/**
 * Contrôleur des Push Notifications
 * 
 * Gère les requêtes HTTP liées aux notifications push :
 * - Création de souscription
 * - Suppression de souscription
 * - Envoi de notification
 */

const pushService = require('../services/pushService');
const { vapidKeys } = require('../config/webpush');

/**
 * Crée ou met à jour une souscription push
 * POST /api/push/subscribe
 */
async function subscribe(req, res) {
    try {
        const { userId, subscription } = req.body;
        
        if (!userId || !subscription) {
            return res.status(400).json({
                success: false,
                message: 'userId et subscription sont requis'
            });
        }

        const result = await pushService.createOrUpdateSubscription(userId, subscription);
        
        console.log('\x1b[36m%s\x1b[0m', '📝 Souscription créée/mise à jour pour l\'utilisateur', userId);
        
        res.json({
            success: true,
            message: result.updated ? 'Souscription mise à jour' : 'Souscription créée',
            data: result
        });
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '❌ Erreur dans subscribe:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

/**
 * Supprime une souscription push
 * DELETE /api/push/unsubscribe
 */
async function unsubscribe(req, res) {
    try {
        const { endpoint } = req.body;
        
        if (!endpoint) {
            return res.status(400).json({
                success: false,
                message: 'endpoint est requis'
            });
        }

        const result = await pushService.deleteSubscription(endpoint);
        
        res.json({
            success: true,
            message: result ? 'Souscription supprimée' : 'Aucune souscription trouvée',
            data: { deleted: result }
        });
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '❌ Erreur dans unsubscribe:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

/**
 * Teste l'envoi d'une notification
 * POST /api/push/test
 */
async function testNotification(req, res) {
    try {
        const { userId } = req.body;
        
        const payload = {
            title: '🛍️ Demo Shop',
            body: 'Test de notification push',
            icon: '/icon-192.png',
            badge: '/badge-72.png',
            image: '/image.png',
            url: '/products',
            productId: 0,
            createdAt: new Date().toISOString()
        };

        const result = await pushService.sendToAllSubscribers(payload, userId);
        
        res.json({
            success: true,
            message: 'Notifications de test envoyées',
            data: result
        });
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '❌ Erreur dans testNotification:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

/**
 * Envoie une notification pour un nouveau produit
 * POST /api/push/notify-product
 */
async function notifyNewProduct(req, res) {
    try {
        const { productId, productName, productImage, userId } = req.body;
        
        if (!productId || !productName) {
            return res.status(400).json({
                success: false,
                message: 'productId et productName sont requis'
            });
        }

        const payload = {
            title: '🛍️ Nouveau produit disponible !',
            body: `${productName}`,
            icon: '/icon-192.png',
            badge: '/badge-72.png',
            image: productImage || 'https://via.placeholder.com/600x300/4A90D9/ffffff?text=Nouveau+Produit',
            url: `/products/${productId}`,
            productId: productId,
            createdAt: new Date().toISOString()
        };

        const result = await pushService.sendToAllSubscribers(payload, userId);
        
        console.log('\x1b[36m%s\x1b[0m', '📦 Notification de produit envoyée:', productName);
        
        res.json({
            success: true,
            message: `Notification envoyée pour "${productName}"`,
            data: result
        });
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '❌ Erreur dans notifyNewProduct:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

// Retourne la clé publique VAPID au frontend
function getVapidPublicKey(req, res) {
    res.json({ publicKey: vapidKeys.publicKey || '' });
}

module.exports = {
    subscribe,
    unsubscribe,
    testNotification,
    notifyNewProduct,
    getVapidPublicKey
};