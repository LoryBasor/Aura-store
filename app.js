/**
 * ========================================
 * AURA - Application Express Principale
 * ========================================
 * Serveur avec support EJS, API REST et authentification JWT
 * ========================================
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const expressLayouts = require('express-ejs-layouts');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Configuration et utilitaires
const { pool, testConnection, closePool } = require('./src/config/database');
const { testConnection: testCloudinary } = require('./src/config/cloudinary');
const { UPLOAD_DIR } = require('./src/config/upload');

// Routes API
const apiRoutes = require('./src/routes');

// Gestion des erreurs
const { errorHandler, notFoundHandler } = require('./src/middlewares/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * ========================================
 * CONFIGURATION EJS
 * ========================================
 */
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layouts/main');

/**
 * ========================================
 * MIDDLEWARES GLOBAUX
 * ========================================
 */

// Sécurité (CSP modifié pour permettre inline scripts nécessaires à EJS)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  }
}));

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

app.set('trust proxy', 1); 

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

/**
 * ========================================
 * MIDDLEWARE D'AUTHENTIFICATION POUR LES VUES
 * ========================================
 * Vérifie le token et charge req.user pour les pages EJS
 */
async function authenticateView(req, res, next) {
  try {
    // Récupérer le token depuis le cookie
    const authHeader = req.cookies.aura_token;
    
    if (!authHeader) {
      console.error('Pas de token');
      return res.redirect('/login');
    }

    const token = authHeader;
    const { verifyToken } = require('./src/config/jwt');
    const { pool } = require('./src/config/database');
    
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      console.error('Token invalide ou expiré');
      return res.redirect('/login');
    }

    // Vérifier l'utilisateur ET récupérer son plan en une seule requête
    const [users] = await pool.execute(
      `SELECT u.id, u.email, u.business_name, u.store_slug, u.is_active, u.role, u.account_status, u.suspended_reason,
              u.phone, u.whatsapp_number, u.city, u.country,
              sc.logo_url,
              COALESCE(sp.name, 'Gratuit') as plan_name, COALESCE(LOWER(sp.name), 'free') as plan_slug
       FROM users u
       LEFT JOIN subscriptions s ON u.id = s.user_id AND (s.status = 'active' OR s.status = 'trial')
       LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
       LEFT JOIN store_customization sc ON u.id = sc.user_id
       WHERE u.id = ? AND u.deleted_at IS NULL`,
      [decoded.userId]
    );

    if (users.length === 0) {
      console.error('Utilisateur non trouvé');
      return res.redirect('/login');
    }

    const user = users[0];
    console.log(`[AuthView] User: ${user.email}, Status: ${user.account_status}, Reason: ${user.suspended_reason}`);

    // 1. Vérifier si le compte est suspendu ou désactivé (Priorité)
    if (user.account_status === 'suspended' || user.account_status === 'deactivated') {
      return res.render('errors/account-suspended', {
        title: 'Compte Suspendu',
        showSidebar: false,
        showHeader: false,
        reason: user.suspended_reason || 'Contactez le support'
      });
    }

    // 2. Vérifier si l'utilisateur est actif (legacy check)
    if (!user.is_active) {
      console.error('Utilisateur inactif');
      return res.redirect('/login');
    }

    // Ajouter l'utilisateur et son plan au contexte de la requête
    req.user = {
      id: user.id,
      email: user.email,
      business_name: user.business_name,
      store_slug: user.store_slug,
      role: user.role,
      account_status: user.account_status,
      phone: user.phone,
      whatsapp_number: user.whatsapp_number,
      city: user.city,
      country: user.country,
      logo_url: user.logo_url,
      plan_name: user.plan_name,
      plan_slug: user.plan_slug,
      // Accès par plan
      has_advanced_stats: ['pro', 'business'].includes(user.plan_slug),
      has_export: ['pro', 'business'].includes(user.plan_slug),
      has_customization: user.plan_slug === 'business',
      has_integrations: user.plan_slug === 'business'
    };

    next();
  } catch (error) {
    console.error('Erreur authentification vue:', error);
    res.redirect('/login');
  }
}


/**
 * Middleware pour vérifier Super Admin sur les vues
 */
