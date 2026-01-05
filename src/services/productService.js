// src/services/productService.js
const { pool } = require('../config/database');
const { slugify, generateToken, buildProductShareLink } = require('../utils/helpers');
const { deleteImage } = require('../config/cloudinary');
const { AppError } = require('../middlewares/errorHandler');
const { calculateOffset } = require('../utils/helpers');

/**
 * Service de gestion des produits avec Cloudinary
 */
class ProductService {
  /**
   * Crée un nouveau produit
   * @param {number} userId - ID du vendeur
   * @param {object} productData - Données du produit
   * @param {object} imageData - {url, public_id} depuis Cloudinary
   * @returns {object} Produit créé avec lien de partage
   */
  async createProduct(userId, productData, imageData = null) {
    const { name, description, price, currency, stock_quantity, is_available } = productData;

    // Générer un slug unique
    let slug = slugify(name);
    let slugSuffix = null;

    while (true) {
      const finalSlug = slugSuffix ? `${slug}-${slugSuffix}` : slug;
      const [slugCheck] = await pool.execute(
        'SELECT id FROM products WHERE user_id = ? AND slug = ?',
        [userId, finalSlug]
      );

      if (slugCheck.length === 0) {
        slug = finalSlug;
        break;
      }
      slugSuffix = slugSuffix ? slugSuffix + 1 : 1;
    }

    // Créer le produit avec URL et public_id Cloudinary
    const [result] = await pool.execute(
      `INSERT INTO products 
       (user_id, name, slug, description, price, currency, image_url, image_public_id, stock_quantity, is_available)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, 
        name, 
        slug, 
        description, 
        price, 
        currency || 'XAF', 
        imageData?.url || null,
        imageData?.public_id || null,
        stock_quantity || 0, 
        is_available ?? true
      ]
    );

    // Générer un token pour le lien de partage
    const shareToken = generateToken(16);
    await pool.execute(
      'INSERT INTO product_links (product_id, token) VALUES (?, ?)',
      [result.insertId, shareToken]
    );

    // Récupérer le produit complet
    return this.getProductById(result.insertId, userId);
  }

  /**
   * Récupère un produit par ID
   * @param {number} productId - ID du produit
   * @param {number} userId - ID du vendeur
   * @returns {object} Produit avec lien de partage
   */
  async getProductById(productId, userId) {
    const [products] = await pool.execute(
      `SELECT p.*, pl.token as share_token
       FROM products p
       LEFT JOIN product_links pl ON p.id = pl.product_id
       WHERE p.id = ? AND p.user_id = ? AND p.deleted_at IS NULL`,
      [productId, userId]
    );

    if (products.length === 0) {
      throw new AppError('Produit introuvable', 404);
    }

    const product = products[0];
    // L'URL Cloudinary est déjà complète, pas besoin de transformation
    product.share_link = product.share_token ? buildProductShareLink(product.share_token) : null;

    return product;
  }

  /**
   * Liste tous les produits d'un vendeur
   * @param {number} userId - ID du vendeur
   * @param {string} search - Recherche
   * @param {object} filters - Filtres (page, limit, is_available)
   * @returns {object} Liste paginée de produits
   */
  async getProductsByUser(userId, search, { page = 1, limit = 20, is_available = 'undefined'}) {
    limit = Number(limit) || 20;
    const offset = calculateOffset(page, limit);
    search = search.substring(7);
    
    let query = `
      SELECT p.*, pl.token as share_token, pl.click_count
      FROM products p
      LEFT JOIN product_links pl ON p.id = pl.product_id
      WHERE p.user_id = ? AND p.deleted_at IS NULL AND p.name LIKE '%${search === 'undefined' ? '': search}%'
    `;
    const params = [userId];

    if (is_available === 'true' || is_available === 'false') {
      is_available === 'true'? is_available = true : is_available = false;
      query += ' AND p.is_available = ?';
      params.push(is_available);
    }

    query += ` ORDER BY p.created_at DESC`;

    const [products] = await pool.execute(query, params);

    // Formater les liens de partage
    products.forEach(product => {
      product.share_link = product.share_token ? buildProductShareLink(product.share_token) : null;
    });

    // Compter le total
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM products 
       WHERE user_id = ? AND deleted_at IS NULL ${is_available !== null ? 'AND is_available = ?' : ''}`,
      is_available !== null ? [userId, is_available] : [userId]
    );

    return {
      products,
      pagination: {
        page,
        limit,
        total: countResult[0].total
      }
    };
  }

