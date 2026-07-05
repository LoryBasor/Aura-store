// src/config/database.js
const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * Configuration du pool de connexions MySQL
 * Pool = réutilisation des connexions pour performance optimale
 */
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'saas_vendor_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  timezone: '+00:00',
  ssl: {
    ca: fs.readFileSync(__dirname + '/ca.pem'),
    rejectUnauthorized: true
  }
};

// Création du pool
const pool = mysql.createPool(dbConfig);

/**
 * Test de connexion à la base de données
 * À appeler au démarrage de l'application
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Connexion à MySQL réussie');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erreur de connexion MySQL:', error.message);
    return false;
  }
}

/**
 * Exécute une requête avec gestion d'erreur
 * @param {string} query - Requête SQL
 * @param {array} params - Paramètres de la requête
 * @returns {Promise<array>} Résultat de la requête
 */
async function executeQuery(query, params = []) {
  try {
    const [results] = await pool.execute(query, params);
    return results;
  } catch (error) {
    console.error('Erreur SQL:', error.message);
    throw error;
  }
}

/**
 * Ferme proprement le pool de connexions
 * À appeler lors de l'arrêt de l'application
 */
async function closePool() {
  try {
    await pool.end();
    console.log('✅ Pool de connexions MySQL fermé');
  } catch (error) {
    console.error('❌ Erreur lors de la fermeture du pool:', error.message);
  }
}

module.exports = {
  pool,
  testConnection,
  executeQuery,
  closePool
};
