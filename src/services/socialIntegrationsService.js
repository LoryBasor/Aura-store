// src/services/socialIntegrationsService.js
const { pool } = require('../config/database');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Service d'intégrations sociales (BUSINESS uniquement)
 */
class SocialIntegrationsService {
  /**
   * Récupère les intégrations sociales
   */
  async getIntegrations(userId) {
    const [integrations] = await pool.execute(
      'SELECT * FROM social_integrations WHERE user_id = ?',
      [userId]
    );

    if (integrations.length === 0) {
      return this.createDefaultIntegrations(userId);
    }

    return integrations[0];
  }

  /**
   * Crée des intégrations par défaut
   */
  async createDefaultIntegrations(userId) {
    await pool.execute(
      `INSERT INTO social_integrations (
        user_id,
        whatsapp_enabled,
        instagram_enabled,
        facebook_enabled,
        custom_order_message
      ) VALUES (?, FALSE, FALSE, FALSE, 
        'Bonjour 👋 Je suis intéressé(e) par le produit {{product_name}} à {{product_price}} {{currency}}. Pouvez-vous me donner plus d\\'informations ?')`,
      [userId]
    );

    return this.getIntegrations(userId);
  }

  /**
   * Met à jour les intégrations
   */
  async updateIntegrations(userId, updates) {
    const allowedFields = [
      'whatsapp_number',
      'whatsapp_enabled',
      'instagram_url',
      'instagram_enabled',
      'facebook_url',
      'facebook_enabled',
      'custom_order_message'
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

    // Vérifier si existe
    const [existing] = await pool.execute(
      'SELECT id FROM social_integrations WHERE user_id = ?',
      [userId]
    );

    if (existing.length === 0) {
      await this.createDefaultIntegrations(userId);
    }

    await pool.execute(
      `UPDATE social_integrations SET ${fields.join(', ')} WHERE user_id = ?`,
      values
    );

    return this.getIntegrations(userId);
  }

  /**
   * Génère URL WhatsApp avec message personnalisé
   */
  generateWhatsAppUrl(product, integrations) {
    if (!integrations.whatsapp_enabled || !integrations.whatsapp_number) {
      return null;
    }

    let message = integrations.custom_order_message || 
      'Bonjour 👋 Je suis intéressé(e) par le produit {{product_name}} à {{product_price}} {{currency}}.';

    // Remplacer les variables
    message = message
      .replace('{{product_name}}', product.name)
      .replace('{{product_price}}', product.price)
      .replace('{{currency}}', product.currency || 'FCFA')
      .replace('{{quantity}}', '1');

    const encodedMessage = encodeURIComponent(message);
    const cleanPhone = integrations.whatsapp_number.replace(/[^\d]/g, '');
    
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
  }

  /**
   * Génère URL Instagram
   */
  generateInstagramUrl(integrations) {
    if (!integrations.instagram_enabled || !integrations.instagram_url) {
      return null;
    }

    // Normaliser l'URL
    let url = integrations.instagram_url.trim();
    
    if (!url.startsWith('http')) {
      // Si c'est juste un username
      if (url.startsWith('@')) {
        url = url.substring(1);
      }
      url = `https://instagram.com/${url}`;
    }

    return url;
  }

  /**
   * Génère URL Facebook
   */
  generateFacebookUrl(integrations) {
    if (!integrations.facebook_enabled || !integrations.facebook_url) {
      return null;
    }

    let url = integrations.facebook_url.trim();
    
    if (!url.startsWith('http')) {
      url = `https://facebook.com/${url}`;
    }

    return url;
  }

  /**
   * Récupère les intégrations pour la boutique publique
   */
  async getPublicIntegrations(storeSlug, product = null) {
    const [users] = await pool.execute(
      'SELECT id FROM users WHERE store_slug = ? AND deleted_at IS NULL',
      [storeSlug]
    );

    if (users.length === 0) {
      return null;
    }

    const integrations = await this.getIntegrations(users[0].id);

    return {
      whatsapp: integrations.whatsapp_enabled ? {
        enabled: true,
        url: product ? this.generateWhatsAppUrl(product, integrations) : null,
        number: integrations.whatsapp_number
      } : { enabled: false },
      
      instagram: integrations.instagram_enabled ? {
        enabled: true,
        url: this.generateInstagramUrl(integrations)
      } : { enabled: false },
      
      facebook: integrations.facebook_enabled ? {
        enabled: true,
        url: this.generateFacebookUrl(integrations)
      } : { enabled: false }
    };
  }

  /**
   * Valide un numéro WhatsApp
   */
  validateWhatsAppNumber(number) {
    const cleaned = number.replace(/[^\d+]/g, '');
    // Format international requis
    return /^\+?\d{10,15}$/.test(cleaned);
  }

  /**
   * Valide une URL Instagram
   */
  validateInstagramUrl(url) {
    // Accepte username ou URL complète
    return /^(@?[\w.]+|https?:\/\/(www\.)?instagram\.com\/[\w.]+\/?)$/.test(url);
  }

  /**
   * Valide une URL Facebook
   */
  validateFacebookUrl(url) {
    return /^([\w.]+|https?:\/\/(www\.)?m\.me\/.+)$/.test(url);
  }
}

module.exports = new SocialIntegrationsService();