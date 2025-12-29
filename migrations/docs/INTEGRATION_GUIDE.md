# 🔧 Guide d'Intégration - Système Super Admin

Guide étape par étape pour intégrer le système Super Admin dans votre backend existant.

---

## 📋 PRÉREQUIS

Avant de commencer, assurez-vous d'avoir:
- ✅ Backend Node.js + Express fonctionnel
- ✅ MySQL configuré et accessible
- ✅ Système d'authentification JWT en place
- ✅ Accès SSH au serveur (pour production)

---

## 🚀 ÉTAPE 1 : MISE À JOUR BASE DE DONNÉES

### 1.1 Exécuter la Migration

```bash
# En développement
mysql -u root -p saas_vendor_db < migrations/002_super_admin_system.sql

# En production (via SSH)
ssh user@votre-serveur
mysql -u saas_user -p saas_vendor_db < /var/www/saas-vendor-api/migrations/002_super_admin_system.sql
```

### 1.2 Vérifier les Tables Créées

```sql
USE saas_vendor_db;

SHOW TABLES LIKE 'subscription%';
-- Devrait afficher: subscription_plans, subscriptions, subscription_history

SHOW TABLES LIKE 'admin%';
-- Devrait afficher: admin_audit_logs

SHOW TABLES LIKE 'system%';
-- Devrait afficher: system_notifications

-- Vérifier la colonne role dans users
DESCRIBE users;
-- Devrait montrer: role ENUM('USER', 'SUPER_ADMIN')
```

### 1.3 Vérifier les Plans par Défaut

```sql
SELECT * FROM subscription_plans;
-- Devrait retourner: Gratuit, Pro, Business
```

---

## 📦 ÉTAPE 2 : MISE À JOUR DES DÉPENDANCES

Aucune nouvelle dépendance n'est requise ! Le système utilise uniquement les packages déjà installés.

---

## 📂 ÉTAPE 3 : AJOUTER LES NOUVEAUX FICHIERS

Créez la structure suivante dans votre projet:

```
src/
├── controllers/
│   └── admin/
│       ├── userController.js
│       ├── subscriptionController.js
│       └── dashboardController.js
├── services/
│   └── admin/
│       ├── userManagementService.js
│       ├── subscriptionService.js
│       └── dashboardService.js
├── middlewares/
│   ├── authorization.js
│   ├── subscriptionCheck.js
│   └── auditLogger.js
└── routes/
    └── adminRoutes.js

scripts/
└── createSuperAdmin.js

docs/
├── ADMIN_API.md
└── INTEGRATION_GUIDE.md
```

**Copiez tous les fichiers créés dans ce projet dans les dossiers correspondants.**

---

## 🔧 ÉTAPE 4 : MISE À JOUR DES FICHIERS EXISTANTS

### 4.1 src/config/constants.js

Remplacer le contenu par la version mise à jour incluant:
- `ACCOUNT_STATUS`
- `SUBSCRIPTION_STATUS`
- `ADMIN_ACTIONS`

### 4.2 src/middlewares/auth.js

Ajouter `role` dans les requêtes SQL et dans `req.user`:

```javascript
// Avant
SELECT id, email, business_name, store_slug, is_active FROM users...

// Après
SELECT id, email, business_name, store_slug, is_active, role FROM users...

// Et
req.user = {
  id: user.id,
  email: user.email,
  business_name: user.business_name,
  store_slug: user.store_slug,
  role: user.role  // ← AJOUTER
};
```

### 4.3 src/routes/index.js

Importer et utiliser les nouveaux middlewares:

```javascript
const adminRoutes = require('./adminRoutes');
const { checkAccountStatus } = require('../middlewares/authorization');
const { requireActiveSubscription } = require('../middlewares/subscriptionCheck');

// Routes admin
router.use('/admin', adminRoutes);

// Protéger les routes produits
router.use(
  '/products',
  authenticate,
  checkAccountStatus,           // ← NOUVEAU
  requireActiveSubscription,    // ← NOUVEAU
  productRoutes
);
```

