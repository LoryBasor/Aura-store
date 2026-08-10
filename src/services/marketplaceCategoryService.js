const { pool } = require('../config/database');

class MarketplaceCategoryService {
  /**
   * Récupère toutes les catégories (pour l'administration)
   */
  async getAllCategories() {
    const [rows] = await pool.query(
      'SELECT * FROM v_marketplace_categories_with_count ORDER BY display_order ASC, name ASC'
    );
    return rows;
  }

  /**
   * Récupère uniquement les catégories actives (pour le front-end / marketplace)
   */
  async getActiveCategories() {
    const [rows] = await pool.query(
      'SELECT * FROM v_marketplace_categories_with_count WHERE is_active = 1 ORDER BY display_order ASC, name ASC'
    );
    return rows;
  }

  /**
   * Crée une nouvelle catégorie marketplace
   */
  async createCategory(data) {
    const { name, slug, description, icon, display_order, is_active } = data;
    const [result] = await pool.execute(
      `INSERT INTO marketplace_categories (name, slug, description, icon, display_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, slug, description || null, icon || null, display_order || 0, is_active !== undefined ? is_active : 1]
    );
    return result.insertId;
  }

  /**
   * Met à jour une catégorie
   */
  async updateCategory(id, data) {
    const { name, slug, description, icon, display_order, is_active } = data;
    await pool.execute(
      `UPDATE marketplace_categories 
       SET name = ?, slug = ?, description = ?, icon = ?, display_order = ?, is_active = ?
       WHERE id = ?`,
      [name, slug, description || null, icon || null, display_order || 0, is_active !== undefined ? is_active : 1, id]
    );
    return true;
  }

  /**
   * Désactive (soft delete ou inactif) une catégorie
   */
  async toggleStatus(id, isActive) {
    await pool.execute(
      'UPDATE marketplace_categories SET is_active = ? WHERE id = ?',
      [isActive ? 1 : 0, id]
    );
    return true;
  }

  /**
   * Supprime complètement une catégorie
   */
  async deleteCategory(id) {
    await pool.execute('DELETE FROM marketplace_categories WHERE id = ?', [id]);
    return true;
  }

  /**
   * Récupère une catégorie par son ID
   */
  async getCategoryById(id) {
    const [rows] = await pool.query('SELECT * FROM marketplace_categories WHERE id = ?', [id]);
    return rows[0] || null;
  }

  /**
   * Récupère une catégorie par son slug
   */
  async getCategoryBySlug(slug) {
    const [rows] = await pool.query('SELECT * FROM marketplace_categories WHERE slug = ?', [slug]);
    return rows[0] || null;
  }
}

module.exports = new MarketplaceCategoryService();
