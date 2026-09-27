// Nodemailer email adapter
import nodemailer from 'nodemailer';
import type { EmailProvider, EmailMessage } from './index.js';

export class NodemailerEmailProvider implements EmailProvider {
  private transporter: ReturnType<typeof nodemailer.createTransport>;

  constructor(
    transport: string,
    private readonly from: string,
  ) {
    this.transporter = nodemailer.createTransport({
      url: transport,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 90000,
    });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  }
}
