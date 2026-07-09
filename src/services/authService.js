// src/services/authService.js
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');
const { generateToken } = require('../config/jwt');
const { slugify } = require('../utils/helpers');
const { AppError } = require('../middlewares/errorHandler');
const subscriptionService = require('./admin/subscriptionService');
const otpService = require('./otpService');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

/**
 * Service d'authentification
 * Gère l'inscription, la connexion et la gestion des utilisateurs
 */
class AuthService {
  /**
   * Inscription d'un nouveau vendeur
   * @param {object} userData - Données utilisateur
   * @returns {object} Utilisateur créé + token JWT
   */
  async register({ email, password, business_name, phone, whatsapp_number }) {
    // Vérifier si l'email existe déjà
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      throw new AppError('Cet email est déjà utilisé', 409);
    }

    // Hasher le mot de passe
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Générer un slug unique pour la boutique
    let store_slug = slugify(business_name);
    let slugSuffix = null;

    // Vérifier unicité du slug
    while (true) {
      const finalSlug = slugSuffix ? `${store_slug}-${slugSuffix}` : store_slug;
      const [slugCheck] = await pool.execute(
        'SELECT id FROM users WHERE store_slug = ?',
        [finalSlug]
      );

      if (slugCheck.length === 0) {
        store_slug = finalSlug;
        break;
      }
      slugSuffix = slugSuffix ? slugSuffix + 1 : 1;
    }

    // Créer l'utilisateur (email_verified = FALSE jusqu'à confirmation OTP)
    const [result] = await pool.execute(
      `INSERT INTO users (email, password_hash, business_name, phone, whatsapp_number, store_slug, email_verified, is_active)
       VALUES (?, ?, ?, ?, ?, ?, FALSE, FALSE)`,
      [email, password_hash, business_name, phone || null, whatsapp_number || null, store_slug]
    );

    const userId = result.insertId;

    // Envoyer l'OTP de vérification email
    await otpService.createAndSendOTP(email, 'email_verification');