function requireSuperAdminView(req, res, next) {
  if (!req.user || req.user.role !== 'SUPER_ADMIN') {
    return res.render('errors/403', {
      title: 'Accès Refusé',
      showSidebar: false,
      showHeader: false,
      message: 'Cette page est réservée aux administrateurs'
    });
  }
  next();
}

/**
 * ========================================
 * ROUTES API (Backend REST)
 * ========================================
 */
app.use('/api', apiRoutes);

/**
 * ========================================
 * ROUTES VUES EJS (Frontend)
 * ========================================
 */

// ==================== PAGES PUBLIQUES ====================

// Page d'accueil - redirection intelligente
app.get('/', (req, res) => {
  res.redirect('/marketplace');
});

// Page de connexion
app.get('/login', (req, res) => {
  res.render('auth/login', {
    title: 'Connexion',
    layout: false
  });
});

// Page d'inscription
app.get('/register', (req, res) => {
  res.render('auth/register', {
    title: 'Inscription',
    layout: false
  });
});

// Page produit public (lien de partage)
app.get('/p/:token', async (req, res, next) => {
  try {
    const { product, customMessage } = await productService.getProductByShareToken(req.params.token);

    // Fetch vendor store customization & integrations
    let customization = null;
    let integrations = null;
    let isBusiness = false;

    try {
      customization = await storeCustomizationService.getPublicCustomization(product.store_slug);
      
      // Vérifier le plan via une vue ou service
      const [planCheck] = await pool.execute(
        `SELECT plan_name FROM v_user_plan_access 
         WHERE user_id = ? AND plan_name = 'Business' 
         AND (subscription_status = 'active' OR subscription_status = 'trial')`,
        [product.vendor_id]
      );
      isBusiness = planCheck.length > 0;

      // Si Business, on peut charger les intégrations
      if (isBusiness) {
        const [intResult] = await pool.execute(
          'SELECT * FROM social_integrations WHERE user_id = ?',
          [product.vendor_id]
        );
        if (intResult.length > 0) integrations = intResult[0];
      }
    } catch (e) { console.error('Error fetching public store data:', e); }

    res.render('public/product', {
      title: `${product.name} | ${customization?.store_title || product.business_name || 'Aura'}`,
      product,
      customMessage,
      customization,
      integrations,
      isBusiness,
      showSidebar: false,
      showHeader: false,
      layout: false
    });
  } catch (error) {
    next(error);
  }
});
// Boutique publique (tous les produits d'un vendeur)
app.get('/store/:storeSlug', async (req, res, next) => {
  try {
    const filters = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 12,
      category: req.query.category,
      search: req.query.search
    };
    
    const storeData = await marketplaceService.getStorePublicData(req.params.storeSlug, filters);
    
    // Fetch customization & Integrations
    let customization = null;
    let integrations = null;
    let isBusiness = false;
    let isFree = true;

    try {
      customization = await storeCustomizationService.getPublicCustomization(req.params.storeSlug);
      
      const [planCheck] = await pool.execute(
        `SELECT plan_name FROM v_user_plan_access 
         WHERE user_id = ? AND plan_name = 'Business' 
         AND (subscription_status = 'active' OR subscription_status = 'trial')`,
        [storeData.store.id]
      );
      isBusiness = planCheck.length > 0;

      const [freeCheck] = await pool.execute(
        `SELECT plan_name FROM v_user_plan_access 
         WHERE user_id = ? AND (plan_name = 'Pro' OR plan_name = 'Business')
         AND (subscription_status = 'active' OR subscription_status = 'trial')`,
        [storeData.store.id]
      );
      isFree = freeCheck.length === 0;

      if (isBusiness) {
        const [intResult] = await pool.execute(
          'SELECT * FROM social_integrations WHERE user_id = ?',
          [storeData.store.id]
        );
        if (intResult.length > 0) integrations = intResult[0];
      }
    } catch(e) { console.error('Error in store route:', e); }

    res.render('public/store', {
      title: `${storeData.store.business_name} | Aura`,
      ...storeData,
      filters,
      customization,
      integrations,
      isBusiness,
      isFree,
      showSidebar: false,
      showHeader: false,
      layout: false
    });
  } catch (error) {
    next(error);
  }
});

