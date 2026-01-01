/**
 * public/js/advancedStats.js
 * ========================================
 * PAGE STATISTIQUES AVANCÉES (PRO et BUSINESS)
 * ========================================
 */

const AdvancedStatsPage = {
  currentPeriod: 'day',
  currentDays: 30,

  init() {
    if (!document.getElementById('advancedStatsContainer')) return;

    // Vérifier l'accès
     setTimeout(() => {
      if (!PlanManager.hasAccess('advanced_stats')) {
        this.showAccessDenied();
        return;
      }
    }, 600);

    this.attachEventListeners();
    this.loadAllStats();
  },

  attachEventListeners() {
    // Changement de période
    const periodSelect = document.getElementById('periodSelect');
    if (periodSelect) {
      periodSelect.addEventListener('change', (e) => {
        this.currentPeriod = e.target.value;
        this.loadEvolution();
      });
    }

    // Changement de jours
    const daysSelect = document.getElementById('daysSelect');
    if (daysSelect) {
      daysSelect.addEventListener('change', (e) => {
        this.currentDays = parseInt(e.target.value);
        this.loadEvolution();
      });
    }

    // Boutons d'export
    const exportJsonBtn = document.querySelector('[data-action="export-stats-json"]');
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', () => API.exportStatsJSON());
    }
  },

  async loadAllStats() {
    try {
      UI.showLoader();

      await Promise.all([
        this.loadConversionMetrics(),
        this.loadEvolution(),
        this.loadTopProducts(),
        this.loadCustomerAnalysis(),
        this.loadForecast()
      ]);

      UI.hideLoader();
    } catch (error) {
      UI.hideLoader();
      console.error('Erreur chargement stats:', error);
    }
  },

  async loadConversionMetrics() {
    try {
      const data = await API.getConversionMetrics();
      
      if (data && data.data && data.data.metrics) {
        this.renderConversionMetrics(data.data.metrics);
      }
    } catch (error) {
      console.error('Erreur métriques:', error);
    }
  },

  renderConversionMetrics(metrics) {
    const container = document.getElementById('conversionMetrics');
    if (!container) return;

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Taux de conversion</span>
            <div class="stat-icon">📊</div>
          </div>
          <div class="stat-value">${metrics.conversion_rate}%</div>
          <div class="stat-change">${metrics.total_views} vues → ${metrics.total_orders} commandes</div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Panier moyen</span>
            <div class="stat-icon">🛒</div>
          </div>
          <div class="stat-value">${UI.formatCurrency(metrics.avg_basket)}</div>
          <div class="stat-change">${metrics.total_orders} commandes</div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Clients uniques</span>
            <div class="stat-icon">👥</div>
          </div>
          <div class="stat-value">${metrics.unique_customers}</div>
          <div class="stat-change">${metrics.total_products} produits</div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Chiffre d'affaires total</span>
            <div class="stat-icon">💰</div>
          </div>
          <div class="stat-value">${UI.formatCurrency(metrics.total_revenue)}</div>
          <div class="stat-change positive">Total cumulé</div>
        </div>
      </div>
    `;
  },

  async loadEvolution() {
    try {
      const data = await API.getOrdersEvolution(this.currentPeriod, this.currentDays);
      
      if (data && data.data && data.data.evolution) {
        this.renderEvolutionChart(data.data.evolution);
      }
    } catch (error) {
      console.error('Erreur évolution:', error);
    }
  },

  renderEvolutionChart(evolution) {
    const container = document.getElementById('evolutionChart');
    if (!container) return;

    if (!evolution || evolution.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Aucune donnée disponible</p></div>';
      return;
    }

    // Créer un graphique simple avec des barres CSS
    const maxRevenue = Math.max(...evolution.map(e => e.revenue));

    container.innerHTML = `
      <div style="padding: 24px;">
        <h4 style="margin-bottom: 24px; color: var(--color-primary);">
          📈 Évolution des commandes (${this.currentDays} derniers jours)
        </h4>
        <div style="display: grid; gap: 16px;">
          ${evolution.map(item => `
            <div style="display: grid; grid-template-columns: 120px 1fr auto; gap: 12px; align-items: center;">
              <div style="font-size: 13px; color: var(--color-secondary);">
                ${item.label}
              </div>
              <div style="background: var(--color-surface); border-radius: 100px; height: 32px; position: relative; overflow: hidden;">
                <div style="
                  width: ${(item.revenue / maxRevenue * 100)}%;
                  height: 100%;
                  background: linear-gradient(90deg, var(--color-primary), var(--color-secondary));
                  border-radius: 100px;
                  transition: width 0.5s;
                "></div>
              </div>
              <div style="display: flex; flex-direction: column; align-items: flex-end;">
                <strong style="font-size: 14px; color: var(--color-primary);">
                  ${UI.formatCurrency(item.revenue)}
                </strong>
                <span style="font-size: 12px; color: var(--color-secondary);">
                  ${item.order_count} cmd
                </span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  async loadTopProducts() {
    try {
      const data = await API.getTopProducts(10);
      
      if (data && data.data && data.data.products) {
        this.renderTopProducts(data.data.products);
      }
    } catch (error) {
      console.error('Erreur top produits:', error);
    }
  },

  renderTopProducts(products) {
    const container = document.getElementById('topProductsList');
    if (!container) return;

    if (!products || products.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Aucun produit</p></div>';
      return;
    }

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${products.map((product, index) => `
          <div style="
            padding: 16px;
            background: ${index === 0 ? 'linear-gradient(135deg, var(--color-accent), var(--color-surface))' : 'var(--color-surface)'};
            border-radius: var(--radius-sm);
            display: flex;
            align-items: center;
            gap: 12px;
          ">
            <div style="
              width: 36px;
              height: 36px;
              border-radius: 50%;
              background: var(--color-primary);
              color: white;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 700;
            ">
              ${index + 1}
            </div>
            <div style="flex: 1;">
              <div style="font-weight: 700; color: var(--color-primary); margin-bottom: 4px;">
                ${product.name}
              </div>
              <div style="font-size: 13px; color: var(--color-secondary);">
                ${product.sales_count} ventes • ${UI.formatCurrency(product.total_revenue)}
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 14px; font-weight: 600; color: var(--color-primary);">
                ${UI.formatCurrency(product.price)}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  async loadCustomerAnalysis() {
    try {
      const data = await API.getCustomerAnalysis();
      
      if (data && data.data && data.data.analysis) {
        this.renderCustomerAnalysis(data.data.analysis);
      }
    } catch (error) {
      console.error('Erreur analyse clients:', error);
    }
  },

  renderCustomerAnalysis(analysis) {
    const container = document.getElementById('customerAnalysis');
    if (!container) return;

    container.innerHTML = `
      <div style="padding: 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 48px; font-weight: 700; color: var(--color-primary);">
            ${analysis.repeat_rate}%
          </div>
          <div style="font-size: 14px; color: var(--color-secondary);">
            Taux de fidélité
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
          <div style="padding: 16px; background: var(--color-surface); border-radius: var(--radius-sm); text-align: center;">
            <div style="font-size: 28px; font-weight: 700; color: var(--color-primary); margin-bottom: 4px;">
              ${analysis.one_time_customers}
            </div>
            <div style="font-size: 13px; color: var(--color-secondary);">
              Clients ponctuels
            </div>
          </div>

          <div style="padding: 16px; background: var(--color-accent); border-radius: var(--radius-sm); text-align: center;">
            <div style="font-size: 28px; font-weight: 700; color: var(--color-primary); margin-bottom: 4px;">
              ${analysis.repeat_customers}
            </div>
            <div style="font-size: 13px; color: var(--color-primary);">
              Clients récurrents
            </div>
          </div>

          <div style="padding: 16px; background: var(--color-surface); border-radius: var(--radius-sm); text-align: center;">
            <div style="font-size: 20px; font-weight: 700; color: var(--color-primary); margin-bottom: 4px;">
              ${analysis.avg_orders_per_customer.toFixed(1)}
            </div>
            <div style="font-size: 13px; color: var(--color-secondary);">
              Commandes / client
            </div>
          </div>

          <div style="padding: 16px; background: var(--color-surface); border-radius: var(--radius-sm); text-align: center;">
            <div style="font-size: 20px; font-weight: 700; color: var(--color-primary); margin-bottom: 4px;">
              ${UI.formatCurrency(analysis.avg_spent_per_customer)}
            </div>
            <div style="font-size: 13px; color: var(--color-secondary);">
              Dépense moyenne
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async loadForecast() {
    try {
      const data = await API.getForecast();
      
      if (data && data.data && data.data.forecast) {
        this.renderForecast(data.data.forecast);
      }
    } catch (error) {
      console.error('Erreur prévisions:', error);
    }
  },

  renderForecast(forecast) {
    const container = document.getElementById('forecastCard');
    if (!container) return;

    const trendIcon = forecast.trend === 'up' ? '📈' : forecast.trend === 'down' ? '📉' : '➡️';
    const trendColor = forecast.trend === 'up' ? 'var(--color-success)' : forecast.trend === 'down' ? 'var(--color-error)' : 'var(--color-secondary)';

    container.innerHTML = `
      <div style="padding: 24px; text-align: center;">
        <div style="font-size: 64px; margin-bottom: 12px;">${trendIcon}</div>
        <h4 style="font-size: 20px; font-weight: 700; color: var(--color-primary); margin-bottom: 8px;">
          Tendance ${forecast.trend === 'up' ? 'à la hausse' : forecast.trend === 'down' ? 'à la baisse' : 'stable'}
        </h4>
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 24px; text-align: left;">
          <div style="padding: 16px; background: var(--color-surface); border-radius: var(--radius-sm);">
            <div style="font-size: 13px; color: var(--color-secondary); margin-bottom: 8px;">
              30 derniers jours
            </div>
            <div style="font-size: 24px; font-weight: 700; color: var(--color-primary);">
              ${forecast.last_30_days.orders}
            </div>
            <div style="font-size: 13px; color: var(--color-secondary);">
              commandes
            </div>
          </div>

          <div style="padding: 16px; background: var(--color-surface); border-radius: var(--radius-sm);">
            <div style="font-size: 13px; color: var(--color-secondary); margin-bottom: 8px;">
              30 jours précédents
            </div>
            <div style="font-size: 24px; font-weight: 700; color: var(--color-primary);">
              ${forecast.previous_30_days.orders}
            </div>
            <div style="font-size: 13px; color: var(--color-secondary);">
              commandes
            </div>
          </div>
        </div>

        <div style="margin-top: 16px; padding: 16px; background: var(--color-accent); border-radius: var(--radius-sm);">
          <div style="font-size: 32px; font-weight: 700; color: ${trendColor};">
            ${forecast.growth.orders > 0 ? '+' : ''}${forecast.growth.orders}%
          </div>
          <div style="font-size: 13px; color: var(--color-secondary);">
            Croissance du nombre de commandes
          </div>
        </div>
      </div>
    `;
  },

  showAccessDenied() {
    const container = document.getElementById('advancedStatsContainer');
    if (!container) return;

    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 64px;">
        <div style="font-size: 64px; margin-bottom: 24px;">🔒</div>
        <h2 style="font-size: 28px; font-weight: 700; color: var(--color-primary); margin-bottom: 12px;">
          Fonctionnalité Pro
        </h2>
        <p style="font-size: 16px; color: var(--color-secondary); margin-bottom: 32px;">
          Les statistiques avancées sont disponibles à partir du plan Pro.
        </p>
        <a href="/subscription" class="btn btn-primary btn-lg">
          🚀 Passer au plan Pro
        </a>
      </div>
    `;
  }
};

// Export global
window.AdvancedStatsPage = AdvancedStatsPage;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('advancedStatsContainer')) {
    // Attendre que PlanManager soit initialisé
    setTimeout(() => {
      AdvancedStatsPage.init();
    }, 100);
  }
});