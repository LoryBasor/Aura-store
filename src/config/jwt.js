// src/config/jwt.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET manquant dans .env');
}

/**
 * Génère un token JWT pour un utilisateur
 * @param {object} payload - Données à encoder (id, email)
 * @returns {string} Token JWT
 */
function generateToken(payload) {
  return jwt.sign(
    payload,
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Vérifie et décode un token JWT
 * @param {string} token - Token à vérifier
 * @returns {object} Payload décodé
 * @throws {Error} Si token invalide ou expiré
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expiré');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Token invalide');
    }
    throw error;
  }
}

/**
 * Décode un token sans vérifier la signature (pour debug)
 * @param {string} token - Token à décoder
 * @returns {object} Payload décodé
 */
function decodeToken(token) {
  return jwt.decode(token);
}

module.exports = {
  generateToken,
  verifyToken,
  decodeToken,
  JWT_SECRET,
  JWT_EXPIRES_IN
}; 