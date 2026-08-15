/**
 * ============================================================
 * AURA STORE — Configuration Base de Données MySQL
 * ============================================================
 * Connexion MySQL entièrement basée sur les variables d'environnement.
 * 
 * MODE AUTOMATIQUE selon NODE_ENV :
 *   - development : connexion directe MySQL local ou SSH tunnel si DB_TARGET=remote_ssh
 *   - production  : connexion directe MySQL (Coolify internal hostname)
 *   - test        : connexion vers une BDD de test dédiée
 *
 * JAMAIS de valeurs hardcodées (ni localhost, ni 127.0.0.1, ni mysql).
 * Tout vient des variables d'environnement.
 * ============================================================
 */

const mysql  = require('mysql2/promise');
require('dotenv').config();
const { isDevelopment, isProduction, nodeEnv } = require('../../config/env');

// SSH tunnel (optionnel — uniquement si DB_TARGET=remote_ssh)
const { createTunnel } = require('tunnel-ssh');

let realPool = null;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Crée la configuration du pool MySQL à partir des variables d'environnement.
 * Rétrocompatibilité : si DB_TARGET=local, on utilise LOCAL_DB_* en priorité.
 */
function buildPoolConfig(host, port) {
  const target = process.env.DB_TARGET || (isProduction ? 'production' : 'local');
  const isLocalTarget = target === 'local';

  const config = {
    host:                  host || (isLocalTarget ? (process.env.LOCAL_DB_HOST || process.env.DB_HOST) : process.env.DB_HOST),
    port:                  parseInt(port || (isLocalTarget ? (process.env.LOCAL_DB_PORT || process.env.DB_PORT) : process.env.DB_PORT), 10) || 3306,
    user:                  isLocalTarget ? (process.env.LOCAL_DB_USER || process.env.DB_USER) : process.env.DB_USER,
    password:              isLocalTarget ? (process.env.LOCAL_DB_PASSWORD !== undefined ? process.env.LOCAL_DB_PASSWORD : process.env.DB_PASSWORD) : process.env.DB_PASSWORD,
    database:              isLocalTarget ? (process.env.LOCAL_DB_NAME || process.env.DB_NAME) : process.env.DB_NAME,
    waitForConnections:    true,
    connectionLimit:       parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
    queueLimit:            0,
    enableKeepAlive:       true,
    keepAliveInitialDelay: 10000,
    timezone:              '+00:00',
  };

  // SSL (optionnel — si DB_SSL_CA est défini)
  if (process.env.DB_SSL_CA) {
    config.ssl = { ca: process.env.DB_SSL_CA };
  }

  return config;
}

// ─── Initialisation ──────────────────────────────────────────────────────────

async function initializeDatabase() {
  if (realPool) return realPool;

  const target = process.env.DB_TARGET || (isProduction ? 'production' : 'local');

  // ═══════════════════════════════════════════════════════
  // MODE SSH TUNNEL (développement uniquement)
  // Active si DB_TARGET=remote_ssh
  // Permet de se connecter à la BDD Coolify depuis son PC
  // ═══════════════════════════════════════════════════════
  if (target === 'remote_ssh') {
    if (isProduction) {
      throw new Error('[DB] ❌ DB_TARGET=remote_ssh interdit en production !');
    }
    console.log('[DB] 🔒 Mode SSH Tunnel — Connexion à Coolify via SSH...');

    const tunnelOptions = { autoClose: false };
    const serverOptions = { host: '127.0.0.1', port: 0 };

    const sshOptions = {
      host:         process.env.SSH_HOST,
      port:         parseInt(process.env.SSH_PORT, 10) || 22,
      username:     process.env.SSH_USER || 'root',
      password:     process.env.SSH_PASSWORD,
      privateKey:   process.env.SSH_PRIVATE_KEY || undefined,
      readyTimeout: 20000,
    };

    const forwardOptions = {
      srcAddr: '127.0.0.1',
      srcPort: 0,
      dstAddr: process.env.DB_HOST || '127.0.0.1',
      dstPort: parseInt(process.env.DB_PORT, 10) || 3306,
    };

    try {
      const [server, client] = await createTunnel(
        tunnelOptions, serverOptions, sshOptions, forwardOptions
      );

      client.on('close', () => {
        console.warn('[DB] ⚠️ Tunnel SSH fermé — Réinitialisation du pool...');
        realPool = null;
      });
      client.on('error', (err) => {
        console.error('[DB] ⚠️ Erreur SSH:', err.message);
        realPool = null;
      });

      const localPort = server.address().port;
      console.log(`[DB] 🔒 Tunnel SSH établi sur le port local ${localPort}`);

      realPool = mysql.createPool(buildPoolConfig('127.0.0.1', localPort));
      return realPool;
    } catch (error) {
      console.error('[DB] ❌ Échec du tunnel SSH:', error.message);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════
  // MODE CONNEXION DIRECTE (développement local ou production)
  // Active si DB_TARGET=local (dev) ou DB_TARGET=production ou
  // automatiquement en NODE_ENV=production
  // ═══════════════════════════════════════════════════════
  const label = isProduction ? '🚀 Production (Coolify)' : '💻 Local';
  console.log(`[DB] ${label} — Connexion directe à MySQL (${process.env.DB_HOST}:${process.env.DB_PORT || 3306})...`);

  realPool = mysql.createPool(buildPoolConfig());
  return realPool;
}

// ─── Auto-initialisation ─────────────────────────────────────────────────────
// Uniquement si on n'est pas déjà en train de créer via SSH (le SSH est async)
if (process.env.DB_TARGET !== 'remote_ssh') {
  initializeDatabase().catch(err => {
    console.error('[DB] ⚠️ Impossible d\'initialiser la BDD au démarrage:', err.message);
  });
}

// ─── Proxy ───────────────────────────────────────────────────────────────────
/**
 * Proxy qui s'assure que le pool est initialisé avant chaque appel.
 * Transparent pour le reste du code : s'utilise comme un pool normal.
 */
const pool = new Proxy({}, {
  get(target, prop) {
    return async function (...args) {
      if (!realPool) {
        await initializeDatabase();
      }
      // Attendre l'initialisation si elle est en cours (tunnel SSH asynchrone)
      while (!realPool) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return realPool[prop](...args);
    };
  }
});

// ─── Fonctions utilitaires ────────────────────────────────────────────────────

async function testConnection() {
  try {
    if (!realPool) await initializeDatabase();
    const connection = await realPool.getConnection();
    console.log('[DB] ✅ Connexion MySQL réussie !');
    connection.release();
    return true;
  } catch (error) {
    console.error('[DB] ❌ Erreur de connexion MySQL:', error.message);
    return false;
  }
}

async function executeQuery(query, params = []) {
  try {
    if (!realPool) await initializeDatabase();
    const [results] = await realPool.execute(query, params);
    return results;
  } catch (error) {
    console.error('[DB] Erreur SQL:', error.message);
    throw error;
  }
}

async function closePool() {
  try {
    if (realPool) {
      await realPool.end();
      realPool = null;
      console.log('[DB] ✅ Pool MySQL fermé.');
    }
  } catch (error) {
    console.error('[DB] ❌ Erreur fermeture pool:', error.message);
  }
}

module.exports = {
  pool,
  testConnection,
  executeQuery,
  closePool,
  getPool: () => realPool,
};