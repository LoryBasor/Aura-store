# 🚀 Aura-store

Plateforme SaaS multi-tenant pour vendeurs WhatsApp et Instagram en Afrique.

## 📋 Table des Matières

- [Fonctionnalités](#fonctionnalités)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Utilisation](#utilisation)
- [API Documentation](#api-documentation)
- [Déploiement](#déploiement)
- [Sécurité](#sécurité)

---

## ✨ Fonctionnalités

### Pour les Vendeurs
- ✅ Inscription et authentification sécurisée (JWT)
- ✅ Gestion complète du catalogue produits (CRUD)
- ✅ Upload d'images produits
- ✅ Génération de liens de partage uniques
- ✅ Réception et gestion des commandes
- ✅ Suivi des clients
- ✅ Dashboard avec statistiques en temps réel
- ✅ Isolation complète des données (multi-tenant)

### Pour les Clients
- ✅ Consultation de produits via lien partagé
- ✅ Passage de commande simple
- ✅ Bouton "Commander via WhatsApp"

---

## 🏗️ Architecture

### Stack Technique
- **Runtime**: Node.js 16+
- **Framework**: Express.js
- **Base de données**: MySQL 8.0
- **Authentification**: JWT (jsonwebtoken)
- **Sécurité**: bcrypt, helmet, express-rate-limit
- **Upload**: Multer, Cloudinary
- **Validation**: Joi

### Structure du Projet
```
saas-vendor-platform/
├── src/
│   ├── config/         # Configuration (DB, JWT, Upload)
│   ├── models/         # Modèles de données
│   ├── controllers/    # Logique des contrôleurs
│   ├── routes/         # Définition des routes API
│   ├── services/       # Logique métier
│   ├── middlewares/    # Middlewares (auth, validation, etc.)
│   ├── utils/          # Utilitaires et helpers
│   └── app.js          # Point d'entrée application
├── migrations/         # Scripts SQL de migration
├── uploads/            # Stockage images
├── .env                # Template variables d'environnement
├── package.json
└── ecosystem.config.js # Configuration PM2
```

---

## 📦 Installation

### Prérequis
- Node.js >= 16.0.0
- MySQL >= 8.0
- npm >= 8.0.0

### Étapes

1. **Cloner le projet**
```bash
git clone <repository-url>
cd Aura-store
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Créer la base de données**
```bash
mysql -u root -p
CREATE DATABASE saas_vendor_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

4. **Exécuter les migrations**
```bash
mysql -u root -p saas_vendor_db < migrations/001_initial_schema.sql
```

5. **Configurer les variables d'environnement**
```bash
cp .env
# Éditer .env avec vos valeurs
``` 

6. **Générer une clé JWT sécurisée**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Copier le résultat dans JWT_SECRET
```

7. **Démarrer l'application**
```bash
# Développement
npm run dev

# Production
npm start
```

---

## ⚙️ Configuration

### Variables d'Environnement (.env)

```bash
# Application
NODE_ENV=production
PORT=3000
APP_URL=https://domaine.com

# Base de données
DB_HOST=localhost
DB_PORT=3306
DB_USER=name_user
DB_PASSWORD=**********************
DB_NAME=saas_vendor_db

# JWT
JWT_SECRET=***********************
JWT_EXPIRES_IN=7d

# Upload
MAX_FILE_SIZE=5242880
UPLOAD_DIR=uploads

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Sécurité
BCRYPT_ROUNDS=12
```

---

## 🔌 API Documentation

### Base URL
```
Production: https://api.domaine.com
Development: http://localhost:3000
```

### Authentification

#### Inscription
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "vendeur@example.com",
  "password": "MotDePasse123!",
  "business_name": "Ma Boutique",
  "phone": "+237612345678",
  "whatsapp_number": "+237612345678"
}
```

**Réponse:**
```json
{
  "success": true,
  "message": "Inscription réussie",
  "data": {
    "user": {
      "id": 1,
      "email": "vendeur@example.com",
      "business_name": "Ma Boutique",
      "store_slug": "ma-boutique"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Connexion
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "vendeur@example.com",
  "password": "MotDePasse123!"
}
```

### Produits (Protégé - Nécessite Token)

#### Créer un produit
```http
POST /api/products
Authorization: Bearer {token}
Content-Type: multipart/form-data

name: "iPhone 15 Pro"
description: "Neuf, sous garantie"
price: 850000
currency: "XAF"
stock_quantity: 5
image: [file]
```

#### Lister les produits
```http
GET /api/products
Authorization: Bearer {token}
```

#### Récupérer un produit public (sans auth)
```http
GET /api/p/{share_token}
```

### Commandes

#### Créer une commande (PUBLIC)
```http
POST /api/orders
Content-Type: application/json

{
  "product_id": 1,
  "customer_name": "Zoua Bryant",
  "customer_phone": "+237698765432",
  "customer_address": "Douala, Akwa",
  "quantity": 1,
  "notes": "Livraison rapide SVP"
}
```

#### Lister les commandes (Vendeur)
```http
GET /api/orders
Authorization: Bearer {token}
```

#### Mettre à jour le statut
```http
PATCH /api/orders/{id}/status
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "en_livraison"
}
```

### Dashboard

#### Statistiques complètes
```http
GET /api/dashboard
Authorization: Bearer {token}
```

**Réponse:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "products": { "total": 25, "available": 20, "total_views": 1543 },
      "orders": { "total": 150, "pending": 12, "delivered": 120 },
      "revenue": { "total": 12500000, "average_order": 83333.33 },
      "customers": { "total": 85, "active_30_days": 42 }
    },
    "top_products": [...],
    "recent_orders": [...]
  }
}
```

---

## 🚀 Déploiement

### Sur VPS (Ubuntu 20.04+)

#### 1. Préparer le serveur
```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Installer MySQL
sudo apt install -y mysql-server
sudo mysql_secure_installation

# Installer PM2 globalement
sudo npm install -g pm2

# Installer Nginx
sudo apt install -y nginx
```

#### 2. Configurer MySQL
```bash
sudo mysql

CREATE DATABASE saas_vendor_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'saas_user'@'localhost' IDENTIFIED BY 'mot_de_passe_fort';
GRANT ALL PRIVILEGES ON saas_vendor_db.* TO 'saas_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

#### 3. Déployer l'application
```bash
# Créer le dossier app
sudo mkdir -p /var/www/aura-store-api
cd /var/www/Aura-store-api

# Cloner le code ou uploader via SFTP
# git clone <repo> .

# Installer les dépendances
npm install --production

# Créer .env avec les bonnes valeurs
nano .env

# Exécuter les migrations
mysql -u saas_user -p saas_vendor_db < migrations/001_initial_schema.sql

# Créer le dossier logs
mkdir logs

# Démarrer avec PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 4. Configurer Nginx (Reverse Proxy)
```bash
sudo nano /etc/nginx/sites-available/Aura-store-api
```

```nginx
server {
    listen 80;
    server_name api.domaine.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads {
        alias /var/www/Aura-store-api/uploads;
        expires 30d;
    }
}
```

```bash
# Activer le site
sudo ln -s /etc/nginx/sites-available/Aura-store-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 5. Installer SSL avec Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.votre-domaine.com
```

#### 6. Monitoring
```bash
# Voir les logs
pm2 logs Aura-store-api

# Statistiques
pm2 monit

# Redémarrer
pm2 restart Aura-store-api

# Stopper
pm2 stop Aura-store-api
```

---

## 🔒 Sécurité

### Mesures Implémentées
- ✅ Hash des mots de passe avec bcrypt (12 rounds)
- ✅ Authentification JWT avec expiration
- ✅ Rate limiting sur toutes les routes
- ✅ Validation stricte des entrées (Joi)
- ✅ Helmet pour sécuriser les headers HTTP
- ✅ Protection CORS
- ✅ Isolation multi-tenant (WHERE user_id)
- ✅ Soft delete pour traçabilité
- ✅ Upload sécurisé (type, taille, destination)
- ✅ Pas de SQL injection (requêtes préparées)

### Recommandations Supplémentaires
- [ ] Mettre en place des backups automatiques MySQL
- [ ] Activer le firewall (ufw)
- [ ] Configurer fail2ban
- [ ] Utiliser Redis pour le rate limiting en production
- [ ] Implémenter la rotation des tokens JWT
- [ ] Ajouter des logs détaillés pour audit

---

## 📊 Performances

### Optimisations Actuelles
- Connection pooling MySQL (10 connexions max)
- Indexation optimale des tables
- Requêtes SQL optimisées
- Limitation des données retournées (pagination)
- Cluster mode avec PM2

### Pour Améliorer
- Implémenter un cache Redis
- Optimisation des images (resize, compression)
- Load balancing avec plusieurs instances

---

## 🐛 Troubleshooting

### Erreur de connexion MySQL
```bash
# Vérifier que MySQL est actif
sudo systemctl status mysql

# Tester la connexion
mysql -u saas_user -p
```

### Port 3000 déjà utilisé
```bash
# Trouver le processus
lsof -i :3000

# Tuer le processus
kill -9 <PID>
```

### PM2 ne démarre pas
```bash
# Voir les logs
pm2 logs

# Vider les logs
pm2 flush

# Supprimer l'app et redémarrer
pm2 delete Aura-store-api
pm2 start ecosystem.config.js
```

---

## 📝 Licence

MIT License - Voir le fichier LICENSE

---

## 👨‍💻 Support

Pour toute question ou problème :
- Email: bryantzoua4@gmail.com

---

**Créé avec ❤️ pour les entrepreneurs africains**
