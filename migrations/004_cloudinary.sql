-- Migration pour ajouter les colonnes Cloudinary à store_customization
-- À exécuter sur votre base de données

-- Migration pour passer de stockage local à Cloudinary
-- À exécuter sur votre base de données

-- Ajouter la colonne image_public_id pour stocker le public_id Cloudinary
ALTER TABLE products 
ADD COLUMN image_public_id VARCHAR(255) NULL AFTER image_url,
ADD INDEX idx_image_public_id (image_public_id);

-- Commentaire sur les colonnes
ALTER TABLE products 
MODIFY COLUMN image_url TEXT NULL COMMENT 'URL complète Cloudinary de l\'image',
MODIFY COLUMN image_public_id VARCHAR(255) NULL COMMENT 'Public ID Cloudinary pour suppression';

-- Ajouter les colonnes pour les public_id Cloudinary
ALTER TABLE store_customization 
ADD COLUMN logo_public_id VARCHAR(255) NULL AFTER logo_url,
ADD COLUMN banner_public_id VARCHAR(255) NULL AFTER banner_url;

-- Ajouter des index pour améliorer les performances
ALTER TABLE store_customization
ADD INDEX idx_logo_public_id (logo_public_id),
ADD INDEX idx_banner_public_id (banner_public_id);

-- Modifier les colonnes URL pour accepter des URLs plus longues (Cloudinary)
ALTER TABLE store_customization 
MODIFY COLUMN logo_url TEXT NULL COMMENT 'URL complète Cloudinary du logo',
MODIFY COLUMN banner_url TEXT NULL COMMENT 'URL complète Cloudinary de la bannière',
MODIFY COLUMN logo_public_id VARCHAR(255) NULL COMMENT 'Public ID Cloudinary du logo',
MODIFY COLUMN banner_public_id VARCHAR(255) NULL COMMENT 'Public ID Cloudinary de la bannière';

-- Vérifier la structure
SHOW COLUMNS FROM store_customization;

