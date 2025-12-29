/**
 * public/js/admin/vendor-details.js
 * ========================================
 * DÉTAILS D'UN VENDEUR - SUPER ADMIN
 * ========================================
 */

const VendorDetails = {
  vendorId: null,

  init() {
    // Récupérer l'ID depuis l'URL
    const pathParts = window.location.pathname.split('/');
    this.vendorId = pathParts[pathParts.length - 1];

    if (this.vendorId) {
      this.loadVendorDetails();
      this.attachEventListeners();
    }
  },

  attachEventListeners() {
    const manageSubBtn = document.getElementById('manageSubscriptionBtn');
    if (manageSubBtn) {
      manageSubBtn.addEventListener('click', () => {
        window.location.href = `/admin/subscriptions/${this.vendorId}`;
      });
    }
  },

  async loadVendorDetails() {
    try {
      const data = await API.get(`/admin/vendors/${this.vendorId}`, true);

      if (data && data.data) {
        this.renderVendorInfo(data.data.user);
        this.renderVendorStats(data.data.stats);
        this.renderRecentOrders(data.data.recent_orders);
      }
    } catch (error) {
      console.error('Erreur chargement détails:', error);
      UI.showNotification('Erreur', 'Impossible de charger les détails', 'error');
    }
  },

  renderVendorInfo(user) {
    document.getElementById('vendorName').textContent = user.business_name;
    document.getElementById('vendorEmail').textContent = user.email;

    const card = document.getElementById('vendorInfoCard');

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

    card.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
        <div>
          <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">Informations générales</h3>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div>
              <strong style="color: var(--color-secondary);">Nom commercial :</strong>
              <div style="font-size: 16px; color: var(--color-primary);">${user.business_name}</div>
            </div>
            <div>
              <strong style="color: var(--color-secondary);">Email :</strong>
              <div style="font-size: 16px; color: var(--color-primary);">${user.email}</div>
            </div>
            ${user.phone ? `
              <div>
                <strong style="color: var(--color-secondary);">Téléphone :</strong>
                <div style="font-size: 16px; color: var(--color-primary);">${user.phone}</div>
              </div>
            ` : ''}
            <div>
              <strong style="color: var(--color-secondary);">Store slug :</strong>
              <div style="font-size: 16px; color: var(--color-primary);">${user.store_slug}</div>
            </div>
            <div>
              <strong style="color: var(--color-secondary);">Inscrit le :</strong>
              <div style="font-size: 16px; color: var(--color-primary);">${UI.formatDate(user.created_at)}</div>
            </div>
          </div>
        </div>

        <div>
          <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">Abonnement actuel</h3>
          <div style="padding: 20px; background: var(--color-surface); border-radius: var(--radius-md);">
            ${user.plan_name ? `
              <div style="margin-bottom: 12px;">
                <span class="badge badge-info" style="font-size: 16px; padding: 8px 16px;">
                  ${user.plan_name}
                </span>
              </div>
              <div style="margin-bottom: 8px;">
                <strong style="color: var(--color-secondary);">Statut :</strong>
                <span class="badge badge-${user.subscription_status === 'active' ? 'success' : 'warning'}">
                  ${user.subscription_status}
                </span>
              </div>
              ${user.expires_at ? `
                <div style="margin-bottom: 8px;">
                  <strong style="color: var(--color-secondary);">Expire le :</strong>
                  <span style="color: var(--color-primary);">${UI.formatDate(user.expires_at)}</span>
                </div>
              ` : ''}
              <div style="margin-bottom: 8px;">
                <strong style="color: var(--color-secondary);">Limites :</strong>
                <div style="font-size: 14px; color: var(--color-primary); margin-top: 4px;">
                  • Produits : ${user.max_products === -1 ? 'Illimité' : user.max_products}<br>
                  • Commandes/mois : ${user.max_orders_per_month === -1 ? 'Illimité' : user.max_orders_per_month}
                </div>
              </div>
              <div>
                <strong style="color: var(--color-secondary);">Utilisation mois en cours :</strong>
                <div style="font-size: 14px; color: var(--color-primary);">${user.current_month_orders || 0} commandes</div>
              </div>
            ` : `
              <p style="color: var(--color-secondary);">Aucun abonnement actif</p>
            `}
          </div>

          <div style="margin-top: 16px; padding: 16px; background: ${user.account_status === 'active' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)'}; border-radius: var(--radius-md);">
            <strong style="color: var(--color-secondary);">Statut du compte :</strong><br>
            <span class="badge badge-${statusColors[user.account_status]}" style="margin-top: 8px; font-size: 16px;">
              ${statusLabels[user.account_status]}
            </span>
            ${user.suspended_reason ? `
              <div style="margin-top: 12px; font-size: 14px; color: var(--color-error);">
                <strong>Raison :</strong> ${user.suspended_reason}
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  },

  renderVendorStats(stats) {
    const container = document.getElementById('vendorStats');

    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Produits</span>
          <div class="stat-icon">📦</div>
        </div>
        <div class="stat-value">${stats.total_products || 0}</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Commandes</span>
          <div class="stat-icon">🛒</div>
        </div>
        <div class="stat-value">${stats.total_orders || 0}</div>
        <div class="stat-change positive">+${stats.orders_last_30_days || 0} (30j)</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Chiffre d'affaires</span>
          <div class="stat-icon">💰</div>
        </div>
        <div class="stat-value">${UI.formatCurrency(stats.total_revenue || 0)}</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Clients</span>
          <div class="stat-icon">👥</div>
        </div>
        <div class="stat-value">${stats.total_customers || 0}</div>
      </div>
    `;
  },

  renderRecentOrders(orders) {
    const container = document.getElementById('recentOrders');

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
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>N° Commande</th>
              <th>Client</th>
              <th>Produit</th>
              <th>Montant</th>
              <th>Statut</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${orders.map(order => `
              <tr>
                <td><strong>${order.order_number}</strong></td>
                <td>${order.customer_name}</td>
                <td>${order.product_name}</td>
                <td style="font-weight: 600;">${UI.formatCurrency(order.total_amount)}</td>
                <td><span class="badge badge-${statusColors[order.status]}">${order.status}</span></td>
                <td style="font-size: 13px; color: var(--color-secondary);">${UI.formatRelativeDate(order.created_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <p style="margin-top: 16px; text-align: center; color: var(--color-secondary); font-size: 14px;">
        ℹ️ Aperçu en lecture seule. Seul le vendeur peut gérer ses commandes.
      </p>
    `;
  }
};

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('vendorInfoCard')) {
    VendorDetails.init();
  }
});