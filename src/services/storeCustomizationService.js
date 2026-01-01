// src/services/storeCustomizationService.js
const { pool } = require('../config/database');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Service de personnalisation de la boutique (BUSINESS uniquement)
 */
class StoreCustomizationService {
  /**
   * Récupère la configuration de personnalisation
   */
  async getCustomization(userId) {
    const [configs] = await pool.execute(
      'SELECT * FROM store_customization WHERE user_id = ?',
      [userId]
    );

    if (configs.length === 0) {
      // Créer configuration par défaut
      return this.createDefaultCustomization(userId);
    }

    return configs[0];
  }

  /**
   * Crée une configuration par défaut
   */
  async createDefaultCustomization(userId) {
    const [result] = await pool.execute(
      `INSERT INTO store_customization (
        user_id,
        primary_color,
        secondary_color,
        text_color,
        order_message,
        show_product_count,
        show_social_links,
        show_contact_info
      ) VALUES (?, '#4F46E5', '#10B981', '#1F2937', 
        'Merci pour votre commande ! Nous vous contacterons bientôt.',
        TRUE, TRUE, TRUE)`,
      [userId]
    );

    return this.getCustomization(userId);
  }

  /**
   * Met à jour la personnalisation
   */
  async updateCustomization(userId, updates) {
    const allowedFields = [
      'primary_color',
      'secondary_color',
      'text_color',
      'logo_url',
      'banner_url',
      'order_message',
      'show_product_count',
      'show_social_links',
      'show_contact_info'
    ];

    const fields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });

    if (fields.length === 0) {
      throw new AppError('Aucune donnée à mettre à jour', 400);
    }

    values.push(userId);

    // Vérifier si config existe
    const [existing] = await pool.execute(
      'SELECT id FROM store_customization WHERE user_id = ?',
      [userId]
    );

    if (existing.length === 0) {
      await this.createDefaultCustomization(userId);
    }

    await pool.execute(
      `UPDATE store_customization SET ${fields.join(', ')} WHERE user_id = ?`,
      values
    );

    return this.getCustomization(userId);
  }

  /**
   * Upload logo
   */
  async uploadLogo(userId, logoPath) {
    return this.updateCustomization(userId, { logo_url: logoPath });
  }

  /**
   * Upload bannière
   */
  async uploadBanner(userId, bannerPath) {
    return this.updateCustomization(userId, { banner_url: bannerPath });
  }

  /**
   * Supprime le logo
   */
  async deleteLogo(userId) {
    const config = await this.getCustomization(userId);
    
    if (config.logo_url) {
      const { deleteFile } = require('../config/upload');
      deleteFile(config.logo_url);
    }

    return this.updateCustomization(userId, { logo_url: null });
  }

  /**
   * Supprime la bannière
   */
  async deleteBanner(userId) {
    const config = await this.getCustomization(userId);
    
    if (config.banner_url) {
      const { deleteFile } = require('../config/upload');
      deleteFile(config.banner_url);
    }

    return this.updateCustomization(userId, { banner_url: null });
  }

  /**
   * Récupère la personnalisation pour la boutique publique
   */
  async getPublicCustomization(storeSlug) {
    const [users] = await pool.execute(
      'SELECT id FROM users WHERE store_slug = ? AND deleted_at IS NULL',
      [storeSlug]
    );

    if (users.length === 0) {
      return null;
    }

    const [configs] = await pool.execute(
      'SELECT * FROM store_customization WHERE user_id = ?',
      [users[0].id]
    );

    if (configs.length === 0) {
      return null;
    }

    const { getImageUrl } = require('../config/upload');
    const config = configs[0];

    return {
      primary_color: config.primary_color,
      secondary_color: config.secondary_color,
      text_color: config.text_color,
      logo_url: getImageUrl(config.logo_url),
      banner_url: getImageUrl(config.banner_url),
      order_message: config.order_message,
      show_product_count: config.show_product_count,
      show_social_links: config.show_social_links,
      show_contact_info: config.show_contact_info
    };
  }

  /**
   * Réinitialise aux valeurs par défaut
   */
  async resetToDefault(userId) {
    const config = await this.getCustomization(userId);

    // Supprimer les images
    if (config.logo_url) {
      const { deleteFile } = require('../config/upload');
      deleteFile(config.logo_url);
    }
    if (config.banner_url) {
      const { deleteFile } = require('../config/upload');
      deleteFile(config.banner_url);
    }

    await pool.execute(
      `UPDATE store_customization SET
        primary_color = '#4F46E5',
        secondary_color = '#10B981',
        text_color = '#1F2937',
        logo_url = NULL,
        banner_url = NULL,
        order_message = 'Merci pour votre commande ! Nous vous contacterons bientôt.',
        show_product_count = TRUE,
        show_social_links = TRUE,
        show_contact_info = TRUE
       WHERE user_id = ?`,
      [userId]
    );

    return this.getCustomization(userId);
  }
}

module.exports = new StoreCustomizationService();