    return {
      requiresOTP: true,
      email,
      message: 'Un code de vérification a été envoyé à votre adresse email.'
    };
  }

  /**
   * Connexion d'un utilisateur
   * @param {string} email - Email
   * @param {string} password - Mot de passe
   * @returns {object} Utilisateur + token JWT
   */
  async login(email, password) {
    // Récupérer l'utilisateur
    const [users] = await pool.execute(
      `SELECT id, email, role, password_hash, business_name, store_slug, is_active, email_verified
       FROM users WHERE email = ? AND deleted_at IS NULL`,
      [email]
    );

    if (users.length === 0) {
      throw new AppError('Identifiants incorrects', 401);
    }

    const user = users[0];

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new AppError('Identifiants incorrects', 401);
    }

    // Vérifier si l'email est confirmé (colonne email_verified peut ne pas exister sur anciens comptes)
    if (!user.email_verified && !user.is_active) {
      throw new AppError('EMAIL_NOT_VERIFIED', 403);
    }

    // Incrémenter le compteur de connexions
    await pool.execute(
      'UPDATE users SET login_count = COALESCE(login_count, 0) + 1, last_login_at = NOW() WHERE id = ?',
      [user.id]
    );

    // Générer le token JWT
    const token = generateToken({
      userId: user.id,
      email: user.email
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        business_name: user.business_name,
        store_slug: user.store_slug,
        role: user.role
      },
      token
    };
  }

  /**
   * Vérifie le code OTP et active le compte
   * @param {string} email
   * @param {string} code
   */
  async verifyEmailOTP(email, code) {
    await otpService.verifyOTP(email, code, 'email_verification');

    // Activer le compte
    const [result] = await pool.execute(
      'UPDATE users SET email_verified = TRUE, is_active = TRUE WHERE email = ?',
      [email]
    );

    if (result.affectedRows === 0) {
      throw new AppError('Utilisateur introuvable.', 404);
    }

    // Récupérer l'utilisateur activé pour créer son abonnement
    const [users] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (users.length > 0) {
      const userId = users[0].id;
      // Assigner le plan Business (ID 3) par défaut pour 1 mois
      try {
        await subscriptionService.createSubscription(userId, 3, {
          notes: 'Plan Business offert à l\'inscription (1 mois)'
        });
      } catch (subError) {
        console.error('Erreur création abonnement après vérification OTP:', subError);
      }
    }

    return { success: true, message: 'Compte activé avec succès. Vous pouvez maintenant vous connecter.' };
  }

  /**
   * Renvoie un OTP de vérification email
   */
  async resendEmailOTP(email) {
    const [users] = await pool.execute(
      'SELECT id, email_verified FROM users WHERE email = ? AND deleted_at IS NULL',
      [email]
    );
    if (users.length === 0) throw new AppError('Email introuvable.', 404);
    if (users[0].email_verified) throw new AppError('Cet email est déjà vérifié.', 400);

    await otpService.createAndSendOTP(email, 'email_verification');
    return { success: true, message: 'Nouveau code envoyé.' };
  }

  /**
   * Initie la réinitialisation de mot de passe
   * @param {string} email
   */
  async forgotPassword(email) {
    const [users] = await pool.execute(
      'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL AND is_active = TRUE',
      [email]
    );

    // Réponse identique même si l'email n'existe pas (sécurité anti-enumération)
    if (users.length > 0) {
      await otpService.createAndSendOTP(email, 'password_reset');
    }

    return { success: true, message: 'Si cet email existe, un code de réinitialisation a été envoyé.' };
  }

  /**
   * Vérifie l'OTP de reset et met à jour le mot de passe
   * @param {string} email
   * @param {string} code
   * @param {string} newPassword
   */
  async resetPassword(email, code, newPassword) {
    // Vérifier le code OTP
    await otpService.verifyOTP(email, code, 'password_reset');

    // Hasher le nouveau mot de passe
    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    const [result] = await pool.execute(
      'UPDATE users SET password_hash = ? WHERE email = ? AND is_active = TRUE',
      [newHash, email]
    );

    if (result.affectedRows === 0) {
      throw new AppError('Utilisateur introuvable ou inactif.', 404);
    }

    return { success: true, message: 'Mot de passe réinitialisé avec succès.' };
  }

  /**
   * Récupère les informations d'un utilisateur
   * @param {number} userId - ID utilisateur
   * @returns {object} Informations utilisateur
   */
  async getUserProfile(userId) {

    const user = await pool.execute('SELECT role FROM users WHERE id = ?', [userId]);
    let users = null;
    if(user.role === 'SUPER_ADMIN'){
        users = await pool.execute(`

        SELECT 
          id,
          email,
          business_name,
          phone,
          whatsapp_number,
          created_at
          FROM users
          WHERE id = ?

        `, 
        [userId]
      );
    }
    else {
        users = await pool.execute(
        `
        SELECT 
          s.*,
          u.id,
          u.email,
          u.business_name,
          u.phone,
          u.whatsapp_number,
          u.city,
          u.country,
          u.store_slug,
          u.created_at,
          sp.name as plan_name
        FROM users u
        JOIN subscriptions s ON u.id = s.user_id
        JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE u.id = ? AND (s.status = 'active' OR s.status = 'trial');`,
        [userId]
      );
    }
    if (users.length === 0) {
      throw new AppError('Utilisateur introuvable', 404);
    }

    return users[0][0];
  }

  /**
   * Met à jour le profil utilisateur
   * @param {number} userId - ID utilisateur
   * @param {object} updates - Champs à mettre à jour
   * @returns {object} Utilisateur mis à jour
   */
  async updateProfile(userId, { business_name, phone, whatsapp_number, country, city }) {
    const updates = [];
    const values = [];

    if (business_name !== undefined) {
      updates.push('business_name = ?');
      values.push(business_name);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone);
    }
    if (whatsapp_number !== undefined) {
      updates.push('whatsapp_number = ?');
      values.push(whatsapp_number);
    }
    if (country !== undefined) {
      updates.push('country = ?');
      values.push(country);
    }
    if (city !== undefined) {
      updates.push('city = ?');
      values.push(city);
    }

    if (updates.length === 0) {
      throw new AppError('Aucune donnée à mettre à jour', 400);
    }

    values.push(userId);

    await pool.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return this.getUserProfile(userId);
  }

  /**
   * Change le mot de passe
   * @param {number} userId - ID utilisateur
   * @param {string} oldPassword - Ancien mot de passe
   * @param {string} newPassword - Nouveau mot de passe
   */
  async changePassword(userId, oldPassword, newPassword) {
    const [users] = await pool.execute(
      'SELECT password_hash FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      throw new AppError('Utilisateur introuvable', 404);
    }

    const isValid = await bcrypt.compare(oldPassword, users[0].password_hash);

    if (!isValid) {
      throw new AppError('Ancien mot de passe incorrect', 401);
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await pool.execute(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [newHash, userId]
    );
  }
}

module.exports = new AuthService();