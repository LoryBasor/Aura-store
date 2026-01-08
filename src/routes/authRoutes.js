// src/routes/authRoutes.js
const express = require('express');
const authController = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');
const { requireActiveSubscription } = require('../middlewares/subscriptionCheck');
const validateRequest = require('../middlewares/validateRequest');
const { authLimiter } = require('../middlewares/rateLimiter');
const { registerSchema, loginSchema } = require('../utils/validators');
const Joi = require('joi');
const { successResponse } = require('../utils/response');

const router = express.Router();

/**
 * Routes d'authentification
 * Préfixe: /api/auth
 */

// Inscription
router.post(
  '/register',
  authLimiter,
  validateRequest(registerSchema),
  authController.register
);

// Connexion
router.post(
  '/login',
  authLimiter,
  validateRequest(loginSchema),
  authController.login
);

// Profil (protégé)
router.get(
  '/profile',
  authenticate,
  authController.getProfile
);

// Mise à jour profil
router.put(
  '/profile',
  authenticate,
  validateRequest(Joi.object({
    business_name: Joi.string().min(2).max(255).optional(),
    phone: Joi.string().pattern(/^[0-9+\s()-]+$/).optional().allow('', null),
    whatsapp_number: Joi.string().pattern(/^[0-9+\s()-]+$/).optional().allow('', null)
  })),
  authController.updateProfile
);

// Changement de mot de passe
router.post(
  '/change-password',
  authenticate,
  validateRequest(Joi.object({
    old_password: Joi.string().required(),
    new_password: Joi.string().min(8).required()
  })),
  authController.changePassword
);

router.post('/logout', (req, res) => {
  res.clearCookie('aura_token', {
    httpOnly: true,
    sameSite: 'strict'
  })

  return successResponse(res, null, 'déconnexion réussie ');
});

module.exports = router;