// src/services/marketplaceService.js - VERSION CORRIGÉE
const { pool } = require('../config/database');
const { AppError } = require('../middlewares/errorHandler');
const { getImageUrl } = require('../config/upload');

/**
 * Service pour le marketplace public - Optimisé avec corrections
 */
class MarketplaceService {
  /**
   * Récupère les données pour la page principale marketplace
   */
  async getMarketplaceHome() {
    // Produits populaires (par view_count)
    const [popularProducts] = await pool.execute(`
      SELECT p.id, p.name, p.price, p.currency, p.image_url, p.slug,
             u.business_name, u.store_slug, u.city, u.country, u.is_verified,
             pl.token as share_token,
             p.view_count, p.order_count
      FROM products p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN product_links pl ON p.id = pl.product_id
      WHERE p.is_available = 1 AND p.deleted_at IS NULL
        AND u.is_active = 1 AND u.deleted_at IS NULL
      ORDER BY p.view_count DESC
      LIMIT 12
    `);

    // Produits récents
    const [recentProducts] = await pool.execute(`
      SELECT p.id, p.name, p.price, p.currency, p.image_url, p.slug,
             u.business_name, u.store_slug, u.city, u.country, u.is_verified,
             pl.token as share_token
      FROM products p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN product_links pl ON p.id = pl.product_id
      WHERE p.is_available = 1 AND p.deleted_at IS NULL
        AND u.is_active = 1 AND u.deleted_at IS NULL
      ORDER BY p.created_at DESC
      LIMIT 12
    `);

    // Boutiques recommandées (par nombre de produits)
    const [recommendedStores] = await pool.execute(`
      SELECT u.id, u.business_name, u.store_slug, u.city, u.country, u.is_verified,
             COUNT(p.id) as product_count,
             SUM(p.view_count) as total_views,
             sc.logo_url
      FROM users u
      LEFT JOIN products p ON u.id = p.user_id AND p.is_available = 1 AND p.deleted_at IS NULL
      LEFT JOIN store_customization sc ON u.id = sc.user_id
      WHERE u.is_active = 1 AND u.deleted_at IS NULL
      GROUP BY u.id, u.business_name, u.store_slug, u.city, u.country, u.is_verified, sc.logo_url
      HAVING product_count > 0
      ORDER BY product_count DESC, total_views DESC
      LIMIT 8
    `);

    // Récupérer les produits pour chaque boutique
    for (let store of recommendedStores) {
      const [storeProducts] = await pool.execute(`
        SELECT p.id, p.name, p.price, p.currency, p.image_url,
               pl.token as share_token
        FROM products p
        LEFT JOIN product_links pl ON p.id = pl.product_id
        WHERE p.user_id = ? AND p.is_available = 1 AND p.deleted_at IS NULL
        ORDER BY p.view_count DESC
        LIMIT 4
      `, [store.id]);

      store.products = storeProducts.map(p => ({
        ...p,
        image_url: getImageUrl(p.image_url)
      }));
    }

    // Catégories tendances (par nombre de produits)
    const [trendingCategories] = await pool.execute(`
      SELECT c.name, c.slug, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.is_available = 1 AND p.deleted_at IS NULL
      WHERE c.is_active = 1 AND c.deleted_at IS NULL
      GROUP BY c.id, c.name, c.slug
      HAVING product_count > 0
      ORDER BY product_count DESC
      LIMIT 10
    `);

    // Formater les images
    popularProducts.forEach(p => p.image_url = getImageUrl(p.image_url));
    recentProducts.forEach(p => p.image_url = getImageUrl(p.image_url));

    return {
      popularProducts,
      recentProducts,
      recommendedStores,
      trendingCategories
    };
  }

