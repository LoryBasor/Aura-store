/**
 * public/js/ui.js
 * ========================================
 * MODULE UI - Gestion des notifications et loaders
 * ========================================
 */
const UI = {
  /**
   * Affiche le loader global
   */
  showLoader() {
    let loader = document.querySelector('.loader-overlay');
    
    if (!loader) {
      loader = document.createElement('div');
      loader.className = 'loader-overlay';
      loader.innerHTML = '<div class="loader"></div>';
      document.body.appendChild(loader);
    }
    
    loader.style.display = 'flex';
  },

  /**
   * Cache le loader global
   */
  hideLoader() {
    const loader = document.querySelector('.loader-overlay');
    if (loader) {
      loader.style.display = 'none';
    }
  },

  /**
   * Affiche une notification
   */
  showNotification(title, message, type = 'info') {
    let container = document.querySelector('.notification-container');
    
    if (!container) {
      container = document.createElement('div');
      container.className = 'notification-container';
      document.body.appendChild(container);
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <div class="notification-title">${title}</div>
        <div class="notification-message">${message}</div>
      </div>
    `;

    container.appendChild(notification);

    // Auto-suppression après 5 secondes
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 5000);
  },

  /**
   * Confirme une action
   */
  confirm(title, message) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay active';
      
      overlay.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
          </div>
          <div class="modal-body">
            <p>${message}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-action="cancel">Annuler</button>
            <button class="btn btn-danger" data-action="confirm">Confirmer</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        overlay.remove();
        resolve(false);
      });

      overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => {
        overlay.remove();
        resolve(true);
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.remove();
          resolve(false);
        }
      });
    });
  },

  /**
   * Formate une devise
   */
  formatCurrency(amount, currency = 'FCFA') {
    const formatted = new Intl.NumberFormat('fr-FR').format(amount);
    return `${formatted} ${currency}`;
  },

  /**
   * Formate une date
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  },

  /**
   * Formate une date relative
   */
  formatRelativeDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Aujourd'hui";
    if (days === 1) return "Hier";
    if (days < 7) return `Il y a ${days} jours`;
    if (days < 30) return `Il y a ${Math.floor(days / 7)} semaines`;
    return this.formatDate(dateString);
  }
};
