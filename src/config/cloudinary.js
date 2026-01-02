// src/config/cloudinary.js
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

/**
 * Configuration Cloudinary pour l'upload d'images
 * Les images ne sont plus stockées localement mais sur Cloudinary
 */

// Validation des variables d'environnement
if (!process.env.CLOUDINARY_CLOUD_NAME || 
    !process.env.CLOUDINARY_API_KEY || 
    !process.env.CLOUDINARY_API_SECRET) {
  throw new Error('Variables Cloudinary manquantes dans .env');
}

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true // Toujours utiliser HTTPS
});

/**
 * Upload une image vers Cloudinary
 * @param {Buffer} fileBuffer - Buffer du fichier
 * @param {string} folder - Dossier Cloudinary (ex: 'products')
 * @param {string} userId - ID utilisateur pour organisation
 * @returns {Promise<object>} Résultat upload avec secure_url et public_id
 */
async function uploadImage(fileBuffer, folder = 'products', userId = null) {
  try {
    // Options d'upload
    const options = {
      folder: userId ? `${folder}/${userId}` : folder,
      resource_type: 'image',
      transformation: [
        { width: 1200, height: 1200, crop: 'limit' }, // Max 1200x1200
        { quality: 'auto', fetch_format: 'auto' } // Optimisation auto
      ],
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp']
    };

    // Upload via stream
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve({
              url: result.secure_url,
              public_id: result.public_id,
              width: result.width,
              height: result.height,
              format: result.format
            });
          }
        }
      );

      uploadStream.end(fileBuffer);
    });
  } catch (error) {
    console.error('Erreur upload Cloudinary:', error);
    throw new Error('Échec de l\'upload de l\'image');
  }
}

/**
 * Supprime une image de Cloudinary
 * @param {string} publicId - Public ID de l'image
 * @returns {Promise<object>} Résultat de la suppression
 */
async function deleteImage(publicId) {
  try {
    if (!publicId) {
      console.log('Aucun public_id fourni pour suppression');
      return null;
    }

    const result = await cloudinary.uploader.destroy(publicId);
    
    if (result.result === 'ok') {
      console.log(`✅ Image supprimée de Cloudinary: ${publicId}`);
    } else {
      console.log(`⚠️ Image non trouvée sur Cloudinary: ${publicId}`);
    }
    
    return result;
  } catch (error) {
    console.error('Erreur suppression Cloudinary:', error);
    throw new Error('Échec de la suppression de l\'image');
  }
}

/**
 * Teste la connexion Cloudinary
 * À appeler au démarrage de l'application
 */
async function testConnection() {
  try {
    await cloudinary.api.ping();
    console.log('✅ Connexion Cloudinary réussie');
    return true;
  } catch (error) {
    console.error('❌ Erreur connexion Cloudinary:', error.message);
    return false;
  }
}

module.exports = {
  cloudinary,
  uploadImage,
  deleteImage,
  testConnection
};