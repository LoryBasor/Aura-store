
// src/config/database.js
const mysql = require('mysql2/promise');
require('dotenv').config();
const { createTunnel } = require('tunnel-ssh');

let realPool = null;

/**
 * Initialise la base de données selon la cible choisie
 */
async function initializeDatabase() {
  if (realPool) return realPool;

  const target = process.env.DB_TARGET || 'local'; // 'production', 'remote_ssh', ou 'local'

  // 🚀 CHEMIN 1 : MODE PRODUCTION (Sur l'instance Coolify)
  if (target === 'production' || process.env.NODE_ENV === 'production') {
    console.log("🚀 Production : Connexion directe à MySQL (sans tunnel SSH)...");
    
    const dbConfigProd = {
      host: process.env.DB_HOST || '127.0.0.1', 
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'mysql',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'aura_store_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      timezone: '+00:00'
    };

    realPool = mysql.createPool(dbConfigProd);
    return realPool;
  }

  // 💻 CHEMIN 2 : MODE LOCAL PURE (Wampserver / MySQL local sur ton PC)
  if (target === 'local') {
    console.log("💻 Local : Connexion directe à la base de données locale...");

    const dbConfigPureLocal = {
      host: process.env.LOCAL_DB_HOST || '127.0.0.1',
      port: parseInt(process.env.LOCAL_DB_PORT) || 3306,
      user: process.env.LOCAL_DB_USER || 'root', // Souvent root en local
      password: process.env.LOCAL_DB_PASSWORD || '', // Souvent vide ou root
      database: process.env.LOCAL_DB_NAME || 'aura_store_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      timezone: '+00:00'
    };

    realPool = mysql.createPool(dbConfigPureLocal);
    return realPool;
  }

  // 🔒 CHEMIN 3 : MODE DISTANT VIA SSH (Développement sur ton PC connecté à Coolify)
  if (target === 'remote_ssh') {
    console.log("🔒 Remote SSH : Initialisation du tunnel SSH vers Coolify...");
    
    const tunnelOptions = { autoClose: false };
    const serverOptions = { host: '127.0.0.1', port: 0 };
    const sshOptions = {
      host: process.env.SSH_HOST,
      port: parseInt(process.env.SSH_PORT) || 22,
      username: process.env.SSH_USER || 'root',
      password: process.env.SSH_PASSWORD,
      readyTimeout: 20000
    };
    const forwardOptions = {
      srcAddr: '127.0.0.1',
      srcPort: 0,
      dstAddr: '127.0.0.1',
      dstPort: 3306
    };

    try {
      const [server, client] = await createTunnel(tunnelOptions, serverOptions, sshOptions, forwardOptions);
      
      client.on('close', () => {
        console.log('⚠️ Le tunnel SSH s\'est fermé. Réinitialisation du pool...');
        realPool = null;
      });
      client.on('error', (err) => {
        console.error('⚠️ Erreur du client SSH :', err.message);
        realPool = null;
      });

      const localPort = server.address().port;
      console.log(`🔒 Tunnel SSH établi ! Le serveur écoute sur le port local : ${localPort}`);
      
      const dbConfigLocalSSH = {
        host: '127.0.0.1',
        port: localPort,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        timezone: '+00:00'
      };

      realPool = mysql.createPool(dbConfigLocalSSH);
      return realPool;
    } catch (error) {
      console.error('❌ Échec de la création du tunnel SSH :', error.message);
      realPool = null;
      throw error;
    }
  }
}

// Lancement automatique au démarrage uniquement si on n'est pas en production
if (process.env.NODE_ENV !== 'production' && process.env.DB_TARGET !== 'production') {
  initializeDatabase().catch(err => {
    console.error("⚠️ Impossible d'initialiser la base de données au démarrage:", err.message);
  });
}

// Le Proxy intercepte tes requêtes 'pool.execute'
const poolProxy = new Proxy({}, {
  get(target, prop) {
    return async function (...args) {
      if (!realPool) {
        await initializeDatabase();
      }
      while (!realPool) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return realPool[prop](...args);
    };
  }
});

async function testConnection() {
  try {
    if (!realPool) await initializeDatabase();
    const connection = await realPool.getConnection();
    console.log('✅ Connexion à MySQL réussie !');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erreur de connexion MySQL:', error.message);
    return false;
  }
}

async function executeQuery(query, params = []) {
  try {
    if (!realPool) await initializeDatabase();
    const [results] = await realPool.execute(query, params);
    return results;
  } catch (error) {
    console.error('Erreur SQL:', error.message);
    throw error;
  }
}

async function closePool() {
  try {
    if (realPool) {
      await realPool.end();
      console.log('✅ Pool de connexions MySQL fermé');
    }
  } catch (error) {
    console.error('❌ Erreur lors de la fermeture du pool:', error.message);
  }
}

module.exports = {
  pool: poolProxy,
  testConnection,
  executeQuery,
  closePool,
  getPool: () => realPool
};