// src/services/storeCustomizationService.js
const { pool } = require('../config/database');
const { AppError } = require('../middlewares/errorHandler');
const { deleteImage } = require('../config/cloudinary');

/**
 * Service de personnalisation de la boutique (BUSINESS uniquement)
 * Utilise Cloudinary pour le stockage des images
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
      'logo_public_id',
      'banner_url',
      'banner_public_id',
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
   * Upload logo vers Cloudinary
   */
  async uploadLogo(userId, logoData) {
    // Récupérer l'ancien logo pour le supprimer
    const config = await this.getCustomization(userId);
    
    if (config.logo_public_id) {
      try {
        await deleteImage(config.logo_public_id);
      } catch (error) {
        console.error('Erreur suppression ancien logo:', error);
        // Continue quand même
      }
    }

    return this.updateCustomization(userId, {
      logo_url: logoData.url,
      logo_public_id: logoData.public_id
    });
  }

  /**
   * Upload bannière vers Cloudinary
   */
  async uploadBanner(userId, bannerData) {
    // Récupérer l'ancienne bannière pour la supprimer
    const config = await this.getCustomization(userId);
    
    if (config.banner_public_id) {
      try {
        await deleteImage(config.banner_public_id);
      } catch (error) {
        console.error('Erreur suppression ancienne bannière:', error);
        // Continue quand même
      }
    }

    return this.updateCustomization(userId, {
      banner_url: bannerData.url,
      banner_public_id: bannerData.public_id
    });
  }

  /**
   * Supprime le logo de Cloudinary
   */
  async deleteLogo(userId) {
    const config = await this.getCustomization(userId);
    console.log('Config avant suppression logo:', config);
    if (config.logo_public_id) {
      try {
        await deleteImage(config.logo_public_id);
      } catch (error) {
        console.error('Erreur suppression logo Cloudinary:', error);
      }
    }

    return this.updateCustomization(userId, {
      logo_url: null,
      logo_public_id: null
    });
  }

  /**
   * Supprime la bannière de Cloudinary
   */
  async deleteBanner(userId) {
    const config = await this.getCustomization(userId);
    
    if (config.banner_public_id) {
      try {
        await deleteImage(config.banner_public_id);
      } catch (error) {
        console.error('Erreur suppression bannière Cloudinary:', error);
      }
    }

    return this.updateCustomization(userId, {
      banner_url: null,
      banner_public_id: null
    });
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

    const config = configs[0];

    // Les URLs Cloudinary sont déjà complètes
    return {
      primary_color: config.primary_color,
      secondary_color: config.secondary_color,
      text_color: config.text_color,
      logo_url: config.logo_url,
      banner_url: config.banner_url,
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

    // Supprimer les images de Cloudinary
    if (config.logo_public_id) {
      try {
        await deleteImage(config.logo_public_id);
      } catch (error) {
        console.error('Erreur suppression logo:', error);
      }
    }
    
    if (config.banner_public_id) {
      try {
        await deleteImage(config.banner_public_id);
      } catch (error) {
        console.error('Erreur suppression bannière:', error);
      }
    }

    await pool.execute(
      `UPDATE store_customization SET
        primary_color = '#4F46E5',
        secondary_color = '#10B981',
        text_color = '#1F2937',
        logo_url = NULL,
        logo_public_id = NULL,
        banner_url = NULL,
        banner_public_id = NULL,
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