// src/config/upload.js
const multer = require('multer');

/**
 * Configuration Multer pour Cloudinary
 * Les fichiers sont stockés en mémoire puis uploadés vers Cloudinary
 * Plus aucun stockage local
 */

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB maximum global (on filtrera les images à 3MB dans le contrôleur)

/**
 * Stockage en mémoire (buffer)
 * Les fichiers ne sont plus écrits sur disque
 */
const storage = multer.memoryStorage();

/**
 * Filtre les types de fichiers acceptés
 */
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format de fichier non autorisé. Acceptés : JPEG, PNG, GIF, WEBP, MP4, WEBM, MOV'), false);
  }
};

/**
 * Configuration Multer
 */
const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 8 // Jusqu'à 8 fichiers (7 images + 1 vidéo)
  },
  fileFilter: fileFilter
});

module.exports = {
  upload,
  MAX_FILE_SIZE,
  /**
   * Retourne l'URL complète de l'image
   * Supporte les URLs Cloudinary et les chemins relatifs
   */
  getImageUrl: (url) => {
    if (!url) return '/images/placeholder.png';
    if (url.startsWith('http')) return url;
    return url;
  }
};