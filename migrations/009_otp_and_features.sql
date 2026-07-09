-- ============================================
-- MIGRATION 009: OTP, Avis, Signalements, Messagerie, Notifications
-- Date: 2026-07-07
-- Description: Toutes les nouvelles fonctionnalités
-- ============================================

-- ============================================
-- 1. Table OTP codes (inscription + mot de passe oublié)
-- ============================================
CREATE TABLE IF NOT EXISTS otp_codes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code VARCHAR(6) NOT NULL,
    type ENUM('email_verification', 'password_reset') NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    attempts INT DEFAULT 0,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email_type (email, type),
    INDEX idx_expires (expires_at),
    INDEX idx_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. Ajouter colonne email_verified à users (si pas encore là)
-- ============================================
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE AFTER must_change_password,
    ADD COLUMN IF NOT EXISTS login_count INT DEFAULT 0 AFTER email_verified;

-- ============================================
-- 3. Table avis & suggestions (vendeurs + visiteurs)
-- ============================================
CREATE TABLE IF NOT EXISTS user_feedback (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NULL COMMENT 'NULL si visiteur marketplace',
    visitor_ip VARCHAR(45) NULL COMMENT 'IP si visiteur',
    visitor_session VARCHAR(100) NULL COMMENT 'Session/fingerprint visiteur',
    source ENUM('vendor_dashboard', 'marketplace') NOT NULL DEFAULT 'vendor_dashboard',
    rating TINYINT UNSIGNED NOT NULL CHECK (rating BETWEEN 1 AND 5),
    category ENUM('Bug', 'Suggestion', 'Nouvelle fonctionnalité', 'Satisfaction', 'Autre') DEFAULT 'Satisfaction',
    comment TEXT,
    suggestions TEXT,
    is_processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP NULL,
    processed_by INT UNSIGNED NULL COMMENT 'Admin qui a traité',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_source (source),
    INDEX idx_rating (rating),
    INDEX idx_processed (is_processed),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. Signalements de produits
-- ============================================
CREATE TABLE IF NOT EXISTS product_reports (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id INT UNSIGNED NOT NULL,
    reporter_ip VARCHAR(45) NULL,
    reporter_session VARCHAR(100) NULL,
    reason ENUM('Arnaque', 'Produit interdit', 'Faux produit', 'Mauvaise description', 'Spam', 'Autre') NOT NULL,
    description TEXT NULL,
    status ENUM('pending', 'reviewed', 'resolved', 'dismissed') DEFAULT 'pending',
    reviewed_at TIMESTAMP NULL,
    reviewed_by INT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_product (product_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    -- Anti-doublon: même IP ne peut pas signaler le même produit plus d'une fois par 24h
    INDEX idx_ip_product (reporter_ip, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 5. Signalements de boutiques
-- ============================================
CREATE TABLE IF NOT EXISTS store_reports (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    vendor_id INT UNSIGNED NOT NULL COMMENT 'L\'utilisateur (vendeur) dont la boutique est signalée',
    reporter_ip VARCHAR(45) NULL,
    reporter_session VARCHAR(100) NULL,
    reason ENUM('Arnaque', 'Produits interdits', 'Faux vendeur', 'Contenu inapproprié', 'Spam', 'Autre') NOT NULL,
    description TEXT NULL,
    status ENUM('pending', 'reviewed', 'resolved', 'dismissed') DEFAULT 'pending',
    reviewed_at TIMESTAMP NULL,
    reviewed_by INT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_vendor (vendor_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_ip_vendor (reporter_ip, vendor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 6. Conversations (messagerie vendeur ↔ admin)
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    vendor_id INT UNSIGNED NULL COMMENT 'NULL si contact marketplace (visiteur)',
    visitor_name VARCHAR(255) NULL COMMENT 'Nom du visiteur pour contact marketplace',
    visitor_email VARCHAR(255) NULL COMMENT 'Email du visiteur',
    subject VARCHAR(255) NOT NULL,
    source ENUM('vendor', 'marketplace_contact') DEFAULT 'vendor',
    status ENUM('open', 'closed', 'archived') DEFAULT 'open',
    last_message_at TIMESTAMP NULL,
    vendor_last_read_at TIMESTAMP NULL,
    admin_last_read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_vendor (vendor_id),
    INDEX idx_status (status),
    INDEX idx_last_message (last_message_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 7. Messages
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT UNSIGNED NOT NULL,
    sender_id INT UNSIGNED NULL COMMENT 'NULL si visiteur marketplace',
    sender_role ENUM('vendor', 'admin', 'visitor') NOT NULL DEFAULT 'vendor',
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_conversation (conversation_id),
    INDEX idx_sender (sender_id),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 8. Pièces jointes des messages (supprimées après 30 jours)
-- ============================================
CREATE TABLE IF NOT EXISTS message_attachments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    message_id INT UNSIGNED NOT NULL,
    filename VARCHAR(255) NOT NULL COMMENT 'Nom d\'affichage',
    stored_filename VARCHAR(255) NOT NULL COMMENT 'Nom physique sur disque',
    file_path VARCHAR(500) NOT NULL,
    file_size INT UNSIGNED NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    expires_at TIMESTAMP NOT NULL COMMENT 'Date de suppression automatique (30j)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    INDEX idx_message (message_id),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 9. Notifications administrateur
-- ============================================
CREATE TABLE IF NOT EXISTS admin_notifications (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    type ENUM('new_report', 'new_message', 'new_feedback', 'subscription_expired', 'new_contact') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    reference_id INT UNSIGNED NULL COMMENT 'ID de l\'entité concernée',
    reference_type VARCHAR(50) NULL COMMENT 'product_report, store_report, message, feedback',
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_is_read (is_read),
    INDEX idx_type (type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Index supplémentaires pour performance
-- ============================================
-- Index sur subscriptions.expires_at pour le cron
CREATE INDEX IF NOT EXISTS idx_sub_expires_status ON subscriptions(expires_at, status);

COMMIT;
