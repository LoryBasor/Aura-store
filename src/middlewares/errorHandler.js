// src/middlewares/errorHandler.js
const { errorResponse, serverErrorResponse } = require('../utils/response');

/**
 * Middleware de gestion centralisée des erreurs
 * À placer en dernier dans la chaîne de middlewares
 */
function errorHandler(err, req, res, next) {
  console.error('❌ Erreur capturée:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    user: req.user?.id
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
    return errorResponse(res, err.message, err.statusCode);
  }

  // Erreur générique
  const message = process.env.NODE_ENV === 'development' 
    ? err.message 
    : 'Une erreur est survenue';
  
  return serverErrorResponse(res, message);
}

/**
 * Middleware pour les routes non trouvées (404)
 */
function notFoundHandler(req, res) {
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