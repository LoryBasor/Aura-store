/**
 * public/js/admin/subscriptions.js (PARTIE 1/2)
 * ========================================
 * GESTION DES ABONNEMENTS - SUPER ADMIN
 * ========================================
 */

const AdminSubscriptions = {
  plans: [],
  vendors: [],
  subscriptions: [],

  init() {
    this.attachEventListeners();
    this.loadAllData();
  },

  attachEventListeners() {
    // Nouveau abonnement
    const newSubBtn = document.querySelector('[data-action="new-subscription"]');
    if (newSubBtn) {
      newSubBtn.addEventListener('click', () => this.openCreateModal());
    }

    // Form créer
    const createForm = document.getElementById('createSubscriptionForm');
    if (createForm) {
      createForm.addEventListener('submit', (e) => this.handleCreate(e));
    }

    // Form changer plan
    const changePlanForm = document.getElementById('changePlanForm');
    if (changePlanForm) {
      changePlanForm.addEventListener('submit', (e) => this.handleChangePlan(e));
    }

    // Form prolonger
    const extendForm = document.getElementById('extendForm');
    if (extendForm) {
      extendForm.addEventListener('submit', (e) => this.handleExtend(e));
    }

    // Form annuler
    const cancelForm = document.getElementById('cancelForm');
    if (cancelForm) {
      cancelForm.addEventListener('submit', (e) => this.handleCancel(e));
    }

    // Filtres
    const searchInput = document.getElementById('searchVendor');
    if (searchInput) {
      searchInput.addEventListener('keyup', () => this.filterSubscriptions());
    }

    const planFilter = document.getElementById('planFilter');
    if (planFilter) {
      planFilter.addEventListener('change', () => this.filterSubscriptions());
    }

    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', () => this.filterSubscriptions());
    }
  },

  async loadAllData() {
    try {
      UI.showLoader();

      await Promise.all([
        this.loadPlans(),
        this.loadVendors(),
        this.loadStats()
      ]);

      UI.hideLoader();
    } catch (error) {
      UI.hideLoader();
      console.error('Erreur chargement données:', error);
    }
  },

  async loadPlans() {
    try {
      const data = await API.get('/admin/plans', false);
      
      if (data && data.data && data.data.plans) {
        this.plans = data.data.plans;
        this.populatePlanSelects();
      }
    } catch (error) {
      console.error('Erreur chargement plans:', error);
    }
  },

  populatePlanSelects() {
    const selects = ['selectPlan', 'newPlanSelect'];
    
    selects.forEach(selectId => {
      const select = document.getElementById(selectId);
      if (select) {
        const options = this.plans.map(plan => 
          `<option value="${plan.id}">${plan.name} - ${UI.formatCurrency(plan.price)}/mois</option>`
        ).join('');
        
        select.innerHTML = '<option value="">-- Sélectionner --</option>' + options;
      }
    });

    // Filtre plans
    const planFilter = document.getElementById('planFilter');
    if (planFilter) {
      const options = this.plans.map(plan => 
        `<option value="${plan.id}">${plan.name}</option>`
      ).join('');
      
      planFilter.innerHTML = '<option value="">Tous les plans</option>' + options;
    }
  },

  async loadVendors() {
    try {
      const data = await API.get('/admin/vendors', false);
      
      if (data && data.data) {
        this.vendors = data.data;
        this.populateVendorSelect();
        this.renderSubscriptionsList();
      }
    } catch (error) {
      console.error('Erreur chargement vendeurs:', error);
    }
  },

  populateVendorSelect() {
    const select = document.getElementById('selectVendor');
    if (!select) return;

    const options = this.vendors
      .filter(v => v.account_status === 'active')
      .map(vendor => 
        `<option value="${vendor.id}">${vendor.business_name} (${vendor.email})</option>`
      ).join('');
    
    select.innerHTML = '<option value="">-- Sélectionner --</option>' + options;
  },

  async loadStats() {
    try {
      const data = await API.get('/admin/subscriptions/stats', false);
      
      if (data && data.data && data.data.stats) {
        this.renderStats(data.data.stats);
      }
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    }
  },

  renderStats(stats) {
    const container = document.getElementById('subscriptionStats');
    if (!container) return;

    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Trial</span>
          <div class="stat-icon">🆕</div>
        </div>
        <div class="stat-value">${stats.trial_count || 0}</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Actifs</span>
          <div class="stat-icon">✅</div>
        </div>
        <div class="stat-value">${stats.active_count || 0}</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Expirés</span>
          <div class="stat-icon">⏰</div>
        </div>
        <div class="stat-value">${stats.expired_count || 0}</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Annulés</span>
          <div class="stat-icon">❌</div>
        </div>
        <div class="stat-value">${stats.cancelled_count || 0}</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Expirant bientôt</span>
          <div class="stat-icon">⚠️</div>
        </div>
        <div class="stat-value">${stats.expiring_soon || 0}</div>
      </div>
    `;
  },

  renderSubscriptionsList() {
    const container = document.getElementById('subscriptionsList');
    if (!container) return;

    if (!this.vendors || this.vendors.length === 0) {
      container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Aucun vendeur</p></div>';
      return;
    }

    // Grouper vendeurs par statut abonnement
    const withSub = this.vendors.filter(v => v.plan_name);
    const withoutSub = this.vendors.filter(v => !v.plan_name);

    container.innerHTML = `
      ${withSub.length > 0 ? `
        <div style="margin-bottom: 24px;">
          <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 16px; padding: 0 24px;">
            Abonnements actifs (${withSub.length})
          </h3>
          <div style="display: flex; flex-direction: column; gap: 12px; padding: 0 24px;">
            ${withSub.map(vendor => this.renderSubscriptionCard(vendor)).join('')}
          </div>
        </div>
      ` : ''}

      ${withoutSub.length > 0 ? `
        <div>
          <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 16px; padding: 0 24px; color: var(--color-secondary);">
            Sans abonnement (${withoutSub.length})
          </h3>
          <div style="display: flex; flex-direction: column; gap: 12px; padding: 0 24px;">
            ${withoutSub.map(vendor => this.renderSubscriptionCard(vendor)).join('')}
          </div>
        </div>
      ` : ''}
    `;

    // Attacher événements
    this.attachCardActions();
  },

  renderSubscriptionCard(vendor) {
    const statusColors = {
      'trial': 'warning',
      'active': 'success',
      'expired': 'error',
      'cancelled': 'neutral',
      'suspended': 'error'
    };

    return `
      <div class="card" style="padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
          <div style="flex: 1;">
            <h4 style="font-size: 16px; font-weight: 700; color: var(--color-primary); margin-bottom: 4px;">
              ${vendor.business_name}
            </h4>
            <div style="font-size: 13px; color: var(--color-secondary);">
              ${vendor.email}
            </div>
          </div>
          <div style="text-align: right;">
            ${vendor.plan_name ? `
              <span class="badge badge-info" style="font-size: 14px; margin-bottom: 4px;">
                ${vendor.plan_name}
              </span>
              <br>
              <span class="badge badge-${statusColors[vendor.subscription_status]}" style="font-size: 12px;">
                ${vendor.subscription_status}
              </span>
            ` : `
              <span class="badge badge-neutral">Aucun abonnement</span>
            `}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px; padding: 16px; background: var(--color-surface); border-radius: var(--radius-sm);">
          <div style="text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: var(--color-primary);">
              ${vendor.products_count || 0}
            </div>
            <div style="font-size: 12px; color: var(--color-secondary);">Produits</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: var(--color-primary);">
              ${vendor.orders_count || 0}
            </div>
            <div style="font-size: 12px; color: var(--color-secondary);">Commandes</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: var(--color-primary);">
              ${UI.formatCurrency(vendor.total_revenue || 0)}
            </div>
            <div style="font-size: 12px; color: var(--color-secondary);">CA Total</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: var(--color-secondary);">
              ${UI.formatRelativeDate(vendor.created_at)}
            </div>
            <div style="font-size: 12px; color: var(--color-secondary);">Inscription</div>
          </div>
        </div>

        <div style="display: flex; gap: 8px;">
          ${vendor.plan_name ? `
            <button class="btn btn-secondary btn-sm" data-action="change-plan" data-user-id="${vendor.id}">
              🔄 Changer plan
            </button>
            <button class="btn btn-secondary btn-sm" data-action="extend" data-user-id="${vendor.id}">
              ⏰ Prolonger
            </button>
            <button class="btn btn-primary btn-sm" data-action="history" data-user-id="${vendor.id}">
              📋 Historique
            </button>
            <button class="btn btn-danger btn-sm" data-action="cancel-sub" data-user-id="${vendor.id}">
              ❌ Annuler
            </button>
          ` : `
            <button class="btn btn-primary btn-sm w-full" data-action="create-for-vendor" data-user-id="${vendor.id}">
              + Créer un abonnement
            </button>
          `}
        </div>
      </div>
    `;
  },

  attachCardActions() {
    // Changer plan
    document.querySelectorAll('[data-action="change-plan"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const userId = e.target.dataset.userId;
        this.openChangePlanModal(userId);
      });
    });

    // Prolonger
    document.querySelectorAll('[data-action="extend"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const userId = e.target.dataset.userId;
        this.openExtendModal(userId);
      });
    });

    // Historique
    document.querySelectorAll('[data-action="history"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const userId = e.target.dataset.userId;
        this.showHistory(userId);
      });
    });

    // Annuler
    document.querySelectorAll('[data-action="cancel-sub"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const userId = e.target.dataset.userId;
        this.openCancelModal(userId);
      });
    });

    // Créer pour vendeur
    document.querySelectorAll('[data-action="create-for-vendor"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const userId = e.target.dataset.userId;
        this.openCreateModal(userId);
      });
    });
  }
};

AdminSubscriptions.openCreateModal = function(preselectedUserId = null) {
  const select = document.getElementById('selectVendor');
  if (preselectedUserId && select) {
    select.value = preselectedUserId;
  }

  document.getElementById('subscriptionNotes').value = '';
  ModalManager.openModal('createSubscriptionModal');
};

AdminSubscriptions.handleCreate = async function(e) {
  e.preventDefault();

  const userId = document.getElementById('selectVendor').value;
  const planId = document.getElementById('selectPlan').value;
  const notes = document.getElementById('subscriptionNotes').value.trim();

  if (!userId || !planId) {
    UI.showNotification('Erreur', 'Veuillez sélectionner un vendeur et un plan', 'error');
    return;
  }

  try {
    await API.post('/admin/subscriptions', {
      user_id: parseInt(userId),
      plan_id: parseInt(planId),
      notes
    }, true);

    UI.showNotification('Succès', 'Abonnement créé', 'success');
    ModalManager.closeModal('createSubscriptionModal');
    this.loadVendors();
    this.loadStats();
  } catch (error) {
    console.error('Erreur création:', error);
  }
};

AdminSubscriptions.openChangePlanModal = function(userId) {
  document.getElementById('changePlanUserId').value = userId;
  ModalManager.openModal('changePlanModal');
};

AdminSubscriptions.handleChangePlan = async function(e) {
  e.preventDefault();

  const userId = document.getElementById('changePlanUserId').value;
  const newPlanId = document.getElementById('newPlanSelect').value;

  if (!newPlanId) {
    UI.showNotification('Erreur', 'Veuillez sélectionner un plan', 'error');
    return;
  }

  try {
    await API.put(`/admin/subscriptions/${userId}/plan`, {
      new_plan_id: parseInt(newPlanId)
    }, true);

    UI.showNotification('Succès', 'Plan modifié', 'success');
    ModalManager.closeModal('changePlanModal');
    this.loadVendors();
  } catch (error) {
    console.error('Erreur changement plan:', error);
  }
};

AdminSubscriptions.openExtendModal = function(userId) {
  document.getElementById('extendUserId').value = userId;
  document.getElementById('extendDays').value = '30';
  ModalManager.openModal('extendModal');
};

AdminSubscriptions.handleExtend = async function(e) {
  e.preventDefault();

  const userId = document.getElementById('extendUserId').value;
  const days = parseInt(document.getElementById('extendDays').value);

  if (!days || days < 1 || days > 365) {
    UI.showNotification('Erreur', 'Nombre de jours invalide (1-365)', 'error');
    return;
  }

  try {
    await API.post(`/admin/subscriptions/${userId}/extend`, { days }, true);

    UI.showNotification('Succès', `Abonnement prolongé de ${days} jours`, 'success');
    ModalManager.closeModal('extendModal');
    this.loadVendors();
  } catch (error) {
    console.error('Erreur prolongation:', error);
  }
};

AdminSubscriptions.openCancelModal = function(userId) {
  document.getElementById('cancelUserId').value = userId;
  document.getElementById('cancelReason').value = '';
  ModalManager.openModal('cancelModal');
};

AdminSubscriptions.handleCancel = async function(e) {
  e.preventDefault();

  const userId = document.getElementById('cancelUserId').value;
  const reason = document.getElementById('cancelReason').value.trim();

  if (!reason) {
    UI.showNotification('Erreur', 'Veuillez préciser une raison', 'error');
    return;
  }

  const confirmed = await UI.confirm(
    'Annuler l\'abonnement',
    'Êtes-vous sûr ? Cette action est irréversible.'
  );

  if (!confirmed) return;

  try {
    await API.post(`/admin/subscriptions/${userId}/cancel`, { reason }, true);

    UI.showNotification('Succès', 'Abonnement annulé', 'success');
    ModalManager.closeModal('cancelModal');
    this.loadVendors();
    this.loadStats();
  } catch (error) {
    console.error('Erreur annulation:', error);
  }
};

AdminSubscriptions.showHistory = async function(userId) {
  try {
    const data = await API.get(`/admin/subscriptions/${userId}/history`, true);

    if (data && data.data && data.data.history) {
      const history = data.data.history;

      // Créer modal custom pour historique
      const modal = document.createElement('div');
      modal.className = 'modal-overlay active';
      modal.id = 'historyModal';
      
      modal.innerHTML = `
        <div class="modal" style="max-width: 800px;">
          <div class="modal-header">
            <h3 class="modal-title">📋 Historique d'abonnement</h3>
            <button class="modal-close" onclick="document.getElementById('historyModal').remove()">✕</button>
          </div>
          <div class="modal-body">
            ${history.length === 0 ? `
              <p style="text-align: center; color: var(--color-secondary);">Aucun historique</p>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 12px;">
                ${history.map(entry => `
                  <div style="padding: 16px; background: var(--color-surface); border-radius: var(--radius-sm); border-left: 3px solid var(--color-accent);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                      <strong style="color: var(--color-primary);">${entry.action}</strong>
                      <span style="font-size: 13px; color: var(--color-secondary);">
                        ${UI.formatDate(entry.created_at)}
                      </span>
                    </div>
                    <div style="font-size: 14px; color: var(--color-secondary); margin-bottom: 4px;">
                      Plan: <strong>${entry.plan_name}</strong>
                    </div>
                    ${entry.old_status ? `
                      <div style="font-size: 14px; color: var(--color-secondary);">
                        Statut: ${entry.old_status} → ${entry.new_status}
                      </div>
                    ` : ''}
                    ${entry.notes ? `
                      <div style="margin-top: 8px; padding: 8px; background: var(--color-background); border-radius: var(--radius-sm); font-size: 13px;">
                        ${entry.notes}
                      </div>
                    ` : ''}
                    ${entry.performed_by_email ? `
                      <div style="margin-top: 8px; font-size: 12px; color: var(--color-tertiary);">
                        Par: ${entry.performed_by_email}
                      </div>
                    ` : ''}
                  </div>
                `).join('')}
              </div>
            `}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('historyModal').remove()">
              Fermer
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
    }
  } catch (error) {
    console.error('Erreur historique:', error);
    UI.showNotification('Erreur', 'Impossible de charger l\'historique', 'error');
  }
};

AdminSubscriptions.filterSubscriptions = function() {
  const search = document.getElementById('searchVendor').value.toLowerCase();
  const planFilter = document.getElementById('planFilter').value;
  const statusFilter = document.getElementById('statusFilter').value;

  let filtered = this.vendors;

  // Recherche
  if (search) {
    filtered = filtered.filter(v => 
      v.business_name.toLowerCase().includes(search) ||
      v.email.toLowerCase().includes(search)
    );
  }

  // Filtre plan
  if (planFilter) {
    filtered = filtered.filter(v => v.plan_id == planFilter);
  }

  // Filtre statut
  if (statusFilter) {
    filtered = filtered.filter(v => v.subscription_status === statusFilter);
  }

  // Re-render avec filtered
  this.vendors = filtered;
  this.renderSubscriptionsList();
  
  // Restaurer la liste complète
  this.loadVendors();
};

// Export global
window.AdminSubscriptions = AdminSubscriptions;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('subscriptionStats')) {
    AdminSubscriptions.init();
  }
});