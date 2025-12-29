# 🔐 API Documentation Super Admin

Documentation complète des endpoints réservés aux Super Admin.

**Base URL**: `https://api.votre-domaine.com/api/admin`

**Authentification**: Toutes les routes nécessitent un JWT avec le rôle `SUPER_ADMIN`

---

## 📊 DASHBOARD

### GET /admin/dashboard
Récupère toutes les statistiques globales de la plateforme.

**Headers**:
```
Authorization: Bearer {super_admin_token}
```

**Réponse**:
```json
{
  "success": true,
  "data": {
    "stats": {
      "vendors": {
        "total": 150,
        "active": 120,
        "suspended": 5,
        "new_last_30_days": 25
      },
      "products": {
        "total": 3450,
        "available": 3200
      },
      "orders": {
        "total": 8500,
        "last_30_days": 450
      },
      "revenue": {
        "total": 125000000,
        "last_30_days": 8500000
      },
      "subscriptions": {
        "trial": 30,
        "active": 100,
        "expired": 20
      }
    },
    "top_vendors": [...],
    "recent_vendors": [...],
    "recent_orders": [...],
    "conversion": {
      "total_signups": 150,
      "active_users": 120,
      "conversion_rate": 80.00
    }
  }
}
```

### GET /admin/dashboard/stats/:period
Statistiques par période (graphiques).

**Paramètres**:
- `period`: `7days`, `30days`, `90days`, `365days`

### GET /admin/dashboard/expiring-subscriptions
Liste les abonnements expirant bientôt.

**Query params**:
- `days` (optionnel): nombre de jours (défaut: 7)

### GET /admin/dashboard/subscription-distribution
Distribution des abonnements par plan.

---

## 👥 GESTION DES VENDEURS

### GET /admin/vendors
Liste tous les vendeurs.

**Query params**:
- `page` (défaut: 1)
- `limit` (défaut: 20)
- `status`: `active`, `suspended`, `deactivated`
- `search`: recherche par email, nom, téléphone

**Exemple**:
```
GET /admin/vendors?page=1&limit=20&status=active&search=boutique
```

**Réponse**:
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "email": "vendeur@example.com",
      "business_name": "Ma Boutique",
      "account_status": "active",
      "subscription_status": "active",
      "plan_name": "Pro",
      "products_count": 25,
      "orders_count": 120,
      "total_revenue": 2500000,
      "created_at": "2025-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

### GET /admin/vendors/:userId
Récupère les détails complets d'un vendeur.

**Réponse**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 5,
      "email": "vendeur@example.com",
      "business_name": "Ma Boutique",
      "phone": "+237612345678",
      "account_status": "active",
      "subscription_status": "active",
      "plan_name": "Pro",
      "expires_at": "2025-02-15T10:30:00Z"
    },
    "stats": {
      "total_products": 25,
      "total_orders": 120,
      "total_revenue": 2500000,
      "total_customers": 45,
      "orders_last_30_days": 15
    },
    "recent_orders": [...]
  }
}
```

### POST /admin/vendors/:userId/suspend
Suspend un vendeur.

**Body**:
```json
{
  "reason": "Violation des conditions d'utilisation"
}
```

**Réponse**:
```json
{
  "success": true,
  "message": "Vendeur suspendu avec succès"
}
```

### POST /admin/vendors/:userId/activate
Réactive un vendeur suspendu.

### POST /admin/vendors/:userId/deactivate
Désactive définitivement un vendeur.

### POST /admin/vendors/:userId/reset-password
Réinitialise le mot de passe d'un vendeur.

**Body** (optionnel):
```json
{
  "must_change_password": true
}
```

**Réponse**:
```json
{
  "success": true,
  "message": "Mot de passe réinitialisé",
  "data": {
    "temporary_password": "Abc123Xyz789"
  }
}
```

⚠️ **Important**: Communiquez ce mot de passe temporaire au vendeur de manière sécurisée.

---

## 📦 GESTION DES PLANS

### GET /admin/plans
Liste tous les plans d'abonnement.

**Query params**:
- `include_inactive` (optionnel): `true` pour inclure les plans désactivés

**Réponse**:
```json
{
  "success": true,
  "data": {
    "plans": [
      {
        "id": 1,
        "name": "Gratuit",
        "slug": "free",
        "price": 0.00,
        "billing_cycle": "monthly",
        "max_products": 5,
        "max_orders_per_month": 20,
        "has_analytics": false,
        "trial_days": 7,
        "is_active": true
      },
      {
        "id": 2,
        "name": "Pro",
        "slug": "pro",
        "price": 5000.00,
        "billing_cycle": "monthly",
        "max_products": -1,
        "max_orders_per_month": -1,
        "has_analytics": true,
        "trial_days": 14,
        "is_active": true
      }
    ]
  }
}
```

### GET /admin/plans/:id
Récupère les détails d'un plan spécifique.

---

## 💳 GESTION DES ABONNEMENTS

### GET /admin/subscriptions/stats
Statistiques globales des abonnements.

**Réponse**:
```json
{
  "success": true,
  "data": {
    "stats": {
      "trial_count": 30,
      "active_count": 100,
      "expired_count": 20,
      "cancelled_count": 10,
      "expiring_soon": 5
    }
  }
}
```

### POST /admin/subscriptions
Crée un abonnement pour un vendeur.

**Body**:
```json
{
  "user_id": 5,
  "plan_id": 2,
  "notes": "Upgrade manuel suite à paiement"
}
```

**Réponse**:
```json
{
  "success": true,
  "message": "Abonnement créé avec succès",
  "data": {
    "subscription": {
      "id": 15,
      "user_id": 5,
      "plan_id": 2,
      "status": "trial",
      "started_at": "2025-01-20T10:00:00Z",
      "trial_ends_at": "2025-02-03T10:00:00Z",
      "expires_at": "2025-02-03T10:00:00Z"
    }
  }
}
```

### PUT /admin/subscriptions/:userId/plan
Change le plan d'un vendeur.

**Body**:
```json
{
  "new_plan_id": 3
}
```

**Réponse**:
```json
{
  "success": true,
  "message": "Plan amélioré avec succès",
  "data": {
    "success": true,
    "action": "upgraded"
  }
}
```

### POST /admin/subscriptions/:userId/extend
Prolonge un abonnement.

**Body**:
```json
{
  "days": 30
}
```

**Réponse**:
```json
{
  "success": true,
  "message": "Abonnement prolongé de 30 jours",
  "data": {
    "success": true,
    "new_expiry": "2025-03-20T10:00:00Z"
  }
}
```

### POST /admin/subscriptions/:userId/cancel
Annule un abonnement.

**Body**:
```json
{
  "reason": "Non-paiement"
}
```

### GET /admin/subscriptions/:userId/history
Récupère l'historique complet des abonnements d'un vendeur.

**Réponse**:
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": 25,
        "action": "created",
        "plan_name": "Pro",
        "old_status": null,
        "new_status": "trial",
        "performed_by_email": "admin@example.com",
        "created_at": "2025-01-20T10:00:00Z"
      },
      {
        "id": 26,
        "action": "upgraded",
        "plan_name": "Business",
        "old_status": "active",
        "new_status": "active",
        "performed_by_email": "admin@example.com",
        "created_at": "2025-01-25T15:30:00Z"
      }
    ]
  }
}
```

