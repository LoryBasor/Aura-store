const fs = require('fs');
const path = require('path');

const fileContent = `// src/controllers/productController.js
const productService = require('../services/productService');
const { successResponse, createdResponse } = require('../utils/response');
const { buildWhatsAppOrderUrl } = require('../utils/helpers');
const { uploadImage, uploadVideo } = require('../config/cloudinary');
const { pool } = require('../config/database');

/**
 * Contrôleur de gestion des produits avec Cloudinary
 */
class ProductController {
  
  async getUserPlanInfo(userId) {
     const [planRes] = await pool.execute(
       \`SELECT plan_name FROM v_user_plan_access WHERE user_id = ? AND (subscription_status = 'active' OR subscription_status = 'trial')\`, 
       [userId]
     );
     return planRes.length > 0 ? planRes[0].plan_name : 'Free';
  }

  async createProduct(req, res, next) {
    try {
      const planName = await this.getUserPlanInfo(req.user.id);
      
      let maxImages = 1;
      let maxVideos = 0;
      if (planName === 'Pro') maxImages = 4;
      else if (planName === 'Business') {
        maxImages = 7;
        maxVideos = 1;
      }

      let mediaData = { images: [], video: null };

      if (req.files) {
        const uploadedImages = req.files.images || [];
        const uploadedVideo = req.files.video ? req.files.video[0] : null;

        if (uploadedImages.length > maxImages) {
          return next(new Error(\`Votre plan \${planName} permet un maximum de \${maxImages} image(s).\`));
        }
        if (uploadedVideo && maxVideos === 0) {
          return next(new Error(\`Votre plan \${planName} ne permet pas d'ajouter de vidéo.\`));
        }

        for (const img of uploadedImages) {
          if (img.size > 3 * 1024 * 1024) return next(new Error('Chaque image ne doit pas dépasser 3 Mo.'));
        }

        try {
          for (const img of uploadedImages) {
            const uploadResult = await uploadImage(img.buffer, 'products', req.user.id);
            mediaData.images.push({ url: uploadResult.url, public_id: uploadResult.public_id });
          }
          if (uploadedVideo) {
            const uploadResult = await uploadVideo(uploadedVideo.buffer, 'products', req.user.id);
            mediaData.video = { url: uploadResult.url, public_id: uploadResult.public_id };
          }
        } catch (uploadError) {
          console.error('Erreur upload Cloudinary:', uploadError);
          return next(new Error('Échec de l\\'upload des médias.'));
        }
      }
      
      const product = await productService.createProduct(req.user.id, req.body, mediaData);
      
      return createdResponse(res, { product }, 'Produit créé avec succès');
    } catch (error) {
      next(error);
    }
  }

  async getProducts(req, res, next) {
    try {
      const page = req.params.page;
      const limit = req.params.limit;
      const is_available = req.params.is_available;
      const search = req.params.search;
      
      const result = await productService.getProductsByUser(req.user.id, search, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        is_available: is_available
      });
      
      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getProduct(req, res, next) {
    try {
      const product = await productService.getProductById(req.params.id, req.user.id);
      return successResponse(res, { product });
    } catch (error) {
      next(error);
    }
  }

  async updateProduct(req, res, next) {
    try {
      const planName = await this.getUserPlanInfo(req.user.id);
      
      let maxImages = 1;
      let maxVideos = 0;
      if (planName === 'Pro') maxImages = 4;
      else if (planName === 'Business') {
        maxImages = 7;
        maxVideos = 1;
      }

      let retainedMediaIds = req.body.retainedMediaIds || [];
      if (!Array.isArray(retainedMediaIds)) {
        retainedMediaIds = [retainedMediaIds];
      }

      const uploadedImages = req.files && req.files.images ? req.files.images : [];
      const uploadedVideo = req.files && req.files.video ? req.files.video[0] : null;

      const totalImages = retainedMediaIds.length + uploadedImages.length;
      
      if (totalImages > maxImages) {
        return next(new Error(\`Votre plan \${planName} permet un maximum de \${maxImages} image(s).\`));
      }
      
      // On ne checke pas retainedVideoId explicitement pour la limite, on assume qu'il y en a max 1.
      // Si une nouvelle video est uploadée et maxVideos == 0
      if (uploadedVideo && maxVideos === 0) {
        return next(new Error(\`Votre plan \${planName} ne permet pas d'ajouter de vidéo.\`));
      }

      for (const img of uploadedImages) {
          if (img.size > 3 * 1024 * 1024) return next(new Error('Chaque image ne doit pas dépasser 3 Mo.'));
      }

      let mediaUpdates = {
        retainedMediaIds,
        newImages: [],
        newVideo: null,
        deleteVideo: req.body.deleteVideo // Flag depuis le front pour supprimer la video existante
      };

      try {
        for (const img of uploadedImages) {
          const uploadResult = await uploadImage(img.buffer, 'products', req.user.id);
          mediaUpdates.newImages.push({ url: uploadResult.url, public_id: uploadResult.public_id });
        }
        if (uploadedVideo) {
          const uploadResult = await uploadVideo(uploadedVideo.buffer, 'products', req.user.id);
          mediaUpdates.newVideo = { url: uploadResult.url, public_id: uploadResult.public_id };
        }
      } catch (uploadError) {
        console.error('Erreur upload Cloudinary:', uploadError);
        return next(new Error('Échec de l\\'upload des nouveaux médias.'));
      }
      
      const product = await productService.updateProduct(
        req.params.id,
        req.user.id,
        req.body,
        mediaUpdates
      );
      
      return successResponse(res, { product }, 'Produit mis à jour');
    } catch (error) {
      next(error);
    }
  }

  async deleteProduct(req, res, next) {
    try {
      await productService.deleteProduct(req.params.id, req.user.id);
      return successResponse(res, null, 'Produit supprimé');
    } catch (error) {
      next(error);
    }
  }

  async getProductByShareLink(req, res, next) {
    try {
      const { product, customMessage } = await productService.getProductByShareToken(req.params.token);
      
      let whatsapp_url = null;
      if (product.whatsapp_number) {
        whatsapp_url = buildWhatsAppOrderUrl(product, product.whatsapp_number);
        // Inject custom message if business plan
        if(customMessage) {
           whatsapp_url = whatsapp_url + '&text=' + encodeURIComponent(customMessage.replace('{{product_name}}', product.name).replace('{{product_price}}', product.price).replace('{{currency}}', product.currency));
        }
      }
      
      return successResponse(res, {
        product,
        vendor: {
          business_name: product.business_name,
          store_slug: product.store_slug
        },
        whatsapp_url
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProductController();
`;

fs.writeFileSync(path.join(__dirname, '../src/controllers/productController.js'), fileContent);
console.log('productController.js updated');
