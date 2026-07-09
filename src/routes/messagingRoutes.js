// src/routes/messagingRoutes.js
const express = require('express');
const router = express.Router();
const messagingController = require('../controllers/messagingController');
const { authenticate } = require('../middlewares/auth');
const { publicLimiter, authLimiter } = require('../middlewares/rateLimiter');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Joi = require('joi');
const validateRequest = require('../middlewares/validateRequest');

// Configuration multer pour les pièces jointes des messages
const attachmentsDir = path.join(__dirname, '../../uploads/messages');
if (!fs.existsSync(attachmentsDir)) {
  fs.mkdirSync(attachmentsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, attachmentsDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `msg-${unique}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo max par fichier
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    if (extOk || mimeOk) cb(null, true);
    else cb(new Error('Type de fichier non autorisé'));
  }
});

// ─── Contact Marketplace (PUBLIC) ───────────────────────────────────────────
router.post('/contact',
  publicLimiter,
  validateRequest(Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    message: Joi.string().min(10).max(3000).required()
  })),
  messagingController.marketplaceContact
);

// ─── Vendeur ─────────────────────────────────────────────────────────────────

// Lister ses conversations
router.get('/conversations',
  authenticate,
  messagingController.getVendorConversations
);

// Créer une conversation
router.post('/conversations',
  authenticate,
  authLimiter,
  validateRequest(Joi.object({
    subject: Joi.string().min(3).max(255).required(),
    initial_message: Joi.string().allow('', null).optional()
  })),
  messagingController.createConversation
);

// Voir les messages d'une conversation
router.get('/conversations/:id/messages',
  authenticate,
  messagingController.getVendorMessages
);

// Envoyer un message (sans pièces jointes pour le moment)
router.post('/conversations/:id/messages',
  authenticate,
  upload.none(), // Désactivé: upload.array('attachments', 5),
  validateRequest(Joi.object({ content: Joi.string().min(1).max(5000).required() })),
  messagingController.sendVendorMessage
);

// ─── Admin ────────────────────────────────────────────────────────────────────

// Lister toutes les conversations
router.get('/admin/conversations',
  authenticate,
  messagingController.getAdminConversations
);

// Voir les messages d'une conversation (admin)
router.get('/admin/conversations/:id/messages',
  authenticate,
  messagingController.getAdminMessages
);

// Répondre à une conversation (admin, sans pièces jointes pour le moment)
router.post('/admin/conversations/:id/messages',
  authenticate,
  upload.none(), // Désactivé: upload.array('attachments', 5),
  validateRequest(Joi.object({ content: Joi.string().min(1).max(5000).required() })),
  messagingController.sendAdminMessage
);

// Changer le statut d'une conversation (admin)
router.put('/admin/conversations/:id/status',
  authenticate,
  validateRequest(Joi.object({ status: Joi.string().valid('open', 'closed', 'archived').required() })),
  messagingController.updateConversationStatus
);

module.exports = router;