// ==================== PAGES D'INFORMATION ====================
app.get('/about', async (req, res, next) => {
  try {
    const { pool } = require('./src/config/database');
    const [plans] = await pool.execute(
      'SELECT * FROM subscription_plans WHERE is_public = 1 AND is_active = 1 ORDER BY price ASC'
    );
    res.render('index', { 
      title: 'À propos d\'Aura',
      plans,
      showSidebar: false,
      showHeader: false,
      layout: false
    });
  } catch (error) {
    res.render('index', { 
      title: 'À propos d\'Aura',
      plans: [],
      showSidebar: false,
      showHeader: false,
      layout: false
    });
  }
});

// ==================== MARKETPLACE PUBLIQUE ====================

// Page principale marketplace
const marketplaceService = require('./src/services/marketplaceService');
app.get('/marketplace', async (req, res) => {
  res.render('marketplace/home', {
    title: 'Marketplace - Aura',
    data: await marketplaceService.getMarketplaceHome(),
    showSidebar: false,
    showHeader: false,
    layout: false
  });
});

// Page liste produits marketplace
app.get('/marketplace/products', async (req, res, next) => {
  try {
    const marketplaceService = require('./src/services/marketplaceService');
    const marketplaceController = require('./src/controllers/marketplaceController');
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const filters = {
      search: req.query.search,
      category: req.query.category,
      city: req.query.city,
      country: req.query.country,
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : null,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : null,
      sort: req.query.sort || 'recent',
      limit,
      offset
    };

    const productData = await marketplaceService.getProducts(filters);
    const categories = await marketplaceService.getCategories();
    const cities = await marketplaceService.getCities();
    const countries = await marketplaceService.getCountries();

    res.render('marketplace/products', {
      title: 'Produits - Marketplace Aura',
      data: { 
        ...productData, 
        filters, 
        categories, 
        cities, 
        countries,
        pagination: {
          page,
          limit,
          total: productData.total,
          totalPages: Math.ceil(productData.total / limit)
        }
      },
      showSidebar: false,
      showHeader: false,
      layout: false
    });
  } catch (error) {
    next(error);
  }
});

// Page liste boutiques marketplace
app.get('/marketplace/stores', async (req, res, next) => {
  try {
    const marketplaceService = require('./src/services/marketplaceService');
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const filters = {
      city: req.query.city,
      country: req.query.country,
      sort: req.query.sort || 'recent',
      limit,
      offset
    };

    const storesData = await marketplaceService.getStores(filters);
    const cities = await marketplaceService.getCities();
    const countries = await marketplaceService.getCountries();

    res.render('marketplace/stores', {
      title: 'Boutiques - Marketplace Aura',
      data: { 
        ...storesData, 
        filters, 
        cities, 
        countries,
        pagination: {
          page,
          limit,
          total: storesData.total,
          totalPages: Math.ceil(storesData.total / limit)
        }
      },
      showSidebar: false,
      showHeader: false,
      layout: false
    });
  } catch (error) {
    next(error);
  }
});

// ==================== ESPACE VENDEUR (SSR - Protected) ====================

const statsService = require('./src/services/statsService');
const categoryService = require('./src/services/categoryService');
const productService = require('./src/services/productService');
const orderService = require('./src/services/orderService');
const authService = require('./src/services/authService');
const advancedStatsService = require('./src/services/advancedStatsService');
const storeCustomizationService = require('./src/services/storeCustomizationService');
const socialIntegrationsService = require('./src/services/socialIntegrationsService');
const adminDashboardService = require('./src/services/admin/dashboardService');
const userManagementService = require('./src/services/admin/userManagementService');
const adminSubscriptionService = require('./src/services/admin/subscriptionService');

// ── Dashboard vendeur ──
app.get('/dashboard', authenticateView, async (req, res, next) => {
  try {
    const dashboardData = await statsService.getDashboardStats(req.user.id);
    let chartData = null;
    
    // Si l'utilisateur a accès aux statistiques avancées (PRO/BUSINESS), on récupère les données d'évolution
    if (req.user.has_advanced_stats) {
      try {
        chartData = await advancedStatsService.getOrdersEvolution(req.user.id, 'day', 30);
      } catch (err) {
        console.error('Erreur récupération evolution pour dashboard:', err);
      }
    }

    res.render('dashboard/index', {
      title: 'Tableau de bord',
      pageTitle: 'Tableau de bord',
      currentPage: 'dashboard',
      user: req.user,
      stats: dashboardData.overview,
      recentOrders: dashboardData.recent_orders,
      topProducts: dashboardData.top_products,
      chartData: chartData ? JSON.stringify(chartData) : null
    });
  } catch (error) { next(error); }
});

