// src/config/database.js
const mysql = require('mysql2/promise');
require('dotenv').config();
const { createTunnel } = require('tunnel-ssh');

let realPool = null;

/**
 * Initialise la base de données (Tunnel SSH en local, connexion directe en Production)
 */
async function initializeDatabase() {
  if (realPool) return realPool;

  // 🚀 CHEMIN 1 : MODE PRODUCTION (Sur ton instance Coolify)
  if (process.env.NODE_ENV === 'production') {
    console.log("🚀 Production : Connexion directe à MySQL (sans tunnel SSH)...");
    
    const dbConfigProd = {
      host: process.env.DB_HOST || '127.0.0.1', // L'IP interne du conteneur MySQL sur Coolify
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

  // 💻 CHEMIN 2 : MODE LOCAL (Développement sur ton PC Windows)
  console.log("💻 Local : Initialisation du tunnel SSH vers Coolify...");
  
  const tunnelOptions = {
    autoClose: false // Empêche le tunnel de se fermer tout seul en cas d'inactivité
  };

  const serverOptions = {
    host: '127.0.0.1',
    port: 0
  };

  const sshOptions = {
    host: process.env.SSH_HOST || '162.220.165.73',
    port: parseInt(process.env.SSH_PORT) || 22,
    username: process.env.SSH_USER || 'root',
    password: process.env.SSH_PASSWORD,
    readyTimeout: 20000 // Évite les coupures brutes pendant la négociation SSH
  };

  const forwardOptions = {
    srcAddr: '127.0.0.1',
    srcPort: 0,
    dstAddr: '127.0.0.1',
    dstPort: 3306
  };

  try {
    const [server, client] = await createTunnel(tunnelOptions, serverOptions, sshOptions, forwardOptions);
    
    // Sécurité anti-crash : Si le client SSH se coupe, on réinitialise pour pouvoir re-tunneler
    client.on('close', () => {
      console.log('⚠️ Le tunnel SSH s\'est fermé. Réinitialisation du pool...');
      realPool = null;
    });
    client.on('error', (err) => {
      console.error('⚠️ Erreur du client SSH :', err.message);
      realPool = null;
    });

    const localPort = server.address().port;
    console.log(`🔒 Tunnel SSH établi avec succès ! Le serveur écoute sur le port local : ${localPort}`);
    
    const dbConfigLocal = {
      host: '127.0.0.1',
      port: localPort,
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

    realPool = mysql.createPool(dbConfigLocal);
    return realPool;
  } catch (error) {
    console.error('❌ Échec de la création du tunnel SSH (Syntaxe officielle) :', error.message);
    realPool = null;
    throw error;
  }
}

// Lancement automatique au démarrage UNIQUEMENT si on est en local
if (process.env.NODE_ENV !== 'production') {
  initializeDatabase().catch(err => {
    console.error("⚠️ Impossible de lancer le tunnel en local:", err.message);
  });
}

// Le Proxy intercepte tes requêtes 'pool.execute' et attend s'il y a une micro-reconnexion
const poolProxy = new Proxy({}, {
  get(target, prop) {
    return async function (...args) {
      // Si on est en prod et que l'app se lance, la première requête va appeler initializeDatabase()
      if (!realPool) {
        await initializeDatabase();
      }
      
      // Boucle d'attente sécurisée si le tunnel est en train de se réinitialiser en local
      while (!realPool) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return realPool[prop](...args);
    };
  }
});

/**
 * Test de connexion à la base de données
 */
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
  pool: poolProxy, // Exporte le proxy sous le nom de pool (ton code d'origine reste intact !)
  testConnection,
  executeQuery,
  closePool,
  getPool: () => realPool
};