  /**
   * Récupère la liste des produits avec filtres - VERSION CORRIGÉE
   */
  async getProducts(filters = {}) {
    let whereConditions = [
      'p.is_available = 1',
      'p.deleted_at IS NULL',
      'u.is_active = 1',
      'u.deleted_at IS NULL'
    ];
    let params = [];
    let orderBy = 'p.created_at DESC';

    // Filtre par recherche
    if (filters.search) {
      whereConditions.push('(p.name LIKE ? OR p.description LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    // Filtre par catégorie - CORRECTION: utiliser paramètre
    if (filters.category) {
      whereConditions.push('c.slug = ?');
      params.push(filters.category);
    }

    // Filtre par ville
    if (filters.city) {
      whereConditions.push('u.city = ?');
      params.push(filters.city);
    }

    // Filtre par pays
    if (filters.country) {
      whereConditions.push('u.country = ?');
      params.push(filters.country);
    }

    // Filtre par prix min
    if (filters.minPrice) {
      whereConditions.push('p.price >= ?');
      params.push(filters.minPrice);
    }

    // Filtre par prix max
    if (filters.maxPrice) {
      whereConditions.push('p.price <= ?');
      params.push(filters.maxPrice);
    }

    // Tri
    if (filters.sort === 'popular') {
      orderBy = 'p.view_count DESC';
    } else if (filters.sort === 'recent') {
      orderBy = 'p.created_at DESC';
    } else if (filters.sort === 'price-asc') {
      orderBy = 'p.price ASC';
    } else if (filters.sort === 'price-desc') {
      orderBy = 'p.price DESC';
    } else if (filters.sort === 'rating') {
      orderBy = 'p.view_count DESC';
    }

    const whereClause = whereConditions.join(' AND ');
    const limit = parseInt(filters.limit ?? 20, 10) || 20;
    const offset = parseInt(filters.offset ?? 0, 10) || 0;

    // CORRECTION: Requête principale avec paramètres
    const query = `
      SELECT p.id, p.name, p.price, p.currency, p.image_url, p.slug, p.description,
             u.business_name, u.store_slug, u.city, u.country, u.is_verified,
             pl.token as share_token,
             c.name as category_name, c.slug as category_slug,
             p.view_count, p.order_count, p.created_at
      FROM products p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_links pl ON p.id = pl.product_id
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const queryParams = [...params];
    const [products] = await pool.execute(query, queryParams);

    // Formater les images
    products.forEach(p => p.image_url = getImageUrl(p.image_url));

    // CORRECTION: Compter le total pour pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM products p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${whereClause}
    `;
    const [countResult] = await pool.execute(countQuery, params);

    return {
      products,
      total: countResult[0].total,
      limit,
      offset
    };
  }

  /**
   * Récupère la liste des boutiques avec filtres - VERSION CORRIGÉE
   */
  async getStores(filters = {}) {
    let whereConditions = [
      'u.is_active = 1',
      'u.deleted_at IS NULL'
    ];
    let params = [];
    let havingClause = 'product_count > 0';
    let orderBy = 'u.created_at DESC';

    // Filtre par ville
    if (filters.city) {
      whereConditions.push('u.city = ?');
      params.push(filters.city);
    }

    // Filtre par pays
    if (filters.country) {
      whereConditions.push('u.country = ?');
      params.push(filters.country);
    }

    // Tri
    if (filters.sort === 'recent') {
      orderBy = 'u.created_at DESC';
    } else if (filters.sort === 'popular') {
      orderBy = 'total_views DESC';
    } else if (filters.sort === 'verified') {
      orderBy = 'product_count DESC';
    }

    const whereClause = whereConditions.join(' AND ');
    const limit = parseInt(filters.limit ?? 20, 10) || 20;
    const offset = parseInt(filters.offset ?? 0, 10) || 0;

    // CORRECTION: Requête principale avec paramètres
    const query = `
      SELECT u.id, u.business_name, u.store_slug, u.city, u.country, 
             u.is_verified, u.created_at, sc.logo_url,
             COUNT(p.id) as product_count,
             COALESCE(SUM(p.view_count), 0) as total_views
      FROM users u
      LEFT JOIN products p ON u.id = p.user_id 
        AND p.is_available = 1 
        AND p.deleted_at IS NULL
      LEFT JOIN store_customization sc ON u.id = sc.user_id
      WHERE ${whereClause}
      GROUP BY u.id, u.business_name, u.store_slug, u.city, u.country, 
               u.is_verified, u.created_at, sc.logo_url
      HAVING ${havingClause}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const queryParams = [...params];
    const [stores] = await pool.execute(query, queryParams);

    // Récupérer les produits pour chaque boutique
    for (let store of stores) {
      const [storeProducts] = await pool.execute(`
        SELECT p.id, p.name, p.price, p.currency, p.image_url,
               pl.token as share_token
        FROM products p
        LEFT JOIN product_links pl ON p.id = pl.product_id
        WHERE p.user_id = ? AND p.is_available = 1 AND p.deleted_at IS NULL
        ORDER BY p.view_count DESC
        LIMIT 4
      `, [store.id]);

      store.products = storeProducts.map(p => ({
        ...p,
        image_url: getImageUrl(p.image_url)
      }));
    }

    // CORRECTION: Compter le total
    const countQuery = `
      SELECT COUNT(DISTINCT u.id) as total
      FROM users u
      LEFT JOIN products p ON u.id = p.user_id 
        AND p.is_available = 1 
        AND p.deleted_at IS NULL
      WHERE ${whereClause}
      HAVING COUNT(p.id) > 0
    `;
    
    const [countResult] = await pool.execute(countQuery, params);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    return {
      stores,
      total,
      limit,
      offset
    };
  }

  /**
   * Récupère les catégories disponibles
   */
  async getCategories() {
    const [categories] = await pool.execute(`
      SELECT c.name, c.slug, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.is_available = 1 AND p.deleted_at IS NULL
      WHERE c.is_active = 1 AND c.deleted_at IS NULL
      GROUP BY c.id, c.name, c.slug
      HAVING product_count > 0
      ORDER BY c.name ASC
    `);

    return categories;
  }

  /**
   * Récupère les villes disponibles
   */
  async getCities() {
    const [cities] = await pool.execute(`
      SELECT DISTINCT u.city, COUNT(p.id) as product_count
      FROM users u
      JOIN products p ON u.id = p.user_id AND p.is_available = 1 AND p.deleted_at IS NULL
      WHERE u.city IS NOT NULL AND u.city != '' AND u.is_active = 1 AND u.deleted_at IS NULL
      GROUP BY u.city
      ORDER BY product_count DESC
      LIMIT 50
    `);

    return cities;
  }

  /**
   * Récupère les pays disponibles
   */
  async getCountries() {
    const [countries] = await pool.execute(`
      SELECT DISTINCT u.country, COUNT(p.id) as product_count
      FROM users u
      JOIN products p ON u.id = p.user_id AND p.is_available = 1 AND p.deleted_at IS NULL
      WHERE u.country IS NOT NULL AND u.country != '' AND u.is_active = 1 AND u.deleted_at IS NULL
      GROUP BY u.country
      ORDER BY product_count DESC
    `);

    return countries;
  }

  /**
   * Récupère les données publiques d'une boutique
   */
  async getStorePublicData(storeSlug, filters = {}) {
    // 1. Récupérer les infos du vendeur
    const [users] = await pool.execute(`
      SELECT id, business_name, store_slug, city, country, is_verified, 
             whatsapp_number, phone, email, created_at
      FROM users 
      WHERE store_slug = ? AND is_active = 1 AND deleted_at IS NULL
    `, [storeSlug]);

    if (users.length === 0) {
      throw new AppError('Boutique introuvable', 404);
    }

    const store = users[0];

    // 2. Récupérer la personnalisation
    const [configs] = await pool.execute(
      'SELECT * FROM store_customization WHERE user_id = ?',
      [store.id]
    );
    const customization = configs.length > 0 ? configs[0] : null;

    // 2.5 Vérifier le plan pour les limitations
    const [planCheck] = await pool.execute(`
      SELECT COALESCE(LOWER(sp.name), 'free') as plan_slug
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id AND (s.status = 'active' OR s.status = 'trial')
      LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE u.id = ?
    `, [store.id]);
    const planSlug = planCheck.length > 0 ? planCheck[0].plan_slug : 'free';
    const isFree = planSlug === 'free' || planSlug === 'gratuit';

    // 3. Récupérer les produits paginés
    let limit = parseInt(filters.limit ?? 20, 10) || 20;
    let page = parseInt(filters.page ?? 1, 10) || 1;
    let offset = (page - 1) * limit;

    // Limitation Plan Gratuit : 5 produits max (les plus récents)
    if (isFree) {
      limit = 5;
      offset = 0;
      page = 1;
    }

    let productWhere = 'p.user_id = ? AND p.is_available = 1 AND p.deleted_at IS NULL';
    let productParams = [store.id];

    // Les filtres (catégorie, recherche) ne fonctionnent pas pour le plan Gratuit
    if (!isFree) {
      if (filters.category && filters.category !== 'all') {
        productWhere += ' AND c.slug = ?';
        productParams.push(filters.category);
      }

      if (filters.search) {
        productWhere += ' AND (p.name LIKE ? OR p.description LIKE ?)';
        productParams.push(`%${filters.search}%`, `%${filters.search}%`);
      }
    }

    const [products] = await pool.execute(`
      SELECT p.*, c.name as category_name, c.slug as category_slug,
             pl.token as share_token
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_links pl ON p.id = pl.product_id
      WHERE ${productWhere}
      ORDER BY p.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `, productParams);

    // Formater les images
    products.forEach(p => p.image_url = getImageUrl(p.image_url));

    // Compter le total
    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${productWhere}
    `, productParams);

    // 4. Récupérer les catégories de cette boutique
    const [storeCategories] = await pool.execute(`
      SELECT DISTINCT c.name, c.slug, COUNT(p.id) as product_count
      FROM categories c
      JOIN products p ON c.id = p.category_id
      WHERE p.user_id = ? AND p.is_available = 1 AND p.deleted_at IS NULL
      GROUP BY c.id
      ORDER BY c.name ASC
    `, [store.id]);

    return {
      store,
      customization,
      products,
      categories: storeCategories,
      pagination: {
        page,
        limit,
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    };
  }
}

module.exports = new MarketplaceService();