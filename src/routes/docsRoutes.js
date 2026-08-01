// src/routes/docsRoutes.js
const express = require('express');
const { pool } = require('../config/database');
const { verifyToken } = require('../config/jwt');
const router = express.Router();

// Middleware d'authentification optionnelle (ne bloque pas si pas de session)
async function optionalAuthenticateView(req, res, next) {
  try {
    const token = req.cookies.aura_token;
    if (!token) {
      req.user = null;
      return next();
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      req.user = null;
      return next();
    }

    const [users] = await pool.execute(
      `SELECT u.id, u.email, u.business_name, u.store_slug, u.role, u.account_status,
              COALESCE(sp.name, 'Gratuit') as plan_name, COALESCE(LOWER(sp.name), 'free') as plan_slug
       FROM users u
       LEFT JOIN subscriptions s ON u.id = s.user_id AND (s.status = 'active' OR s.status = 'trial')
       LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE u.id = ? AND u.deleted_at IS NULL`,
      [decoded.userId]
    );

    if (users.length > 0) {
      const user = users[0];
      req.user = {
        id: user.id,
        email: user.email,
        business_name: user.business_name,
        store_slug: user.store_slug,
        role: user.role,
        plan_name: user.plan_name,
        plan_slug: user.plan_slug,
        has_advanced_stats: ['pro', 'business'].includes(user.plan_slug),
        has_export: ['pro', 'business'].includes(user.plan_slug),
        has_customization: user.plan_slug === 'business',
        has_integrations: user.plan_slug === 'business'
      };
    } else {
      req.user = null;
    }
    next();
  } catch (error) {
    console.error('Erreur authentification optionnelle docs:', error);
    req.user = null;
    next();
  }
}

router.get('/', optionalAuthenticateView, async (req, res, next) => {
  try {
    // Récupérer les plans actifs
    const [plans] = await pool.execute(
      'SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY display_order ASC'
    );

    res.render('docs/index', {
      title: 'Documentation',
      currentPage: 'docs',
      layout: 'layouts/docs',
      user: req.user || null,
      plans: plans
    });
  } catch (error) {
    console.error('Erreur chargement documentation:', error);
    res.render('docs/index', {
      title: 'Documentation',
      currentPage: 'docs',
      layout: 'layouts/docs',
      user: req.user || null,
      plans: []
    });
  }
});

module.exports = router;
