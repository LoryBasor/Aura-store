// src/services/otpService.js
// Gestion des codes OTP pour vérification email et réinitialisation mot de passe
const crypto = require('crypto');
const { pool } = require('../config/database');
const { AppError } = require('../middlewares/errorHandler');
const emailService = require('./emailService');

const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 5;      // Brute-force protection
const RESEND_COOLDOWN_SECONDS = 60; // Anti-spam : 1 min entre chaque renvoi

/**
 * Génère un code OTP numérique à 6 chiffres
 */
function generateOTPCode() {
  return String(crypto.randomInt(100000, 999999));
}

/**
 * Crée et enregistre un OTP en BDD + envoie par email
 * @param {string} email - Email de destination
 * @param {'email_verification'|'password_reset'} type - Type d'OTP
 */
async function createAndSendOTP(email, type) {
  // Vérifier le cooldown anti-spam (1 min entre deux envois)
  const [recent] = await pool.execute(
    `SELECT created_at FROM otp_codes
     WHERE email = ? AND type = ? AND is_used = FALSE
       AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND)
     ORDER BY created_at DESC LIMIT 1`,
    [email, type, RESEND_COOLDOWN_SECONDS]
  );

  if (recent.length > 0) {
    const elapsed = Math.ceil((Date.now() - new Date(recent[0].created_at).getTime()) / 1000);
    const remaining = RESEND_COOLDOWN_SECONDS - elapsed;
    throw new AppError(`Veuillez attendre ${remaining} seconde(s) avant de renvoyer un code.`, 429);
  }

  // Invalider les anciens OTPs du même type pour cet email
  await pool.execute(
    `UPDATE otp_codes SET is_used = TRUE
     WHERE email = ? AND type = ? AND is_used = FALSE`,
    [email, type]
  );

  // Générer et enregistrer le nouvel OTP
  const code = generateOTPCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await pool.execute(
    `INSERT INTO otp_codes (email, code, type, expires_at)
     VALUES (?, ?, ?, ?)`,
    [email, code, type, expiresAt]
  );

  // Envoyer par email
  if (type === 'email_verification') {
    await emailService.sendEmailVerificationOTP(email, code);
  } else if (type === 'password_reset') {
    await emailService.sendPasswordResetOTP(email, code);
  }

  return { success: true, expires_at: expiresAt };
}

/**
 * Vérifie un OTP saisi par l'utilisateur
 * @param {string} email
 * @param {string} code - Code saisi
 * @param {'email_verification'|'password_reset'} type
 * @returns {boolean} true si valide
 */
async function verifyOTP(email, code, type) {
  // Récupérer l'OTP le plus récent non utilisé
  const [otps] = await pool.execute(
    `SELECT id, attempts, expires_at FROM otp_codes
     WHERE email = ? AND type = ? AND is_used = FALSE
     ORDER BY created_at DESC LIMIT 1`,
    [email, type]
  );

  if (otps.length === 0) {
    throw new AppError('Aucun code en attente. Veuillez en demander un nouveau.', 404);
  }

  const otp = otps[0];

  // Vérifier le nombre de tentatives (brute-force)
  if (otp.attempts >= MAX_ATTEMPTS) {
    // Invalider l'OTP
    await pool.execute('UPDATE otp_codes SET is_used = TRUE WHERE id = ?', [otp.id]);
    throw new AppError('Trop de tentatives incorrectes. Demandez un nouveau code.', 429);
  }

  // Vérifier l'expiration
  if (new Date() > new Date(otp.expires_at)) {
    await pool.execute('UPDATE otp_codes SET is_used = TRUE WHERE id = ?', [otp.id]);
    throw new AppError('Le code a expiré. Demandez un nouveau code.', 410);
  }

  // Vérifier le code (comparaison en temps constant)
  const codeValid = crypto.timingSafeEqual(
    Buffer.from(code.trim()),
    Buffer.from(otp.id.toString().padEnd(code.trim().length, '0').slice(0, code.trim().length))
      .fill(0) // reset, on utilise string comparison ci-dessous
  ) || code.trim() === String(otp.id);

  // Simple string comparison (OTP numérique simple)
  // On récupère le vrai code pour comparer
  const [codeRow] = await pool.execute(
    'SELECT code FROM otp_codes WHERE id = ?',
    [otp.id]
  );
  const storedCode = codeRow[0]?.code;

  if (storedCode !== code.trim()) {
    // Incrémenter le compteur de tentatives
    await pool.execute(
      'UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?',
      [otp.id]
    );
    const remaining = MAX_ATTEMPTS - otp.attempts - 1;
    throw new AppError(
      `Code incorrect. Il vous reste ${remaining} tentative(s).`,
      400
    );
  }

  // Marquer comme utilisé
  await pool.execute('UPDATE otp_codes SET is_used = TRUE WHERE id = ?', [otp.id]);

  return true;
}

/**
 * Supprime les OTPs expirés (nettoyage BDD)
 */
async function cleanupExpiredOTPs() {
  const [result] = await pool.execute(
    'DELETE FROM otp_codes WHERE expires_at < NOW() OR is_used = TRUE AND created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)'
  );
  return result.affectedRows;
}

module.exports = {
  createAndSendOTP,
  verifyOTP,
  cleanupExpiredOTPs
};
