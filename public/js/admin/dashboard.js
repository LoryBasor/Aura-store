/**
 * public/js/admin/dashboard.js
 * ========================================
 * DASHBOARD SUPER ADMIN
 * ========================================
 */

const AdminDashboard = {
  currentPeriod: '30days',

  init() {
    this.attachEventListeners();
    this.loadAllData();
  },

  attachEventListeners() {
    // Filtre de période
    const periodFilter = document.getElementById('periodFilter');
    if (periodFilter) {
      periodFilter.addEventListener('change', (e) => {
        this.currentPeriod = e.target.value;
        this.loadStatsByPeriod();
      });
    }

    // Bouton refresh
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadAllData();
      });
    }
  },

  async loadAllData() {
    try {
      UI.showLoader();
      
      // Charger toutes les données en parallèle
      await Promise.all([
        this.loadDashboard(),
        this.loadExpiringSubscriptions(),
        this.loadSubscriptionDistribution()
      ]);

      UI.hideLoader();
      UI.showNotification('Succès', 'Données actualisées', 'success');
    } catch (error) {
      UI.hideLoader();
      console.error('Erreur chargement dashboard:', error);
      UI.showNotification('Erreur', 'Impossible de charger les données', 'error');
    }
  },

  async loadDashboard() {
    try {
      const data = await API.get('/admin/dashboard', false);
      
      if (data && data.data) {
        this.renderGlobalStats(data.data.stats);
        this.renderConversionRate(data.data.conversion);
        this.renderTopVendors(data.data.top_vendors);
        this.renderRecentActivity(data.data.recent_vendors);
      }
    } catch (error) {
      console.error('Erreur loadDashboard:', error);
      throw error;
    }
  },

  renderGlobalStats(stats) {
    const container = document.getElementById('globalStats');
    if (!container) return;

    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Vendeurs Actifs</span>
          <div class="stat-icon">👥</div>
        </div>
        <div class="stat-value">${stats.vendors.active || 0}</div>
        <div class="stat-change positive">+${stats.vendors.new_last_30_days || 0} ce mois</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Total Vendeurs</span>
          <div class="stat-icon">🏪</div>
        </div>
        <div class="stat-value">${stats.vendors.total || 0}</div>
        <div class="stat-change">${stats.vendors.suspended || 0} suspendus</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Produits Totaux</span>
          <div class="stat-icon">📦</div>
        </div>
        <div class="stat-value">${stats.products.total || 0}</div>
        <div class="stat-change">${stats.products.available || 0} disponibles</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Commandes Totales</span>
          <div class="stat-icon">🛒</div>
        </div>
        <div class="stat-value">${stats.orders.total || 0}</div>
        <div class="stat-change positive">+${stats.orders.last_30_days || 0} (30j)</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">CA Plateforme</span>
          <div class="stat-icon">💰</div>
        </div>
        <div class="stat-value">${UI.formatCurrency(stats.revenue.total || 0)}</div>
        <div class="stat-change positive">${UI.formatCurrency(stats.revenue.last_30_days || 0)} (30j)</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Abonnements Actifs</span>
          <div class="stat-icon">✅</div>
        </div>
        <div class="stat-value">${stats.subscriptions.active || 0}</div>
        <div class="stat-change">${stats.subscriptions.trial || 0} en trial</div>
      </div>
    `;
  },

  renderConversionRate(conversion) {
    const container = document.getElementById('conversionStats');
    if (!container) return;

    const rate = conversion.conversion_rate || 0;
    const color = rate > 50 ? 'var(--color-success)' : rate > 30 ? 'var(--color-warning)' : 'var(--color-error)';

    container.innerHTML = `
      <div style="padding: 32px; text-align: center;">
        <div style="font-size: 64px; font-weight: 700; color: ${color}; margin-bottom: 16px;">
          ${rate}%
        </div>
        <div style="font-size: 16px; color: var(--color-secondary); margin-bottom: 32px;">
          Taux de conversion global
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; text-align: left;">
          <div style="padding: 16px; background: var(--color-surface); border-radius: var(--radius-sm);">
            <div style="font-size: 28px; font-weight: 700; color: var(--color-primary);">
              ${conversion.total_signups || 0}
            </div>
            <div style="font-size: 13px; color: var(--color-secondary);">
              Inscriptions totales
            </div>
          </div>
          
          <div style="padding: 16px; background: var(--color-accent); border-radius: var(--radius-sm);">
            <div style="font-size: 28px; font-weight: 700; color: var(--color-primary);">
              ${conversion.active_users || 0}
            </div>
            <div style="font-size: 13px; color: var(--color-primary);">
              Utilisateurs actifs
            </div>
          </div>
        </div>
      </div>
    `;
  },

  renderTopVendors(vendors) {
    const container = document.getElementById('topVendors');
    if (!container) return;

    if (!vendors || vendors.length === 0) {
      container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Aucun vendeur</p></div>';
      return;
    }

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${vendors.slice(0, 5).map((vendor, index) => `
          <div style="padding: 16px; background: ${index === 0 ? 'linear-gradient(135deg, var(--color-accent), var(--color-surface))' : 'var(--color-surface)'}; border-radius: var(--radius-sm); display: flex; align-items: center; gap: 12px; cursor: pointer;" data-vendor-id="${vendor.id}">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--color-primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px;">
              ${index + 1}
            </div>
            <div style="flex: 1;">
              <div style="font-weight: 700; color: var(--color-primary); margin-bottom: 4px;">
                ${vendor.business_name}
              </div>
              <div style="font-size: 13px; color: var(--color-secondary);">
                ${vendor.total_orders || 0} commandes • ${UI.formatCurrency(vendor.total_revenue || 0)}
              </div>
            </div>
            <button class="btn btn-sm btn-secondary" onclick="window.location.href='/admin/vendors/${vendor.id}'">
              Voir
            </button>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderRecentActivity(vendors) {
    const container = document.getElementById('recentActivity');
    if (!container) return;

    if (!vendors || vendors.length === 0) {
      container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Aucune activité</p></div>';
      return;
    }

    const statusColors = {
      'active': 'success',
      'suspended': 'error',
      'deactivated': 'neutral'
    };

    const statusLabels = {
      'active': 'Actif',
      'suspended': 'Suspendu',
      'deactivated': 'Désactivé'
    };

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${vendors.slice(0, 10).map(vendor => `
          <div style="padding: 12px; border-left: 3px solid var(--color-accent); background: var(--color-surface); border-radius: var(--radius-sm);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <strong style="font-size: 14px; color: var(--color-primary);">
                ${vendor.business_name}
              </strong>
              <span class="badge badge-${statusColors[vendor.account_status]}">
                ${statusLabels[vendor.account_status]}
              </span>
            </div>
            <div style="font-size: 13px; color: var(--color-secondary);">
              ${vendor.email} • Inscrit ${UI.formatRelativeDate(vendor.created_at)}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  async loadExpiringSubscriptions() {
    try {
      const data = await API.get('/admin/dashboard/expiring-subscriptions?days=7', false);
      
      if (data && data.data && data.data.subscriptions && data.data.subscriptions.length > 0) {
        this.renderExpiringSubscriptions(data.data.subscriptions);
        document.getElementById('expiringSubscriptionsCard').style.display = 'block';
      } else {
        document.getElementById('expiringSubscriptionsCard').style.display = 'none';
      }
    } catch (error) {
      console.error('Erreur expiring subs:', error);
    }
  },

  renderExpiringSubscriptions(subscriptions) {
    const container = document.getElementById('expiringSubscriptions');
    if (!container) return;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${subscriptions.map(sub => `
          <div style="padding: 16px; background: rgba(255, 152, 0, 0.1); border-left: 4px solid var(--color-warning); border-radius: var(--radius-sm);">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
              <div>
                <strong style="color: var(--color-primary);">${sub.business_name}</strong>
                <div style="font-size: 13px; color: var(--color-secondary); margin-top: 4px;">
                  ${sub.email} • Plan: ${sub.plan_name}
                </div>
              </div>
              <span class="badge badge-warning">
                ${sub.days_remaining} jour(s) restant(s)
              </span>
            </div>
            <div style="font-size: 13px; color: var(--color-secondary);">
              Expire le ${UI.formatDate(sub.expires_at)}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  async loadSubscriptionDistribution() {
    try {
      const data = await API.get('/admin/dashboard/subscription-distribution', false);
      
      if (data && data.data && data.data.distribution) {
        this.renderSubscriptionDistribution(data.data.distribution);
      }
    } catch (error) {
      console.error('Erreur distribution:', error);
    }
  },

  renderSubscriptionDistribution(distribution) {
    const container = document.getElementById('subscriptionDistribution');
    if (!container) return;

    if (!distribution || distribution.length === 0) {
      container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Aucune donnée</p></div>';
      return;
    }

    // Grouper par plan
    const planGroups = {};
    distribution.forEach(item => {
      if (!planGroups[item.plan_name]) {
        planGroups[item.plan_name] = { active: 0, trial: 0 };
      }
      if (item.status === 'active') {
        planGroups[item.plan_name].active = item.count;
      } else if (item.status === 'trial') {
        planGroups[item.plan_name].trial = item.count;
      }
    });

    container.innerHTML = `
      <div style="padding: 24px;">
        ${Object.keys(planGroups).map(planName => {
          const data = planGroups[planName];
          const total = data.active + data.trial;
          
          return `
            <div style="margin-bottom: 24px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <strong style="color: var(--color-primary);">${planName}</strong>
                <span style="color: var(--color-secondary); font-size: 14px;">${total} total</span>
              </div>
              <div style="height: 8px; background: var(--color-surface); border-radius: 100px; overflow: hidden; margin-bottom: 8px;">
                <div style="width: 100%; height: 100%; background: linear-gradient(90deg, var(--color-success) ${data.active / total * 100}%, var(--color-warning) ${data.active / total * 100}%);"></div>
              </div>
              <div style="display: flex; gap: 16px; font-size: 13px; color: var(--color-secondary);">
                <span>✅ ${data.active} actifs</span>
                <span>🆕 ${data.trial} trial</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  async loadStatsByPeriod() {
    try {
      const data = await API.get(`/admin/dashboard/stats/${this.currentPeriod}`, false);
      console.log('Stats période:', data);
      // TODO: Afficher graphique si souhaité
    } catch (error) {
      console.error('Erreur stats période:', error);
    }
  }
};

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  // ── 1. Graphique d'évolution (Chart.js) — lit les données SSR injectées ──
  const ssrDataEl = document.getElementById('ssr-admin-data');
  if (ssrDataEl) {
    try {
      const trends = JSON.parse(ssrDataEl.textContent || '{}');
      const ctx = document.getElementById('trendsChart')?.getContext('2d');

      if (ctx && trends.orders && trends.orders.length > 0) {
        const data = trends.orders;
        const labels = data.map(d => new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));

        new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [
              {
                label: 'Commandes',
                data: data.map(d => d.count),
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                yAxisID: 'y'
              },
              {
                label: 'Revenu (FCFA)',
                data: data.map(d => d.revenue),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                yAxisID: 'y1'
              }
            ]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { position: 'top' },
              tooltip: { mode: 'index', intersect: false }
            },
            scales: {
              y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: { display: true, text: 'Nb. Commandes' },
                grid: { drawOnChartArea: false }
              },
              y1: {
                type: 'linear',
                display: true,
                position: 'right',
                title: { display: true, text: 'Revenu (FCFA)' },
                ticks: { callback: value => value.toLocaleString('fr-FR') }
              }
            }
          }
        });
      }
    } catch (e) {
      console.error('[Dashboard] Erreur lecture données SSR graphique:', e);
    }
  }

  // ── 2. Pastille de notifications non lues (lecture data-attribute SSR) ──
  const countBadge = document.getElementById('unreadNotifCount');
  if (countBadge) {
    const unread = parseInt(countBadge.getAttribute('data-unread') || '0', 10);
    if (unread > 0) {
      countBadge.style.display = 'inline-block';
    }
  }
});