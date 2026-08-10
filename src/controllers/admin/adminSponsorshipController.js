// src/controllers/admin/adminSponsorshipController.js
const { pool } = require('../../config/database');
const { successResponse, createdResponse } = require('../../utils/response');
const { AppError } = require('../../middlewares/errorHandler');

class AdminSponsorshipController {
  
  /**
   * GET /api/admin/sponsorships
   * List all sponsorships with store information
   */
  async listSponsorships(req, res, next) {
    try {
      const [sponsorships] = await pool.execute(`
        SELECT ss.*, u.business_name, u.store_slug, u.email
        FROM store_sponsorships ss
        JOIN users u ON ss.user_id = u.id
        ORDER BY ss.created_at DESC
      `);
      return successResponse(res, { sponsorships });
    } catch (error) { next(error); }
  }

  /**
   * POST /api/admin/sponsorships
   */
  async createSponsorship(req, res, next) {
    try {
      const { user_id, start_date, end_date } = req.body;
      if (!user_id || !start_date || !end_date) {
        throw new AppError('user_id, start_date et end_date sont requis', 400);
      }
      
      const [users] = await pool.execute('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL', [user_id]);
      if (users.length === 0) throw new AppError('Vendeur introuvable', 404);

      const [result] = await pool.execute(
        'INSERT INTO store_sponsorships (user_id, start_date, end_date) VALUES (?, ?, ?)',
        [user_id, start_date, end_date]
      );

      return createdResponse(res, { id: result.insertId }, 'Sponsoring créé avec succès');
    } catch (error) { next(error); }
  }

  /**
   * PUT /api/admin/sponsorships/:id
   */
  async updateSponsorship(req, res, next) {
    try {
      const { start_date, end_date, is_active } = req.body;
      if (!start_date || !end_date) {
        throw new AppError('start_date et end_date sont requis', 400);
      }

      await pool.execute(
        'UPDATE store_sponsorships SET start_date = ?, end_date = ?, is_active = ? WHERE id = ?',
        [start_date, end_date, is_active === '1' || is_active === 1 || is_active === true ? 1 : 0, req.params.id]
      );

      return successResponse(res, null, 'Sponsoring mis à jour');
    } catch (error) { next(error); }
  }

  /**
   * PATCH /api/admin/sponsorships/:id/toggle
   */
  async toggleSponsorship(req, res, next) {
    try {
      await pool.execute(
        'UPDATE store_sponsorships SET is_active = NOT is_active WHERE id = ?',
        [req.params.id]
      );
      return successResponse(res, null, 'Statut du sponsoring modifié');
    } catch (error) { next(error); }
  }

  /**
   * DELETE /api/admin/sponsorships/:id
   */
  async deleteSponsorship(req, res, next) {
    try {
      await pool.execute('DELETE FROM store_sponsorships WHERE id = ?', [req.params.id]);
      return successResponse(res, null, 'Sponsoring supprimé');
    } catch (error) { next(error); }
  }
}

module.exports = new AdminSponsorshipController();
