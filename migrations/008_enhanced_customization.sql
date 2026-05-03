-- ============================================
-- MIGRATION 008: Enhanced Customization
-- Date: 2026-05-01
-- Description: Adds detailed customization fields for the storefront
-- ============================================

USE defaultdb;

-- Alter store_customization table to add new fields
ALTER TABLE store_customization
ADD COLUMN store_title VARCHAR(255) NULL AFTER user_id,
ADD COLUMN store_description TEXT NULL AFTER store_title,
ADD COLUMN title_color VARCHAR(20) DEFAULT '#1f2937' AFTER text_color,
ADD COLUMN description_color VARCHAR(20) DEFAULT '#4b5563' AFTER title_color,
ADD COLUMN background_color VARCHAR(20) DEFAULT '#f3f4f6' AFTER description_color,
ADD COLUMN font_family VARCHAR(100) DEFAULT 'Inter' AFTER background_color,
ADD COLUMN product_layout ENUM('grid', 'list') DEFAULT 'grid' AFTER font_family,
ADD COLUMN button_style ENUM('solid', 'outline', 'rounded') DEFAULT 'solid' AFTER product_layout,
ADD COLUMN footer_text TEXT NULL AFTER button_style;

COMMIT;
