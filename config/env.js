/**
 * ============================================================
 * AURA STORE — Configuration centralisée de l'environnement
 * ============================================================
 * Source unique de vérité pour NODE_ENV.
 * Utiliser ces constantes dans tout le projet au lieu de
 * répéter process.env.NODE_ENV === 'xxx' partout.
 *
 * Usage :
 *   const { isDevelopment, isProduction } = require('./config/env');
 * ============================================================
 */

const nodeEnv = process.env.NODE_ENV || 'development';

const isProduction  = nodeEnv === 'production';
const isDevelopment = nodeEnv === 'development';
const isTest        = nodeEnv === 'test';

// Niveau de log : en dev on veut tout voir, en prod on veut du JSON propre
const logLevel = isProduction ? 'info' : 'debug';

// En développement, activer les stack traces détaillées
const verboseErrors = isDevelopment || isTest;

// Port de l'API
const port = parseInt(process.env.PORT, 10) || 3000;

// URL de l'application (pour les liens dans les emails, logs, etc.)
const appUrl = process.env.APP_URL || `http://localhost:${port}`;

module.exports = {
  nodeEnv,
  isProduction,
  isDevelopment,
  isTest,
  logLevel,
  verboseErrors,
  port,
  appUrl
};