// ── Statistiques avancées (PRO et BUSINESS) ──
app.get('/advanced-stats', authenticateView, async (req, res, next) => {
  try {
    const evolution = await advancedStatsService.getOrdersEvolution(req.user.id, 'day', 30);
    const byStatus = await advancedStatsService.getOrdersByStatus(req.user.id);
    const topProducts = await advancedStatsService.getTopProducts(req.user.id, 10);
    const conversion = await advancedStatsService.getConversionMetrics(req.user.id);
    const customers = await advancedStatsService.getCustomerAnalysis(req.user.id);
    const forecast = await advancedStatsService.getForecast(req.user.id);
    const hourlyStats = await advancedStatsService.getOrdersByHour(req.user.id);
    const storeVisibility = await advancedStatsService.getStoreVisibility(req.user.id);
    const solicitedProducts = await advancedStatsService.getMostSolicitedProducts(req.user.id, 5);
    const categoryPerformance = await advancedStatsService.getCategoryPerformance(req.user.id);
    const topCustomersList = await advancedStatsService.getTopCustomers(req.user.id, 5);
    const subHistory = await advancedStatsService.getSubscriptionHistory(req.user.id);

    res.render('dashboard/advanced-stats', {
      title: 'Statistiques Avancées',
      pageTitle: 'Statistiques Avancées',
      currentPage: 'advanced-stats',
      user: req.user,
      evolution,
      byStatus,
      topProducts,
      conversion,
      customers,
      forecast,
      hourlyStats,
      storeVisibility,
      solicitedProducts,
      categoryPerformance,
      topCustomersList,
      subHistory
    });
  } catch (error) { next(error); }
});

// ── Personnalisation (BUSINESS) ──
app.get('/customization', authenticateView, async (req, res, next) => {
  try {
    let customization = null;
    try { customization = await storeCustomizationService.getCustomization(req.user.id); } catch(e) {}
    res.render('dashboard/customization', {
      title: 'Personnalisation',
      pageTitle: 'Personnalisation',
      currentPage: 'customization',
      user: req.user,
      customization
    });
  } catch (error) { next(error); }
});

// ── Intégrations (BUSINESS) ──
app.get('/integrations', authenticateView, async (req, res, next) => {
  try {
    let integrations = null;
    try { integrations = await socialIntegrationsService.getIntegrations(req.user.id); } catch(e) {}
    res.render('dashboard/integrations', {
      title: 'Intégrations',
      pageTitle: 'Intégrations',
      currentPage: 'integrations',
      user: req.user,
      integrations
    });
  } catch (error) { next(error); }
});

// ── Produits ──
app.get('/products', authenticateView, async (req, res, next) => {
  try {
    const search = req.query.search || '';
    const status = req.query.status || 'undefined';
    const category = req.query.category || null;
    const page = parseInt(req.query.page) || 1;

    const [productData, categories] = await Promise.all([
      productService.getProductsByUser(req.user.id, `search=${search}`, {
        page, limit: 20, is_available: status, category_id: category
      }),
      categoryService.getCategoriesByUser(req.user.id)
    ]);

    res.render('dashboard/products', {
      title: 'Mes Produits',
      pageTitle: 'Mes Produits',
      currentPage: 'products',
      user: req.user,
      products: productData.products,
      pagination: productData.pagination,
      categories,
      filters: { search, status, category, page }
    });
  } catch (error) { next(error); }
});

// ── Catégories ──
app.get('/categories', authenticateView, async (req, res, next) => {
  try {
    const categories = await categoryService.getCategoriesByUser(req.user.id);
    res.render('dashboard/categories', {
      title: 'Catégories | AURA',
      pageTitle: 'Catégories',
      currentPage: 'categories',
      user: req.user,
      categories
    });
  } catch (error) { next(error); }
});

