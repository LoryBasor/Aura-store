const fs = require('fs');
const path = require('path');

const fileContent = `// src/services/productService.js
const { pool } = require('../config/database');
const { slugify, generateToken, buildProductShareLink } = require('../utils/helpers');
const { deleteImage, deleteVideo } = require('../config/cloudinary');
const { AppError } = require('../middlewares/errorHandler');
const { calculateOffset } = require('../utils/helpers');

/**
 * Service de gestion des produits avec Cloudinary et catégories
 */
class ProductService {
  async createProduct(userId, productData, mediaData = { images: [], video: null }) {
    const { name, description, price, currency, stock_quantity, is_available, category_id } = productData;
    if (category_id) {
      await this.validateCategoryOwnership(userId, category_id);
    }

    let slug = slugify(name);
    let slugSuffix = null;

    while (true) {
      const finalSlug = slugSuffix ? \`\${slug}-\${slugSuffix}\` : slug;
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

    const coverImage = mediaData.images && mediaData.images.length > 0 ? mediaData.images[0] : null;

    const [result] = await pool.execute(
      \`INSERT INTO products 
       (user_id, category_id, name, slug, description, price, currency, image_url, image_public_id, stock_quantity, is_available, admin_disabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`,
      [
        userId,
        category_id || null,
        name, 
        slug, 
        description, 
        price, 
        currency || 'XAF', 
        coverImage?.url || null,
        coverImage?.public_id || null,
        stock_quantity || 0, 
        is_available ?? true,
        false
      ]
    );

    const productId = result.insertId;

    if (mediaData.video) {
        await pool.execute(
            \`INSERT INTO product_media (product_id, media_type, url, public_id, position, is_cover) VALUES (?, 'video', ?, ?, 0, FALSE)\`,
            [productId, mediaData.video.url, mediaData.video.public_id]
        );
    }
    
    if (mediaData.images && mediaData.images.length > 0) {
        for (let i = 0; i < mediaData.images.length; i++) {
            const img = mediaData.images[i];
            const isCover = (i === 0);
            await pool.execute(
                \`INSERT INTO product_media (product_id, media_type, url, public_id, position, is_cover) VALUES (?, 'image', ?, ?, ?, ?)\`,
                [productId, img.url, img.public_id, i + 1, isCover]
            );
        }
    }

    const shareToken = generateToken(16);
    await pool.execute(
      'INSERT INTO product_links (product_id, token) VALUES (?, ?)',
      [productId, shareToken]
    );

    return this.getProductById(productId, userId);
  }

  async getProductById(productId, userId) {
    const [products] = await pool.execute(
      \`SELECT p.*, 
              pl.token as share_token,
              c.id as category_id,
              c.name as category_name,
              p.admin_disabled
       FROM products p
       LEFT JOIN product_links pl ON p.id = pl.product_id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ? AND p.user_id = ? AND p.deleted_at IS NULL\`,
      [productId, userId]
    );

    if (products.length === 0) {
      throw new AppError('Produit introuvable', 404);
    }

    const product = products[0];
    product.share_link = product.share_token ? buildProductShareLink(product.share_token) : null;

    const [media] = await pool.execute(
      \`SELECT * FROM product_media WHERE product_id = ? ORDER BY media_type DESC, position ASC\`,
      [productId]
    );
    product.media = media;

    return product;
  }

  async getProductsByUser(userId, search, { page = 1, limit = 20, is_available = 'undefined', category_id = null }) {
    limit = Number(limit) || 20;
    const offset = calculateOffset(page, limit);
    if(search && search.startsWith('search=')) {
        search = search.substring(7);
    }
    
    let query = \`
      SELECT p.*, 
             pl.token as share_token, 
             pl.click_count,
             c.id as category_id,
             c.name as category_name,
             p.admin_disabled
      FROM products p
      LEFT JOIN product_links pl ON p.id = pl.product_id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.user_id = ? AND p.deleted_at IS NULL AND p.name LIKE '%\${search === 'undefined' ? '' : search}%'
    \`;
    const params = [userId];

    if (is_available === 'true' || is_available === 'false') {
      is_available = (is_available === 'true');
      query += ' AND p.is_available = ?';
      params.push(is_available);
    }

    if (category_id && category_id !== 'all') {
      query += ' AND p.category_id = ?';
      params.push(category_id);
    }

    query += \` ORDER BY p.created_at DESC LIMIT \${limit} OFFSET \${offset}\`;

    const [products] = await pool.execute(query, params);

    for (let product of products) {
      product.share_link = product.share_token ? buildProductShareLink(product.share_token) : null;
      // Optionnel: on pourrait charger product_media ici si on en a besoin dans la liste,
      // mais en général l'image de couverture dans p.image_url suffit.
    }

    let countQuery = \`
      SELECT COUNT(*) as total 
      FROM products 
      WHERE user_id = ? AND deleted_at IS NULL
    \`;
    let countParams = [userId];
    
    if (is_available === true || is_available === false) {
      countQuery += ' AND is_available = ?';
      countParams.push(is_available);
    }
    
    if (category_id && category_id !== 'all') {
      countQuery += ' AND category_id = ?';
      countParams.push(category_id);
    }
    
    const [countResult] = await pool.execute(countQuery, countParams);

    return {
      products,
      pagination: {
        page,
        limit,
        total: countResult[0].total
      }
    };
  }

  async updateProduct(productId, userId, updates, mediaUpdates = null) {
    const currentProduct = await this.getProductById(productId, userId);
    
    const fields = [];
    const values = [];

    if (updates.name !== undefined && currentProduct.name !== updates.name) {
      fields.push('name = ?');
      values.push(updates.name);
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
      const isAvailable = currentProduct.admin_disabled ? false : updates.is_available;
      fields.push('is_available = ?');
      values.push(isAvailable);
    }
    if (updates.category_id !== undefined) {
      if (updates.category_id) {
        await this.validateCategoryOwnership(userId, updates.category_id);
        fields.push('category_id = ?');
        values.push(updates.category_id);
      } else {
        fields.push('category_id = NULL');
      }
    }

    // Gestion des médias
    if (mediaUpdates) {
      const retainedMediaIds = mediaUpdates.retainedMediaIds || [];
      const newImages = mediaUpdates.newImages || [];
      const newVideo = mediaUpdates.newVideo || null;
      const deleteVideoRequest = mediaUpdates.deleteVideo === true || mediaUpdates.deleteVideo === 'true';

      // 1. Trouver les médias à supprimer
      for (const m of currentProduct.media) {
         if (m.media_type === 'image' && !retainedMediaIds.includes(m.public_id)) {
            await deleteImage(m.public_id).catch(() => {});
            await pool.execute('DELETE FROM product_media WHERE id = ?', [m.id]);
         }
         if (m.media_type === 'video' && (deleteVideoRequest || newVideo)) {
            await deleteVideo(m.public_id).catch(() => {});
            await pool.execute('DELETE FROM product_media WHERE id = ?', [m.id]);
         }
      }

      // 2. Ajouter la nouvelle vidéo
      if (newVideo) {
         await pool.execute(
            \`INSERT INTO product_media (product_id, media_type, url, public_id, position, is_cover) VALUES (?, 'video', ?, ?, 0, FALSE)\`,
            [productId, newVideo.url, newVideo.public_id]
         );
      }

      // 3. Ajouter les nouvelles images
      for (let i = 0; i < newImages.length; i++) {
         const img = newImages[i];
         await pool.execute(
             \`INSERT INTO product_media (product_id, media_type, url, public_id, position, is_cover) VALUES (?, 'image', ?, ?, 99, FALSE)\`,
             [productId, img.url, img.public_id]
         );
      }

      // 4. Mettre à jour les positions et l'image de couverture
      const [finalImages] = await pool.execute(
         \`SELECT id, public_id, url FROM product_media WHERE product_id = ? AND media_type = 'image' ORDER BY position ASC, id ASC\`,
         [productId]
      );

      // On réassigne la position de 1 à N, et is_cover pour la première
      for (let i = 0; i < finalImages.length; i++) {
         const isCover = (i === 0);
         await pool.execute(
            \`UPDATE product_media SET position = ?, is_cover = ? WHERE id = ?\`,
            [i + 1, isCover, finalImages[i].id]
         );
         
         // Mettre à jour aussi dans la table products pour fallback
         if (isCover) {
            fields.push('image_url = ?', 'image_public_id = ?');
            values.push(finalImages[i].url, finalImages[i].public_id);
         }
      }
      
      if (finalImages.length === 0) {
          fields.push('image_url = NULL', 'image_public_id = NULL');
      }
    }

    if (fields.length > 0) {
      values.push(productId, userId);
      await pool.execute(
        \`UPDATE products SET \${fields.join(', ')} WHERE id = ? AND user_id = ?\`,
        values
      );
    }

    return this.getProductById(productId, userId);
  }

  async deleteProduct(productId, userId) {
    const product = await this.getProductById(productId, userId);

    await pool.execute(
      'DELETE FROM products WHERE id = ? AND user_id = ?',
      [productId, userId]
    );

    for (const m of product.media) {
       if (m.media_type === 'image') {
          await deleteImage(m.public_id).catch(() => {});
       } else if (m.media_type === 'video') {
          await deleteVideo(m.public_id).catch(() => {});
       }
    }
  }

  async getProductByShareToken(token) {
    const [products] = await pool.execute(
      \`SELECT p.*, 
              u.business_name, 
              u.whatsapp_number,
              u.id as vendor_id, 
              u.store_slug,
              u.city,
              u.country,
              pl.click_count, 
              pl.product_id,
              c.name as category_name
       FROM products p
       JOIN users u ON p.user_id = u.id
       JOIN product_links pl ON p.id = pl.product_id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE pl.token = ? AND p.is_available = 1 AND p.admin_disabled = 0 AND p.deleted_at IS NULL AND u.is_active = 1\`,
      [token]
    );

    if (products.length === 0) {
      throw new AppError('Produit introuvable ou indisponible', 404);
    }

    const product = products[0];
    
    const [isPlanBusiness] = await pool.execute(
      \`SELECT user_id, plan_name FROM v_user_plan_access 
       WHERE user_id = ? AND (subscription_status = 'active' OR subscription_status = 'trial')\`, 
      [product.vendor_id]
    );
    
    let planName = 'Free';
    if (isPlanBusiness.length !== 0){
       planName = isPlanBusiness[0].plan_name;
    }

    let customMessage = null;
    if (planName === 'Business'){
      const [custom_message] = await pool.execute(
        \`SELECT custom_order_message FROM social_integrations WHERE user_id = ?\`, 
        [product.vendor_id]
      );
      if(custom_message.length > 0) customMessage = custom_message[0];
    }

    // Récupérer les médias et filtrer selon le plan
    const [media] = await pool.execute(
      \`SELECT * FROM product_media WHERE product_id = ? ORDER BY media_type DESC, position ASC\`,
      [product.product_id]
    );

    let allowedMedia = [];
    if (planName === 'Business') {
       // max 7 images, 1 video
       const videos = media.filter(m => m.media_type === 'video').slice(0, 1);
       const images = media.filter(m => m.media_type === 'image').slice(0, 7);
       allowedMedia = [...videos, ...images];
    } else if (planName === 'Pro') {
       // max 4 images, no video
       allowedMedia = media.filter(m => m.media_type === 'image').slice(0, 4);
    } else {
       // Free: max 1 image, no video
       allowedMedia = media.filter(m => m.media_type === 'image').slice(0, 1);
    }
    
    product.media = allowedMedia;

    await pool.execute(
      \`UPDATE product_links SET click_count = click_count + 1, last_clicked_at = NOW() WHERE token = ?\`,
      [token]
    );
    await pool.execute(
      \`UPDATE products SET view_count = view_count + 1 WHERE id = ?\`,
      [product.product_id]
    );

    return { product, customMessage };
  }

  async validateCategoryOwnership(userId, categoryId) {
    const [categories] = await pool.execute(
      \`SELECT id FROM categories 
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL\`,
      [categoryId, userId]
    );

    if (categories.length === 0) {
      throw new AppError('Catégorie invalide ou introuvable', 400);
    }
  }

  async getProductStatsByCategory(userId) {
    const [stats] = await pool.execute(
      \`SELECT 
         c.id,
         c.name,
         c.slug,
         COUNT(p.id) as total_products,
         COUNT(CASE WHEN p.is_available = 1 THEN 1 END) as available_products,
         SUM(p.view_count) as total_views,
         SUM(p.order_count) as total_orders
       FROM categories c
       LEFT JOIN products p ON c.id = p.category_id AND p.deleted_at IS NULL
       WHERE c.user_id = ? AND c.deleted_at IS NULL
       GROUP BY c.id
       ORDER BY c.display_order ASC, c.name ASC\`,
      [userId]
    );

    return stats;
  }
}

module.exports = new ProductService();
`;

fs.writeFileSync(path.join(__dirname, '../src/services/productService.js'), fileContent);
console.log('productService.js updated');
