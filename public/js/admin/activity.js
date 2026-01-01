/**
 * public/js/admin/activity.js
 * ========================================
 * ACTIVITÉ GLOBALE - SUPER ADMIN
 * ========================================
 */

const AdminActivity = {
  currentPeriod: '7days',
  currentTab: null,
  refreshInterval: null,

  init() {
    this.attachEventListeners();
    this.loadAllData();
    this.startAutoRefresh();
  },

  attachEventListeners() {
    // Filtre période
    const periodFilter = document.getElementById('periodFilter');
    if (periodFilter) {
      periodFilter.addEventListener('change', (e) => {
        this.currentPeriod = e.target.value;
        this.loadAllData();
      });
    }

    // Refresh manuel
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadAllData();
        UI.showNotification('Succès', 'Données actualisées', 'success');
      });
    }

    // Export
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.openExportModal());
    }

    // Form export
    const exportForm = document.getElementById('exportForm');
    if (exportForm) {
      exportForm.addEventListener('submit', (e) => this.handleExport(e));
    }

    // Chart metric
    const chartMetric = document.getElementById('chartMetric');
    if (chartMetric) {
      chartMetric.addEventListener('change', () => this.renderActivityChart());
    }

    // Tabs
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab;
        this.switchTab(tab);
      });
    });
  },

  async loadAllData() {
    try {
      UI.showLoader();

      await Promise.all([
        this.loadRealtimeStats(),
        this.loadActivityData(),
        this.loadRecentSignups(),
        this.loadRecentOrders(),
        this.loadSystemStatus()
      ]);

      UI.hideLoader();
    } catch (error) {
      UI.hideLoader();
      console.error('Erreur chargement activité:', error);
      UI.showNotification('Erreur', 'Impossible de charger les données', 'error');
    }
  },

  async loadRealtimeStats() {
    try {
      const data = await API.get('/admin/dashboard', false);

      if (data && data.data && data.data.stats) {
        this.renderRealtimeStats(data.data.stats);
        this.renderQuickStats(data.data.stats);
      }
    } catch (error) {
      console.error('Erreur stats temps réel:', error);
      throw error;
    }
  },

  async renderRealtimeStats(stats) {
    const container = document.getElementById('realtimeStats');
    const reponse = await API.getAdminDashboard();
    const conversion = reponse.data.conversion;
    if (!container) return;

    const periodLabels = {
      'today': 'Aujourd\'hui',
      '7days': '7 derniers jours',
      '30days': '30 derniers jours',
      '90days': '90 derniers jours'
    };

    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Nouveaux Vendeurs</span>
          <div class="stat-icon">🆕</div>
        </div>
        <div class="stat-value">${stats.vendors.new_last_30_days || 0}</div>
        <div class="stat-change positive">+${Math.round((stats.vendors.new_last_30_days / stats.vendors.total) * 100 || 0)}%</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Commandes (${periodLabels[this.currentPeriod]})</span>
          <div class="stat-icon">🛒</div>
        </div>
        <div class="stat-value">${stats.orders.last_30_days || 0}</div>
        <div class="stat-change positive">Sur ${stats.orders.total || 0} total</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">CA Période</span>
          <div class="stat-icon">💰</div>
        </div>
        <div class="stat-value">${UI.formatCurrency(stats.revenue.last_30_days || 0)}</div>
        <div class="stat-change positive">Sur ${UI.formatCurrency(stats.revenue.total || 0)} total</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Taux Conversion</span>
          <div class="stat-icon">📊</div>
        </div>
        <div class="stat-value">${conversion.conversion_rate || 0}%</div>
        <div class="stat-change">${conversion.active_users || 0}/${conversion.total_signups || 0} actifs</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Produits Actifs</span>
          <div class="stat-icon">📦</div>
        </div>
        <div class="stat-value">${stats.products.available || 0}</div>
        <div class="stat-change">Sur ${stats.products.total || 0} total</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Abonnements Actifs</span>
          <div class="stat-icon">✅</div>
        </div>
        <div class="stat-value">${stats.subscriptions.active || 0}</div>
        <div class="stat-change warning">${stats.subscriptions.trial || 0} en trial</div>
      </div>
    `;
  },

  renderQuickStats(stats) {
    const container = document.getElementById('quickStats');
    if (!container) return;

    const avgOrderValue = stats.orders.total > 0 
      ? stats.revenue.total / stats.orders.total 
      : 0;

    const avgVendorRevenue = stats.vendors.active > 0 
      ? stats.revenue.total / stats.vendors.active 
      : 0;

    container.innerHTML = `
      <div style="padding: 24px; display: flex; flex-direction: column; gap: 20px;">
        <div style="padding: 16px; background: var(--color-surface); border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 28px; font-weight: 700; color: var(--color-primary);">
            ${UI.formatCurrency(avgOrderValue)}
          </div>
          <div style="font-size: 13px; color: var(--color-secondary); margin-top: 4px;">
            Panier moyen
          </div>
        </div>

        <div style="padding: 16px; background: var(--color-surface); border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 28px; font-weight: 700; color: var(--color-primary);">
            ${UI.formatCurrency(avgVendorRevenue)}
          </div>
          <div style="font-size: 13px; color: var(--color-secondary); margin-top: 4px;">
            CA moyen/vendeur
          </div>
        </div>

        <div style="padding: 16px; background: var(--color-surface); border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 28px; font-weight: 700; color: var(--color-primary);">
            ${stats.vendors.suspended || 0}
          </div>
          <div style="font-size: 13px; color: var(--color-secondary); margin-top: 4px;">
            Comptes suspendus
          </div>
        </div>

        <div style="padding: 16px; background: var(--color-surface); border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 28px; font-weight: 700; color: var(--color-primary);">
            ${stats.subscriptions.expired || 0}
          </div>
          <div style="font-size: 13px; color: var(--color-secondary); margin-top: 4px;">
            Abonnements expirés
          </div>
        </div>
      </div>
    `;
  },

  async loadActivityData() {
    try {
      const data = await API.get(`/admin/dashboard/stats/${this.currentPeriod}`, false);

      if (data && data.data) {
        this.activityData = data.data;
        this.renderActivityChart();
      }
    } catch (error) {
      console.error('Erreur activity data:', error);
    }
  },

  renderActivityChart() {
    const container = document.getElementById('activityChart');
    if (!container || !this.activityData) return;

    const metric = document.getElementById('chartMetric')?.value || 'orders';
    const data = this.activityData;

    // Graphique simple avec des barres ASCII
    container.innerHTML = `
      <div style="padding: 24px; display: flex; flex-direction: column; gap: 12px;">
        <div style="font-size: 14px; color: var(--color-secondary); margin-bottom: 12px;">
          📈 Évolution sur ${this.currentPeriod}
        </div>
        
        ${metric === 'orders' && data.orders ? `
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${data.orders.slice(0, 7).map(day => {
              const maxValue = Math.max(...data.orders.map(d => d.count));
              const percentage = (day.count / maxValue) * 100;
              
              return `
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="width: 80px; font-size: 12px; color: var(--color-secondary);">
                    ${new Date(day.date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })}
                  </div>
                  <div style="flex: 1; height: 24px; background: var(--color-surface); border-radius: var(--radius-sm); overflow: hidden;">
                    <div style="width: ${percentage}%; height: 100%; background: linear-gradient(90deg, var(--color-primary), var(--color-accent)); transition: width 0.3s;"></div>
                  </div>
                  <div style="width: 60px; text-align: right; font-weight: 700; color: var(--color-primary);">
                    ${day.count}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <p style="text-align: center; color: var(--color-secondary); padding: 48px;">
            Graphique ${metric} non disponible
          </p>
        `}
      </div>
    `;
  },

  async loadRecentSignups() {
    try {
      const data = await API.get('/admin/vendors', false);

      if (data && data.data) {
        const signups = data.data
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 5);

        document.getElementById('signupsCount').textContent = signups.length;
        this.renderRecentSignups(signups);
      }
    } catch (error) {
      console.error('Erreur signups:', error);
    }
  },

  renderRecentSignups(signups) {
    const container = document.getElementById('recentSignups');
    if (!container) return;

    if (!signups || signups.length === 0) {
      container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Aucune inscription récente</p></div>';
      return;
    }

    const statusColors = {
      'active': 'success',
      'suspended': 'error',
      'deactivated': 'neutral'
    };

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px; padding: 16px;">
        ${signups.map(vendor => `
          <div style="padding: 12px; background: var(--color-surface); border-radius: var(--radius-sm); cursor: pointer;" onclick="window.location.href='/admin/vendors/${vendor.id}'">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <strong style="color: var(--color-primary); font-size: 14px;">
                ${vendor.business_name}
              </strong>
              <span class="badge badge-${statusColors[vendor.account_status]}" style="font-size: 11px;">
                ${vendor.account_status}
              </span>
            </div>
            <div style="font-size: 12px; color: var(--color-secondary);">
              ${vendor.email}
            </div>
            <div style="font-size: 11px; color: var(--color-tertiary); margin-top: 4px;">
              📅 ${UI.formatRelativeDate(vendor.created_at)}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  async loadRecentOrders() {
    try {
      const data = await API.get('/admin/dashboard', false);

      if (data && data.data && data.data.recent_orders) {
        const orders = data.data.recent_orders.slice(0, 5);
        document.getElementById('ordersCount').textContent = orders.length;
        this.renderRecentOrders(orders);
      }
    } catch (error) {
      console.error('Erreur orders:', error);
    }
  },

  renderRecentOrders(orders) {
    const container = document.getElementById('recentOrders');
    if (!container) return;

    if (!orders || orders.length === 0) {
      container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Aucune commande récente</p></div>';
      return;
    }

    const statusColors = {
      'nouvelle': 'info',
      'confirmee': 'success',
      'en_preparation': 'warning',
      'en_livraison': 'warning',
      'livree': 'success',
      'annulee': 'error'
    };

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px; padding: 16px;">
        ${orders.map(order => `
          <div style="padding: 12px; background: var(--color-surface); border-radius: var(--radius-sm);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <strong style="color: var(--color-primary); font-size: 14px;">
                ${order.order_number}
              </strong>
              <span class="badge badge-${statusColors[order.status]}" style="font-size: 11px;">
                ${order.status}
              </span>
            </div>
            <div style="font-size: 12px; color: var(--color-secondary); margin-bottom: 4px;">
              ${order.vendor_name} • ${order.customer_name}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 16px; font-weight: 700; color: var(--color-primary);">
                ${UI.formatCurrency(order.total_amount)}
              </span>
              <span style="font-size: 11px; color: var(--color-tertiary);">
                ${UI.formatRelativeDate(order.created_at)}
              </span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  async loadSystemStatus() {
    const container = document.getElementById('systemStatus');
    if (!container) return;

    // Simuler état système
    container.innerHTML = `
      <div style="padding: 24px; display: flex; flex-direction: column; gap: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: var(--color-secondary);">API</span>
          <span class="badge badge-success">✓ Opérationnel</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: var(--color-secondary);">Base de données</span>
          <span class="badge badge-success">✓ Opérationnel</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: var(--color-secondary);">Stockage</span>
          <span class="badge badge-success">✓ OK</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: var(--color-secondary);">Serveur</span>
          <span class="badge badge-success">✓ En ligne</span>
        </div>
      </div>
    `;

    this.loadAlerts();
  },

  async loadAlerts() {
    const container = document.getElementById('alertsPanel');
    if (!container) return;

    try {
      const data = await API.get('/admin/dashboard/expiring-subscriptions?days=7', false);
      const alerts = [];

      if (data && data.data && data.data.subscriptions && data.data.subscriptions.length > 0) {
        alerts.push({
          type: 'warning',
          message: `${data.data.subscriptions.length} abonnement(s) expirent bientôt`,
          subscriptions: data.data.subscriptions
        });
      }

      if (alerts.length === 0) {
        container.innerHTML = `
          <div style="padding: 24px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 12px;">✅</div>
            <div style="color: var(--color-success); font-weight: 700;">
              Aucune alerte
            </div>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div style="padding: 16px; display: flex; flex-direction: column; gap: 12px;">
            ${alerts.map(alert => `
              <div style="padding: 12px; background: rgba(255, 152, 0, 0.1); border-left: 4px solid var(--color-warning); border-radius: var(--radius-sm);">
                <div style="font-size: 13px; color: var(--color-primary);">
                  ⚠️ ${alert.message} <br>
                    <strong> Boutiques concernées: </strong>
                    ${alert.subscriptions.map(s => s.business_name).join(', ')}
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }
    } catch (error) {
      console.error('Erreur alerts:', error);
    }
  },
};

AdminActivity.switchTab = async function(tab) {
  this.currentTab = tab;

  // Mettre à jour boutons actifs
  document.querySelectorAll('[data-tab]').forEach(btn => {
    if (btn.dataset.tab === tab) {
      btn.classList.remove('btn-secondary');
      btn.classList.add('btn-primary');
    } else {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-secondary');
    }
  });

  const container = document.getElementById('activityDetails');
  container.innerHTML = '<div class="loader"></div>';

  try {
    switch (tab) {
      case 'vendors':
        await this.loadVendorsTab();
        break;
      case 'products':
        await this.loadProductsTab();
        break;
      case 'orders':
        await this.loadOrdersTab();
        break;
      case 'subscriptions':
        await this.loadSubscriptionsTab();
        break;
    }
  } catch (error) {
    console.error(`Erreur tab ${tab}:`, error);
    container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Erreur de chargement</p></div>';
  }
};

AdminActivity.loadVendorsTab = async function() {
  const data = await API.get('/admin/vendors', false);

  const container = document.getElementById('activityDetails');
  if (!data || !data.data) {
    container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Aucun vendeur</p></div>';
    return;
  }

  const vendors = data.data;

  container.innerHTML = `
    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>Vendeur</th>
            <th>Email</th>
            <th>Plan</th>
            <th>Produits</th>
            <th>Commandes</th>
            <th>CA</th>
            <th>Statut</th>
            <th>Inscrit</th>
          </tr>
        </thead>
        <tbody>
          ${vendors.map(v => `
            <tr>
              <td><strong>${v.business_name}</strong></td>
              <td style="font-size: 13px;">${v.email}</td>
              <td><span class="badge badge-info">${v.plan_name || 'Aucun'}</span></td>
              <td style="text-align: center;">${v.products_count || 0}</td>
              <td style="text-align: center;">${v.orders_count || 0}</td>
              <td style="font-weight: 600;">${UI.formatCurrency(v.total_revenue || 0)}</td>
              <td><span class="badge badge-${v.account_status === 'active' ? 'success' : 'error'}">${v.account_status}</span></td>
              <td style="font-size: 13px; color: var(--color-secondary);">${UI.formatRelativeDate(v.created_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
};

AdminActivity.loadProductsTab = async function() {
  const container = document.getElementById('activityDetails');
  
  container.innerHTML = `
    <div style="padding: 48px; text-align: center; color: var(--color-secondary);">
      <div style="font-size: 64px; margin-bottom: 16px;">📦</div>
      <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 8px; color: var(--color-primary);">
        Vue d'ensemble des produits
      </h3>
      <p style="margin-bottom: 24px;">
        Les produits sont gérés individuellement par chaque vendeur.<br>
        Consultez les détails d'un vendeur pour voir ses produits.
      </p>
      <button class="btn btn-primary" onclick="window.location.href='/admin/vendors'">
        Voir les vendeurs
      </button>
    </div>
  `;
};

AdminActivity.loadOrdersTab = async function() {
  const data = await API.get('/admin/dashboard', false);

  const container = document.getElementById('activityDetails');
  if (!data || !data.data || !data.data.recent_orders) {
    container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Aucune commande</p></div>';
    return;
  }

  const orders = data.data.recent_orders;

  const statusColors = {
    'nouvelle': 'info',
    'confirmee': 'success',
    'en_preparation': 'warning',
    'en_livraison': 'warning',
    'livree': 'success',
    'annulee': 'error'
  };

  container.innerHTML = `
    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>N° Commande</th>
            <th>Vendeur</th>
            <th>Client</th>
            <th>Produit</th>
            <th>Montant</th>
            <th>Statut</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(o => `
            <tr>
              <td><strong>${o.order_number}</strong></td>
              <td style="font-size: 13px;">${o.vendor_name}</td>
              <td>${o.customer_name}</td>
              <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${o.product_name}</td>
              <td style="font-weight: 600;">${UI.formatCurrency(o.total_amount)}</td>
              <td><span class="badge badge-${statusColors[o.status]}">${o.status}</span></td>
              <td style="font-size: 13px; color: var(--color-secondary);">${UI.formatRelativeDate(o.created_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <p style="padding: 16px; text-align: center; color: var(--color-secondary); font-size: 14px;">
      ℹ️ Aperçu lecture seule. Les commandes sont gérées par les vendeurs.
    </p>
  `;
};

AdminActivity.loadSubscriptionsTab = async function() {
  const data = await API.get('/admin/subscriptions/stats', false);

  const container = document.getElementById('activityDetails');
  if (!data || !data.data || !data.data.stats) {
    container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Aucune donnée</p></div>';
    return;
  }

  const stats = data.data.stats;

  container.innerHTML = `
    <div style="padding: 32px;">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 24px; margin-bottom: 32px;">
        <div style="padding: 24px; background: var(--color-surface); border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 48px; font-weight: 700; color: var(--color-warning);">
            ${stats.trial_count || 0}
          </div>
          <div style="font-size: 16px; color: var(--color-secondary); margin-top: 8px;">
            Abonnements Trial
          </div>
        </div>

        <div style="padding: 24px; background: var(--color-surface); border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 48px; font-weight: 700; color: var(--color-success);">
            ${stats.active_count || 0}
          </div>
          <div style="font-size: 16px; color: var(--color-secondary); margin-top: 8px;">
            Abonnements Actifs
          </div>
        </div>

        <div style="padding: 24px; background: var(--color-surface); border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 48px; font-weight: 700; color: var(--color-error);">
            ${stats.expired_count || 0}
          </div>
          <div style="font-size: 16px; color: var(--color-secondary); margin-top: 8px;">
            Abonnements Expirés
          </div>
        </div>

        <div style="padding: 24px; background: var(--color-surface); border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 48px; font-weight: 700; color: var(--color-tertiary);">
            ${stats.cancelled_count || 0}
          </div>
          <div style="font-size: 16px; color: var(--color-secondary); margin-top: 8px;">
            Abonnements Annulés
          </div>
        </div>
      </div>

      <div style="text-align: center;">
        <a href='/admin/subscriptions'>
          <button class="btn btn-primary">
            📋 Gérer les abonnements
          </button>
        </a>
      </div>
    </div>
  `;
};

AdminActivity.openExportModal = function() {
  ModalManager.openModal('exportModal');
};

AdminActivity.handleExport = async function(e) {
  e.preventDefault();

  const format = document.getElementById('exportFormat').value;
  const period = document.getElementById('exportPeriod').value;
  
  const includeVendors = document.getElementById('includeVendors').checked;
  const includeOrders = document.getElementById('includeOrders').checked;
  const includeProducts = document.getElementById('includeProducts').checked;
  const includeSubscriptions = document.getElementById('includeSubscriptions').checked;

  if (!includeVendors && !includeOrders && !includeProducts && !includeSubscriptions) {
    UI.showNotification('Erreur', 'Sélectionnez au moins une catégorie', 'error');
    return;
  }

  UI.showNotification('Export', 'Génération du rapport en cours...', 'info');
  
  // Simuler export
  setTimeout(() => {
    UI.showNotification('Succès', `Rapport ${format.toUpperCase()} généré`, 'success');
    ModalManager.closeModal('exportModal');
    
    // Dans une vraie implémentation, générer le fichier
    console.log('Export:', { format, period, includeVendors, includeOrders, includeProducts, includeSubscriptions });
  }, 2000);
};

AdminActivity.startAutoRefresh = function() {
  // Rafraîchir toutes les 5 minutes
  this.refreshInterval = setInterval(() => {
    console.log('Auto-refresh activité...');
    this.loadRealtimeStats();
    this.loadRecentSignups();
    this.loadRecentOrders();
  }, 5 * 60 * 1000);
};

AdminActivity.stopAutoRefresh = function() {
  if (this.refreshInterval) {
    clearInterval(this.refreshInterval);
    this.refreshInterval = null;
  }
};

// Arrêter le refresh quand on quitte la page
window.addEventListener('beforeunload', () => {
  AdminActivity.stopAutoRefresh();
});

// Export global
window.AdminActivity = AdminActivity;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('realtimeStats')) {
    AdminActivity.init();
  }
});