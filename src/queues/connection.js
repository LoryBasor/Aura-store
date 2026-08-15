/**
 * ============================================================
 * AURA STORE — Connexion BullMQ (re-export depuis config/redis.js)
 * ============================================================
 * Ce fichier maintient la rétrocompatibilité avec les imports
 * existants tout en centralisant la config Redis dans config/redis.js.
 * ============================================================
 */
const { redisConnection } = require('../../config/redis');

module.exports = { connection: redisConnection };
