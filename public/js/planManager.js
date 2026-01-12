/**
 * public/js/planManager.js
 * ========================================
 * GESTIONNAIRE DES FONCTIONNALITÉS PAR PLAN
 * ========================================
 */

const PlanManager = {
  currentPlan: null,

  /**
   * Plans disponibles
   */
  PLANS: {
    FREE: 'free',
    PRO: 'pro',
    BUSINESS: 'business'
  },

  /**
   * Initialise le plan de l'utilisateur
   */
  async init() {
    try {
      const isPublicPage = currentPath.startsWith('/p/');
    const isPublicStore = currentPath.startsWith('/store/');


    if (isPublicPage || isPublicStore) {
      return;
    }

      const data = await API.getProfile();
      if (data && data.data && data.data.user) {
        this.currentPlan = (data.data.user.plan_name || 'free').toLowerCase();
        this.updateUIBasedOnPlan();
      }
    } catch (error) {
      console.error('Erreur chargement plan:', error);
      this.currentPlan = 'free';
    }
  },

  /**
   * Vérifie si l'utilisateur a accès à une fonctionnalité
   */
  hasAccess(feature) {
    const features = {
      // Statistiques avancées (PRO et BUSINESS)
      advanced_stats: [this.PLANS.PRO, this.PLANS.BUSINESS],
      
      // Export de données (PRO et BUSINESS)
      export_data: [this.PLANS.PRO, this.PLANS.BUSINESS],
      
      // Personnalisation (BUSINESS uniquement)
      customization: [this.PLANS.BUSINESS],
      
      // Intégrations sociales (BUSINESS uniquement)
      social_integrations: [this.PLANS.BUSINESS]
    };

    return features[feature] && features[feature].includes(this.currentPlan);
  },

  /**
   * Affiche un message de mise à niveau
   */
  showUpgradeMessage(feature) {
    let requiredPlan = 'Pro';
    let featureName = '';

    switch(feature) {
      case 'advanced_stats':
        featureName = 'statistiques avancées';
        requiredPlan = 'Pro';
        break;
      case 'export_data':
        featureName = 'export des données';
        requiredPlan = 'Pro';
        break;
      case 'customization':
        featureName = 'personnalisation de la boutique';
        requiredPlan = 'Business';
        break;
      case 'social_integrations':
        featureName = 'intégrations sociales';
        requiredPlan = 'Business';
        break;
      default:
        featureName = 'cette fonctionnalité';
    }

    UI.showNotification(
      `🔒 Fonctionnalité ${requiredPlan}`,
      `Les ${featureName} nécessitent le plan ${requiredPlan}. Contactez-nous pour passer au plan supérieur.`,
      'info'
    );
  },

  /**
   * Met à jour l'UI selon le plan
   */
  updateUIBasedOnPlan() {
    // Masquer/afficher les boutons d'export
    const exportBtns = document.querySelectorAll('[data-feature="export"]');
    exportBtns.forEach(btn => {
      if (!this.hasAccess('export_data')) {
        btn.style.display = 'none';
      }
    });

    // Masquer/afficher les liens de menu selon le plan
    this.updateNavigationMenu();

    // Afficher le badge du plan dans la sidebar
    this.displayPlanBadge();
  },

  /**
   * Met à jour le menu de navigation
   */
  updateNavigationMenu() {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav) return;

    // Supprimer les sections existantes ajoutées dynamiquement
    const dynamicSections = nav.querySelectorAll('.nav-section[data-dynamic="true"]');
    dynamicSections.forEach(section => section.remove());

    // Section Fonctionnalités avancées (PRO et BUSINESS)
    if (this.hasAccess('advanced_stats')) {
      const advancedSection = this.createNavSection('Fonctionnalités Pro', [
        {
          href: '/advanced-stats',
          icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>`,
          label: 'Statistiques avancées',
          page: 'advanced-stats'
        }
      ]);
      
      // Insérer avant la section "Compte"
      const accountSection = nav.querySelector('.nav-section:last-of-type');
      if (accountSection) {
        nav.insertBefore(advancedSection, accountSection);
      } else {
        nav.appendChild(advancedSection);
      }
    }

    // Section Business (BUSINESS uniquement)
    if (this.hasAccess('customization')) {
      const businessSection = this.createNavSection('Business', [
        {
          href: '/customization',
          icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/>`,
          label: 'Personnalisation',
          page: 'customization'
        },
        {
          href: '/integrations',
          icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>`,
          label: 'Intégrations',
          page: 'integrations'
        }
      ]);
      
      const accountSection = nav.querySelector('.nav-section:last-of-type');
      if (accountSection) {
        nav.insertBefore(businessSection, accountSection);
      } else {
        nav.appendChild(businessSection);
      }
    }
  },

  /**
   * Crée une section de navigation
   */
  createNavSection(title, links) {
    const section = document.createElement('div');
    section.className = 'nav-section';
    section.setAttribute('data-dynamic', 'true');
    
    const titleDiv = document.createElement('div');
    titleDiv.className = 'nav-section-title';
    titleDiv.textContent = title;
    section.appendChild(titleDiv);

    links.forEach(link => {
      const a = document.createElement('a');
      a.href = link.href;
      a.className = `nav-item ${window.location.pathname === link.href ? 'active' : ''}`;
      
      a.innerHTML = `
        <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          ${link.icon}
        </svg>
        <span>${link.label}</span>
      `;
      
      section.appendChild(a);
    });

    return section;
  },

  /**
   * Affiche le badge du plan
   */
  displayPlanBadge() {
    const userDetails = document.querySelector('.user-details');
    if (!userDetails) return;

    // Supprimer l'ancien badge s'il existe
    const oldBadge = document.querySelector('.plan-badge');
    if (oldBadge) oldBadge.remove();

    const badge = document.createElement('div');
    badge.className = 'plan-badge';
    
    const colors = {
      free: '#9CA3AF',
      pro: '#3B82F6',
      business: '#8B5CF6'
    };

    badge.style.cssText = `
      display: inline-block;
      padding: 2px 8px;
      background: ${colors[this.currentPlan] || colors.free};
      color: white;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      margin-top: 4px;
    `;

    badge.textContent = this.currentPlan.toUpperCase();
    userDetails.appendChild(badge);
  },

  /**
   * Bloque l'accès à une fonctionnalité
   */
  blockFeature(feature, callback) {
    if (this.hasAccess(feature)) {
      callback();
    } else {
      this.showUpgradeMessage(feature);
    }
  }
};

PlanManager.init();
// Export global
window.PlanManager = PlanManager;