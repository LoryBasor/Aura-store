// src/middlewares/errorHandler.js
const { errorResponse, serverErrorResponse } = require('../utils/response');
const { isDevelopment } = require('../../config/env');


/**
 * Middleware de gestion centralisée des erreurs
 * À placer en dernier dans la chaîne de middlewares
 */
function errorHandler(err, req, res, next) {
  console.error('❌ Erreur capturée:', {
    message: err.message,
    stack:   isDevelopment ? err.stack : undefined,
    url:     req.originalUrl,
    method:  req.method,
    user:    req.user?.id
  });

  // Erreur Multer (upload)
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return errorResponse(res, 'Fichier trop volumineux (max 5MB)', 400);
    }
    return errorResponse(res, 'Erreur lors de l\'upload du fichier', 400);
  }

  // Erreur de validation Joi
  if (err.isJoi) {
    const errors = err.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    return errorResponse(res, 'Données invalides', 400, errors);
  }

  // Erreur MySQL
  if (err.code) {
    switch (err.code) {
      case 'ER_DUP_ENTRY':
        return errorResponse(res, 'Cette entrée existe déjà', 409);
      case 'ER_NO_REFERENCED_ROW_2':
        return errorResponse(res, 'Référence invalide', 400);
      case 'ER_ROW_IS_REFERENCED_2':
        return errorResponse(res, 'Impossible de supprimer, données liées', 400);
      case 'ECONNREFUSED':
        console.error('❌ Base de données inaccessible');
        return serverErrorResponse(res, 'Service temporairement indisponible');
    }
  }

  // Erreur personnalisée avec statusCode
  if (err.statusCode) {
    if (req.accepts('html') && !req.path.startsWith('/api')) {
      if (err.statusCode === 403) return res.status(403).render('errors/403', { title: 'Accès Refusé', showSidebar: false, showHeader: false, message: err.message });
      if (err.statusCode === 404) return res.status(404).render('errors/404', { title: 'Page introuvable', showSidebar: false, showHeader: false });
    }
    return errorResponse(res, err.message, err.statusCode);
  }

  // Erreur générique — ne jamais exposer les détails en production
  const message = isDevelopment ? err.message : 'Une erreur est survenue';
  
  if (req.accepts('html') && !req.path.startsWith('/api')) {
    return res.status(500).render('errors/404', { title: 'Erreur', showSidebar: false, showHeader: false }); // On peut utiliser 404 comme fallback ou créer une 500
  }
  return serverErrorResponse(res, message);
}

/**
 * Middleware pour les routes non trouvées (404)
 */
function notFoundHandler(req, res) {
  if (req.accepts('html') && !req.path.startsWith('/api')) {
    return res.status(404).render('errors/404', {
      title: 'Page introuvable',
      showSidebar: false,
      showHeader: false
    });
  }
  return errorResponse(res, `Route ${req.originalUrl} introuvable`, 404);
}

/**
 * Classe d'erreur personnalisée
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  errorHandler,
  notFoundHandler,
  AppError
};