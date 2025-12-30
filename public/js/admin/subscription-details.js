/**
 * public/js/admin/subscription-details.js
 * ========================================
 * DÉTAILS ABONNEMENT - SUPER ADMIN
 * ========================================
 */

const SubscriptionDetails = {
  userId: null,
  subscription: null,
  vendor: null,
  plans: [],
  history: [],

  init() {
    // Récupérer l'ID depuis l'URL
    const pathParts = window.location.pathname.split('/');
    this.userId = pathParts[pathParts.length - 1];

    if (this.userId) {
      this.attachEventListeners();
      this.loadAllData();
    }
  },

  attachEventListeners() {
    // Bouton voir vendeur
    const viewVendorBtn = document.getElementById('viewVendorBtn');
    if (viewVendorBtn) {
      viewVendorBtn.addEventListener('click', () => {
        window.location.href = `/admin/vendors/${this.userId}`;
      });
    }

    // Quick actions cards
    const changePlanCard = document.getElementById('changePlanCard');
    if (changePlanCard) {
      changePlanCard.addEventListener('click', () => this.openChangePlanModal());
    }

    const extendCard = document.getElementById('extendCard');
    if (extendCard) {
      extendCard.addEventListener('click', () => this.openExtendModal());
    }

    const cancelCard = document.getElementById('cancelCard');
    if (cancelCard) {
      cancelCard.addEventListener('click', () => this.openCancelModal());
    }

    const historyCard = document.getElementById('historyCard');
    if (historyCard) {
      historyCard.addEventListener('click', () => {
        document.getElementById('historyTimeline').scrollIntoView({ behavior: 'smooth' });
      });
    }

    // Forms
    const changePlanForm = document.getElementById('changePlanForm');
    if (changePlanForm) {
      changePlanForm.addEventListener('submit', (e) => this.handleChangePlan(e));
    }

    const extendForm = document.getElementById('extendForm');
    if (extendForm) {
      extendForm.addEventListener('submit', (e) => this.handleExtend(e));
    }

    const cancelForm = document.getElementById('cancelForm');
    if (cancelForm) {
      cancelForm.addEventListener('submit', (e) => this.handleCancel(e));
    }

    // Preview calcul nouvelle date
    const extendDaysInput = document.getElementById('extendDays');
    if (extendDaysInput) {
      extendDaysInput.addEventListener('input', () => this.updateExtendPreview());
    }

    // Plan comparison
    const newPlanSelect = document.getElementById('newPlanSelect');
    if (newPlanSelect) {
      newPlanSelect.addEventListener('change', () => this.showPlanComparison());
    }
  },

  async loadAllData() {
    try {
      UI.showLoader();

      await Promise.all([
        this.loadVendorDetails(),
        this.loadPlans(),
        this.loadHistory()
      ]);

      UI.hideLoader();
    } catch (error) {
      UI.hideLoader();
      console.error('Erreur chargement données:', error);
      UI.showNotification('Erreur', 'Impossible de charger les données', 'error');
    }
  },

  async loadVendorDetails() {
    try {
      const data = await API.get(`/admin/vendors/${this.userId}`, false);

      if (data && data.data) {
        this.vendor = data.data.user;
        this.renderSubscriptionInfo();
        this.renderUsageStats(data.data.stats);
      }
    } catch (error) {
      console.error('Erreur chargement vendeur:', error);
      throw error;
    }
  },

  async loadPlans() {
    try {
      const data = await API.get('/admin/plans', false);
      if (data && data.data && data.data.plans) {
        this.plans = data.data.plans;
        this.populatePlanSelect();
        this.renderPlanDetails();
      }
    } catch (error) {
      console.error('Erreur chargement plans:', error);
      throw error;
    }
  },

  async loadHistory() {
    try {
      const data = await API.get(`/admin/subscriptions/${this.userId}/history`, false);

      if (data && data.data && data.data.history) {
        this.history = data.data.history;
        this.renderHistory();
      }
    } catch (error) {
      console.error('Erreur chargement historique:', error);
      throw error;
    }
  },

  renderSubscriptionInfo() {
    const vendor = this.vendor;

    document.getElementById('pageTitle').textContent = `Abonnement de ${vendor.business_name}`;
    document.getElementById('vendorInfo').textContent = vendor.email;

    const card = document.getElementById('subscriptionInfoCard');

    const statusColors = {
      'trial': 'warning',
      'active': 'success',
      'expired': 'error',
      'cancelled': 'neutral',
      'suspended': 'error'
    };

    const statusLabels = {
      'trial': 'Période d\'essai',
      'active': 'Actif',
      'expired': 'Expiré',
      'cancelled': 'Annulé',
      'suspended': 'Suspendu'
    };

    if (!vendor.plan_name) {
      card.innerHTML = `
        <div style="text-align: center; padding: 48px;">
          <div style="font-size: 64px; margin-bottom: 16px;">📭</div>
          <h3 style="font-size: 24px; font-weight: 700; color: var(--color-primary); margin-bottom: 12px;">
            Aucun abonnement actif
          </h3>
          <p style="color: var(--color-secondary); margin-bottom: 24px;">
            Ce vendeur n'a pas d'abonnement actif pour le moment.
          </p>
          <button class="btn btn-primary create-subscription">
            Créer un abonnement
          </button>
        </div>
      `;
      card.querySelector('.create-subscription').addEventListener('click', e => window.location.href = '/admin/subscriptions');
      // Désactiver les actions
      ['changePlanCard', 'extendCard', 'cancelCard'].forEach(id => {
        const card = document.getElementById(id);
        if (card) {
          card.style.opacity = '0.5';
          card.style.pointerEvents = 'none';
        }
      });

      return;
    }

    const currentPlan = this.plans.find(p => p.name === vendor.plan_name) || {};
    card.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; padding: 24px;">
        <!-- Colonne gauche : Infos abonnement -->
        <div>
          <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 24px;">
            Informations générales
          </h3>

          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div>
              <strong style="color: var(--color-secondary); font-size: 14px;">Plan actuel</strong>
              <div style="font-size: 24px; font-weight: 700; color: var(--color-primary); margin-top: 4px;">
                ${vendor.plan_name}
              </div>
            </div>

            <div>
              <strong style="color: var(--color-secondary); font-size: 14px;">Statut</strong>
              <div style="margin-top: 4px;">
                <span class="badge badge-${statusColors[vendor.subscription_status]}" style="font-size: 16px; padding: 8px 16px;">
                  ${statusLabels[vendor.subscription_status]}
                </span>
              </div>
            </div>

            ${vendor.expires_at ? `
              <div>
                <strong style="color: var(--color-secondary); font-size: 14px;">Date d'expiration</strong>
                <div style="font-size: 18px; color: var(--color-primary); margin-top: 4px;">
                  ${UI.formatDate(vendor.expires_at)}
                </div>
                <div style="font-size: 13px; color: var(--color-warning); margin-top: 4px;">
                  ⏰ ${this.getDaysRemaining(vendor.expires_at)}
                </div>
              </div>
            ` : ''}

            ${vendor.current_month_orders !== undefined ? `
              <div>
                <strong style="color: var(--color-secondary); font-size: 14px;">Utilisation ce mois</strong>
                <div style="font-size: 18px; color: var(--color-primary); margin-top: 4px;">
                  ${vendor.current_month_orders} / ${vendor.max_orders_per_month === -1 ? '∞' : vendor.max_orders_per_month} commandes
                </div>
                ${vendor.max_orders_per_month > 0 ? `
                  <div style="width: 100%; height: 8px; background: var(--color-surface); border-radius: 100px; overflow: hidden; margin-top: 8px;">
                    <div style="width: ${Math.min((vendor.current_month_orders / vendor.max_orders_per_month) * 100, 100)}%; height: 100%; background: ${vendor.current_month_orders >= vendor.max_orders_per_month ? 'var(--color-error)' : 'var(--color-success)'};"></div>
                  </div>
                ` : ''}
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Colonne droite : Limites du plan -->
        <div>
          <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 24px;">
            Limites du plan
          </h3>

          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div style="padding: 16px; background: var(--color-surface); border-radius: var(--radius-sm);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: var(--color-secondary);">📦 Produits</span>
                <strong style="font-size: 20px; color: var(--color-primary);">
                  ${vendor.max_products === -1 ? 'Illimité' : vendor.max_products}
                </strong>
              </div>
            </div>

            <div style="padding: 16px; background: var(--color-surface); border-radius: var(--radius-sm);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: var(--color-secondary);">🛒 Commandes/mois</span>
                <strong style="font-size: 20px; color: var(--color-primary);">
                  ${vendor.max_orders_per_month === -1 ? 'Illimité' : vendor.max_orders_per_month}
                </strong>
              </div>
            </div>

            ${currentPlan.storage_limit ? `
              <div style="padding: 16px; background: var(--color-surface); border-radius: var(--radius-sm);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: var(--color-secondary);">💾 Stockage</span>
                  <strong style="font-size: 20px; color: var(--color-primary);">
                    ${currentPlan.storage_limit} MB
                  </strong>
                </div>
              </div>
            ` : ''}

            ${currentPlan.price ? `
              <div style="padding: 20px; background: linear-gradient(135deg, var(--color-accent), var(--color-surface)); border-radius: var(--radius-sm); text-align: center; margin-top: 16px;">
                <div style="font-size: 14px; color: var(--color-secondary); margin-bottom: 4px;">
                  Prix mensuel
                </div>
                <div style="font-size: 32px; font-weight: 700; color: var(--color-primary);">
                  ${UI.formatCurrency(currentPlan.price)}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  },

  renderUsageStats(stats) {
    const container = document.getElementById('usageStats');
    if (!container) return;

    container.innerHTML = `
      <div style="padding: 24px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 24px;">
          <div style="text-align: center; padding: 20px; background: var(--color-surface); border-radius: var(--radius-md);">
            <div style="font-size: 36px; font-weight: 700; color: var(--color-primary);">
              ${stats.total_products || 0}
            </div>
            <div style="font-size: 14px; color: var(--color-secondary); margin-top: 8px;">
              📦 Produits créés
            </div>
          </div>

          <div style="text-align: center; padding: 20px; background: var(--color-surface); border-radius: var(--radius-md);">
            <div style="font-size: 36px; font-weight: 700; color: var(--color-primary);">
              ${stats.total_orders || 0}
            </div>
            <div style="font-size: 14px; color: var(--color-secondary); margin-top: 8px;">
              🛒 Commandes totales
            </div>
            <div style="font-size: 12px; color: var(--color-tertiary); margin-top: 4px;">
              +${stats.orders_last_30_days || 0} ce mois
            </div>
          </div>

          <div style="text-align: center; padding: 20px; background: var(--color-surface); border-radius: var(--radius-md);">
            <div style="font-size: 36px; font-weight: 700; color: var(--color-primary);">
              ${UI.formatCurrency(stats.total_revenue || 0)}
            </div>
            <div style="font-size: 14px; color: var(--color-secondary); margin-top: 8px;">
              💰 Chiffre d'affaires
            </div>
          </div>

          <div style="text-align: center; padding: 20px; background: var(--color-surface); border-radius: var(--radius-md);">
            <div style="font-size: 36px; font-weight: 700; color: var(--color-primary);">
              ${stats.total_customers || 0}
            </div>
            <div style="font-size: 14px; color: var(--color-secondary); margin-top: 8px;">
              👥 Clients
            </div>
          </div>
        </div>
      </div>
    `;
  },

  renderPlanDetails() {
    const container = document.getElementById('planDetails');
    const vendor = this.vendor;
    if (!container || !this.vendor || !this.vendor.plan_name) return;
    const currentPlan = this.plans.find(p => p.name === vendor.plan_name);
    if (!currentPlan) return;

    container.innerHTML = `
      <div style="padding: 24px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px;">
          <div>
            <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 16px; color: var(--color-primary);">
              Fonctionnalités incluses
            </h4>
            <ul style="list-style: none; padding: 0;">
              ${currentPlan.has_analytics ? '<li style="padding: 8px 0; display: flex; align-items: center; gap: 8px;"><span style="color: var(--color-success);">✓</span> Statistiques avancées</li>' : ''}
              ${currentPlan.has_api_access ? '<li style="padding: 8px 0; display: flex; align-items: center; gap: 8px;"><span style="color: var(--color-success);">✓</span> Accès API</li>' : ''}
              ${currentPlan.has_priority_support ? '<li style="padding: 8px 0; display: flex; align-items: center; gap: 8px;"><span style="color: var(--color-success);">✓</span> Support prioritaire</li>' : ''}
              ${currentPlan.has_whatsapp_integration ? '<li style="padding: 8px 0; display: flex; align-items: center; gap: 8px;"><span style="color: var(--color-success);">✓</span> Intégration WhatsApp</li>' : ''}
              ${currentPlan.has_custom_branding ? '<li style="padding: 8px 0; display: flex; align-items: center; gap: 8px;"><span style="color: var(--color-success);">✓</span> Branding personnalisé</li>' : ''}
            </ul>
          </div>

          <div>
            <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 16px; color: var(--color-primary);">
              Informations du plan
            </h4>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div>
                <strong style="color: var(--color-secondary); font-size: 14px;">Cycle de facturation</strong>
                <div style="color: var(--color-primary);">${currentPlan.billing_cycle === 'monthly' ? 'Mensuel' : currentPlan.billing_cycle === 'yearly' ? 'Annuel' : 'Autre'}</div>
              </div>
              ${currentPlan.trial_days > 0 ? `
                <div>
                  <strong style="color: var(--color-secondary); font-size: 14px;">Période d'essai</strong>
                  <div style="color: var(--color-primary);">${currentPlan.trial_days} jours</div>
                </div>
              ` : ''}
              ${currentPlan.description ? `
                <div>
                  <strong style="color: var(--color-secondary); font-size: 14px;">Description</strong>
                  <div style="color: var(--color-primary); font-size: 14px; line-height: 1.6;">
                    ${currentPlan.description}
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  renderHistory() {
    const container = document.getElementById('historyTimeline');
    if (!container) return;

    if (!this.history || this.history.length === 0) {
      container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Aucun historique disponible</p></div>';
      return;
    }

    const actionIcons = {
      'created': '🆕',
      'upgraded': '⬆️',
      'downgraded': '⬇️',
      'renewed': '🔄',
      'cancelled': '❌',
      'suspended': '⛔',
      'activated': '✅'
    };

    container.innerHTML = `
      <div style="padding: 24px;">
        <div style="position: relative;">
          ${this.history.map((entry, index) => `
            <div style="position: relative; padding-left: 48px; padding-bottom: 24px; ${index === this.history.length - 1 ? '' : 'border-left: 2px solid var(--color-surface);'}">
              <div style="position: absolute; left: -12px; top: 0; width: 24px; height: 24px; background: var(--color-primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px;">
                ${actionIcons[entry.action] || '📝'}
              </div>
              
              <div style="padding: 16px; background: var(--color-surface); border-radius: var(--radius-sm); border-left: 3px solid var(--color-accent);">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                  <strong style="font-size: 16px; color: var(--color-primary); text-transform: capitalize;">
                    ${entry.action}
                  </strong>
                  <span style="font-size: 13px; color: var(--color-secondary);">
                    ${UI.formatDate(entry.created_at)}
                  </span>
                </div>

                <div style="font-size: 14px; color: var(--color-secondary); margin-bottom: 8px;">
                  Plan: <strong style="color: var(--color-primary);">${entry.plan_name}</strong>
                </div>

                ${entry.old_status && entry.new_status ? `
                  <div style="padding: 8px; background: var(--color-background); border-radius: var(--radius-sm); font-size: 13px; margin-bottom: 8px;">
                    Statut: <span class="badge badge-neutral">${entry.old_status}</span> 
                    → 
                    <span class="badge badge-success">${entry.new_status}</span>
                  </div>
                ` : ''}

                ${entry.notes ? `
                  <div style="padding: 12px; background: var(--color-background); border-radius: var(--radius-sm); font-size: 14px; margin-top: 8px; color: var(--color-secondary);">
                    💬 ${entry.notes}
                  </div>
                ` : ''}

                ${entry.performed_by_email ? `
                  <div style="margin-top: 8px; font-size: 12px; color: var(--color-tertiary);">
                    👤 Par: ${entry.performed_by_email}
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  getDaysRemaining(expiryDate) {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diff = expiry - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return 'Expiré';
    if (days === 0) return 'Expire aujourd\'hui';
    if (days === 1) return 'Expire demain';
    return `Expire dans ${days} jours`;
  },

  populatePlanSelect() {
    const select = document.getElementById('newPlanSelect');
    if (!select || !this.plans) return;

    const options = this.plans.map(plan => 
      `<option value="${plan.id}" ${plan.name === this.vendor?.plan_name ? 'disabled' : ''}>
        ${plan.name} - ${UI.formatCurrency(plan.price)}/mois
        ${plan.name === this.vendor?.plan_name ? ' (Actuel)' : ''}
      </option>`
    ).join('');

    select.innerHTML = '<option value="">-- Sélectionner un nouveau plan --</option>' + options;
  }
};

SubscriptionDetails.openChangePlanModal = function() {
  if (!this.vendor || !this.vendor.plan_name) {
    UI.showNotification('Erreur', 'Aucun abonnement actif', 'error');
    return;
  }

  document.getElementById('changePlanUserId').value = this.userId;
  document.getElementById('currentPlanName').textContent = this.vendor.plan_name;
  document.getElementById('newPlanSelect').value = '';
  document.getElementById('planComparisonInfo').style.display = 'none';

  ModalManager.openModal('changePlanModal');
};

SubscriptionDetails.showPlanComparison = function() {
  const newPlanId = document.getElementById('newPlanSelect').value;
  if (!newPlanId) {
    document.getElementById('planComparisonInfo').style.display = 'none';
    return;
  }

  const currentPlan = this.plans.find(p => p.name === this.vendor.plan_name);
  const newPlan = this.plans.find(p => p.id == newPlanId);

  if (!currentPlan || !newPlan) return;

  const isUpgrade = newPlan.price > currentPlan.price;
  const priceDiff = Math.abs(newPlan.price - currentPlan.price);

  const comparisonInfo = document.getElementById('planComparisonInfo');
  comparisonInfo.style.display = 'block';
  comparisonInfo.innerHTML = `
    <div style="margin-bottom: 12px;">
      <strong>${isUpgrade ? '⬆️ Upgrade' : '⬇️ Downgrade'}</strong>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 16px; align-items: center; margin-bottom: 16px;">
      <div style="text-align: center; padding: 12px; background: var(--color-surface); border-radius: var(--radius-sm);">
        <div style="font-size: 13px; color: var(--color-secondary); margin-bottom: 4px;">Actuel</div>
        <strong style="font-size: 20px; color: var(--color-primary);">${UI.formatCurrency(currentPlan.price)}</strong>
      </div>
      <div style="font-size: 24px;">${isUpgrade ? '→' : '←'}</div>
      <div style="text-align: center; padding: 12px; background: var(--color-surface); border-radius: var(--radius-sm);">
        <div style="font-size: 13px; color: var(--color-secondary); margin-bottom: 4px;">Nouveau</div>
        <strong style="font-size: 20px; color: ${isUpgrade ? 'var(--color-success)' : 'var(--color-warning)'};">
          ${UI.formatCurrency(newPlan.price)}
        </strong>
      </div>
    </div>

    <div style="font-size: 14px; color: var(--color-secondary); text-align: center;">
      Différence: ${isUpgrade ? '+' : '-'}${UI.formatCurrency(priceDiff)}/mois
    </div>

    <div style="margin-top: 16px; padding: 12px; background: var(--color-surface); border-radius: var(--radius-sm);">
      <strong style="font-size: 14px;">Nouvelles limites:</strong>
      <ul style="list-style: none; padding: 0; margin-top: 8px; font-size: 13px;">
        <li style="padding: 4px 0;">📦 Produits: ${newPlan.max_products === -1 ? 'Illimité' : newPlan.max_products}</li>
        <li style="padding: 4px 0;">🛒 Commandes/mois: ${newPlan.max_orders_per_month === -1 ? 'Illimité' : newPlan.max_orders_per_month}</li>
        ${newPlan.storage_limit ? `<li style="padding: 4px 0;">💾 Stockage: ${newPlan.storage_limit} MB</li>` : ''}
      </ul>
    </div>
  `;
};

SubscriptionDetails.handleChangePlan = async function(e) {
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

    UI.showNotification('Succès', 'Plan modifié avec succès', 'success');
    ModalManager.closeModal('changePlanModal');
    
    // Recharger les données
    this.loadAllData();
  } catch (error) {
    console.error('Erreur changement plan:', error);
  }
};

SubscriptionDetails.openExtendModal = function() {
  if (!this.vendor || !this.vendor.expires_at) {
    UI.showNotification('Erreur', 'Aucune date d\'expiration trouvée', 'error');
    return;
  }

  document.getElementById('extendUserId').value = this.userId;
  document.getElementById('currentExpiryDate').textContent = UI.formatDate(this.vendor.expires_at);
  document.getElementById('extendDays').value = '30';
  
  this.updateExtendPreview();
  ModalManager.openModal('extendModal');
};

SubscriptionDetails.updateExtendPreview = function() {
  const days = parseInt(document.getElementById('extendDays').value);
  if (!days || !this.vendor || !this.vendor.expires_at) return;

  const currentExpiry = new Date(this.vendor.expires_at);
  const newExpiry = new Date(currentExpiry.getTime() + (days * 24 * 60 * 60 * 1000));

  document.getElementById('newExpiryDate').textContent = UI.formatDate(newExpiry);
};

SubscriptionDetails.handleExtend = async function(e) {
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
    
    // Recharger les données
    this.loadAllData();
  } catch (error) {
    console.error('Erreur prolongation:', error);
  }
};

SubscriptionDetails.openCancelModal = function() {
  if (!this.vendor || !this.vendor.plan_name) {
    UI.showNotification('Erreur', 'Aucun abonnement actif', 'error');
    return;
  }

  document.getElementById('cancelUserId').value = this.userId;
  document.getElementById('cancelReason').value = '';
  
  ModalManager.openModal('cancelModal');
};

SubscriptionDetails.handleCancel = async function(e) {
  e.preventDefault();

  const userId = document.getElementById('cancelUserId').value;
  const reason = document.getElementById('cancelReason').value.trim();

  if (!reason) {
    UI.showNotification('Erreur', 'Veuillez préciser une raison', 'error');
    return;
  }

  const confirmed = await UI.confirm(
    'Annuler l\'abonnement',
    'Cette action est irréversible. Le vendeur perdra l\'accès immédiatement. Confirmer ?'
  );

  if (!confirmed) return;

  try {
    await API.post(`/admin/subscriptions/${userId}/cancel`, { reason }, true);

    UI.showNotification('Succès', 'Abonnement annulé', 'success');
    ModalManager.closeModal('cancelModal');
    
    // Rediriger vers la liste des abonnements
    setTimeout(() => {
      window.location.href = '/admin/subscriptions';
    }, 1500);
  } catch (error) {
    console.error('Erreur annulation:', error);
  }
};

// Export global
window.SubscriptionDetails = SubscriptionDetails;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('subscriptionInfoCard')) {
    SubscriptionDetails.init();
  }
});