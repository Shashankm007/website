import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { AppConfig } from '../config/configuration';

/**
 * Transactional email via SMTP (nodemailer). In dev with no SMTP creds,
 * emails are logged to the console instead of sent.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(private readonly config: ConfigService) {
    const smtp = this.config.get<AppConfig['smtp']>('smtp')!;
    this.from = smtp.from;
    this.frontendUrl = this.config.get<string>('frontendUrl')!;

    if (smtp.user && smtp.pass) {
      this.transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.port === 465,
        auth: { user: smtp.user, pass: smtp.pass },
      });
    } else {
      this.transporter = null;
      this.logger.warn('SMTP not configured — emails will be logged, not sent.');
    }
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      this.logger.debug(`[MAIL:dev] To: ${to} | ${subject}\n${html}`);
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
      this.logger.log(`Sent "${subject}" to ${to}`);
    } catch (err) {
      this.logger.error(`Failed to send "${subject}" to ${to}: ${(err as Error).message}`);
    }
  }

  // -- Templates -------------------------------------------------------------

  private layout(title: string, body: string): string {
    return `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#f6f7f9;padding:24px;color:#0f172a">
      <div style="max-width:560px;margin:auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e8f0">
        <h1 style="font-size:20px;margin:0 0 8px">🛠️ HashTag Creations</h1>
        <h2 style="font-size:16px;color:#334155">${title}</h2>
        ${body}
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
        <p style="font-size:12px;color:#94a3b8">You received this email from HashTag Creations. If this wasn't you, ignore it.</p>
      </div></body></html>`;
  }

  private button(href: string, label: string): string {
    return `<a href="${href}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;margin:12px 0">${label}</a>`;
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const url = `${this.frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
    await this.send(
      to,
      'Verify your email',
      this.layout('Confirm your email address', `<p>Welcome! Please confirm your email to activate your account.</p>${this.button(url, 'Verify email')}<p style="font-size:12px;color:#94a3b8">Link expires in 24 hours.</p>`),
    );
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const url = `${this.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await this.send(
      to,
      'Reset your password',
      this.layout('Reset your password', `<p>We received a request to reset your password.</p>${this.button(url, 'Reset password')}<p style="font-size:12px;color:#94a3b8">Link expires in 1 hour. If you didn't request this, ignore this email.</p>`),
    );
  }

  async sendOrderConfirmation(to: string, order: { orderNumber: string; totalCents: number }): Promise<void> {
    const url = `${this.frontendUrl}/account/orders`;
    const total = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(order.totalCents / 100);
    await this.send(
      to,
      `Order ${order.orderNumber} confirmed`,
      this.layout('Thanks for your order!', `<p>Your order <strong>${order.orderNumber}</strong> has been received and paid.</p><p>Total: <strong>${total}</strong></p>${this.button(url, 'View order')}`),
    );
  }

  async sendOrderStatusUpdate(to: string, order: { orderNumber: string; status: string }): Promise<void> {
    const url = `${this.frontendUrl}/account/orders`;
    await this.send(
      to,
      `Order ${order.orderNumber} — ${order.status}`,
      this.layout('Order update', `<p>Your order <strong>${order.orderNumber}</strong> is now <strong>${order.status}</strong>.</p>${this.button(url, 'Track order')}`),
    );
  }
}
