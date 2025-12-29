// src/middlewares/rateLimiter.js
const rateLimit = require('express-rate-limit');
const { RATE_LIMITS } = require('../config/constants');

/**
 * Rate limiter pour les routes d'authentification
 * Limite stricte pour prévenir les attaques brute-force
 */
const authLimiter = rateLimit({
  windowMs: RATE_LIMITS.AUTH.windowMs,
  max: RATE_LIMITS.AUTH.max,
  message: {
    success: false,
    message: 'Trop de tentatives. Réessayez dans 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Utiliser l'IP comme clé
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  }
});

/**
 * Rate limiter pour les routes API générales
 */
const apiLimiter = rateLimit({
  windowMs: RATE_LIMITS.API.windowMs,
  max: RATE_LIMITS.API.max,
  message: {
    success: false,
    message: 'Trop de requêtes. Réessayez plus tard.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Utiliser user_id si authentifié, sinon IP
  keyGenerator: (req) => {
    return req.user?.id?.toString() || req.ip || req.connection.remoteAddress;
  }
});

/**
 * Rate limiter pour les routes publiques (liens produits)
 * Plus permissif car destiné au public
 */
const publicLimiter = rateLimit({
  windowMs: RATE_LIMITS.PUBLIC.windowMs,
  max: RATE_LIMITS.PUBLIC.max,
  message: {
    success: false,
    message: 'Trop de requêtes. Réessayez plus tard.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Ne pas limiter les requêtes authentifiées
    return !!req.user;
  }
});

module.exports = {
  authLimiter,
  apiLimiter,
  publicLimiter
};