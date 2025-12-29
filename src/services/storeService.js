// src/services/storeService.js

const { pool } = require('../config/database');
const { AppError } = require('../middlewares/errorHandler');
const { getImageUrl } = require('../config/upload');

class StoreService {

    async getStore (storeSlug) {
        // Récupérer les infos du vendeur
      const [vendors] = await pool.execute(
        `SELECT id, business_name, store_slug, whatsapp_number 
         FROM users 
         WHERE store_slug = ? AND is_active = 1 AND deleted_at IS NULL`,
        [storeSlug]
      );

      if (vendors.length === 0) {
        throw new AppError('Boutique introuvable', 404);
      }

      const vendor = vendors[0];

      // Récupérer tous les produits disponibles du vendeur
      const [products] = await pool.execute(
        `SELECT p.*, pl.token as share_token
         FROM products p
         LEFT JOIN product_links pl ON p.id = pl.product_id
         WHERE p.user_id = ? AND p.is_available = 1 AND p.deleted_at IS NULL
         ORDER BY p.created_at DESC`,
        [vendor.id]
      );

      // Formater les URLs des images
      products.forEach(product => {
        product.image_url = getImageUrl(product.image_url);
      });

      return{
        vendor: {
          business_name: vendor.business_name,
          store_slug: vendor.store_slug,
          whatsapp_number: vendor.whatsapp_number
        },
        products
      };
    }
}

module.exports = new StoreService();