  /**
   * Met à jour un produit
   * @param {number} productId - ID du produit
   * @param {number} userId - ID du vendeur
   * @param {object} updates - Champs à mettre à jour
   * @param {object} newImageData - {url, public_id} depuis Cloudinary
   * @returns {object} Produit mis à jour
   */
  async updateProduct(productId, userId, updates, newImageData = null) {
    // Récupérer le produit actuel
    const currentProduct = await this.getProductById(productId, userId);

    const fields = [];
    const values = [];

    if (updates.name !== undefined && currentProduct.name !== updates.name) {
      fields.push('name = ?');
      values.push(updates.name);
      
      // Régénérer le slug si nom change
      const newSlug = slugify(updates.name);
      if (newSlug !== currentProduct.slug) {
        fields.push('slug = ?');
        values.push(newSlug);
      }
    }

    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }

    if (updates.price !== undefined) {
      fields.push('price = ?');
      values.push(updates.price);
    }

    if (updates.currency !== undefined) {
      fields.push('currency = ?');
      values.push(updates.currency);
    }

    if (updates.stock_quantity !== undefined) {
      fields.push('stock_quantity = ?');
      values.push(updates.stock_quantity);
    }

    if (updates.is_available !== undefined) {
      fields.push('is_available = ?');
      values.push(updates.is_available);
    }

    // Gestion de la nouvelle image Cloudinary
    if (newImageData) {
      // Supprimer l'ancienne image de Cloudinary
      if (currentProduct.image_public_id) {
        try {
          await deleteImage(currentProduct.image_public_id);
        } catch (error) {
          console.error('Erreur suppression ancienne image:', error);
          // On continue quand même
        }
      }
      
      fields.push('image_url = ?');
      values.push(newImageData.url);
      
      fields.push('image_public_id = ?');
      values.push(newImageData.public_id);
    }

    if (fields.length === 0) {
      throw new AppError('Aucune donnée à mettre à jour', 400);
    }

    values.push(productId, userId);

    await pool.execute(
      `UPDATE products SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );

    return this.getProductById(productId, userId);
  }

  /**
   * Supprime un produit (soft delete)
   * @param {number} productId - ID du produit
   * @param {number} userId - ID du vendeur
   */
  async deleteProduct(productId, userId) {
    const product = await this.getProductById(productId, userId);

    // Soft delete en base
    await pool.execute(
      'DELETE FROM products WHERE id = ? AND user_id = ?',
      [productId, userId]
    );

    // Supprimer l'image de Cloudinary
    if (product.image_public_id) {
      try {
        await deleteImage(product.image_public_id);
      } catch (error) {
        console.error('Erreur suppression image Cloudinary:', error);
        // L'erreur ne doit pas bloquer la suppression du produit
      }
    }
  }

  /**
   * Récupère un produit par son token de partage (route publique)
   * @param {string} token - Token de partage
   * @returns {object} Produit + infos vendeur
   */
  async getProductByShareToken(token) {
    const [products] = await pool.execute(
      `SELECT p.*, u.business_name, u.whatsapp_number,u.id, u.store_slug, pl.click_count
       FROM products p
       JOIN users u ON p.user_id = u.id
       JOIN product_links pl ON p.id = pl.product_id
       WHERE pl.token = ? AND p.is_available = 1 AND p.deleted_at IS NULL AND u.is_active = 1`,
      [token]
    );

    if (products.length === 0) {
      throw new AppError('Produit introuvable ou indisponible', 404);
    }

    const product = products[0];
     const [isPlanBusiness] = await pool.execute(`SELECT user_id FROM v_user_plan_access WHERE user_id = ? AND plan_name = 'Business' AND (subscription_status = 'active' OR subscription_status = 'trial')`, [product.id]);
    let customMessage = null;
    if (isPlanBusiness.length !== 0){
      const [custom_message] = await pool.execute(`SELECT custom_order_message FROM social_integrations WHERE user_id = ?`, [product.id]);
      customMessage = custom_message[0];
    }

    // Incrémenter le compteur de vues
    await pool.execute(
      `UPDATE product_links SET click_count = click_count + 1, last_clicked_at = NOW() WHERE token = ?`,
      [token]
    );

    await pool.execute(
      'UPDATE products SET view_count = view_count + 1 WHERE id = ?',
      [product.id]
    );

    return {product, customMessage};
  }
}

module.exports = new ProductService();