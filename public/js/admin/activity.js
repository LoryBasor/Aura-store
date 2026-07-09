/**
 * ========================================
 * public/js/admin/activity.js
 * ========================================
 */

// Ouvrir la modale d'édition de prix (fonction globale appelée depuis les boutons EJS)
function openEditPrice(id, name, price) {
  document.getElementById('editPlanId').value = id;
  document.getElementById('editPlanName').textContent = 'Plan : ' + name;
  document.getElementById('newPlanPrice').value = price;
  document.getElementById('editPriceModal').classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
  // Lire les données SSR depuis le bloc JSON
  let trends = { vendors: [], orders: [] };
  try {
    const ssrEl = document.getElementById('ssr-activity-data');
    if (ssrEl) trends = JSON.parse(ssrEl.textContent || '{}');
  } catch(e) { console.error('[activity.js] Erreur lecture SSR data:', e); }

    // Préparation des dates (labels)
    // On fusionne les dates des deux datasets pour avoir un axe X cohérent
    const allDates = [...new Set([
        ...trends.vendors.map(v => v.date),
        ...trends.orders.map(o => o.date)
    ])].sort();

    // Map des données par date pour un accès facile
    const vendorMap = Object.fromEntries(trends.vendors.map(v => [v.date, v.vendor_count]));
    const orderMap = Object.fromEntries(trends.orders.map(o => [o.date, o.count]));
    const revenueMap = Object.fromEntries(trends.orders.map(o => [o.date, o.revenue]));

    const labels = allDates.map(d => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }));

    // 1. Graphique Évolution (Vendeurs & Commandes)
    const ctxEvolution = document.getElementById('evolutionChart')?.getContext('2d');
    if (ctxEvolution) {
        new Chart(ctxEvolution, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Nouveaux Vendeurs',
                        data: allDates.map(d => vendorMap[d] || 0),
                        borderColor: '#2196F3',
                        backgroundColor: 'rgba(33, 150, 243, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Commandes',
                        data: allDates.map(d => orderMap[d] || 0),
                        borderColor: '#4CAF50',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
                }
            }
        });
    }

    // 2. Graphique Revenus
    const ctxRevenue = document.getElementById('revenueChart')?.getContext('2d');
    if (ctxRevenue) {
        new Chart(ctxRevenue, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Chiffre d\'Affaires (FCFA)',
                    data: allDates.map(d => revenueMap[d] || 0),
                    backgroundColor: '#FF9800',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => value.toLocaleString('fr-FR') + ' F'
                        }
                    }
                }
            }
        });
    }

    // --- Gestion de la modification des prix ---
    const editPriceForm = document.getElementById('editPriceForm');
    if (editPriceForm) {
        editPriceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('editPlanId').value;
            const price = document.getElementById('newPlanPrice').value;

            if (typeof UI !== 'undefined') UI.showLoader();
            try {
                const resp = await fetch(`/api/admin/plans/${id}/price`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ price })
                });
                const data = await resp.json();
                if (resp.ok) {
                    if (typeof UI !== 'undefined') UI.showNotification('Succès', 'Prix mis à jour', 'success');
                    setTimeout(() => location.reload(), 1000);
                } else {
                    if (typeof UI !== 'undefined') UI.showNotification('Erreur', data.message || 'Échec', 'error');
                }
            } catch (error) {
                if (typeof UI !== 'undefined') UI.showNotification('Erreur', 'Erreur réseau', 'error');
            } finally {
                if (typeof UI !== 'undefined') UI.hideLoader();
            }
        });
    }

    // Fermeture des modals
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-close') || e.target.classList.contains('modal-overlay')) {
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        }
    });
});
