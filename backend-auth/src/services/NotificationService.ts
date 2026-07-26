import { Resend } from 'resend';

export class NotificationService {
  private resend: Resend;
  private evoUrl: string;
  private evoInstance: string;
  private evoToken: string;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY || 're_YxZ9y82M_95rZ1qG6M3qWc3Kx2Lp5J67r');
    this.evoUrl = process.env.EVOLUTION_API_URL || '';
    this.evoInstance = process.env.EVOLUTION_API_INSTANCE || '';
    this.evoToken = process.env.EVOLUTION_API_TOKEN || '';
  }

  /**
   * Envia uma mensagem de WhatsApp utilizando a Evolution API
   */
  async sendWhatsApp(number: string, text: string): Promise<boolean> {
    if (!this.evoUrl || !this.evoInstance || !this.evoToken) {
      console.warn('⚠️ [WhatsApp] Credenciais da Evolution API não estão configuradas no .env');
      // Vamos tentar simular ou falhar amigavelmente se não estiver configurado, 
      // mas como o usuário diz que já tem, ele precisa preencher.
    }

    try {
      // A Evolution API exige que o número venha formatado com o DDI (ex: 5511999999999)
      const cleanNumber = number.replace(/\D/g, ''); 

      const endpoint = `${this.evoUrl}/message/sendText/${this.evoInstance}`;
      console.log(`[WhatsApp] Tentando enviar mensagem para ${cleanNumber} via ${endpoint}...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.evoToken
        },
        body: JSON.stringify({
          number: cleanNumber,
          text: text
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const responseData = await response.json();

      if (!response.ok) {
        console.error(`❌ [WhatsApp] Erro na resposta da Evolution API:`, responseData);
        return false;
      }

      console.log(`✅ [WhatsApp] Mensagem enviada com sucesso para ${cleanNumber}.`);
      return true;

    } catch (error: any) {
      console.error('❌ [WhatsApp] Falha crítica de conexão com a Evolution API:', error.message);
      return false;
    }
  }

  /**
   * Envia um e-mail de recuperação utilizando Resend
   */
  async sendRecoveryEmail(email: string, userName: string, resetLink: string): Promise<boolean> {
    try {
      await this.resend.emails.send({
        from: 'Gestor-Nex <suporte@gestornex.fidycard.com.br>',
        to: email,
        subject: 'Recuperação de Senha - GestorNex / StitsOS',
        html: `<p>Olá, ${userName}</p>
               <p>Você solicitou a recuperação da sua senha.</p>
               <p>Clique no link abaixo para criar uma nova senha:</p>
               <a href="${resetLink}">Resetar minha senha</a>
               <p>Este link expira em 1 hora.</p>`
      });
      console.log(`✅ [E-mail] Link de reset enviado para ${email}.`);
      return true;
    } catch (e: any) {
      console.error("❌ [E-mail] Erro ao enviar pelo Resend:", e.message);
      return false;
    }
  }
}
