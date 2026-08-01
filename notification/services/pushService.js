/**
 * Service de gestion des Push Notifications
 * 
 * Ce service centralise toute la logique métier liée aux notifications push :
 * - Création des souscriptions
 * - Suppression des souscriptions
 * - Envoi des notifications
 * - Nettoyage des souscriptions invalides
 */

const { getPool } = require('../config/db');
const { sendNotification } = require('../config/webpush');

class PushService {
    /**
     * Crée ou met à jour une souscription push pour un utilisateur
     * 
     * @param {number} userId - ID de l'utilisateur
     * @param {Object} subscription - Objet de souscription du navigateur
     * @returns {Promise<Object>} Souscription créée ou mise à jour
     */
    async createOrUpdateSubscription(userId, subscription) {
        const pool = getPool();
        const { endpoint, keys } = subscription;
        const { p256dh, auth } = keys;

        try {
            // Vérifier si l'utilisateur existe
            const [users] = await pool.query('SELECT id FROM users WHERE id = ?', [userId]);
            if (users.length === 0) {
                throw new Error(`Utilisateur ${userId} non trouvé`);
            }

            // Vérifier si la souscription existe déjà
            const [existing] = await pool.query(
                'SELECT id FROM push_subscriptions WHERE endpoint = ?',
                [endpoint]
            );

            if (existing.length > 0) {
                // Mettre à jour la souscription existante
                await pool.query(
                    `UPDATE push_subscriptions 
                     SET p256dh = ?, auth = ?, updated_at = CURRENT_TIMESTAMP 
                     WHERE endpoint = ?`,
                    [p256dh, auth, endpoint]
                );
                
                console.log('\x1b[36m%s\x1b[0m', '🔄 Souscription push mise à jour');
                return { id: existing[0].id, userId, endpoint, updated: true };
            } else {
                // Créer une nouvelle souscription
                const [result] = await pool.query(
                    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) 
                     VALUES (?, ?, ?, ?)`,
                    [userId, endpoint, p256dh, auth]
                );
                
                console.log('\x1b[32m%s\x1b[0m', '✅ Nouvelle souscription push créée');
                return { id: result.insertId, userId, endpoint, created: true };
            }
        } catch (error) {
            console.error('\x1b[31m%s\x1b[0m', '❌ Erreur lors de la gestion de la souscription:', error.message);
            throw error;
        }
    }

    /**
     * Supprime une souscription push
     * 
     * @param {string} endpoint - Endpoint de la souscription à supprimer
     * @returns {Promise<boolean>} Succès de la suppression
     */
    async deleteSubscription(endpoint) {
        const pool = getPool();
        
        try {
            const [result] = await pool.query(
                'DELETE FROM push_subscriptions WHERE endpoint = ?',
                [endpoint]
            );
            
            if (result.affectedRows > 0) {
                console.log('\x1b[32m%s\x1b[0m', '✅ Souscription push supprimée avec succès');
                return true;
            } else {
                console.log('\x1b[33m%s\x1b[0m', '⚠️  Aucune souscription trouvée pour cet endpoint');
                return false;
            }
        } catch (error) {
            console.error('\x1b[31m%s\x1b[0m', '❌ Erreur lors de la suppression de la souscription:', error.message);
            throw error;
        }
    }

    /**
     * Envoie une notification push à tous les utilisateurs abonnés
     * 
     * @param {Object} payload - Payload de la notification
     * @param {number} userId - ID de l'utilisateur qui publie (optionnel)
     * @returns {Promise<Object>} Résultat de l'envoi
     */
    async sendToAllSubscribers(payload, userId = null) {
        const pool = getPool();
        
        try {
            // Récupérer toutes les souscriptions
            let query = `
                SELECT ps.*, u.name as user_name 
                FROM push_subscriptions ps
                JOIN users u ON ps.user_id = u.id
            `;
            
            // Si un userId est fourni, filtrer pour cet utilisateur
            if (userId) {
                query += ' WHERE ps.user_id = ?';
            }
            
            const [subscriptions] = await pool.query(query, userId ? [userId] : []);
            
            if (subscriptions.length === 0) {
                console.log('\x1b[33m%s\x1b[0m', '⚠️  Aucune souscription trouvée');
                return { total: 0, sent: 0, failed: 0 };
            }

            console.log(`\x1b[36m%s\x1b[0m`, `📨 Envoi de notification à ${subscriptions.length} abonnés`);
            
            const results = {
                total: subscriptions.length,
                sent: 0,
                failed: 0,
                expired: []
            };

            // Envoyer la notification à chaque souscription
            for (const sub of subscriptions) {
                try {
                    const subscription = {
                        endpoint: sub.endpoint,
                        keys: {
                            p256dh: sub.p256dh,
                            auth: sub.auth
                        }
                    };

                    await sendNotification(subscription, payload);
                    results.sent++;
                    
                    console.log(`   ✅ Envoyé à ${sub.user_name || sub.user_id}`);
                } catch (error) {
                    if (error.status === 404 || error.status === 410) {
                        // Souscription expirée - supprimer de la base
                        await this.deleteSubscription(sub.endpoint);
                        results.expired.push(sub.endpoint);
                        console.log(`   🗑️  Souscription expirée supprimée pour ${sub.user_name || sub.user_id}`);
                    } else {
                        results.failed++;
                        console.log(`   ❌ Échec pour ${sub.user_name || sub.user_id}: ${error.message}`);
                    }
                }
            }

            console.log('\x1b[36m%s\x1b[0m', `📊 Résultats de l\'envoi :`);
            console.log(`   Envoyées: ${results.sent}`);
            console.log(`   Échouées: ${results.failed}`);
            console.log(`   Expirées: ${results.expired.length}`);

            return results;
        } catch (error) {
            console.error('\x1b[31m%s\x1b[0m', '❌ Erreur lors de l\'envoi des notifications:', error.message);
            throw error;
        }
    }

    /**
     * Nettoie les souscriptions expirées
     */
    async cleanupExpiredSubscriptions() {
        // Cette méthode est appelée automatiquement lors de l'envoi
        // Mais peut être utilisée pour un nettoyage manuel
        console.log('\x1b[36m%s\x1b[0m', '🧹 Nettoyage des souscriptions expirées...');
        // La logique de nettoyage est déjà gérée dans sendToAllSubscribers
    }

    /**
     * Récupère toutes les souscriptions d'un utilisateur
     */
    async getUserSubscriptions(userId) {
        const pool = getPool();
        
        try {
            const [subscriptions] = await pool.query(
                'SELECT * FROM push_subscriptions WHERE user_id = ?',
                [userId]
            );
            
            return subscriptions;
        } catch (error) {
            console.error('\x1b[31m%s\x1b[0m', '❌ Erreur lors de la récupération des souscriptions:', error.message);
            throw error;
        }
    }
}

module.exports = new PushService();