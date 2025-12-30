/**
 * public/js/api.js
 * ========================================
 * AURA - Module API Central
 * ========================================
 * Gestion centralisée des appels API
 * - Authentification JWT automatique
 * - Gestion des erreurs globales
 * - Notifications automatiques
 * - Redirection si session invalide
 * ========================================
 */

const API = {
  baseURL: '/api',
  
  /**
   * Récupère le token JWT du localStorage
   */
  getToken() {
    return localStorage.getItem('aura_token');
  },

  /**
   * Sauvegarde le token JWT
   */
  setToken(token) {
    localStorage.setItem('aura_token', token);
  },

  /**
   * Supprime le token JWT
   */
  removeToken() {
    localStorage.removeItem('aura_token');
  },

  /**
   * Récupère les infos utilisateur du localStorage
   */
  getUser() {
    const user = localStorage.getItem('aura_user');
    return user ? JSON.parse(user) : null;
  },

  /**
   * Sauvegarde les infos utilisateur
   */
  setUser(user) {
    localStorage.setItem('aura_user', JSON.stringify(user));
  },

  /**
   * Supprime les infos utilisateur
   */
  removeUser() {
    localStorage.removeItem('aura_user');
  },

  /**
   * Déconnexion complète
   */
  log_out() {
    this.removeToken();
    this.removeUser();
    // Force le rechargement complet pour éviter les problèmes de cache
    window.location.replace('/login');
  },

  /**
   * Vérifie si l'utilisateur est authentifié
   */
  isAuthenticated() {
    return !!this.getToken();
  },

  /**
   * Vérifie si l'utilisateur est Super Admin
   */
  isSuperAdmin() {
    const user = this.getUser();
    return user && user.role === 'SUPER_ADMIN';
  },

  /**
   * Construit les headers pour les requêtes
   */
  buildHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  },

  /**
   * Gère les erreurs HTTP
   */
  async handleResponse(response) {
    // Session expirée ou invalide
    if (response.status === 401) {
      UI.showNotification('Session expirée', 'Veuillez vous reconnecter', 'error');
      this.logout();
      return null;
    }

    // Accès interdit
    if (response.status === 403) {
      UI.showNotification('Accès refusé', 'Vous n\'avez pas les permissions nécessaires', 'error');
      throw new Error('Accès refusé');
    }

    const data = await response.json();

    // Erreur serveur
    if (!response.ok) {
      const message = data.message || 'Une erreur est survenue';
      throw new Error(message);
    }

    return data;
  },

  /**
   * Effectue une requête GET
   */
  async get(endpoint, showLoader = true) {
    if (showLoader) UI.showLoader();

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'GET',
        headers: this.buildHeaders()
      });

      return await this.handleResponse(response);
    } catch (error) {
      UI.showNotification('Erreur', error.message, 'error');
      throw error;
    } finally {
      if (showLoader) UI.hideLoader();
    }
  },

  /**
   * Effectue une requête POST
   */
  async post(endpoint, body = {}, showLoader = true) {
    if (showLoader) UI.showLoader();

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(body)
      });

      return await this.handleResponse(response);
    } catch (error) {
      UI.showNotification('Erreur', error.message, 'error');
      throw error;
    } finally {
      if (showLoader) UI.hideLoader();
    }
  },

  /**
   * Effectue une requête PUT
   */
  async put(endpoint, body = {}, showLoader = true) {
    if (showLoader) UI.showLoader();

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'PUT',
        headers: this.buildHeaders(),
        body: JSON.stringify(body)
      });

      return await this.handleResponse(response);
    } catch (error) {
      UI.showNotification('Erreur', error.message, 'error');
      throw error;
    } finally {
      if (showLoader) UI.hideLoader();
    }
  },

  /**
   * Effectue une requête PATCH
   */
  async patch(endpoint, body = {}, showLoader = true) {
    if (showLoader) UI.showLoader();

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'PATCH',
        headers: this.buildHeaders(),
        body: JSON.stringify(body)
      });

      return await this.handleResponse(response);
    } catch (error) {
      UI.showNotification('Erreur', error.message, 'error');
      throw error;
    } finally {
      if (showLoader) UI.hideLoader();
    }
  },

  /**
   * Effectue une requête DELETE
   */
  async delete(endpoint, showLoader = true) {
    if (showLoader) UI.showLoader();

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'DELETE',
        headers: this.buildHeaders()
      });

      return await this.handleResponse(response);
    } catch (error) {
      UI.showNotification('Erreur', error.message, 'error');
      throw error;
    } finally {
      if (showLoader) UI.hideLoader();
    }
  },

  /**
   * Upload de fichier (FormData)
   */
  async upload(endpoint, formData, showLoader = true) {
    if (showLoader) UI.showLoader();

    try {
      const headers = {};
      const token = this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: headers,
        body: formData
      });

      return await this.handleResponse(response);
    } catch (error) {
      UI.showNotification('Erreur', error.message, 'error');
      throw error;
    } finally {
      if (showLoader) UI.hideLoader();
    }
  },

  /**
   * ========================================
   * MÉTHODES MÉTIER - AUTHENTIFICATION
   * ========================================
   */

  async login(email, password) {
    const data = await this.post('/auth/login', { email, password });
    if (data && data.data) {
      this.setToken(data.data.token);
      this.setUser(data.data.user);
      UI.showNotification('Connexion réussie', 'Bienvenue sur AURA', 'success');
      
      // Attendre un peu pour que le localStorage soit bien enregistré
      setTimeout(() => {
        // Redirection selon le rôle avec replace pour éviter de revenir en arrière
        if (data.data.user.role === 'SUPER_ADMIN') {
          window.location.replace('/admin/dashboard');
        } else {
          window.location.replace('/dashboard');
        }
      }, 100);
    }
    return data;
  },

  async register(formData) {
    const data = await this.post('/auth/register', formData);
    
    if (data && data.data) {
      UI.showNotification('Inscription réussie', 'Bienvenue sur AURA', 'success');
      
      // Attendre un peu pour que le localStorage soit bien enregistré
      setTimeout(() => {
        window.location.replace('/login');
      }, 100);
    }
    
    return data;
  },

  async getProfile() {
    return await this.get('/auth/profile');
  },

  async updateProfile(updates) {
    return await this.put('/auth/profile', updates);
  },
  async logout () {
    await this.post('/auth/logout');
    this.log_out();
  },

  /**
   * ========================================
   * MÉTHODES MÉTIER - PRODUITS
   * ========================================
   */

  async getProducts(page = 1, search ,limit = 20, is_available = null) {
    return await this.get(`/products/search=${search}/${is_available}`);
  },

  async getProduct(id) {
    return await this.get(`/products/${id}`);
  },

  async createProduct(formData) {
    return await this.upload('/products', formData);
  },

  async updateProduct(id, formData) {
    return await this.put(`/products/${id}`, formData);
  },

  async deleteProduct(id) {
    return await this.delete(`/products/${id}`);
  },

  /**
   * ========================================
   * MÉTHODES MÉTIER - COMMANDES
   * ========================================
   */

  async getOrders(page = 1, limit = 20, status = null) {
    let url = `/orders?page=${page}&limit=${limit}`;
    if (status) url += `&status=${status}`;
    return await this.get(url);
  },

  async getOrder(id) {
    return await this.get(`/orders/${id}`);
  },

  async updateOrderStatus(id, status) {
    return await this.patch(`/orders/${id}/status`, { status });
  },

  async getOrderStats() {
    return await this.get('/orders/stats');
  },

  /**
   * ========================================
   * MÉTHODES MÉTIER - DASHBOARD
   * ========================================
   */

  async getDashboard() {
    return await this.get('/dashboard');
  },

  async getStatsByPeriod(period) {
    return await this.get(`/dashboard/stats/${period}`);
  },

  /**
   * ========================================
   * MÉTHODES MÉTIER - ADMIN
   * ========================================
   */

  async getAdminDashboard() {
    return await this.get('/admin/dashboard');
  },

  async getVendors(page = 1, limit = 20, search = '') {
    let url = `/admin/vendors`;
    // if (search) url += `&search=${encodeURIComponent(search)}`;
    return await this.get(url);
  },

  async getVendor(id) {
    return await this.get(`/admin/vendors/${id}`);
  },

  async suspendVendor(id, reason) {
    return await this.post(`/admin/vendors/${id}/suspend`, { reason });
  },

  async activateVendor(id) {
    return await this.post(`/admin/vendors/${id}/activate`);
  },

  async getPlans() {
    return await this.get('/admin/plans');
  },

  async getSubscriptionHistory(userId) {
    return await this.get(`/admin/subscriptions/${userId}/history`);
  },

  async changePlan(userId, newPlanId) {
    return await this.put(`/admin/subscriptions/${userId}/plan`, { new_plan_id: newPlanId });
  }
};

