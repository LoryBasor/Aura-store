/**
 * Application Express principale
 * 
 * Point d'entrée de l'application web-push-demo
 * Configure :
 * - Les middlewares Express
 * - Les routes
 * - La base de données
 * - Le serveur HTTP
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { initDatabase } = require('./config/db');
const pushRoutes = require('./routes/pushRoutes');
const productRoutes = require('./routes/productRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARES ====================

// Logger des requêtes
app.use((req, res, next) => {
    console.log(`\x1b[36m${req.method}\x1b[0m ${req.url}`);
    next();
});

// Middleware JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware static
app.use(express.static(path.join(__dirname, 'public')));

// ==================== ROUTES ====================

function renderView(viewName) {
    const filePath = path.join(__dirname, 'views', viewName);
    const html = fs.readFileSync(filePath, 'utf8');
    return html.replace(/\{\{VAPID_PUBLIC_KEY\}\}/g, process.env.VAPID_PUBLIC_KEY || '');
}

// Routes API
app.use('/api/push', pushRoutes);
app.use('/api/products', productRoutes);

// Pages HTML
app.get('/', (req, res) => {
    res.send(renderView('index.html'));
});

app.get('/products', (req, res) => {
    res.send(renderView('products.html'));
});

app.get('/products/:id', (req, res) => {
    res.send(renderView('products.html'));
});

// Route pour le Service Worker
app.get('/sw.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Service-Worker-Allowed', '/');
    res.sendFile(path.join(__dirname, 'public', 'service-worker.js'));
});

// ==================== DÉMARRAGE ====================

async function startServer() {
    try {
        // 1. Initialiser la base de données
        console.log('\x1b[36m%s\x1b[0m', '🚀 Démarrage de l\'application...');
        console.log('\x1b[36m%s\x1b[0m', '📦 Initialisation de la base de données...');
        await initDatabase();

        // 2. Démarrer le serveur
        app.listen(PORT, () => {
            console.log('\x1b[32m%s\x1b[0m', `✅ Serveur démarré sur http://localhost:${PORT}`);
            console.log('\x1b[36m%s\x1b[0m', '📱 Accédez à l\'interface de test :');
            console.log(`   - Page principale: http://localhost:${PORT}/`);
            console.log(`   - Liste des produits: http://localhost:${PORT}/products`);
            console.log('\n\x1b[33m%s\x1b[0m', '🔑 Assurez-vous d\'avoir configuré les clés VAPID dans .env');
            console.log('\x1b[36m%s\x1b[0m', 'ℹ️  Exécutez "npm run generate-vapid" si ce n\'est pas fait');
        });
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '❌ Erreur au démarrage:', error.message);
        process.exit(1);
    }
}

// Gestion des erreurs non capturées
process.on('unhandledRejection', (err) => {
    console.error('\x1b[31m%s\x1b[0m', '💥 Unhandled Rejection:', err.message);
    console.error(err.stack);
});

process.on('uncaughtException', (err) => {
    console.error('\x1b[31m%s\x1b[0m', '💥 Uncaught Exception:', err.message);
    console.error(err.stack);
});

// Démarrer l'application
startServer();

module.exports = app;