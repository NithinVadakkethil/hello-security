import nodemailer from 'nodemailer';
import { EmailProvider, SendEmailInput, SendEmailResult } from './EmailProvider';
import { logger } from '../logger/logger';

export class SmtpEmailProvider implements EmailProvider {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      logger.info(`📧 SMTP Email Provider initialized for host: ${host}`);
    } else {
      logger.warn('📧 SMTP credentials not fully configured. Email Provider running in MOCK mode.');
    }
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || '"Hello Orbit Security" <no-reply@helloorbit.com>';

    if (!this.transporter) {
      logger.info(`[MOCK EMAIL SENT] To: ${input.to} | Subject: ${input.subject}`);
      return {
        success: true,
        providerMessageId: `mock-msg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      };
    }

    try {
      const info = await this.transporter.sendMail({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });

      logger.info(`📧 Email successfully sent to ${input.to}: ${info.messageId}`);
      return {
        success: true,
        providerMessageId: info.messageId,
      };
    } catch (err: any) {
      logger.error(`❌ Failed to send email to ${input.to}: ${err.message}`);
      return {
        success: false,
        error: err.message,
      };
    }
  }
}

export const emailProvider = new SmtpEmailProvider();
