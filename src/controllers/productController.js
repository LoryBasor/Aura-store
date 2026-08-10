// src/controllers/productController.js
const productService = require('../services/productService');
const { successResponse, createdResponse } = require('../utils/response');
const { buildWhatsAppOrderUrl } = require('../utils/helpers');
const { uploadImage, uploadVideo } = require('../config/cloudinary');
const { pool } = require('../config/database');

/**
 * Récupère le plan de l'utilisateur depuis la base
 */
async function getUserPlanInfo(userId) {
  const [planRes] = await pool.execute(
    `SELECT plan_name FROM v_user_plan_access 
     WHERE user_id = ? AND (subscription_status = 'active' OR subscription_status = 'trial')
     LIMIT 1`,
    [userId]
  );
  return planRes.length > 0 ? planRes[0].plan_name : 'Free';
}

/**
 * Retourne les quotas médias selon le plan
 */
function getPlanQuotas(planName) {
  if (planName === 'Business') return { maxImages: 7, maxVideos: 1 };
  if (planName === 'Pro')      return { maxImages: 4, maxVideos: 0 };
  return                              { maxImages: 1, maxVideos: 0 };
}

/**
 * Créer un nouveau produit
 * POST /api/products
 */
async function createProduct(req, res, next) {
  try {
    const planName = await getUserPlanInfo(req.user.id);
    const { maxImages, maxVideos } = getPlanQuotas(planName);

    // Normaliser is_available (FormData envoie des strings)
    if (req.body.is_available !== undefined) {
      req.body.is_available = req.body.is_available === 'true' || req.body.is_available === true;
    }

    let mediaData = { images: [], video: null };

    if (req.files) {
      const uploadedImages = req.files.images || [];
      const uploadedVideo  = req.files.video ? req.files.video[0] : null;

      if (uploadedImages.length > maxImages) {
        return next(new Error(`Votre plan ${planName} permet un maximum de ${maxImages} image(s).`));
      }
      if (uploadedVideo && maxVideos === 0) {
        return next(new Error(`Votre plan ${planName} ne permet pas d'ajouter de vidéo.`));
      }
      for (const img of uploadedImages) {
        if (img.size > 3 * 1024 * 1024) {
          return next(new Error(`L'image "${img.originalname}" dépasse 3 Mo.`));
        }
      }

      try {
        for (const img of uploadedImages) {
          const r = await uploadImage(img.buffer, 'products', req.user.id);
          mediaData.images.push({ url: r.url, public_id: r.public_id });
        }
        if (uploadedVideo) {
          const r = await uploadVideo(uploadedVideo.buffer, 'products', req.user.id);
          mediaData.video = { url: r.url, public_id: r.public_id };
        }
      } catch (uploadError) {
        console.error('Erreur upload Cloudinary:', uploadError);
        return next(new Error("Échec de l'upload des médias."));
      }
    }

    // Gestion du prix promotionnel selon le plan
    if (planName === 'Pro' || planName === 'Business') {
      if (req.body.promotionPrice !== undefined && req.body.promotionPrice !== '') {
        const p = parseFloat(req.body.price);
        const pp = parseFloat(req.body.promotionPrice);
        if (isNaN(pp) || pp < 0) {
          return next(new Error("Le prix promotionnel est invalide ou négatif."));
        }
        if (pp >= p) {
          return next(new Error("Le prix promotionnel doit être strictement inférieur au prix normal."));
        }
        req.body.promotion_price = pp;
      } else {
        req.body.promotion_price = null;
      }
    } else {
      // Pour Gratuit : on ne passe pas de promotion_price, la BD ignorera ou mettra NULL
      req.body.promotion_price = undefined; 
      // Si une valeur avait été envoyée côté client, on l'ignore.
    }

    const product = await productService.createProduct(req.user.id, req.body, mediaData);
    return createdResponse(res, { product }, 'Produit créé avec succès');
  } catch (error) {
    next(error);
  }
}

/**
 * Récupérer tous les produits du vendeur
 * GET /api/products/:search/:is_available
 */