// ── Commandes ──
app.get('/orders', authenticateView, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const status = req.query.status || null;
    const search = req.query.search || '';

    const [orderData, orderStats, productData] = await Promise.all([
      orderService.getOrdersByUser(req.user.id, { page, limit: 20, status }),
      orderService.getOrderStats(req.user.id),
      productService.getProductsByUser(req.user.id, '', { page: 1, limit: 500, is_available: 'true' })
    ]);

    res.render('dashboard/orders', {
      title: 'Commandes',
      pageTitle: 'Mes Commandes',
      currentPage: 'orders',
      user: req.user,
      orders: orderData.orders,
      pagination: orderData.pagination,
      orderStats: orderStats.stats,
      filters: { status, search, page },
      availableProducts: productData.products || []
    });
  } catch (error) { next(error); }
});

// ── Clients ──
app.get('/customers', authenticateView, async (req, res, next) => {
  try {
    const { pool } = require('./src/config/database');
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    const [customers] = await pool.execute(
      `SELECT * FROM customers WHERE user_id = ? AND deleted_at IS NULL 
       AND (name LIKE ? OR phone LIKE ?) ORDER BY total_spent DESC LIMIT ${limit} OFFSET ${offset}`,
      [req.user.id, `%${search}%`, `%${search}%`]
    );
    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM customers WHERE user_id = ? AND deleted_at IS NULL',
      [req.user.id]
    );

    res.render('dashboard/customers', {
      title: 'Clients',
      pageTitle: 'Mes Clients',
      currentPage: 'customers',
      user: req.user,
      customers,
      pagination: { page, limit, total: countResult[0].total },
      filters: { search }
    });
  } catch (error) { next(error); }
});

// ── Profil ──
app.get('/profile', authenticateView, async (req, res, next) => {
  try {
    const profile = await authService.getUserProfile(req.user.id);
    res.render('dashboard/profile', {
      title: 'Mon Profil',
      pageTitle: 'Mon Profil',
      currentPage: 'profile',
      user: req.user,
      profile
    });
  } catch (error) { next(error); }
});

// ── Abonnement ──
app.get('/subscription', authenticateView, async (req, res, next) => {
  try {
    const { pool } = require('./src/config/database');
    
    // 1. Tous les plans publics
    const [plans] = await pool.execute(
      'SELECT * FROM subscription_plans WHERE is_public = 1 AND is_active = 1 ORDER BY price ASC'
    );

    // 2. Détails de l'abonnement actuel via la vue v_user_plan_access
    const [accessInfo] = await pool.execute(
      'SELECT * FROM v_user_plan_access WHERE user_id = ?',
      [req.user.id]
    );

    // 3. Historique récent
    const [history] = await pool.execute(
      `SELECT sh.*, sp.name as plan_name 
       FROM subscription_history sh 
       JOIN subscription_plans sp ON sh.plan_id = sp.id 
       WHERE sh.user_id = ? 
       ORDER BY sh.created_at DESC LIMIT 5`,
      [req.user.id]
    );

    // 4. Nombre de commandes cette semaine (pour suivi quota Plan Gratuit)
    const [weeklyOrders] = await pool.execute(
      'SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)',
      [req.user.id]
    );

    res.render('dashboard/subscription', {
      title: 'Mon Plan',
      pageTitle: 'Mon Plan & Abonnement',
      currentPage: 'subscription',
      user: req.user,
      plans,
      subscription: accessInfo.length > 0 ? accessInfo[0] : null,
      weeklyOrders: weeklyOrders[0].count,
      history
    });
  } catch (error) { 
    console.error('Erreur route subscription:', error);
    next(error); 
  }
});

// ==================== ESPACE ADMIN (SSR - Protected + Super Admin) ====================

// ── Dashboard admin ──
app.get('/admin/dashboard', authenticateView, requireSuperAdminView, async (req, res, next) => {
  try {
    const [globalStats, topVendors, recentVendors, recentOrders, conversionRate, subDistrib, trends] = await Promise.all([
      adminDashboardService.getGlobalStats(),
      adminDashboardService.getTopVendors(10),
      adminDashboardService.getRecentVendors(10),
      adminDashboardService.getRecentOrders(20),
      adminDashboardService.getConversionRate(),
      adminDashboardService.getSubscriptionDistribution(),
      adminDashboardService.getStatsByPeriod('30days')
    ]);
    res.render('admin/dashboard', {
      title: 'Administration',
      pageTitle: 'Administration',
      currentPage: 'admin-dashboard',
      user: req.user,
      globalStats,
      topVendors,
      recentVendors,
      recentOrders,
      conversionRate,
      subDistrib,
      trends
    });
  } catch (error) { next(error); }
});

