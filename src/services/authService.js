// src/services/authService.js
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');
const { generateToken } = require('../config/jwt');
const { slugify } = require('../utils/helpers');
const { AppError } = require('../middlewares/errorHandler');

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

    // Créer l'utilisateur
    const [result] = await pool.execute(
      `INSERT INTO users (email, password_hash, business_name, phone, whatsapp_number, store_slug)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [email, password_hash, business_name, phone || null, whatsapp_number || null, store_slug]
    );

    // Récupérer l'utilisateur créé
    const [users] = await pool.execute(
      'SELECT id, email, business_name, store_slug, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    const user = users[0];

    return {
      user: {
        id: user.id,
        email: user.email,
        business_name: user.business_name,
        store_slug: user.store_slug,
        created_at: user.created_at
      }
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
      'SELECT id, email, role ,password_hash, business_name, store_slug, is_active FROM users WHERE email = ? AND deleted_at IS NULL',
      [email]
    );

    if (users.length === 0) {
      throw new AppError('Identifiants incorrects', 401);
    }

    const user = users[0];

    // Vérifier que le compte est actif
    if (!user.is_active) {
      throw new AppError('Compte désactivé', 403);
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      throw new AppError('Identifiants incorrects', 401);
    }

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