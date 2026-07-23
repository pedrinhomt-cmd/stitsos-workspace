import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_YxZ9y82M_95rZ1qG6M3qWc3Kx2Lp5J67r'); // Substituir pela chave correta


const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3003;
const JWT_SECRET = process.env.JWT_SECRET || 'stits-super-secret-key-2026';

// Proteções de Segurança Enterprise
app.use(helmet({ crossOriginResourcePolicy: false })); // Permite CORS cross-origin
app.use(cors({
  origin: '*', // Permite de qualquer site (GestorNex)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// Preflight handled globally by app.use(cors()) above
app.use(express.json());

// Limite de Requisições (Anti Brute-Force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // limite de 10 tentativas por IP
  message: { error: 'Muitas tentativas de login. Bloqueio de segurança ativado por 15 minutos.' }
});

// 1. Endpoint de Login (SSO) com Anti Brute-Force
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const email = req.body.email?.trim();
    const password = req.body.password?.trim();
    
    // Busca usuário e inclui o tenant e os apps que ele tem acesso
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        tenant: {
          include: {
            apps: {
              include: { app: true }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    let accessibleApps: string[] = [];
    if (user.role === 'CEO') {
      const allApps = await prisma.app.findMany();
      accessibleApps = allApps.map(a => a.name);
    } else if (user.tenant) {
      accessibleApps = user.tenant.apps.map(ta => ta.app.name);
    }

    // Por padrão, libera acesso ao GestorNex para todos os usuários cadastrados
    if (!accessibleApps.includes('GestorNex')) {
      accessibleApps.push('GestorNex');
    }

    // Gera o Token JWT
    const token = jwt.sign(
      { 
        userId: user.id,
        sub: user.id,
        email: user.email,
        role: user.role, 
        tenantId: user.tenantId,
        accessibleApps 
      }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenant: user.tenant ? {
          name: user.tenant.name,
          plan: user.tenant.plan
        } : null,
        accessibleApps
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// 1.5 Endpoint de Cadastro (Register)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, whatsapp } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'E-mail já está em uso.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        whatsapp,
        password: hashedPassword,
        role: 'USER'
      }
    });

    res.status(201).json({ message: 'Usuário cadastrado com sucesso!', userId: user.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor ao registrar usuário' });
  }
});

// Middleware de Autenticação
const authMiddleware = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// 1.6 Endpoint de Alteração de Senha
app.put('/api/auth/password', authMiddleware, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Senha atualizada com sucesso!' });
  } catch (error) {
    console.error('Erro ao atualizar senha:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao atualizar a senha.' });
  }
});

// 1.7.1 Solicitacao de Recuperacao de Senha (Forgot Password)
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email, channel } = req.body;
    if (!email) return res.status(400).json({ error: 'E-mail é obrigatório.' });

    // Busca o usuário pelo e-mail principal OU pelo e-mail de recuperação
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email },
          { recoveryEmail: email }
        ]
      }
    });

    if (!user) {
      // Retorna sucesso de forma genérica para evitar enumeração de contas (Segurança)
      return res.json({ message: 'Se a conta existir, um link de recuperação foi enviado.' });
    }

    if (channel === 'WHATSAPP' && !user.whatsapp) {
      return res.status(400).json({ error: 'Não há um número de WhatsApp cadastrado para esta conta.' });
    }

    // Gera um token aleatório único
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hora de validade

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpires
      }
    });

    // Envia o link
    const resetLink = `https://gestornex.com.br/reset-password?token=${resetToken}`;
    
    if (channel === 'WHATSAPP') {
      try {
        const evoUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
        const evoInstance = process.env.EVOLUTION_API_INSTANCE || 'Evolution';
        const evoToken = process.env.EVOLUTION_API_TOKEN || '';
        
        await fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evoToken
          },
          body: JSON.stringify({
            number: user.whatsapp,
            text: `Olá ${user.name},\n\nVocê solicitou a recuperação da sua senha no StitsOS.\n\nAcesse o link abaixo para criar uma nova senha:\n${resetLink}\n\nEste link expira em 1 hora.`
          })
        });
      } catch (e) {
        console.error("Erro ao enviar whatsapp pela Evolution API:", e);
      }
      console.log(`[RECOVERY] WhatsApp de reset enviado para ${user.whatsapp}. Token: ${resetToken}`);
    } else {
      // Tentativa de envio com Resend (em produção precisará de um domínio verificado ou enviar para onbording)
      try {
        await resend.emails.send({
          from: 'Gestor-Nex <onboarding@resend.dev>',
          to: email, // O e-mail que o usuário digitou (pode ser o principal ou o de recuperação)
          subject: 'Recuperação de Senha - GestorNex',
          html: `<p>Olá, ${user.name}</p>
                 <p>Você solicitou a recuperação da sua senha.</p>
                 <p>Clique no link abaixo para criar uma nova senha:</p>
                 <a href="${resetLink}">Resetar minha senha</a>
                 <p>Este link expira em 1 hora.</p>`
        });
      } catch (e) {
        console.error("Erro ao enviar email pelo resend:", e);
      }
      console.log(`[RECOVERY] E-mail de reset enviado para ${email}. Token: ${resetToken}`);
    }

    res.json({ message: 'Se a conta existir, um link de recuperação foi enviado.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno ao processar a recuperação.' });
  }
});