// ── Vendeurs admin ──
app.get('/admin/vendors', authenticateView, requireSuperAdminView, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const result = await userManagementService.listAllVendors({ page, limit: 20, status, search });
    res.render('admin/vendors', {
      title: 'Gestion Vendeurs',
      pageTitle: 'Gestion des Vendeurs',
      currentPage: 'admin-vendors',
      user: req.user,
      vendors: result.vendors,
      pagination: result.pagination,
      filters: { search, status }
    });
  } catch (error) { next(error); }
});

// ── Détails vendeur ──
app.get('/admin/vendors/:id', authenticateView, requireSuperAdminView, async (req, res, next) => {
  try {
    const details = await userManagementService.getVendorDetails(req.params.id);
    res.render('admin/vendor-details', {
      title: 'Détails Vendeur',
      pageTitle: 'Détails Vendeur',
      currentPage: 'admin-vendors',
      user: req.user,
      vendorId: req.params.id,
      vendor: details
    });
  } catch (error) { next(error); }
});

// ── Plans & Abonnements admin ──
app.get('/admin/subscriptions', authenticateView, requireSuperAdminView, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const planFilter = req.query.plan || '';
    const statusFilter = req.query.status || '';

    const { pool } = require('./src/config/database');
    const [plans] = await pool.execute('SELECT * FROM subscription_plans ORDER BY price ASC');
    const result = await adminSubscriptionService.listSubscriptions({ page, limit: 20, search, plan: planFilter, status: statusFilter });

    res.render('admin/plans', {
      title: 'Plans & Abonnements',
      pageTitle: 'Plans & Abonnements',
      currentPage: 'admin-plans',
      user: req.user,
      plans,
      subscriptions: result.subscriptions || [],
      pagination: result.pagination || { page: 1, limit: 20, total: 0 },
      filters: { search, plan: planFilter, status: statusFilter }
    });
  } catch (error) { next(error); }
});

// ── Détails abonnement ──
app.get('/admin/subscriptions/:userId', authenticateView, requireSuperAdminView, async (req, res, next) => {
  try {
    const { pool } = require('./src/config/database');
    const [history] = await pool.execute(
      `SELECT s.*, sp.name as plan_name, sp.price FROM subscriptions s
       JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE s.user_id = ? ORDER BY s.created_at DESC`,
      [req.params.userId]
    );
    const [plans] = await pool.execute('SELECT * FROM subscription_plans ORDER BY price ASC');
    const vendorDetails = await userManagementService.getVendorDetails(req.params.userId);
    res.render('admin/subscription-details', {
      title: 'Gestion Abonnement',
      pageTitle: 'Gestion Abonnement',
      currentPage: 'admin-plans',
      user: req.user,
      userId: req.params.userId,
      vendor: vendorDetails,
      history,
      plans
    });
  } catch (error) { next(error); }
});

// ── Activité globale ──
app.get('/admin/activity', authenticateView, requireSuperAdminView, async (req, res, next) => {
  try {
    const { pool } = require('./src/config/database');
    const adminDashboardService = require('./src/services/admin/dashboardService');

    const [activityLogs, globalStats, recentVendors, recentOrders, trends, currentPlans] = await Promise.all([
      pool.execute(
        `SELECT al.*, u.business_name as admin_name, u.email as admin_email
         FROM admin_audit_logs al LEFT JOIN users u ON al.admin_id = u.id
         ORDER BY al.created_at DESC LIMIT 100`
      ).then(r => r[0]),
      adminDashboardService.getGlobalStats(),
      adminDashboardService.getRecentVendors(10),
      adminDashboardService.getRecentOrders(10),
      adminDashboardService.getStatsByPeriod('30days'),
      adminSubscriptionService.listPlans({ includeInactive: true })
    ]);

    res.render('admin/activity', {
      title: 'Activité Globale',
      pageTitle: 'Activité de la Plateforme',
      currentPage: 'admin-activity',
      user: req.user,
      activityLogs,
      globalStats,
      recentVendors,
      recentOrders,
      trends,
      plans: currentPlans
    });
  } catch (error) { next(error); }
});

