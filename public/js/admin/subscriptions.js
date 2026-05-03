/**
 * ========================================
 * public/js/admin/subscriptions.js
 * ========================================
 */

const AdminSubscriptions = {
  // Modals (Lazy lookup)
  getCreateModal: () => document.getElementById('createSubscriptionModal'),
  getChangeModal: () => document.getElementById('changePlanModal'),
  getExtendModal: () => document.getElementById('extendModal'),
  getCancelModal: () => document.getElementById('cancelModal'),

  // Open Change Plan
  openChangePlan(userId) {
    console.log('[AdminSubs] Opening change plan for user:', userId);
    const input = document.getElementById('changePlanUserId');
    if (input) input.value = userId;
    const modal = AdminSubscriptions.getChangeModal();
    if (modal) modal.classList.add('active');
    else console.error('[AdminSubs] Modal changePlanModal non trouvée');
  },

  // Open Extend
  openExtend(userId) {
    console.log('[AdminSubs] Opening extend for user:', userId);
    const input = document.getElementById('extendUserId');
    if (input) input.value = userId;
    const modal = AdminSubscriptions.getExtendModal();
    if (modal) modal.classList.add('active');
    else console.error('[AdminSubs] Modal extendModal non trouvée');
  },

  // Open Cancel
  openCancel(userId) {
    console.log('[AdminSubs] Opening cancel for user:', userId);
    const input = document.getElementById('cancelUserId');
    if (input) input.value = userId;
    const modal = AdminSubscriptions.getCancelModal();
    if (modal) modal.classList.add('active');
    else console.error('[AdminSubs] Modal cancelModal non trouvée');
  },

  // Open Change Status
  openChangeStatus(subId, vendorName, currentStatus) {
    console.log('[AdminSubs] Opening change status for sub:', subId);
    const inputId = document.getElementById('statusSubId');
    const inputName = document.getElementById('statusVendorName');
    const inputStatus = document.getElementById('newSubStatus');
    
    if (inputId) inputId.value = subId;
    if (inputName) inputName.textContent = 'Vendeur: ' + vendorName;
    if (inputStatus) inputStatus.value = currentStatus;
    
    const modal = document.getElementById('changeStatusModal');
    if (modal) modal.classList.add('active');
  },

  // Initialize
  init() {
    console.log('[AdminSubs] Initializing forms and listeners...');
    
    // Fermeture des modals
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-close') || e.target.classList.contains('modal-overlay')) {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
      }
    });

    // Create Subscription Button
    document.querySelector('[data-action="new-subscription"]')?.addEventListener('click', () => {
      AdminSubscriptions.getCreateModal()?.classList.add('active');
      AdminSubscriptions.loadVendorsForSelect();
    });

    // Handle Create Form
    const createForm = document.getElementById('createSubscriptionForm');
    if (createForm) {
        createForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user_id = document.getElementById('selectVendor').value;
            const plan_id = document.getElementById('selectPlan').value;
            const notes = document.getElementById('subscriptionNotes').value;
            AdminSubscriptions.executeAction(`/api/admin/subscriptions`, { user_id, plan_id, notes }, 'POST');
        });
    }

    // Handle Change Plan Form
    const changeForm = document.getElementById('changePlanForm');
    if (changeForm) {
        changeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userId = document.getElementById('changePlanUserId').value;
            const new_plan_id = document.getElementById('newPlanSelect').value;
            AdminSubscriptions.executeAction(`/api/admin/subscriptions/${userId}/plan`, { new_plan_id }, 'PUT');
        });
    }

    // Handle Extend Form
    const extendForm = document.getElementById('extendForm');
    if (extendForm) {
        extendForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userId = document.getElementById('extendUserId').value;
            const days = document.getElementById('extendDays').value;
            AdminSubscriptions.executeAction(`/api/admin/subscriptions/${userId}/extend`, { days: parseInt(days) }, 'POST');
        });
    }

    // Handle Cancel Form
    const cancelForm = document.getElementById('cancelForm');
    if (cancelForm) {
        cancelForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userId = document.getElementById('cancelUserId').value;
            const reason = document.getElementById('cancelReason').value;
            AdminSubscriptions.executeAction(`/api/admin/subscriptions/${userId}/cancel`, { reason }, 'POST');
        });
    }

    // Handle Change Status Form
    const changeStatusForm = document.getElementById('changeStatusForm');
    if (changeStatusForm) {
        changeStatusForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('statusSubId').value;
            const status = document.getElementById('newSubStatus').value;
            AdminSubscriptions.executeAction(`/api/admin/subscriptions/${id}/status`, { status }, 'PUT');
        });
    }

    // Delegation supportée pour les éléments avec data-action
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const userId = btn.dataset.userId;
      const action = btn.dataset.action;
      if (action === 'change-plan') AdminSubscriptions.openChangePlan(userId);
      if (action === 'extend') AdminSubscriptions.openExtend(userId);
      if (action === 'cancel-sub') AdminSubscriptions.openCancel(userId);
    });
  },

  async loadVendorsForSelect() {
    const select = document.getElementById('selectVendor');
    if (!select || select.children.length > 1) return;

    try {
      const resp = await fetch('/api/admin/vendors?limit=100');
      const data = await resp.json();
      if (data.success) {
        data.data.vendors.forEach(v => {
          const opt = document.createElement('option');
          opt.value = v.id;
          opt.textContent = `${v.business_name} (${v.email})`;
          select.appendChild(opt);
        });
      }
    } catch (e) { console.error(e); }
  },

  async executeAction(url, body, method = 'POST') {
    if (typeof UI === 'undefined') {
        alert('Erreur: UI.js non chargé');
        return;
    }
    UI.showLoader();
    try {
      const resp = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await resp.json();
      if (resp.ok) {
        UI.showNotification('Succès', 'Action effectuée avec succès', 'success');
        setTimeout(() => location.reload(), 1000);
      } else {
        UI.showNotification('Erreur', data.message || 'Échec de l\'opération', 'error');
      }
    } catch (e) {
      UI.showNotification('Erreur', 'Erreur réseau', 'error');
    } finally {
      UI.hideLoader();
    }
  }
};

// Exposition globale
window.AdminSubscriptions = AdminSubscriptions;

// Boot
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AdminSubscriptions.init());
} else {
    AdminSubscriptions.init();
}
