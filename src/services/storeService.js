// src/services/storeService.js
const { pool } = require('../config/database');
const { AppError } = require('../middlewares/errorHandler');
const { getImageUrl } = require('../config/upload');
const storeCustomizationService = require('./storeCustomizationService');
const socialIntegrationsService = require('./socialIntegrationsService');

class StoreService {
  /**
   * Récupère la boutique avec personnalisation et intégrations
   */
  async getStore(storeSlug) {
    // Récupérer les infos du vendeur
    const [vendors] = await pool.execute(
      `SELECT u.id, u.business_name, u.store_slug, u.whatsapp_number,
              sp.slug as plan_slug
       FROM users u
       LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status IN ('trial', 'active')
       LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE u.store_slug = ? AND u.is_active = 1 AND u.deleted_at IS NULL`,
      [storeSlug]
    );

    if (vendors.length === 0) {
      throw new AppError('Boutique introuvable', 404);
    }

    const vendor = vendors[0];
    const planSlug = vendor.plan_slug || 'free';

    // Récupérer les produits (limite selon le plan)
    let query = `
      SELECT p.*, pl.token as share_token
      FROM products p
      LEFT JOIN product_links pl ON p.id = pl.product_id
      WHERE p.user_id = ? AND p.is_available = 1 AND p.deleted_at IS NULL
      ORDER BY p.created_at DESC
    `;

    // Limiter à 5 produits si plan Free
    if (planSlug === 'free') {
      query += ' LIMIT 5';
    }

    const [products] = await pool.execute(query, [vendor.id]);

    // Formater les URLs des images
    products.forEach(product => {
      product.image_url = getImageUrl(product.image_url);
    });

    // ✨ NOUVEAU - Récupérer la personnalisation (si plan Business)
    let customization = null;
    if (planSlug === 'business') {
      customization = await storeCustomizationService.getPublicCustomization(storeSlug);
    }

    // ✨ NOUVEAU - Récupérer les intégrations sociales (si plan Business)
    let integrations = null;
    if (planSlug === 'business') {
      integrations = await socialIntegrationsService.getPublicIntegrations(storeSlug);
    }

    return {
      vendor: {
        business_name: vendor.business_name,
        store_slug: vendor.store_slug,
        whatsapp_number: vendor.whatsapp_number,
        plan: planSlug
      },
      products,
      customization, // ✨ Configuration visuelle
      integrations, // ✨ Liens sociaux
      has_more: planSlug === 'free' && products.length === 5 // Indicateur si plan limité
    };
  }

  /**
   * Récupère un produit avec les intégrations pour la page produit
   */
  async getProductWithIntegrations(token) {
    const [products] = await pool.execute(
      `SELECT p.*, u.business_name, u.whatsapp_number, u.store_slug, pl.click_count,
              sp.slug as plan_slug
       FROM products p
       JOIN users u ON p.user_id = u.id
       JOIN product_links pl ON p.id = pl.product_id
       LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status IN ('trial', 'active')
       LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE pl.token = ? AND p.is_available = 1 AND p.deleted_at IS NULL AND u.is_active = 1`,
      [token]
    );

    if (products.length === 0) {
      throw new AppError('Produit introuvable ou indisponible', 404);
    }

    const product = products[0];
    product.image_url = getImageUrl(product.image_url);

    // Incrémenter les compteurs
    await pool.execute(
      'UPDATE product_links SET click_count = click_count + 1, last_clicked_at = NOW() WHERE token = ?',
      [token]
    );

    await pool.execute(
      'UPDATE products SET view_count = view_count + 1 WHERE id = ?',
      [product.id]
    );

    // ✨ Si plan Business, récupérer les intégrations pour ce produit
    let integrations = null;
    if (product.plan_slug === 'business') {
      integrations = await socialIntegrationsService.getPublicIntegrations(
        product.store_slug,
        product
      );
    }

    return {
      product,
      vendor: {
        business_name: product.business_name,
        store_slug: product.store_slug,
        whatsapp_number: product.whatsapp_number
      },
      integrations // ✨ URLs WhatsApp/Instagram/Facebook générées
    };
  }
}

module.exports = new StoreService();