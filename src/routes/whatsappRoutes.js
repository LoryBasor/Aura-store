// src/routes/whatsappRoutes.js
const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsapp/whatsappController');
const { authenticate } = require('../middlewares/auth');
const { requireActiveSubscription, requireFeature } = require('../middlewares/subscriptionCheck');

// Middleware commun : authentifié + abonnement actif
const baseAuth = [authenticate, requireActiveSubscription];

// Middleware Business uniquement
const businessOnly = [...baseAuth, requireFeature('whatsapp_integration')];

// Routes BUSINESS uniquement (connexion, IA, réponses auto)
router.get('/status', ...businessOnly, whatsappController.getStatus);
router.get('/generate-qr', ...businessOnly, whatsappController.generateQR);
router.post('/generate-pairing-code', ...businessOnly, whatsappController.generatePairingCode);
router.post('/disconnect', ...businessOnly, whatsappController.disconnect);
router.post('/toggle-ai', ...businessOnly, whatsappController.toggleAI);
router.post('/summary-time', ...businessOnly, whatsappController.saveSummaryTime);
router.get('/auto-replies', ...businessOnly, whatsappController.getAutoReplies);
router.post('/auto-replies', ...businessOnly, whatsappController.createAutoReply);
router.delete('/auto-replies/:id', ...businessOnly, whatsappController.deleteAutoReply);

// Stats : accessible aux plans Pro ET Business
router.get('/stats', ...baseAuth, whatsappController.getStats);

module.exports = router;
