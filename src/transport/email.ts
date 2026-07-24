import nodemailer from 'nodemailer';
import { loadCredentials, CredentialStore } from '../core/credentials';
import { logger, maskEmail } from '../core/logger';
import { DeliveryResult, SendEmailOptions, Transport } from './types';

export class EmailTransport implements Transport {
  private creds: CredentialStore | null = null;

  constructor(customCreds?: CredentialStore) {
    this.creds = customCreds || loadCredentials();
  }

  private getTransporter() {
    if (!this.creds || (!this.creds.smtpHost && !this.creds.smtpUser)) {
      throw new Error('未检测到有效的 SMTP/邮箱传输凭据，请运行 kindle setup 进行绑定。');
    }

    const host = this.creds.smtpHost || 'smtp.gmail.com';
    const port = this.creds.smtpPort || 587;
    const secure = port === 465;

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: this.creds.smtpUser,
        pass: this.creds.smtpPass
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000
    });
  }

  async verify(): Promise<boolean> {
    try {
      const transporter = this.getTransporter();
      await transporter.verify();
      return true;
    } catch (error) {
      logger.warn(`SMTP 凭据连通性验证失败: ${(error as Error).message}`);
      return false;
    }
  }

  async send(options: SendEmailOptions): Promise<DeliveryResult> {
    try {
      const transporter = this.getTransporter();
      const fromAddr = this.creds?.smtpUser || 'kindle-bridge@local';

      logger.info(`📧 正在发送投递邮件...`);
      logger.info(`  发件人: ${maskEmail(fromAddr)}`);
      logger.info(`  收件人 (Kindle): ${maskEmail(options.to)}`);
      logger.info(`  主题: ${options.subject}`);
      logger.info(`  附件: ${options.attachments.map(a => a.filename).join(', ')}`);

      const info = await transporter.sendMail({
        from: fromAddr,
        to: options.to,
        subject: options.subject,
        text: options.text || `Sent via Kindle Bridge at ${new Date().toISOString()}`,
        html: options.html,
        attachments: options.attachments.map(a => ({
          filename: a.filename,
          path: a.path
        }))
      });

      logger.info(`✅ 邮件发送成功！Message ID: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId,
        providerAcceptedTime: new Date().toISOString()
      };
    } catch (error) {
      const errMsg = (error as Error).message;
      logger.error(`❌ 邮件发送失败: ${errMsg}`);
      return {
        success: false,
        error: errMsg
      };
    }
  }
}
