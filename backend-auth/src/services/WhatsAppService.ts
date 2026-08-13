import { PrismaClient } from '@prisma/client';

export interface SendMessageOptions {
  instanceName: string;
  number: string;
  text: string;
  simulateTyping?: boolean;
  minDelayMs?: number;
  maxDelayMs?: number;
}

export interface InstanceStatusResponse {
  instanceName: string;
  status: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';
  phoneNumber?: string | null;
  profileName?: string | null;
  profilePic?: string | null;
  qrCode?: string | null;
}

export class WhatsAppService {
  private prisma: PrismaClient;
  private evoUrl: string;
  private evoKey: string;
  private webhookBaseUrl: string;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || new PrismaClient();
    this.evoUrl = (process.env.EVOLUTION_API_URL || 'http://localhost:8080').replace(/\/$/, '');
    this.evoKey = process.env.EVOLUTION_API_KEY || process.env.EVOLUTION_API_TOKEN || 'stits_global_master_key_2026';
    this.webhookBaseUrl = process.env.STITS_WEBHOOK_URL || 'http://localhost:3003/api/whatsapp/webhook';
  }

  /**
   * Helper para montar headers autenticados para a Evolution API v2
   */
  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'apikey': this.evoKey
    };
  }

  /**
   * Sanitiza e formata número de telefone para o padrão WhatsApp internacional
   */
  public sanitizePhoneNumber(phone: string): string {
    let clean = phone.replace(/\D/g, '');
    // Se for formato brasileiro sem DDI (10 ou 11 dígitos), adiciona 55
    if (clean.length === 10 || clean.length === 11) {
      clean = `55${clean}`;
    }
    return clean;
  }

  /**
   * Helper de delay assíncrono (jitter / pausa humana)
   */
  public async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gera o nome padronizado da instância para multi-tenancy
   */
  public buildInstanceName(tenantId: string, appName: string = 'NEXUS_CRM'): string {
    const cleanApp = appName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanTenant = tenantId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
    return `stits_${cleanApp}_${cleanTenant}`;
  }

  /**
   * Cria ou obtém uma instância para um Tenant específico na Evolution API
   */
  async getOrCreateInstance(tenantId: string, appName: string = 'NEXUS_CRM'): Promise<InstanceStatusResponse> {
    const instanceName = this.buildInstanceName(tenantId, appName);

    // 1. Busca no banco de dados local
    let record = await this.prisma.whatsAppInstance.findUnique({
      where: { instanceName }
    });

    if (!record) {
      record = await this.prisma.whatsAppInstance.create({
        data: {
          tenantId,
          appName,
          instanceName,
          status: 'CONNECTING'
        }
      });
    }

    // 2. Tenta criar na Evolution API (caso ainda não exista lá)
    try {
      const webhookUrl = `${this.webhookBaseUrl}?instance=${instanceName}&tenantId=${tenantId}&app=${appName}`;
      
      const createResponse = await fetch(`${this.evoUrl}/instance/create`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          instanceName,
          token: `token_${instanceName}`,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
          webhook: webhookUrl,
          webhookByEvents: false,
          webhookEvents: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED']
        })
      });

      const createData = await createResponse.json().catch(() => ({}));
      console.log(`[WhatsAppService] Instance creation check for ${instanceName}:`, createResponse.status, createData);

      // Se a criação já devolveu o QR Code direto
      const directQr = createData?.qrcode?.base64 || createData?.base64 || createData?.qrcode || createData?.code;
      if (directQr && typeof directQr === 'string') {
        await this.prisma.whatsAppInstance.updateMany({
          where: { instanceName },
          data: { qrCode: directQr, status: 'CONNECTING' }
        });
      }

    } catch (err: any) {
      console.warn(`[WhatsAppService] Instance already exists or Evolution API check: ${err.message}`);
    }

    // 3. Atualiza estado e retorna status
    return this.refreshInstanceStatus(instanceName);
  }

  /**
   * Consulta o estado atual da conexão e atualiza a persistência
   */
  async refreshInstanceStatus(instanceName: string): Promise<InstanceStatusResponse> {
    let status: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' = 'DISCONNECTED';
    let phoneNumber: string | null = null;
    let profileName: string | null = null;
    let profilePic: string | null = null;
    let qrCode: string | null = null;

    try {
      // Checa estado da conexão
      const stateRes = await fetch(`${this.evoUrl}/instance/connectionState/${instanceName}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (stateRes.ok) {
        const stateData = await stateRes.json();
        const rawState = stateData?.instance?.state || stateData?.state;

        if (rawState === 'open') {
          status = 'CONNECTED';
          if (stateData?.instance?.owner) {
            phoneNumber = stateData.instance.owner.replace(/@.*$/, '');
          }
          if (stateData?.instance?.profileName) {
            profileName = stateData.instance.profileName;
          }
          if (stateData?.instance?.profilePictureUrl) {
            profilePic = stateData.instance.profilePictureUrl;
          }
        } else if (rawState === 'connecting' || rawState === 'qrcode') {
          status = 'CONNECTING';
        } else {
          status = 'DISCONNECTED';
        }
      }

      // Se ainda não estiver conectado, busca o QR Code atualizado
      if (status !== 'CONNECTED') {
        const qrRes = await fetch(`${this.evoUrl}/instance/connect/${instanceName}`, {
          method: 'GET',
          headers: this.getHeaders()
        });

        if (qrRes.ok) {
          const qrData = await qrRes.json();
          const extracted = qrData?.base64 || qrData?.qrcode?.base64 || qrData?.qrcode || qrData?.code || qrData?.pairingCode || null;
          if (extracted && typeof extracted === 'string') {
            qrCode = extracted;
            status = 'CONNECTING';
          }
        }
      }

    } catch (error: any) {
      console.error(`[WhatsAppService] Erro ao consultar status de ${instanceName}:`, error.message);
    }

    // Atualiza no banco
    const updated = await this.prisma.whatsAppInstance.updateMany({
      where: { instanceName },
      data: {
        status,
        phoneNumber,
        profileName,
        profilePic,
        qrCode: status === 'CONNECTED' ? null : qrCode
      }
    });

    return {
      instanceName,
      status,
      phoneNumber,
      profileName,
      profilePic,
      qrCode
    };
  }

  /**
   * Desconecta uma instância (Logout)
   */
  async logoutInstance(instanceName: string): Promise<boolean> {
    try {
      await fetch(`${this.evoUrl}/instance/logout/${instanceName}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });

      await this.prisma.whatsAppInstance.updateMany({
        where: { instanceName },
        data: {
          status: 'DISCONNECTED',
          qrCode: null,
          phoneNumber: null
        }
      });

      return true;
    } catch (err: any) {
      console.error(`[WhatsAppService] Erro ao desconectar ${instanceName}:`, err.message);
      return false;
    }
  }

  /**
   * Disparo Seguro de Mensagem com Anti-Ban (Digitação Humana + Jitter Delay)
   */
  async sendWithAntiBan(options: SendMessageOptions): Promise<{ success: boolean; data?: any; error?: string }> {
    const { 
      instanceName, 
      number, 
      text, 
      simulateTyping = true,
      minDelayMs = 2000,
      maxDelayMs = 5000
    } = options;

    if (!number || !text) {
      return { success: false, error: 'Número de telefone e texto são obrigatórios.' };
    }

    const cleanNumber = this.sanitizePhoneNumber(number);

    try {
      // 1. Simulação de Comportamento Humano: Status "Digitando..."
      if (simulateTyping) {
        try {
          await fetch(`${this.evoUrl}/chat/sendPresence/${instanceName}`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
              number: cleanNumber,
              presence: 'composing',
              delay: 3500
            })
          });
        } catch (e) {
          // Ignora se presença falhar, prossegue com o envio
        }

        // Simula o tempo que uma pessoa levaria para digitar
        const typingDelay = Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
        console.log(`[Anti-Ban] Simulando digitação para ${cleanNumber} (${typingDelay}ms)...`);
        await this.sleep(typingDelay);
      }

      // 2. Envio do Texto
      const endpoint = `${this.evoUrl}/message/sendText/${instanceName}`;
      console.log(`[WhatsAppService] Disparando mensagem para ${cleanNumber} via ${instanceName}...`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          number: cleanNumber,
          text: text,
          options: {
            delay: 1200,
            presence: 'composing',
            linkPreview: true
          }
        })
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error(`❌ [WhatsAppService] Falha na Evolution API:`, responseData);
        return { success: false, error: responseData?.message || 'Erro na Evolution API' };
      }

      console.log(`✅ [WhatsAppService] Mensagem enviada com sucesso para ${cleanNumber}!`);
      return { success: true, data: responseData };

    } catch (err: any) {
      console.error(`❌ [WhatsAppService] Exceção crítica no envio:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Disparo em Lote com Fila e Jitter de Segurança (Anti-Ban estendido para campanhas)
   */
  async sendBatchWithProtection(
    instanceName: string,
    items: Array<{ number: string; text: string; leadName?: string }>,
    intervalRangeSeconds: [number, number] = [20, 45],
    onProgress?: (progress: { current: number; total: number; success: boolean; leadName?: string }) => void
  ): Promise<{ total: number; sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      console.log(`[Batch ${i + 1}/${items.length}] Processando envio para ${item.leadName || item.number}...`);

      const res = await this.sendWithAntiBan({
        instanceName,
        number: item.number,
        text: item.text,
        simulateTyping: true,
        minDelayMs: 3000,
        maxDelayMs: 6000
      });

      if (res.success) {
        sent++;
      } else {
        failed++;
      }

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: items.length,
          success: res.success,
          leadName: item.leadName
        });
      }

      // Se ainda houver mensagens, aguarda o intervalo humano de segurança entre contatos
      if (i < items.length - 1) {
        const [minSec, maxSec] = intervalRangeSeconds;
        const randomSeconds = Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec;
        console.log(`⏳ [Anti-Ban Queue] Aguardando ${randomSeconds}s antes do próximo disparo...`);
        await this.sleep(randomSeconds * 1000);
      }
    }

    return { total: items.length, sent, failed };
  }
}
