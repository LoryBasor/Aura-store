// src/controllers/authController.js
const { token } = require('morgan');
const authService = require('../services/authService');
const { successResponse, createdResponse } = require('../utils/response');

/**
 * Contrôleur d'authentification
 */
class AuthController {
  /**
   * Inscription d'un nouveau vendeur
   * POST /api/auth/register
   */
  async register(req, res, next) {
    try {
      const result = await authService.register(req.body);
      
      return createdResponse(res, result, 'Inscription réussie');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Connexion
   * POST /api/auth/login
   */
    async login(req, res, next) {
    try {
      const { email, password } = req.body;
      let result;
      try {
        result = await authService.login(email, password);
      } catch (error) {
        if (error.message === 'EMAIL_NOT_VERIFIED') {
          // Rediriger vers la page de vérification OTP
          return res.status(403).json({
            success: false,
            requiresOTP: true,
            email,
            message: 'Votre email n\'est pas encore vérifié. Un code a été renvoyé à votre adresse.'
          });
        }
        throw error;
      }
      
      // Le token est stocké dans un cookie httpOnly sécurisé
      res.cookie('aura_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000 // 24 heures
      });

      // On ne renvoie pas le token dans le corps de la réponse pour éviter le stockage en localStorage
      delete result.token;
      
      return successResponse(res, result, 'Connexion réussie');
    } catch (error) {
      next(error); 
    }
  }

  /**
   * Déconnexion
   * POST /api/auth/logout
   */
  async logout(req, res, next) {
    try {
      res.clearCookie('aura_token', { path: '/' });
      return successResponse(res, null, 'Déconnexion réussie');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Récupérer le profil de l'utilisateur connecté
   * GET /api/auth/profile
   */
  async getProfile(req, res, next) {
    try {
      const profile = await authService.getUserProfile(req.user.id);
      
      return successResponse(res, { user: profile });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour le profil
   * PUT /api/auth/profile
   */
  async updateProfile(req, res, next) {
    try {
      const updatedProfile = await authService.updateProfile(req.user.id, req.body);
      
      return successResponse(res, { user: updatedProfile }, 'Profil mis à jour');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Changer le mot de passe
   * POST /api/auth/change-password
   */
  async changePassword(req, res, next) {
    try {
      const { old_password, new_password } = req.body;
      
      await authService.changePassword(req.user.id, old_password, new_password);
      
      return successResponse(res, null, 'Mot de passe modifié avec succès');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Vérifier le code OTP d'inscription
   * POST /api/auth/verify-email
   */
  async verifyEmail(req, res, next) {
    try {
      const { email, code } = req.body;
      const result = await authService.verifyEmailOTP(email, code);
      return successResponse(res, result, result.message);
    } catch (error) { next(error); }
  }

  /**
   * Renvoyer le code OTP d'inscription
   * POST /api/auth/resend-otp
   */
  async resendEmailOTP(req, res, next) {
    try {
      const { email } = req.body;
      const result = await authService.resendEmailOTP(email);
      return successResponse(res, result, result.message);
    } catch (error) { next(error); }
  }

  /**
   * Mot de passe oublié — envoyer OTP
   * POST /api/auth/forgot-password
   */
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      const result = await authService.forgotPassword(email);
      return successResponse(res, result, result.message);
    } catch (error) { next(error); }
  }

  /**
   * Réinitialiser le mot de passe avec OTP
   * POST /api/auth/reset-password
   */
  async resetPassword(req, res, next) {
    try {
      const { email, code, new_password } = req.body;
      const result = await authService.resetPassword(email, code, new_password);
      return successResponse(res, result, result.message);
    } catch (error) { next(error); }
  }
}

module.exports = new AuthController();