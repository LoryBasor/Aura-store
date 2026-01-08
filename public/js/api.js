/**
 * public/js/api.js - VERSION ÉTENDUE
 * Ajout des nouveaux endpoints pour les fonctionnalités par plan
 */

const API = {
  baseURL: '/api',
  
  getToken() {
    return localStorage.getItem('aura_token');
  },

  setToken(token) {
    localStorage.setItem('aura_token', token);
  },

  removeToken() {
    localStorage.removeItem('aura_token');
  },

  getUser() {
    const user = localStorage.getItem('aura_user');
    return user ? JSON.parse(user) : null;
  },

  setUser(user) {
    localStorage.setItem('aura_user', JSON.stringify(user));
  },

  removeUser() {
    localStorage.removeItem('aura_user');
  },

  log_out() {
    this.removeToken();
    this.removeUser();
    window.location.replace('/login');
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  isSuperAdmin() {
    const user = this.getUser();
    return user && user.role === 'SUPER_ADMIN';
  },

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

  async handleResponse(response) {
    if (response.status === 401) {
      UI.showNotification('Session expirée', 'Veuillez vous reconnecter', 'error');
      this.logout();
      return null;
    }

    if (response.status === 403) {
      const data = await response.json();
      UI.showNotification('Accès refusé', data.message || 'Permissions insuffisantes', 'error');
      throw new Error(data.message || 'Accès refusé');
    }

    const data = await response.json();

    if (!response.ok) {
      const message = data.message || 'Une erreur est survenue';
      throw new Error(message);
    }

    return data;
  },

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

  // ========================================
  // AUTHENTIFICATION
  // ========================================

  async login(email, password) {
    const data = await this.post('/auth/login', { email, password });
    if (data && data.data) {
      this.setToken(data.data.token);
      this.setUser(data.data.user);
      UI.showNotification('Connexion réussie', 'Bienvenue sur AURA', 'success');
      
      setTimeout(() => {
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

  async logout() {
    await this.post('/auth/logout');
    this.log_out();
  },

  // ========================================
  // PRODUITS
  // ========================================

  async getProducts(page = 1, search, limit = 20, is_available = null) {
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

  // ========================================
  // COMMANDES
  // ========================================

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

  // ========================================
  // DASHBOARD
  // ========================================

  async getDashboard() {
    return await this.get('/dashboard');
  },

  async getStatsByPeriod(period) {
    return await this.get(`/dashboard/stats/${period}`);
  },

  // ========================================
  //  - STATISTIQUES AVANCÉES (PRO/BUSINESS)
  // ========================================

  async getAdvancedStats() {
    return await this.get('/features/stats/complete');
  },

  async getOrdersEvolution(period = 'day', days = 30) {
    return await this.get(`/features/stats/evolution?period=${period}&days=${days}`);
  },

  async getConversionMetrics() {
    return await this.get('/features/stats/conversion');
  },

  async getTopProducts(limit = 10) {
    return await this.get(`/features/stats/top-products?limit=${limit}`);
  },

  async getCustomerAnalysis() {
    return await this.get('/features/stats/customers');
  },

  async getForecast() {
    return await this.get('/features/stats/forecast');
  },

  // ========================================
  //  - EXPORT (PRO/BUSINESS)
  // ========================================

  async exportOrdersJSON() {
    window.open(`${this.baseURL}/features/export/orders/json`, '_blank');
    UI.showNotification('Export', 'Exportation réussi ', 'info');
  },

  async exportProductsJSON() {
    window.open(`${this.baseURL}/features/export/products/json`, '_blank');
    UI.showNotification('Export', 'Exportation réussi ', 'info');
  },

  async exportStatsJSON() {
    window.open(`${this.baseURL}/features/export/stats/json`, '_blank');
    UI.showNotification('Export', 'Exportation réussi ', 'info');
  },

  async exportOrdersExcel() {
    const data = await this.getProfile();
    if(data && data.data) {
      const {plan_name} = data.data.user;
      if(plan_name.toLowerCase() === 'gratuit'){
        UI.showNotification('Fonctionnalité réservée', 'L\'export des commandes est disponible pour les plans payants. Veuillez mettre à niveau votre abonnement pour accéder à cette fonctionnalité.', 'info');
        return;
      }
    }
    setTimeout(() => {
      window.open(`${this.baseURL}/features/export/orders/excel`, '_blank');
      UI.showNotification('Export', 'Exportation réussi ', 'info');
    }, 500);
  },

  async exportProductsExcel() {
    window.open(`${this.baseURL}/features/export/products/excel`, '_blank');
    UI.showNotification('Export', 'Exportation réussi ', 'info');
  },

  // ========================================
  //  - PERSONNALISATION (BUSINESS)
  // ========================================

  async getCustomization() {
    return await this.get('/features/customization');
  },

  async updateCustomization(updates) {
    return await this.put('/features/customization', updates);
  },

  async uploadLogo(formData) {
    return await this.upload('/features/customization/logo', formData);
  },

  async uploadBanner(formData) {
    return await this.upload('/features/customization/banner', formData);
  },

  async deleteLogo() {
    return await this.delete('/features/customization/logo');
  },

  async deleteBanner() {
    return await this.delete('/features/customization/banner');
  },

  async resetCustomization() {
    return await this.post('/features/customization/reset');
  },

  // ========================================
  //  - INTÉGRATIONS SOCIALES (BUSINESS)
  // ========================================

  async getIntegrations() {
    return await this.get('/features/integrations');
  },

  async updateIntegrations(updates) {
    return await this.put('/features/integrations', updates);
  },

  async toggleWhatsApp(enabled) {
    return await this.post('/features/integrations/whatsapp/toggle', { enabled });
  },

  async toggleInstagram(enabled) {
    return await this.post('/features/integrations/instagram/toggle', { enabled });
  },

  async toggleFacebook(enabled) {
    return await this.post('/features/integrations/facebook/toggle', { enabled });
  },

  async testWhatsAppMessage() {
    return await this.post('/features/integrations/whatsapp/test');
  },

  async getMessagePreview() {
    return await this.get('/features/integrations/message-preview');
  },

  // ========================================
  // ADMIN
  // ========================================

  async getAdminDashboard() {
    return await this.get('/admin/dashboard');
  },

  async getVendors(page = 1, limit = 20, search = '') {
    let url = `/admin/vendors`;
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

// Protection automatique des pages
document.addEventListener('DOMContentLoaded', () => {
  const currentPath = window.location.pathname;
  const isAuthPage = currentPath.includes('/login') || currentPath.includes('/register');
  const isPublicPage = currentPath.startsWith('/p/');
  const isPublicStore = currentPath.startsWith('/store/');
  const isRootPage = currentPath === '/';

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

  if (isPublicPage || isPublicStore) {
    return;
  }

  if (!API.isAuthenticated()) {
    window.location.replace('/login');
    return;
  }

  const isAdminPage = currentPath.startsWith('/admin');
  if (isAdminPage && !API.isSuperAdmin()) {
    UI.showNotification('Accès refusé', 'Cette page est réservée aux administrateurs', 'error');
    window.location.replace('/dashboard');
  }
});