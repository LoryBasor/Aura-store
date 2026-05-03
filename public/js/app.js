/**
 * public/js/app.js
 * ========================================
 * AURA - Module JavaScript Principal (Minimal SSR Version)
 * ========================================
 */

// ========================================
// UTILITAIRES GLOBAUX
// ========================================
const AppUtils = {
  delegate(element, eventType, selector, handler) {
    if (!element) return;
    element.addEventListener(eventType, (e) => {
      const target = e.target.closest(selector);
      if (target) {
        handler.call(target, e);
      }
    });
  },

  on(selector, event, handler) {
    const element = document.querySelector(selector);
    if (element) {
      element.addEventListener(event, handler);
    }
  },

  onAll(selector, event, handler) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => el.addEventListener(event, handler));
  }
};

// ========================================
// GESTION DE LA SIDEBAR (MOBILE)
// ========================================
const SidebarManager = {
  init() {
    AppUtils.on('#mobileMenuBtn', 'click', this.toggleSidebar);
    AppUtils.on('#sidebarOverlay', 'click', this.closeSidebar);
    window.addEventListener('resize', this.handleResize.bind(this));
  },

  toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) {
      sidebar.classList.toggle('active');
      if(overlay) overlay.classList.toggle('active');
    }
  },

  closeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) {
      sidebar.classList.remove('active');
      if(overlay) overlay.classList.remove('active');
    }
  },

  handleResize() {
    const mobileBtn = document.getElementById('mobileMenuBtn');
    if (mobileBtn) {
      mobileBtn.style.display = window.innerWidth <= 1024 ? 'flex' : 'none';
    }
  }
};

// ========================================
// GESTION DES MODALS
// ========================================
const ModalManager = {
  init() {
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.closeModal(e.target);
      }
    });

    AppUtils.delegate(document, 'click', '.modal-close', (e) => {
      const modal = e.target.closest('.modal-overlay');
      if (modal) this.closeModal(modal);
    });

    AppUtils.delegate(document, 'click', '.annuler', (e) => {
      const modal = e.target.closest('.modal-overlay');
      if (modal) this.closeModal(modal);
    });
    
    AppUtils.delegate(document, 'click', '[data-modal]', (e) => {
      const modalId = e.target.closest('[data-modal]').dataset.modal;
      if (modalId) this.openModal(modalId);
    });
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
    }
  },

  closeModal(modalElement) {
    if (typeof modalElement === 'string') {
      modalElement = document.getElementById(modalElement);
    }
    if (modalElement) {
      modalElement.classList.remove('active');
    }
  }
};

// ========================================
// INITIALISATION GLOBALE
// ========================================
document.addEventListener('DOMContentLoaded', () => {
  SidebarManager.init();
  ModalManager.init();
  
  // Basic visual feedback for form submissions (skip AJAX forms)
  AppUtils.onAll('form', 'submit', function() {
    // Skip forms marked as AJAX (they manage their own loading state)
    if (this.dataset.ajax === 'true') return;

    const submitBtn = this.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.classList.add('loading');
      if (typeof UI !== 'undefined' && UI.showLoader) {
        UI.showLoader();
      }
    }
  });

  // Basic image preview functionality
  AppUtils.onAll('input[type="file"][accept="image/*"]', 'change', function(e) {
    const previewContainerId = this.dataset.preview;
    if (previewContainerId && this.files && this.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const preview = document.getElementById(previewContainerId);
        if (preview) {
          if (preview.tagName.toLowerCase() === 'img') {
            preview.src = event.target.result;
            preview.style.display = 'block';
          } else {
            preview.style.backgroundImage = `url(${event.target.result})`;
          }
        }
      };
      reader.readAsDataURL(this.files[0]);
    }
  });

  // Gestion de la déconnexion (cookie httpOnly - pas de localStorage)
  AppUtils.delegate(document, 'click', '.deco', async (e) => {
    try {
      if (typeof UI !== 'undefined' && UI.showLoader) UI.showLoader();
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Erreur déconnexion:', err);
    } finally {
      window.location.href = '/login';
    }
  });
});

window.ModalManager = ModalManager;