async function getProducts(req, res, next) {
  try {
    const result = await productService.getProductsByUser(req.user.id, req.params.search, {
      page: parseInt(req.params.page) || 1,
      limit: parseInt(req.params.limit) || 20,
      is_available: req.params.is_available
    });
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

/**
 * Récupérer un produit par ID
 * GET /api/products/:id
 */
async function getProduct(req, res, next) {
  try {
    const product = await productService.getProductById(req.params.id, req.user.id);
    return successResponse(res, { product });
  } catch (error) {
    next(error);
  }
}

/**
 * Mettre à jour un produit
 * PUT /api/products/:id
 */
async function updateProduct(req, res, next) {
  try {
    const planName = await getUserPlanInfo(req.user.id);
    const { maxImages, maxVideos } = getPlanQuotas(planName);

    // IDs des médias existants à conserver
    let retainedMediaIds = req.body.retainedMediaIds || [];
    if (!Array.isArray(retainedMediaIds)) {
      retainedMediaIds = retainedMediaIds ? [retainedMediaIds] : [];
    }
    // Filtrer les valeurs vides
    retainedMediaIds = retainedMediaIds.filter(id => id && id.trim() !== '');

    const uploadedImages = req.files && req.files.images ? req.files.images : [];
    const uploadedVideo  = req.files && req.files.video  ? req.files.video[0] : null;

    const totalImages = retainedMediaIds.length + uploadedImages.length;

    if (totalImages > maxImages) {
      return next(new Error(`Votre plan ${planName} permet un maximum de ${maxImages} image(s).`));
    }
    if (uploadedVideo && maxVideos === 0) {
      return next(new Error(`Votre plan ${planName} ne permet pas d'ajouter de vidéo.`));
    }
    for (const img of uploadedImages) {
      if (img.size > 3 * 1024 * 1024) {
        return next(new Error(`L'image "${img.originalname}" dépasse 3 Mo.`));
      }
    }

    let mediaUpdates = {
      retainedMediaIds,
      newImages: [],
      newVideo: null,
      deleteVideo: req.body.deleteVideo === 'true' || req.body.deleteVideo === true
    };

    // Normaliser is_available (FormData envoie des strings)
    if (req.body.is_available !== undefined) {
      req.body.is_available = req.body.is_available === 'true' || req.body.is_available === true;
    }

    try {
      for (const img of uploadedImages) {
        const r = await uploadImage(img.buffer, 'products', req.user.id);
        mediaUpdates.newImages.push({ url: r.url, public_id: r.public_id });
      }
      if (uploadedVideo) {
        const r = await uploadVideo(uploadedVideo.buffer, 'products', req.user.id);
        mediaUpdates.newVideo = { url: r.url, public_id: r.public_id };
      }
    } catch (uploadError) {
      console.error('Erreur upload Cloudinary:', uploadError);
      return next(new Error("Échec de l'upload des nouveaux médias."));
    }

    // Gestion du prix promotionnel
    if (planName === 'Pro' || planName === 'Business') {
      // S'il est présent et non vide dans la requête, on le valide
      if (req.body.promotionPrice !== undefined && req.body.promotionPrice !== '') {
        // Attention : req.body.price peut ne pas être défini si ce n'est pas une màj du prix, 
        // mais le form envoie toujours le prix.
        const p = parseFloat(req.body.price || (await productService.getProductById(req.params.id, req.user.id)).price);
        const pp = parseFloat(req.body.promotionPrice);
        
        if (isNaN(pp) || pp < 0) {
          return next(new Error("Le prix promotionnel est invalide ou négatif."));
        }
        if (pp >= p) {
          return next(new Error("Le prix promotionnel doit être strictement inférieur au prix normal."));
        }
        req.body.promotion_price = pp;
      } else if (req.body.promotionPrice === '') {
        // L'utilisateur a explicitement vidé le champ, on veut supprimer la promo
        req.body.promotion_price = null;
      }
    } else {
      // Plan Gratuit : on ignore silencieusement toute tentative de modification de promotionPrice
      req.body.promotion_price = undefined; 
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

/**
 * Supprimer un produit
 * DELETE /api/products/:id
 */
async function deleteProduct(req, res, next) {
  try {
    await productService.deleteProduct(req.params.id, req.user.id);
    return successResponse(res, null, 'Produit supprimé');
  } catch (error) {
    next(error);
  }
}

/**
 * Page produit publique via lien de partage
 * GET /p/:token  → Géré dans app.js via productService directement
 */
async function getProductByShareLink(req, res, next) {
  try {
    const { product, customMessage } = await productService.getProductByShareToken(req.params.token);

    let whatsapp_url = null;
    if (product.whatsapp_number) {
      whatsapp_url = buildWhatsAppOrderUrl(product, product.whatsapp_number);
      if (customMessage && customMessage.custom_order_message) {
        const msg = customMessage.custom_order_message
          .replace('{{product_name}}', product.name)
          .replace('{{product_price}}', product.price)
          .replace('{{currency}}', product.currency);
        whatsapp_url = whatsapp_url + '&text=' + encodeURIComponent(msg);
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

module.exports = {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getProductByShareLink
};