// ── API: Modifier prix plan ──
app.post('/api/admin/plans/:id/price', authenticateView, requireSuperAdminView, async (req, res, next) => {
  try {
    const { price } = req.body;
    const { id } = req.params;
    await adminSubscriptionService.updatePlanPrice(id, price, req.user.id);
    res.json({ success: true, message: 'Prix mis à jour' });
  } catch (error) { next(error); }
});

// ── API: Modifier statut abonnement ──
app.put('/api/admin/subscriptions/:id/status', authenticateView, requireSuperAdminView, async (req, res, next) => {
  try {
    const { status } = req.body;
    const { id } = req.params;
    await adminSubscriptionService.updateSubscriptionStatus(id, status, req.user.id);
    res.json({ success: true, message: 'Statut mis à jour' });
  } catch (error) { next(error); }
});

/**
 * ========================================
 * GESTION DES ERREURS
 * ========================================
 */

// Page 404 personnalisée
app.use((req, res) => {
  // Vérifier si c'est une route API
  if (req.path.startsWith('/api')) {
    return notFoundHandler(req, res);
  }
  
  // Sinon, afficher la page 404 HTML
  res.status(404).render('errors/404', {
    title: 'Page introuvable',
    showSidebar: false,
    showHeader: false
  });
});

// Gestionnaire d'erreurs global
app.use(errorHandler);

/**
 * ========================================
 * DÉMARRAGE DU SERVEUR
 * ========================================
 */
async function startServer() {
  try {
    // Test connexion BDD
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('❌ Impossible de se connecter à la base de données');
      process.exit(1);
    }
    // Tester la connexion Cloudinary
    const cloudinaryOk = await testCloudinary();
    if (!cloudinaryOk) {
      throw new Error('Connexion Cloudinary échouée');
    }
    // Démarrer le serveur
    const server = app.listen(PORT, () => {
      console.log('');
      console.log('=================================');
      console.log('✨ AURA - Serveur démarré !');
      console.log('=================================');
      console.log(`📱 Port: ${PORT}`);
      console.log(`🌐 URL: http://localhost:${PORT}`); 
      console.log(`🔧 Environnement: ${process.env.NODE_ENV || 'development'}`);
      console.log('=================================');
      console.log('');
      console.log('📍 Routes disponibles:');
      console.log(`   - ${process.env.APP_URL}/ (Accueil)`);
      console.log(`   - ${process.env.APP_URL}/marketplace (Marketplace)`);
      console.log(`   - ${process.env.APP_URL}/marketplace/products (Produits)`);
      console.log(`   - ${process.env.APP_URL}/marketplace/stores (Boutiques)`);
      console.log(`   - ${process.env.APP_URL}/login (Connexion)`);
      console.log(`   - ${process.env.APP_URL}/register (Inscription)`);
      console.log(`   - ${process.env.APP_URL}/dashboard (Vendeur)`);
      console.log(`   - ${process.env.APP_URL}/admin/dashboard (Admin)`);
      console.log(`   - ${process.env.APP_URL}/api/health (API Health)`);
      console.log('');
    });

    // Arrêt gracieux
    process.on('SIGTERM', () => gracefulShutdown(server));
    process.on('SIGINT', () => gracefulShutdown(server));

  } catch (error) {
    console.error('❌ Erreur au démarrage:', error);
    process.exit(1);
  }
}

/**
 * Arrêt gracieux du serveur
 */
async function gracefulShutdown(server) {
  console.log('\n⏳ Arrêt du serveur en cours...');
  
  server.close(async () => {
    console.log('✅ Serveur HTTP fermé');
    await closePool();
    console.log('✅ Connexions BDD fermées');
    console.log('✅ Arrêt complet');
    process.exit(0);
  });

  // Forcer l'arrêt après 10 secondes
  setTimeout(() => {
    console.error('⚠️ Arrêt forcé après timeout');
    process.exit(1);
  }, 10000);
}

// Démarrer le serveur
if (require.main === module) {
  startServer();
}

module.exports = app;
