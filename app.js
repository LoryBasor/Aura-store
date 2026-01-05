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
const { testConnection, closePool } = require('./src/config/database');
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
      scriptSrc: ["'self'", "'unsafe-inline'"],
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
      // Pas de token, rediriger vers login
      console.error('Pas de token');
      return res.redirect('/login');
    }else{
      console.log(authHeader);
    }

    const token = authHeader;
    const { verifyToken } = require('./src/config/jwt');
    const { pool } = require('./src/config/database');
    
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      // Token invalide ou expiré
      console.error('Token invalide ou expiré');
      return res.redirect('/login');
    }
    // Vérifier que l'utilisateur existe
    const [users] = await pool.execute(
      'SELECT id, email, business_name, store_slug, is_active, role, account_status FROM users WHERE id = ? AND deleted_at IS NULL',
      [decoded.userId]
    );

    if (users.length === 0 || !users[0].is_active) {
      console.error('utilisateur n extiste pas');
      return res.redirect('/login');
    }

    const user = users[0];

    // Vérifier si le compte est suspendu ou désactivé
    if (user.account_status === 'suspended' || user.account_status === 'deactivated') {
      return res.render('errors/account-suspended', {
        title: 'Compte Suspendu',
        showSidebar: false,
        showHeader: false,
        reason: user.suspended_reason || 'Contactez le support'
      });
    }

    // Ajouter l'utilisateur au contexte de la requête
    req.user = {
      id: user.id,
      email: user.email,
      business_name: user.business_name,
      store_slug: user.store_slug,
      role: user.role,
      account_status: user.account_status
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
  res.render('index', {
    layout: false
  });
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
app.get('/p/:token', (req, res) => {
  res.render('public/product', {
    title: 'Produit',
    showSidebar: false,
    showHeader: false,
    layout: false,
    token: req.params.token
  });
});
// Boutique publique (tous les produits d'un vendeur)
app.get('/store/:storeSlug', (req, res) => {
  res.render('public/store', {
    title: 'Boutique',
    showSidebar: false,
    showHeader: false,
    layout: false,
    storeSlug: req.params.storeSlug
  });
});

// ==================== ESPACE VENDEUR (Protected) ====================

// Dashboard vendeur
app.get('/dashboard',authenticateView,  (req, res) => {
  res.render('dashboard/index', {
    title: 'Tableau de bord',
    pageTitle: 'Tableau de bord',
    currentPage: 'dashboard',
    user: req.user
  });
});

// Statistiques avancées (PRO et BUSINESS)
app.get('/advanced-stats', (req, res) => {
  res.render('dashboard/advanced-stats', {
    title: 'Statistiques Avancées',
    pageTitle: 'Statistiques Avancées',
    currentPage: 'advanced-stats',
    user: req.user
  });
});

// Personnalisation (BUSINESS uniquement)
app.get('/customization', (req, res) => {
  res.render('dashboard/customization', {
    title: 'Personnalisation',
    pageTitle: 'Personnalisation',
    currentPage: 'customization',
    user: req.user
  });
});

// Intégrations (BUSINESS uniquement)
app.get('/integrations', (req, res) => {
  res.render('dashboard/integrations', {
    title: 'Intégrations',
    pageTitle: 'Intégrations',
    currentPage: 'integrations',
    user: req.user
  });
});

// Gestion des produits
app.get('/products', authenticateView, (req, res) => {
  res.render('dashboard/products', {
    title: 'Mes Produits',
    pageTitle: 'Mes Produits',
    currentPage: 'products',
    user: req.user
  });
});

// Gestion des commandes
app.get('/orders', authenticateView, (req, res) => {
  res.render('dashboard/orders', {
    title: 'Commandes',
    pageTitle: 'Mes Commandes',
    currentPage: 'orders',
    user: req.user
  });
});

// Gestion des clients
app.get('/customers', authenticateView, (req, res) => {
  res.render('dashboard/customers', {
    title: 'Clients',
    pageTitle: 'Mes Clients',
    currentPage: 'customers',
    user: req.user
  });
});

// Profil utilisateur
app.get('/profile', authenticateView, (req, res) => {
  res.render('dashboard/profile', {
    title: 'Mon Profil',
    pageTitle: 'Mon Profil',
    currentPage: 'profile',
    user: req.user
  });
});

// Abonnement
app.get('/subscription', authenticateView, (req, res) => {
  res.render('dashboard/subscription', {
    title: 'Mon Abonnement',
    pageTitle: 'Mon Abonnement',
    currentPage: 'subscription',
    user: req.user
  });
});

// ==================== ESPACE ADMIN (Protected + Super Admin) ====================

// Dashboard admin
app.get('/admin/dashboard', authenticateView, requireSuperAdminView, (req, res) => {
  res.render('admin/dashboard', {
    title: 'Administration',
    pageTitle: 'Administration',
    currentPage: 'admin-dashboard',
    user: req.user
  });
});

// Gestion des vendeurs
app.get('/admin/vendors', authenticateView, requireSuperAdminView, (req, res) => {
  res.render('admin/vendors', {
    title: 'Gestion Vendeurs',
    pageTitle: 'Gestion des Vendeurs',
    currentPage: 'admin-vendors',
    user: req.user
  });
});

// Détails d'un vendeur
app.get('/admin/vendors/:id', authenticateView, requireSuperAdminView, (req, res) => {
  res.render('admin/vendor-details', {
    title: 'Détails Vendeur',
    pageTitle: 'Détails Vendeur',
    currentPage: 'admin-vendors',
    user: req.user,
    vendorId: req.params.id
  });
});

// Gestion des plans et abonnements
app.get('/admin/subscriptions', authenticateView, requireSuperAdminView, (req, res) => {
  res.render('admin/plans', {
    title: 'Plans & Abonnements',
    pageTitle: 'Plans & Abonnements',
    currentPage: 'admin-plans',
    user: req.user
  });
});

// Gestion d'un abonnement spécifique
app.get('/admin/subscriptions/:userId', authenticateView, requireSuperAdminView, (req, res) => {
  res.render('admin/subscription-details', {
    title: 'Gestion Abonnement',
    pageTitle: 'Gestion Abonnement',
    currentPage: 'admin-plans',
    user: req.user,
    userId: req.params.userId
  });
});

// Activité globale
app.get('/admin/activity', authenticateView, requireSuperAdminView, (req, res) => {
  res.render('admin/activity', {
    title: 'Activité Globale',
    pageTitle: 'Activité de la Plateforme',
    currentPage: 'admin-activity',
    user: req.user
  });
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
      console.log('   - http://localhost:' + PORT + '/login (Connexion)');
      console.log('   - http://localhost:' + PORT + '/register (Inscription)');
      console.log('   - http://localhost:' + PORT + '/dashboard (Vendeur)');
      console.log('   - http://localhost:' + PORT + '/admin/dashboard (Admin)');
      console.log('   - http://localhost:' + PORT + '/api/health (API Health)');
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
