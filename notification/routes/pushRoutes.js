/**
 * Routes des Push Notifications
 * 
 * Définit les endpoints pour la gestion des notifications push
 */

const express = require('express');
const router = express.Router();
const pushController = require('../controllers/pushController');

// Créer ou mettre à jour une souscription
// POST /api/push/subscribe
router.post('/subscribe', pushController.subscribe);

// Supprimer une souscription
// DELETE /api/push/unsubscribe
router.delete('/unsubscribe', pushController.unsubscribe);

// Tester une notification
// POST /api/push/test
router.post('/test', pushController.testNotification);

// Notifier pour un nouveau produit
// POST /api/push/notify-product
router.post('/notify-product', pushController.notifyNewProduct);

// Fournit la clé publique VAPID utilisée par le client
router.get('/vapid-public-key', pushController.getVapidPublicKey);

module.exports = router;
