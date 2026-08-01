/**
 * Configuration de la base de données MySQL
 * 
 * Utilisation de mysql2 pour les connexions et requêtes
 * Création automatique des tables au démarrage
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuration de la connexion
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'webpush_demo',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let pool;

/**
 * Initialise la connexion à la base de données
 * Crée les tables si elles n'existent pas
 */
async function initDatabase() {
    try {
        // Créer d'abord une connexion sans base pour créer la DB si nécessaire
        const tempConnection = await mysql.createConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password
        });

        // Créer la base de données si elle n'existe pas
        await tempConnection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
        await tempConnection.end();

        // Créer le pool de connexions
        pool = mysql.createPool(dbConfig);

        // Créer les tables
        await createTables();

        console.log('\x1b[32m%s\x1b[0m', '✅ Base de données initialisée avec succès');
        
        // Ajouter des données de démonstration si nécessaire
        await seedDemoData();

        return pool;
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '❌ Erreur d\'initialisation de la base de données:', error.message);
        throw error;
    }
}

/**
 * Crée toutes les tables nécessaires
 */
async function createTables() {
    // Table des utilisateurs
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Table des produits
    await pool.query(`
        CREATE TABLE IF NOT EXISTS products (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            image VARCHAR(500),
            user_id INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    // Table des souscriptions push
    await pool.query(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            endpoint TEXT NOT NULL,
            p256dh VARCHAR(255) NOT NULL,
            auth VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_subscription (endpoint(255))
        )
    `);

    console.log('\x1b[36m%s\x1b[0m', '📋 Tables créées/vérifiées :');
    console.log('   - users');
    console.log('   - products');
    console.log('   - push_subscriptions');
}

/**
 * Ajoute des données de démonstration
 */
async function seedDemoData() {
    // Vérifier si des utilisateurs existent déjà
    const [existingUsers] = await pool.query('SELECT COUNT(*) as count FROM users');
    
    if (existingUsers[0].count > 0) {
        return;
    }

    console.log('\x1b[36m%s\x1b[0m', '🌱 Ajout des données de démonstration...');

    // Ajouter des utilisateurs fictifs
    const users = [
        { name: 'Jean Dupont' },
        { name: 'Marie Martin' },
        { name: 'Pierre Lambert' },
        { name: 'Sophie Bernard' }
    ];

    for (const user of users) {
        await pool.query('INSERT INTO users (name) VALUES (?)', [user.name]);
    }

    // Récupérer les IDs des utilisateurs
    const [userRows] = await pool.query('SELECT id FROM users');
    
    // Ajouter des produits fictifs
    const products = [
        { 
            name: 'Nike Air Max 270', 
            description: 'La nouvelle Nike Air Max 270 est une chaussure de running avec une unité Air Max visible à l\'arrière pour un confort et un style exceptionnels.',
            image: 'https://static.nike.com/a/images/t_PDP_1280_v1/f_auto,q_auto:eco/d6d0d4c1-541e-438e-82c9-76bdf9246857/air-max-270-shoes-2V6Bmg.png',
            user_id: userRows[0].id
        },
        { 
            name: 'Apple iPhone 15 Pro', 
            description: 'Le nouvel iPhone 15 Pro avec puce A17 Pro, appareil photo de 48MP et design en titane. Le smartphone le plus avancé d\'Apple.',
            image: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-model-unselect-gallery-2-202309?wid=5120&hei=2880&fmt=p-jpg&qlt=80&.v=1693310364788',
            user_id: userRows[1].id
        },
        { 
            name: 'Samsung Galaxy S24 Ultra', 
            description: 'Le Galaxy S24 Ultra avec écran 6.8" QHD+, appareil photo 200MP et S Pen intégré. La puissance Android réinventée.',
            image: 'https://images.samsung.com/is/image/samsung/p6pim/fr/2401/gallery/fr-galaxy-s24-s928-491838-sm-s928bzkgeue-539653817?$Gallery_L2_No_Animation$',
            user_id: userRows[2].id
        },
        { 
            name: 'Sony WH-1000XM5', 
            description: 'Les écouteurs Sony WH-1000XM5 offrent une réduction de bruit ultime, une qualité audio exceptionnelle et un confort inégalé.',
            image: 'https://m.media-amazon.com/images/I/61bI9t-EBaL._AC_SL1500_.jpg',
            user_id: userRows[3].id
        }
    ];

    for (const product of products) {
        await pool.query(
            'INSERT INTO products (name, description, image, user_id) VALUES (?, ?, ?, ?)',
            [product.name, product.description, product.image, product.user_id]
        );
    }

    console.log('\x1b[32m%s\x1b[0m', '✅ Données de démonstration ajoutées avec succès');
}

/**
 * Récupère le pool de connexions
 */
function getPool() {
    if (!pool) {
        throw new Error('La base de données n\'a pas été initialisée. Appelez initDatabase() d\'abord.');
    }
    return pool;
}

module.exports = {
    initDatabase,
    getPool
};