### 4.4 src/routes/productRoutes.js

Ajouter la vérification de limite:

```javascript
const { checkPlanLimit } = require('../middlewares/subscriptionCheck');

router.post(
  '/',
  authenticate,
  apiLimiter,
  checkPlanLimit('products'),  // ← NOUVEAU
  upload.single('image'),
  validateRequest(productSchema),
  productController.createProduct
);
```

### 4.5 src/routes/orderRoutes.js

Ajouter l'incrémentation du compteur:

```javascript
const { incrementOrderCount } = require('../middlewares/subscriptionCheck');

router.post(
  '/',
  publicLimiter,
  validateRequest(orderSchema),
  orderController.createOrder,
  incrementOrderCount  // ← NOUVEAU
);
```

### 4.6 package.json

Ajouter le script:

```json
"scripts": {
  "create-admin": "node scripts/createSuperAdmin.js"
}
```

---

## 🔐 ÉTAPE 5 : CRÉER LE PREMIER SUPER ADMIN

### En Développement

```bash
npm run create-admin
```

Suivre les instructions interactives:
```
📧 Email du Super Admin: admin@votre-domaine.com
🔑 Mot de passe (min 8 caractères): ********
🔑 Confirmer le mot de passe: ********
🏢 Nom (ex: Admin Principal): Admin Principal
```

### En Production (via SSH)

```bash
ssh user@votre-serveur
cd /var/www/saas-vendor-api
npm run create-admin
```

⚠️ **IMPORTANT**: Notez ces identifiants dans un gestionnaire de mots de passe sécurisé.

---

## 🧪 ÉTAPE 6 : TESTER L'INTÉGRATION

### 6.1 Redémarrer le Serveur

```bash
# Développement
npm run dev

# Production
pm2 restart saas-vendor-api
```

### 6.2 Tester la Connexion Super Admin

```bash
# POST /api/auth/login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@votre-domaine.com",
    "password": "votre_mot_de_passe"
  }'
```

**Réponse attendue**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "admin@votre-domaine.com",
      "role": "SUPER_ADMIN"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 6.3 Tester une Route Admin

```bash
# Sauvegarder le token
TOKEN="le_token_reçu"

# GET /api/admin/dashboard
curl http://localhost:3000/api/admin/dashboard \
  -H "Authorization: Bearer $TOKEN"
```

**Réponse attendue**: Statistiques globales

### 6.4 Tester la Vérification d'Abonnement

**Créer un vendeur test**:
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "vendeur.test@example.com",
    "password": "Test123456!",
    "business_name": "Boutique Test"
  }'
```

**Le vendeur doit avoir un plan par défaut (Gratuit) automatiquement.**

**Vérifier**:
```sql
SELECT u.email, s.status, sp.name 
FROM users u
JOIN subscriptions s ON u.id = s.user_id
JOIN subscription_plans sp ON s.plan_id = sp.id
WHERE u.email = 'vendeur.test@example.com';
```

---

## 🎯 ÉTAPE 7 : ASSIGNER UN ABONNEMENT À UN VENDEUR

### Via API Admin

```bash
# Se connecter en tant que Super Admin
# Obtenir le token

# Créer un abonnement pour le vendeur ID 5
curl -X POST http://localhost:3000/api/admin/subscriptions \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 5,
    "plan_id": 2,
    "notes": "Abonnement Pro suite à paiement manuel"
  }'
```

### Via SQL Direct (fallback)

```sql
-- Donner le plan Pro (ID 2) au vendeur ID 5 pour 30 jours
INSERT INTO subscriptions 
  (user_id, plan_id, status, started_at, current_period_start, current_period_end, expires_at)
VALUES 
  (5, 2, 'active', NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), DATE_ADD(NOW(), INTERVAL 30 DAY));
