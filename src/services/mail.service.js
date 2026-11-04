const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const {
  buildConfirmationEmail,
  buildReminder24hEmail,
  buildReminder30mEmail
} = require('../templates/emails');

class MailService {
  constructor() {
    this.transporter = null;
  }

  _getProvider() {
    return (process.env.EMAIL_PROVIDER || 'smtp').trim().toLowerCase();
  }

  _getFromHeader() {
    const fromName =
      process.env.EMAIL_FROM_NAME || 'Estudiantes Embajadores de Google 2026 - UPTEX';
    const fromAddress =
      process.env.EMAIL_FROM_ADDRESS ||
      process.env.SMTP_USER ||
      'no-reply@gsa-uptex.org';
    return `"${fromName}" <${fromAddress}>`;
  }

  _hasSmtpCredentials() {
    const user = (process.env.SMTP_USER || '').trim();
    const pass = (process.env.SMTP_PASS || '').trim();
    return Boolean(
      user &&
        pass &&
        !user.includes('tu-correo@') &&
        !pass.includes('xxxx')
    );
  }

  _hasResendCredentials() {
    const key = (process.env.RESEND_API_KEY || '').trim();
    return Boolean(key && !key.includes('tu_api_key'));
  }

  _getSmtpTransporter() {
    if (this.transporter) return this.transporter;

    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const secure =
      process.env.SMTP_SECURE !== undefined
        ? process.env.SMTP_SECURE === 'true'
        : port === 465;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER.trim(),
        pass: process.env.SMTP_PASS.replace(/\s+/g, '') // Quita espacios de la contraseña de aplicación de 16 letras
      }
    });

    return this.transporter;
  }

  /**
   * Envía un correo usando el proveedor configurado en .env (smtp o resend).
   * Si en entorno local aún no se configuran credenciales de correo, guarda una vista previa en data/outbox/
   * para facilitar las pruebas locales inmediatas.
   */
  async sendEmail({ to, subject, html, text, tag = 'general' }) {
    const provider = this._getProvider();

    if (provider === 'resend' && this._hasResendCredentials()) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: this._getFromHeader(),
          to: [to],
          subject,
          html,
          text
        })
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Error en Resend API (${response.status}): ${errBody}`);
      }

      const data = await response.json();
      console.log(`📧 [Resend] Correo "${tag}" enviado a ${to} (ID: ${data.id})`);
      return { provider: 'resend', messageId: data.id };
    }

    if (provider === 'smtp' && this._hasSmtpCredentials()) {
      const transporter = this._getSmtpTransporter();
      const info = await transporter.sendMail({
        from: this._getFromHeader(),
        to,
        subject,
        html,
        text
      });

      console.log(`📧 [SMTP] Correo "${tag}" enviado a ${to} (ID: ${info.messageId})`);
      return { provider: 'smtp', messageId: info.messageId };
    }

    // Modo simulación local cuando aún no se han llenado SMTP_PASS o RESEND_API_KEY en .env
    const outboxDir = path.join(__dirname, '../../data/outbox');
    if (!fs.existsSync(outboxDir)) {
      fs.mkdirSync(outboxDir, { recursive: true });
    }
    const safeEmail = String(to).replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${Date.now()}_${tag}_${safeEmail}.html`;
    const filePath = path.join(outboxDir, filename);
    fs.writeFileSync(filePath, html, 'utf8');

    console.log(
      `🧪 [Modo Simulación Local - Sin credenciales SMTP/Resend en .env] Correo "${tag}" para ${to} guardado en: data/outbox/${filename}`
    );
    return { provider: 'local-outbox', filePath };
  }

  async sendConfirmation(registration) {
    const { subject, html, text } = buildConfirmationEmail(registration);
    return this.sendEmail({
      to: registration.correo,
      subject,
      html,
      text,
      tag: 'confirmacion'
    });
  }

  async sendReminder24h(registration) {
    const { subject, html, text } = buildReminder24hEmail(registration);
    return this.sendEmail({
      to: registration.correo,
      subject,
      html,
      text,
      tag: 'recordatorio-24h'
    });
  }

  async sendReminder30m(registration) {
    const { subject, html, text } = buildReminder30mEmail(registration);
    return this.sendEmail({
      to: registration.correo,
      subject,
      html,
      text,
      tag: 'recordatorio-30min'
    });
  }
}

module.exports = new MailService();