/**
 * Protection automatique des pages
 * Vérifie l'authentification au chargement
 */
document.addEventListener('DOMContentLoaded', () => {
  const currentPath = window.location.pathname;
  const isAuthPage = currentPath.includes('/login') || currentPath.includes('/register');
  const isPublicPage = currentPath.startsWith('/p/');
  const isPublicStore = currentPath.startsWith('/store/');
  const isRootPage = currentPath === '/';
  const isLoginPage = currentPath.startsWith('/login');

  // Page racine redirige vers login
  if (isRootPage) {
    if (API.isAuthenticated()) {
      const user = API.getUser();
      if (user && user.role === 'SUPER_ADMIN') {
        window.location.replace('/admin/dashboard');
      } else {
        window.location.replace('/dashboard');
      }
    } else {
      window.location.replace('/login');
    }
    return;
  }

  // Pages auth : rediriger si déjà connecté
  if (isAuthPage) {
    if (API.isAuthenticated()) {
      const user = API.getUser();
      if (user && user.role === 'SUPER_ADMIN') {
        window.location.replace('/admin/dashboard');
      } else {
        window.location.replace('/dashboard');
      }
    }
    return;
  }

  // Pages publiques : pas de vérification
  if (isPublicPage || isPublicStore) {
    return;
  }

  // Pages protégées : vérifier l'authentification
  if (!API.isAuthenticated()) {
    window.location.replace('/login');
    return;
  }

  // Vérifier les pages admin
  const isAdminPage = currentPath.startsWith('/admin');
  if (isAdminPage && !API.isSuperAdmin()) {
    UI.showNotification('Accès refusé', 'Cette page est réservée aux administrateurs', 'error');
    window.location.replace('/dashboard');
  }
});
