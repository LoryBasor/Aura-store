-- ============================================
-- MIGRATION 010: Système avancé de gestion des médias
-- Date: 2025-01-XX
-- Description: Ajout du support multi-images et vidéos par produit
-- ============================================

USE aura_store_db;

-- ============================================
-- 1. Création de la table product_media
-- ============================================
CREATE TABLE IF NOT EXISTS product_media (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id INT UNSIGNED NOT NULL,
    
    media_type ENUM('image', 'video') NOT NULL DEFAULT 'image',
    url TEXT NOT NULL COMMENT 'URL Cloudinary du média',
    public_id VARCHAR(255) NOT NULL COMMENT 'Public ID Cloudinary',
    
    is_cover BOOLEAN DEFAULT FALSE COMMENT 'Indique si l\'image est la couverture',
    position INT DEFAULT 0 COMMENT 'Ordre d\'affichage',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_product (product_id),
    INDEX idx_media_type (media_type),
    INDEX idx_is_cover (is_cover)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. Migration des images existantes
-- ============================================
-- On insère les images actuelles des produits dans la nouvelle table
INSERT INTO product_media (product_id, media_type, url, public_id, is_cover, position)
SELECT 
    id as product_id,
    'image' as media_type,
    image_url as url,
    COALESCE(image_public_id, '') as public_id,
    TRUE as is_cover,
    0 as position
FROM products
WHERE image_url IS NOT NULL AND image_url != '';

COMMIT;
