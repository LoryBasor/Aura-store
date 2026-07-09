// src/services/emailService.js
// Service d'envoi d'emails via Nodemailer
const nodemailer = require('nodemailer');

let transporter = null;

/**
 * Initialise et retourne le transporter Nodemailer (singleton)
 */
function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: parseInt(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  return transporter;
}

/**
 * Envoie un email générique
 * @param {object} options - { to, subject, html, text }
 */
async function sendEmail({ to, subject, html, text }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[EmailService] SMTP non configuré. Email non envoyé à:', to);
    console.warn('[EmailService] Sujet:', subject);
    return false;
  }

  try {
    const info = await getTransporter().sendMail({
      from: `"Aura Store" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, '')
    });
    console.log(`[EmailService] Email envoyé à ${to}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('[EmailService] Erreur envoi email:', error.message);
    return false;
  }
}

/**
 * Envoie un OTP de vérification d'email
 */
async function sendEmailVerificationOTP(email, otp) {
  return sendEmail({
    to: email,
    subject: 'Confirmez votre adresse email — Aura Store',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f8f9fa; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #5C6C73; font-size: 28px; margin: 0;">Aura Store</h1>
          <p style="color: #888; font-size: 14px;">Confirmez votre compte</p>
        </div>
        <div style="background: white; border-radius: 8px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <h2 style="color: #333; font-size: 20px; margin-top: 0;">Votre code de confirmation</h2>
          <p style="color: #666; font-size: 15px;">Entrez ce code pour confirmer votre adresse email :</p>
          <div style="text-align: center; margin: 24px 0;">
            <span style="display: inline-block; background: #5C6C73; color: white; font-size: 36px; font-weight: bold; letter-spacing: 12px; padding: 16px 24px; border-radius: 8px;">${otp}</span>
          </div>
          <p style="color: #999; font-size: 13px; text-align: center;">⏰ Ce code expire dans <strong>5 minutes</strong>.</p>
          <p style="color: #999; font-size: 13px; text-align: center;">Si vous n'avez pas créé de compte, ignorez cet email.</p>
        </div>
        <p style="text-align: center; color: #bbb; font-size: 12px; margin-top: 16px;">© ${new Date().getFullYear()} Aura Store</p>
      </div>
    `
  });
}

/**
 * Envoie un OTP de réinitialisation de mot de passe
 */
async function sendPasswordResetOTP(email, otp) {
  return sendEmail({
    to: email,
    subject: 'Réinitialisation de mot de passe — Aura Store',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f8f9fa; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #5C6C73; font-size: 28px; margin: 0;">Aura Store</h1>
          <p style="color: #888; font-size: 14px;">Sécurité du compte</p>
        </div>
        <div style="background: white; border-radius: 8px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <h2 style="color: #333; font-size: 20px; margin-top: 0;">Réinitialisation de mot de passe</h2>
          <p style="color: #666; font-size: 15px;">Entrez ce code pour réinitialiser votre mot de passe :</p>
          <div style="text-align: center; margin: 24px 0;">
            <span style="display: inline-block; background: #e74c3c; color: white; font-size: 36px; font-weight: bold; letter-spacing: 12px; padding: 16px 24px; border-radius: 8px;">${otp}</span>
          </div>
          <p style="color: #999; font-size: 13px; text-align: center;">⏰ Ce code expire dans <strong>5 minutes</strong>.</p>
          <p style="color: #999; font-size: 13px; text-align: center;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email et sécurisez votre compte.</p>
        </div>
        <p style="text-align: center; color: #bbb; font-size: 12px; margin-top: 16px;">© ${new Date().getFullYear()} Aura Store</p>
      </div>
    `
  });
}

/**
 * Envoie une notification d'expiration d'abonnement
 */
async function sendSubscriptionExpiredEmail(email, businessName, planName) {
  return sendEmail({
    to: email,
    subject: 'Votre abonnement a expiré — Aura Store',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f8f9fa; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #5C6C73; font-size: 28px; margin: 0;">Aura Store</h1>
        </div>
        <div style="background: white; border-radius: 8px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <h2 style="color: #e67e22; font-size: 20px; margin-top: 0;">⚠️ Abonnement expiré</h2>
          <p style="color: #555; font-size: 15px;">Bonjour <strong>${businessName}</strong>,</p>
          <p style="color: #666; font-size: 14px;">Votre abonnement <strong>${planName}</strong> a expiré. Votre boutique a été automatiquement replacée sur le <strong>plan Gratuit</strong>.</p>
          <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 12px; margin: 16px 0;">
            <p style="color: #856404; font-size: 13px; margin: 0;">📦 Limite de 5 produits visibles sur le marketplace<br>📊 Statistiques avancées désactivées<br>✨ Personnalisation désactivée</p>
          </div>
          <a href="${process.env.APP_URL}/subscription" style="display: block; text-align: center; background: #5C6C73; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 16px;">Renouveler mon abonnement</a>
        </div>
        <p style="text-align: center; color: #bbb; font-size: 12px; margin-top: 16px;">© ${new Date().getFullYear()} Aura Store</p>
      </div>
    `
  });
}

/**
 * Notifie l'admin d'un nouveau signalement
 */
async function sendReportNotificationToAdmin(type, details) {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
  if (!adminEmail) return false;

  const typeLabel = type === 'product' ? 'produit' : 'boutique';
  return sendEmail({
    to: adminEmail,
    subject: `Nouveau signalement de ${typeLabel} — Aura Store`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #e74c3c;">🚨 Nouveau signalement de ${typeLabel}</h2>
        <table style="width:100%; border-collapse: collapse; font-size: 14px;">
          ${Object.entries(details).map(([k, v]) => `<tr><td style="padding:6px;font-weight:bold;color:#555;">${k}</td><td style="padding:6px;color:#333;">${v}</td></tr>`).join('')}
        </table>
        <a href="${process.env.APP_URL}/admin/reports" style="display:inline-block;background:#e74c3c;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:16px;">Voir le signalement</a>
      </div>
    `
  });
}

/**
 * Notifie l'admin d'un nouveau message
 */
async function sendMessageNotificationToAdmin(senderName, subject) {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
  if (!adminEmail) return false;

  return sendEmail({
    to: adminEmail,
    subject: `Nouveau message de ${senderName} — Aura Store`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #5C6C73;">💬 Nouveau message reçu</h2>
        <p><strong>De :</strong> ${senderName}</p>
        <p><strong>Sujet :</strong> ${subject}</p>
        <a href="${process.env.APP_URL}/admin/messages" style="display:inline-block;background:#5C6C73;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:16px;">Voir le message</a>
      </div>
    `
  });
}

module.exports = {
  sendEmail,
  sendEmailVerificationOTP,
  sendPasswordResetOTP,
  sendSubscriptionExpiredEmail,
  sendReportNotificationToAdmin,
  sendMessageNotificationToAdmin
};