// 1.7.2 Resetar a Senha (Usando o Token)
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Token inválido ou senha muito curta.' });
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: { gt: new Date() } // Token ainda não expirou
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Link de recuperação inválido ou expirado.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null
      }
    });

    res.json({ message: 'Sua senha foi redefinida com sucesso! Você já pode fazer login.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno ao redefinir a senha.' });
  }
});

// 1.7.3 Gerenciar E-mails (Principal e Recuperação)
app.put('/api/auth/profile/emails', authMiddleware, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;
    const { email, recoveryEmail } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'O e-mail principal é obrigatório.' });
    }

    // Verificar se o novo e-mail principal já está em uso por outro usuário
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail && existingEmail.id !== userId) {
      return res.status(400).json({ error: 'Este e-mail principal já está em uso por outra conta.' });
    }

    // Verificar se o novo e-mail de recuperação já está em uso
    if (recoveryEmail) {
      const existingRecovery = await prisma.user.findFirst({ where: { recoveryEmail } });
      if (existingRecovery && existingRecovery.id !== userId) {
        return res.status(400).json({ error: 'Este e-mail de recuperação já está associado a outra conta.' });
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { 
        email,
        recoveryEmail: recoveryEmail || null
      }
    });

    res.json({ message: 'Preferências de e-mail atualizadas com sucesso!' });
  } catch (error) {
    console.error('Erro ao atualizar e-mails:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao atualizar e-mails.' });
  }
});


// 1.8 Rotas de Gerenciamento de Apps (Vitrine Dinâmica)
app.get('/api/apps', authMiddleware, async (req: any, res: any) => {
  try {
    const apps = await prisma.app.findMany({
      where: { isActive: true }
    });
    res.json(apps);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar aplicativos' });
  }
});

app.post('/api/apps', authMiddleware, async (req: any, res: any) => {
  if (req.user.role !== 'CEO') return res.status(403).json({ error: 'Acesso negado' });
  try {
    const data = req.body;
    const newApp = await prisma.app.create({ data });
    res.status(201).json(newApp);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar aplicativo' });
  }
});

app.put('/api/apps/:id', authMiddleware, async (req: any, res: any) => {
  if (req.user.role !== 'CEO') return res.status(403).json({ error: 'Acesso negado' });
  try {
    const updated = await prisma.app.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar aplicativo' });
  }
});

// 2. Rota para o CEO listar todos os Tenants (Dashboard Administrativo)
app.get('/api/tenants', authMiddleware, async (req: any, res: any) => {
  if (req.user.role !== 'CEO') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const tenants = await prisma.tenant.findMany({
    include: {
      apps: { include: { app: true } }
    }
  });

  // Formata a resposta para o frontend
  const formatted = tenants.map(t => ({
    id: t.id,
    name: t.name,
    docType: t.docType,
    doc: t.doc,
    plan: t.plan,
    status: t.status,
    apps: t.apps.map(ta => ta.app.name)
  }));

  res.json(formatted);
});

// 3. Rota de Seed (Apenas para criar os dados iniciais do banco!)
app.post('/api/seed', async (req, res) => {
  try {
    // Cria Apps
    const appMabon = await prisma.app.create({ data: { name: 'Mabon', category: 'Deep Tech & Social' } });
    const appZion = await prisma.app.create({ data: { name: 'Zion', category: 'Deep Tech & Social' } });
    const appSoySim = await prisma.app.create({ data: { name: 'SoySim AI', category: 'Agronegócio' } });

    // Cria Tenant
    const tenantFazenda = await prisma.tenant.create({
      data: {
        name: 'Fazendas Nova Era Ltda',
        docType: 'CNPJ',
        doc: '45.123.000/0001-99',
        plan: 'Anual (Enterprise)',
        apps: {
          create: [
            { appId: appSoySim.id },
            { appId: appMabon.id } // Fazenda Nova Era tem acesso ao Mabon e SoySim
          ]
        }
      }
    });

    // Hash da senha
    const hashedPassword = await bcrypt.hash('123456', 10);

    // Cria Usuário Cliente
    await prisma.user.create({
      data: {
        name: 'Carlos Fazendeiro',
        email: 'carlos@novaera.com',
        password: hashedPassword,
        role: 'USER',
        tenantId: tenantFazenda.id
      }
    });

    // Cria Usuário CEO (Mestre da Stits)
    await prisma.user.create({
      data: {
        name: 'CEO Stits',
        email: 'ceo@stits.com.br',
        password: hashedPassword,
        role: 'CEO'
      }
    });

    res.json({ message: 'Banco populado com sucesso! Logins: carlos@novaera.com e ceo@stits.com.br (Senha: 123456)' });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Stits Backend SSO rodando na porta ${PORT}`);
});
