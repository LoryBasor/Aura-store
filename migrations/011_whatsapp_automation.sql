-- ============================================
-- MIGRATION 011: WhatsApp Automation
-- Date: 2026-07-28
-- Description: Création des tables pour le module WhatsApp Automation
-- ============================================

-- Table wa_sessions (Connexion WhatsApp par vendeur)
CREATE TABLE IF NOT EXISTS wa_sessions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    session_id VARCHAR(100) NOT NULL,
    status ENUM('connecting', 'connected', 'disconnected') DEFAULT 'disconnected',
    connected_number VARCHAR(50),
    last_sync TIMESTAMP NULL,
    ai_enabled TINYINT(1) NOT NULL DEFAULT 1,
    summary_time VARCHAR(5) DEFAULT '20:00',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_session (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table wa_messages (Historique des messages liés aux commandes)
CREATE TABLE IF NOT EXISTS wa_messages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    order_id INT UNSIGNED,
    message_id VARCHAR(100) NOT NULL UNIQUE,
    remote_jid VARCHAR(100) NOT NULL,
    direction ENUM('inbound', 'outbound') NOT NULL,
    content TEXT,
    message_type VARCHAR(50),
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    INDEX idx_message_id (message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table wa_auto_replies (Réponses automatiques du vendeur)
CREATE TABLE IF NOT EXISTS wa_auto_replies (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    keyword VARCHAR(100) NOT NULL,
    response TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_keyword (user_id, keyword)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table wa_campaigns (Campagnes marketing WhatsApp)
CREATE TABLE IF NOT EXISTS wa_campaigns (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    target_audience VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    status ENUM('draft', 'scheduled', 'running', 'completed', 'failed') DEFAULT 'draft',
    scheduled_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
