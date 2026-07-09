// src/routes/feedbackRoutes.js
const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const { authenticate } = require('../middlewares/auth');
const { authLimiter } = require('../middlewares/rateLimiter');
const Joi = require('joi');
const validateRequest = require('../middlewares/validateRequest');

const feedbackSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
  category: Joi.string().valid('Bug', 'Suggestion', 'Nouvelle fonctionnalité', 'Satisfaction', 'Autre').optional(),
  comment: Joi.string().max(2000).optional().allow('', null),
  suggestions: Joi.string().max(2000).optional().allow('', null)
});

// Vendeur connecté soumet un avis
router.post('/',
  authenticate,
  authLimiter,
  validateRequest(feedbackSchema),
  feedbackController.submitVendorFeedback
);

// Visiteur marketplace soumet un avis (public, rate limited)
router.post('/marketplace',
  authLimiter,
  validateRequest(feedbackSchema),
  feedbackController.submitMarketplaceFeedback
);

// Admin — consulter les avis
router.get('/admin',
  authenticate,
  feedbackController.getAdminFeedback
);

// Admin — marquer un avis comme traité
router.put('/admin/:id/process',
  authenticate,
  feedbackController.markFeedbackProcessed
);

module.exports = router;
