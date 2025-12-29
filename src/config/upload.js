// src/config/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024; // 5MB

// Créer le dossier uploads s'il n'existe pas
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Configuration du stockage Multer
 * Organise les images par user_id pour isolation
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Créer un sous-dossier par utilisateur
    const userId = req.user?.id || 'temp';
    const userDir = path.join(UPLOAD_DIR, userId.toString());
    
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    // Générer un nom de fichier sécurisé et unique
    const randomName = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${randomName}${ext}`);
  }
});

/**
 * Filtre les types de fichiers acceptés
 */
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format de fichier non autorisé. Acceptés : JPEG, PNG, GIF, WEBP'), false);
  }
};

/**
 * Configuration Multer
 */
const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1 // Une seule image par requête
  },
  fileFilter: fileFilter
});

/**
 * Supprime un fichier image du serveur
 * @param {string} filePath - Chemin relatif du fichier
 */
function deleteFile(filePath) {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`✅ Fichier supprimé: ${filePath}`);
    }
  } catch (error) {
    console.error('Erreur suppression fichier:', error.message);
  }
}

/**
 * Génère l'URL publique d'une image
 * @param {string} filePath - Chemin relatif du fichier
 * @returns {string} URL complète
 */
function getImageUrl(filePath) {
  if (!filePath) return null;
  const baseUrl = "";
  // const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  return `${baseUrl}${filePath.replace(/\\/g, '/').replace('/uploads','')}`;
}

module.exports = {
  upload,
  deleteFile,
  getImageUrl,
  UPLOAD_DIR,
  MAX_FILE_SIZE
};