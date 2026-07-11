@ -1,130 +1,134 @@
// src/config/database.js
const mysql = require('mysql2/promise');
require('dotenv').config();
const { createTunnel } = require('tunnel-ssh');

let realPool = null;

/**
 * Initialise le tunnel SSH selon la syntaxe officielle, puis crée le pool
 */
async function initializeDatabase() {
  if (realPool) return realPool;

  const tunnelOptions = {
    autoClose: false
  };

  const serverOptions = {
    host: '127.0.0.1',
    port: 0
  };

  const sshOptions = {
    host: process.env.SSH_HOST || '162.220.165.73',
    port: parseInt(process.env.SSH_PORT) || 22,
    username: process.env.SSH_USER || 'root',
    password: process.env.SSH_PASSWORD
  };

  const forwardOptions = {
    srcAddr: '127.0.0.1',
    srcPort: 0,
    dstAddr: '127.0.0.1',
    dstPort: 3306
  };

  try {

    const [server, client] = await createTunnel(tunnelOptions, serverOptions, sshOptions, forwardOptions);
    const localPort = server.address().port;
    console.log(`🔒 Tunnel SSH établi avec succès ! Le serveur écoute sur le port local : ${localPort}`);
    
    const dbConfig = {
      host: '127.0.0.1',
      port: localPort,
      user: process.env.DB_USER || 'mysql',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'aura_store_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      timezone: '+00:00'
    };

    realPool = mysql.createPool(dbConfig);
    return realPool;
  } catch (error) {
    console.error('❌ Échec de la création du tunnel SSH (Syntaxe officielle) :', error);
    throw error;
  }
}
initializeDatabase();
if (process.env.NODE_ENV !== 'production') {
  initializeDatabase().catch(err => {
    console.error("⚠️ Impossible de lancer le tunnel en local:", err.message);
  });
}
const poolProxy = new Proxy({}, {
  get(target, prop) {
    if (!realPool) {
      return async function (...args) {
        
        while (!realPool) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        return realPool[prop](...args);
      };
    }
    return realPool[prop];
  }
});

/**
 * Test de connexion à la base de données
 */
async function testConnection() {
  try {
    if (!realPool) await initializeDatabase();
    const connection = await realPool.getConnection();
    console.log('✅ Connexion à MySQL réussie via le tunnel officiel !');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erreur de connexion MySQL:', error.message);
    return false;
  }
}

/**
 * Exécute une requête avec gestion d'erreur
 */
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

/**
 * Ferme proprement le pool de connexions
 */
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