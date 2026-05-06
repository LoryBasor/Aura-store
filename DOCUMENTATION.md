# 🌟 Documentation Aura-store

Bienvenue dans la documentation officielle d'**Aura**, la plateforme de gestion de boutique tout-en-un conçue pour simplifier la vente en ligne et la gestion des commandes via WhatsApp.

---

## 📋 Table des Matières
1. [Présentation Générale](#présentation-générale)
2. [Espace Vendeur (Dashboard)](#espace-vendeur-dashboard)
3. [Expérience Client (Marketplace)](#expérience-client-marketplace)
4. [Espace Administrateur](#espace-administrateur)
5. [Fonctionnalités Clés](#fonctionnalités-clés)
6. [Système d'Abonnements](#système-dabonnements)
7. [Guide Technique](#guide-technique)

---

## 1. Présentation Générale
Aura est une plateforme SaaS (Software as a Service) qui permet aux vendeurs de créer rapidement un catalogue de produits en ligne, de gérer leurs stocks et de recevoir des commandes directement sur WhatsApp. 

L'objectif est d'éliminer les frictions du commerce en ligne traditionnel en proposant une interface ultra-rapide et optimisée pour le mobile.

---

## 2. Espace Vendeur (Dashboard)
Chaque vendeur dispose d'un tableau de bord complet pour piloter son activité.

### 🛍️ Gestion des Produits
- **Création & Édition** : Ajout de produits avec images (via Cloudinary), prix, descriptions et gestion de catégories.
- **Gestion des Stocks** : Suivi automatique des quantités. Les produits en rupture sont signalés.
- **Liens de Partage** : Chaque produit possède un lien unique (ex: `/p/token`) prêt à être partagé sur les réseaux sociaux.

### 📦 Gestion des Commandes
- **Suivi en Temps Réel** : Visualisation de toutes les commandes entrantes (Nouvelles, En préparation, Livrées, Annulées).
- **Commandes Manuelles** : Possibilité pour le vendeur de saisir lui-même une commande faite hors-ligne.
- **Détails Clients** : Historique des commandes par client pour une meilleure fidélisation.

### 🎨 Personnalisation & Branding
- **Identité Visuelle** : Modification du logo et des couleurs de la boutique (disponible en plan Business).
- **Intégrations** : Configuration du numéro WhatsApp et personnalisation des messages de commande automatiques.

### 📈 Statistiques
- **Tableau de bord** : Vue d'ensemble du chiffre d'affaires, nombre de commandes et produits populaires.
- **Stats Avancées** : Graphiques de performance et analyses détaillées (plans Pro/Business).

---

## 3. Expérience Client (Marketplace)
Aura propose une expérience d'achat "One-Click".

- **Page Produit** : Interface épurée, optimisée pour le chargement rapide.
- **Passage de Commande** : Formulaire simplifié (Nom, Téléphone, Adresse). Pas besoin de créer de compte pour l'acheteur.
- **Redirection WhatsApp** : Dès que le client valide sa commande, il est automatiquement redirigé vers le WhatsApp du vendeur avec un message pré-rempli contenant tous les détails de la commande.

---

## 4. Espace Administrateur
L'administrateur dispose d'outils puissants pour modérer et gérer la plateforme.

- **Gestion des Vendeurs** : Vue détaillée de chaque vendeur, leurs produits et leurs performances.
- **Modération** : Possibilité de suspendre un compte ou de désactiver des produits spécifiques (verrouillage admin).
- **Gestion des Plans** : Création et modification des tarifs et des limites de chaque abonnement.
- **Audit Logs** : Historique complet des actions effectuées par les administrateurs pour une transparence totale.

---

## 5. Fonctionnalités Clés

### 🔗 Redirection WhatsApp Intelligente
Le système garantit que le client arrive toujours au bon endroit :
1. Vérification du numéro configuré dans les intégrations.
2. Secours sur le numéro du profil si aucune intégration n'est définie.
3. Normalisation automatique des numéros (ajout de l'indicatif `237` si manquant).

### 🔒 Sécurité & Rôles
- **Middleware d'authentification** : Protection stricte des routes privées.
- **Vérification de compte** : Les comptes peuvent être suspendus par l'admin, bloquant instantanément l'accès au dashboard et au catalogue.

---

## 6. Système d'Abonnements
Aura propose trois niveaux de plans :

1. **Plan Gratuit** : Pour débuter (limité à 5 produits et 20 commandes/semaine).
2. **Plan Pro** : Pour les vendeurs réguliers (produits illimités, statistiques).
3. **Plan Business** : L'expérience complète (branding personnalisé, API, support prioritaire).

> [!TIP]
> **Promotion Nouveau Vendeur** : Actuellement, toute nouvelle inscription bénéficie du **Plan Business offert pendant 30 jours**.

---

## 7. Guide Technique

### Stack Technologique
- **Backend** : Node.js avec Express.js.
- **Frontend** : EJS (Server Side Rendering) pour un SEO optimal et des performances accrues.
- **Base de données** : MySQL (Hébergé sur Aiven).
- **Stockage Images** : Cloudinary.

### Structure du Projet
- `src/services` : Logique métier (Produits, Commandes, Auth).
- `src/controllers` : Gestion des requêtes HTTP.
- `views/` : Templates EJS pour le rendu visuel.
- `public/` : Assets statiques (CSS, JS client).

---
*Documentation générée par l'IA Aura - 2026*
