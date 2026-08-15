/**
 * ============================================================
 * AURA STORE — Configuration Redis centralisée
 * ============================================================
 * Fournit une connexion Redis unique basée sur les variables
 * d'environnement. Fonctionne en dev (Redis local) comme en
 * production (Redis Coolify) sans modification du code.
 *
 * Usage :
 *   const { redisConnection } = require('../../config/redis');
 *   // ou
 *   const { getRedisClient } = require('../../config/redis');
 * ============================================================
 */
require('dotenv').config();
const IORedis = require('ioredis');
const { isDevelopment } = require('./env');

/**
 * Configuration Redis — lue depuis les variables d'environnement.
 * En développement : Redis local (127.0.0.1:6379)
 * En production    : Redis Coolify (hostname interne Coolify)
 */
const redisConfig = {
  host:               process.env.REDIS_HOST     || '127.0.0.1',
  port:               parseInt(process.env.REDIS_PORT, 10) || 6379,
  password:           process.env.REDIS_PASSWORD || undefined,
  db:                 parseInt(process.env.REDIS_DB, 10)   || 0,
  maxRetriesPerRequest: null, // Requis par BullMQ
  enableReadyCheck:   false,  // Requis par BullMQ
  // Reconnexion automatique
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    if (isDevelopment) {
      console.warn(`[Redis] Reconnexion tentative #${times} dans ${delay}ms...`);
    }
    return delay;
  },
  reconnectOnError(err) {
    const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
    if (targetErrors.some(e => err.message.includes(e))) {
      return 1; // Reconnect et re-execute la commande
    }
    return false;
  }
};

/**
 * Objet de connexion pour BullMQ (format simple sans ioredis instance).
 * BullMQ crée lui-même les connexions ioredis à partir de cet objet.
 */
const redisConnection = {
  host:     process.env.REDIS_HOST     || '127.0.0.1',
  port:     parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db:       parseInt(process.env.REDIS_DB, 10)   || 0,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

/**
 * Client ioredis singleton pour les opérations directes (hors BullMQ).
 */
let _redisClient = null;

function getRedisClient() {
  if (!_redisClient) {
    _redisClient = new IORedis(redisConfig);

    _redisClient.on('connect', () => {
      console.log('[Redis] ✅ Connexion établie.');
    });

    _redisClient.on('error', (err) => {
      console.error('[Redis] ❌ Erreur:', err.message);
    });

    _redisClient.on('reconnecting', () => {
      console.warn('[Redis] ⚠️ Reconnexion en cours...');
    });
  }
  return _redisClient;
}

/**
 * Test de connexion Redis
 */
async function testRedisConnection() {
  try {
    const client = getRedisClient();
    await client.ping();
    console.log('[Redis] ✅ PING réussi — Redis accessible.');
    return true;
  } catch (err) {
    console.error('[Redis] ❌ Connexion échouée:', err.message);
    return false;
  }
}

/**
 * Fermeture propre du client Redis (arrêt gracieux)
 */
async function closeRedisClient() {
  if (_redisClient) {
    try {
      await _redisClient.quit();
      _redisClient = null;
      console.log('[Redis] ✅ Client fermé proprement.');
    } catch (err) {
      console.error('[Redis] ❌ Erreur lors de la fermeture:', err.message);
    }
  }
}

module.exports = {
  redisConnection,  // Pour BullMQ (Queue, Worker, QueueEvents)
  getRedisClient,   // Pour les opérations directes ioredis
  testRedisConnection,
  closeRedisClient,
};
