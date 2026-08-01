/**
 * Contrôleur des produits
 * 
 * Gère les requêtes HTTP liées aux produits :
 * - Récupération des produits
 * - Création de produit
 */

const { getPool } = require('../config/db');

/**
 * Récupère tous les produits
 * GET /api/products
 */
async function getProducts(req, res) {
    try {
        const pool = getPool();
        const [products] = await pool.query(`
            SELECT p.*, u.name as seller_name 
            FROM products p
            LEFT JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
        `);
        
        res.json({
            success: true,
            data: products
        });
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '❌ Erreur lors de la récupération des produits:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

/**
 * Récupère un produit par son ID
 * GET /api/products/:id
 */
async function getProductById(req, res) {
    try {
        const pool = getPool();
        const { id } = req.params;
        
        const [products] = await pool.query(`
            SELECT p.*, u.name as seller_name 
            FROM products p
            LEFT JOIN users u ON p.user_id = u.id
            WHERE p.id = ?
        `, [id]);
        
        if (products.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Produit non trouvé'
            });
        }
        
        res.json({
            success: true,
            data: products[0]
        });
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '❌ Erreur lors de la récupération du produit:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

/**
 * Crée un nouveau produit
 * POST /api/products
 */
async function createProduct(req, res) {
    try {
        const pool = getPool();
        const { name, description, image, userId } = req.body;
        
        if (!name || !description) {
            return res.status(400).json({
                success: false,
                message: 'name et description sont requis'
            });
        }

        const [result] = await pool.query(
            'INSERT INTO products (name, description, image, user_id) VALUES (?, ?, ?, ?)',
            [name, description, image || null, userId || 1]
        );
        
        // Récupérer le produit créé
        const [products] = await pool.query(
            'SELECT * FROM products WHERE id = ?',
            [result.insertId]
        );
        
        console.log('\x1b[32m%s\x1b[0m', '✅ Produit créé avec succès:', name);
        
        res.status(201).json({
            success: true,
            message: 'Produit créé avec succès',
            data: products[0]
        });
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '❌ Erreur lors de la création du produit:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

module.exports = {
    getProducts,
    getProductById,
    createProduct
};