import nodemailer from 'nodemailer';
import { config } from './config';

const smtpConfigured = Boolean(config.smtp.host && config.smtp.user);

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    })
  : null;

/**
 * Envoie un email de validation à l'administrateur.
 * Si le SMTP n'est pas configuré, les liens sont affichés dans la console
 * du serveur pour que la validation reste possible en développement.
 */
export async function sendAdminValidationEmail(opts: {
  subject: string;
  intro: string;
  details: Record<string, string>;
  approveUrl: string;
  rejectUrl: string;
}) {
  const detailRows = Object.entries(opts.details)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#666;">${k}</td><td style="padding:4px 0;"><strong>${v}</strong></td></tr>`
    )
    .join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;">
      <h2 style="color:#0f766e;">Mekano — ${opts.subject}</h2>
      <p>${opts.intro}</p>
      <table style="border-collapse:collapse;margin:12px 0;">${detailRows}</table>
      <p style="margin:24px 0;">
        <a href="${opts.approveUrl}"
           style="background:#0f766e;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;">
          ✅ Valider
        </a>
        &nbsp;&nbsp;
        <a href="${opts.rejectUrl}"
           style="background:#dc2626;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;">
          ❌ Refuser
        </a>
      </p>
      <p style="color:#999;font-size:12px;">Email automatique envoyé par l'API Mekano.</p>
    </div>`;

  if (!transporter) {
    console.log('─'.repeat(60));
    console.log(`[MAIL non configuré] À : ${config.adminEmail}`);
    console.log(`Sujet : Mekano — ${opts.subject}`);
    console.log(`Valider : ${opts.approveUrl}`);
    console.log(`Refuser : ${opts.rejectUrl}`);
    console.log('─'.repeat(60));
    return;
  }

  try {
    await transporter.sendMail({
      from: `"Mekano" <${config.smtp.user}>`,
      to: config.adminEmail,
      subject: `Mekano — ${opts.subject}`,
      html,
    });
    console.log(`Email de validation envoyé à ${config.adminEmail}`);
  } catch (err) {
    console.error('Échec envoi email admin :', err);
    console.log(`Lien de validation (secours) : ${opts.approveUrl}`);
  }
}