```

---

## ✅ CHECKLIST DE VALIDATION

Avant de déployer en production, vérifiez:

- [ ] ✅ Migration SQL exécutée sans erreur
- [ ] ✅ Tables créées (subscription_plans, subscriptions, etc.)
- [ ] ✅ 3 plans par défaut présents (Gratuit, Pro, Business)
- [ ] ✅ Compte Super Admin créé et testé
- [ ] ✅ Routes `/api/admin/*` protégées (401 sans token, 403 sans rôle admin)
- [ ] ✅ Vendeur peut créer des produits (avec limite si plan gratuit)
- [ ] ✅ Limite de produits respectée (plan gratuit = 5 max)
- [ ] ✅ Compteur de commandes mensuelles incrémente correctement
- [ ] ✅ Dashboard admin accessible et affiche des stats
- [ ] ✅ Logs d'audit enregistrent les actions sensibles
- [ ] ✅ Suspension d'un vendeur bloque son accès
- [ ] ✅ Super Admin peut tout voir sans restrictions

---

## 🐛 DÉPANNAGE

### Erreur: "Table 'subscription_plans' doesn't exist"

**Solution**: Exécuter la migration SQL
```bash
mysql -u root -p saas_vendor_db < migrations/002_super_admin_system.sql
```

### Erreur: "Forbidden - Vous n'avez pas les permissions"

**Causes possibles**:
1. Token invalide → Se reconnecter
2. Utilisateur n'a pas le rôle SUPER_ADMIN → Vérifier en DB:
   ```sql
   SELECT role FROM users WHERE email = 'votre_email';
   ```
3. Middleware `requireSuperAdmin` non appliqué → Vérifier routes

### Erreur: "Aucun abonnement actif"

**Solution**: Créer un abonnement pour le vendeur
```bash
curl -X POST http://localhost:3000/api/admin/subscriptions \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id": X, "plan_id": 1}'
```

### Les limites ne fonctionnent pas

**Vérifier**:
```sql
-- Le vendeur a-t-il un abonnement actif ?
SELECT * FROM subscriptions WHERE user_id = X AND status IN ('trial', 'active');

-- Le plan a-t-il des limites ?
SELECT max_products, max_orders_per_month FROM subscription_plans WHERE id = Y;
```

### Compteur de commandes ne reset pas

**Vérifier le trigger**:
```sql
SHOW TRIGGERS LIKE 'subscriptions';
```

Si absent, recréer:
```sql
DELIMITER $$
CREATE TRIGGER reset_monthly_usage
BEFORE UPDATE ON subscriptions
FOR EACH ROW
BEGIN
    IF NEW.usage_reset_at IS NULL OR NEW.usage_reset_at < DATE_SUB(NOW(), INTERVAL 1 MONTH) THEN
        SET NEW.current_month_orders = 0;
        SET NEW.usage_reset_at = NOW();
    END IF;
END$$
DELIMITER ;
```

---

## 📞 SUPPORT

En cas de blocage:
1. Consulter les logs: `pm2 logs saas-vendor-api`
2. Vérifier l'état MySQL: `systemctl status mysql`
3. Tester la connexion DB: `mysql -u saas_user -p`

---

## 🎉 PROCHAINES ÉTAPES

Après intégration réussie:

1. **Créer des plans personnalisés**
   - Modifier `subscription_plans` selon vos besoins

2. **Automatiser les notifications**
   - Email avant expiration (J-7, J-3, J-1)
   - SMS pour suspension de compte

3. **Intégrer Mobile Money**
   - CinetPay, Fedapay, Paystack
   - Webhooks pour activation automatique

4. **Dashboard frontend admin**
   - React/Vue dashboard pour Super Admin
   - Graphiques avec Chart.js/Recharts

5. **Exports de données**
   - CSV des vendeurs
   - Rapport mensuel des revenus

---

**Dernière mise à jour**: 2025-12-23