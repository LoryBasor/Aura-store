// src/services/categoryService.js
const { pool } = require('../config/database');
const { AppError } = require('../middlewares/errorHandler');
const { slugify } = require('../utils/helpers');

/**
 * Service de gestion des catégories
 */
class CategoryService {
  /**
   * Créer une nouvelle catégorie
   */
  async createCategory(userId, categoryData) {
    const { name, description } = categoryData;

    // Générer slug unique
    let slug = slugify(name);
    let slugSuffix = null;

    while (true) {
      const finalSlug = slugSuffix ? `${slug}-${slugSuffix}` : slug;
      const [slugCheck] = await pool.execute(
        'SELECT id FROM categories WHERE user_id = ? AND slug = ? AND deleted_at IS NULL',
        [userId, finalSlug]
      );

      if (slugCheck.length === 0) {
        slug = finalSlug;
        break;
      }
      slugSuffix = slugSuffix ? slugSuffix + 1 : 1;
    }

    // Obtenir le dernier display_order
    const [orderResult] = await pool.execute(
      'SELECT MAX(display_order) as max_order FROM categories WHERE user_id = ? AND deleted_at IS NULL',
      [userId]
    );
    const displayOrder = (orderResult[0]?.max_order || 0) + 1;

    // Créer la catégorie
    const [result] = await pool.execute(
      `INSERT INTO categories (user_id, name, slug, description, display_order)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, name, slug, description || null, displayOrder]
    );

    return this.getCategoryById(result.insertId, userId);
  }

  /**
   * Récupérer toutes les catégories d'un vendeur
   */
  async getCategoriesByUser(userId) {
    const [categories] = await pool.execute(
      `SELECT c.*, 
              COUNT(p.id) as product_count,
              COUNT(CASE WHEN p.is_available = 1 THEN 1 END) as available_products
       FROM categories c
       LEFT JOIN products p ON c.id = p.category_id AND p.deleted_at IS NULL
       WHERE c.user_id = ? AND c.deleted_at IS NULL
       GROUP BY c.id
       ORDER BY c.display_order ASC, c.name ASC`,
      [userId]
    );

    return categories;
  }

  /**
   * Récupérer une catégorie par ID
   */
  async getCategoryById(categoryId, userId) {
    const [categories] = await pool.execute(
      `SELECT c.*, 
              COUNT(p.id) as product_count
       FROM categories c
       LEFT JOIN products p ON c.id = p.category_id AND p.deleted_at IS NULL
       WHERE c.id = ? AND c.user_id = ? AND c.deleted_at IS NULL
       GROUP BY c.id`,
      [categoryId, userId]
    );

    if (categories.length === 0) {
      throw new AppError('Catégorie introuvable', 404);
    }

    return categories[0];
  }

  /**
   * Mettre à jour une catégorie
   */
  async updateCategory(categoryId, userId, updates) {
    // Vérifier que la catégorie existe et appartient au vendeur
    await this.getCategoryById(categoryId, userId);

    const fields = [];
    const values = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);

      // Regénérer le slug si le nom change
      const newSlug = slugify(updates.name);
      fields.push('slug = ?');
      values.push(newSlug);
    }

    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }

    if (updates.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.is_active);
    }

    if (updates.display_order !== undefined) {
      fields.push('display_order = ?');
      values.push(updates.display_order);
    }

    if (fields.length === 0) {
      throw new AppError('Aucune donnée à mettre à jour', 400);
    }

    values.push(categoryId, userId);

    await pool.execute(
      `UPDATE categories SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );

    return this.getCategoryById(categoryId, userId);
  }

  /**
   * Supprimer une catégorie
   */
  async deleteCategory(categoryId, userId) {
    // Vérifier que la catégorie existe
    const category = await this.getCategoryById(categoryId, userId);

    // Vérifier qu'aucun produit n'utilise cette catégorie
    if (category.product_count > 0) {
      throw new AppError(
        `Impossible de supprimer : ${category.product_count} produit(s) utilisent cette catégorie`,
        400
      );
    }

    // Soft delete
    await pool.execute(
      'DELETE FROM categories WHERE id = ? AND user_id = ?',
      [categoryId, userId]
    );
  }

  /**
   * Réorganiser l'ordre des catégories
   */
  async reorderCategories(userId, categoryOrders) {
    // categoryOrders = [{id: 1, order: 1}, {id: 2, order: 2}, ...]
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      for (const item of categoryOrders) {
        await connection.execute(
          'UPDATE categories SET display_order = ? WHERE id = ? AND user_id = ?',
          [item.order, item.id, userId]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return this.getCategoriesByUser(userId);
  }

  /**
   * Obtenir les catégories publiques d'une boutique (avec produits disponibles)
   */
  async getPublicCategories(storeSlug) {
    const [categories] = await pool.execute(
      `SELECT c.id, c.name, c.slug, c.description,
              COUNT(p.id) as product_count
       FROM categories c
       JOIN users u ON c.user_id = u.id
       LEFT JOIN products p ON c.id = p.category_id 
              AND p.is_available = 1 
              AND p.deleted_at IS NULL
       WHERE u.store_slug = ? 
         AND c.is_active = 1 
         AND c.deleted_at IS NULL
       GROUP BY c.id
       HAVING product_count > 0
       ORDER BY c.display_order ASC, c.name ASC`,
      [storeSlug]
    );

    return categories;
  }
}

module.exports = new CategoryService();