---

## 🔍 LOGS D'AUDIT

Toutes les actions sensibles sont automatiquement loguées dans la table `admin_audit_logs`.

**Informations enregistrées**:
- Admin qui a effectué l'action
- Type d'action (suspend, activate, reset_password, etc.)
- Entité modifiée (user, subscription)
- Ancien et nouvel état (JSON)
- Adresse IP
- User Agent
- Timestamp

**Exemple de requête SQL pour consulter les logs**:
```sql
SELECT 
  u.email as admin_email,
  aal.action,
  aal.entity_type,
  aal.entity_id,
  aal.notes,
  aal.created_at
FROM admin_audit_logs aal
JOIN users u ON aal.admin_id = u.id
ORDER BY aal.created_at DESC
LIMIT 50;
```

---

## 🔒 SÉCURITÉ

### Bonnes Pratiques

1. **Ne jamais partager le token Super Admin**
2. **Utiliser HTTPS en production**
3. **Rotation régulière des mots de passe**
4. **Consulter régulièrement les logs d'audit**
5. **Limiter le nombre de comptes Super Admin (1-2 max)**

### Codes d'Erreur

- `401`: Non authentifié (token manquant/invalide)
- `403`: Interdit (pas le rôle SUPER_ADMIN)
- `404`: Ressource introuvable
- `400`: Données invalides
- `500`: Erreur serveur

---

## 📝 NOTES

### Création du Premier Super Admin

Le premier compte Super Admin doit être créé via le script CLI:

```bash
npm run create-admin
```

**Ce compte ne peut PAS être créé via l'API pour des raisons de sécurité.**

### Taux de Limite (Rate Limiting)

Les routes admin sont protégées par rate limiting:
- 100 requêtes / 15 minutes par IP/utilisateur

### Workflow Typique

**Nouvel utilisateur**:
1. Utilisateur s'inscrit (plan gratuit automatique)
2. Super Admin peut upgrader manuellement: `POST /admin/subscriptions`
3. Super Admin peut prolonger: `POST /admin/subscriptions/:userId/extend`

**Problème vendeur**:
1. Super Admin suspend: `POST /admin/vendors/:userId/suspend`
2. Investigation / contact vendeur
3. Super Admin réactive: `POST /admin/vendors/:userId/activate`

**Paiement manuel**:
1. Vendeur envoie preuve de paiement
2. Super Admin crée/prolonge abonnement
3. Note dans le champ `notes` pour traçabilité

---

## 🚀 Évolutions Futures

- [ ] API de paiement automatique (Mobile Money)
- [ ] Webhooks pour événements (subscription.expired, etc.)
- [ ] Export Excel des données
- [ ] Notifications automatiques avant expiration
- [ ] Dashboard analytics avancé

---

**Dernière mise à jour**: 2025-12-23