import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';

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
    let user = await prisma.user.findUnique({
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

    // Auto-cadastro: se o usuário não for achado, criamos na hora (lógica do legado GestorNex)
    if (!user) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user = await prisma.user.create({
        data: {
          name: email.split('@')[0], // Nome genérico a partir do e-mail
          email: email,
          password: hashedPassword,
          role: 'USER'
        },
        include: {
          tenant: {
            include: { apps: { include: { app: true } } }
          }
        }
      });
    } else {
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }
    }

    // Se o usuário for CEO (não tem tenant específico, vê todos)
    let accessibleApps: string[] = [];
    if (user.role === 'CEO') {
      const allApps = await prisma.app.findMany();
      accessibleApps = allApps.map(a => a.name);
    } else if (user.tenant) {
      accessibleApps = user.tenant.apps.map(ta => ta.app.name);
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
    const { name, email, password } = req.body;
    
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
