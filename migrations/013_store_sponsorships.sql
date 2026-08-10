-- ============================================
-- MIGRATION 013: Store Sponsorships & Priority
-- Date: 2026-08-09
-- Description: Ajout du système de sponsorisation et la vue de priorité globale du marketplace.
-- ============================================

-- 1. Table des sponsorings
CREATE TABLE IF NOT EXISTS store_sponsorships (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_active_period (user_id, is_active, start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Vue centrale du Marketplace avec priorité absolue
-- Priority Score:
-- 1 = Sponsorisé + Vérifié
-- 2 = Sponsorisé
-- 3 = Business + Vérifié
-- 4 = Business
-- 5 = Pro + Vérifié
-- 6 = Pro
-- 7 = Gratuit + Vérifié
-- 8 = Gratuit
CREATE OR REPLACE VIEW v_marketplace_users AS
SELECT 
    u.*,
    COALESCE(vupa.plan_slug, 'free') as plan_slug,
    IF(ss.user_id IS NOT NULL, 1, 0) as is_sponsored,
    CASE
      WHEN ss.user_id IS NOT NULL AND u.is_verified = 1 THEN 1
      WHEN ss.user_id IS NOT NULL THEN 2
      WHEN vupa.plan_slug = 'business' AND u.is_verified = 1 THEN 3
      WHEN vupa.plan_slug = 'business' THEN 4
      WHEN vupa.plan_slug = 'pro' AND u.is_verified = 1 THEN 5
      WHEN vupa.plan_slug = 'pro' THEN 6
      WHEN u.is_verified = 1 THEN 7
      ELSE 8
    END as priority_score
FROM users u
LEFT JOIN v_user_plan_access vupa ON u.id = vupa.user_id
LEFT JOIN (
    SELECT DISTINCT user_id 
    FROM store_sponsorships 
    WHERE is_active = 1 AND NOW() BETWEEN start_date AND end_date
) ss ON u.id = ss.user_id;
