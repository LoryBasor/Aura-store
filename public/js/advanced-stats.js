document.addEventListener("DOMContentLoaded", function() {
  let data = {};
  try {
    const ssrEl = document.getElementById('ssr-stats-data');
    if (ssrEl) data = JSON.parse(ssrEl.textContent || '{}');
  } catch(e) {
    console.error('Erreur lecture stats SSR:', e);
    return;
  }

  const formatCurrency = (value) => new Intl.NumberFormat('fr-FR').format(value) + ' FCFA';

  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.color = "#6b7280";

  const chartColors = {
    purple: '#8b5cf6', blue: '#3b82f6', green: '#10b981',
    amber: '#f59e0b', pink: '#ec4899', cyan: '#06b6d4', slate: '#64748b'
  };

  const commonPlugins = {
    legend: { labels: { padding: 16, usePointStyle: true, pointStyle: 'circle' } },
    tooltip: {
      backgroundColor: 'rgba(17,24,39,0.9)',
      padding: 12, cornerRadius: 8,
      titleFont: { weight: '600' }
    }
  };

  // ── 1. Evolution Chart ──
  const evCtx = document.getElementById('evolutionChart');
  if (evCtx && data.evolution && data.evolution.length > 0) {
    const labels = data.evolution.map(d => d.label || d.period);
    new Chart(evCtx.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: "Chiffre d'affaires (FCFA)",
            data: data.evolution.map(d => d.revenue),
            borderColor: chartColors.purple,
            backgroundColor: 'rgba(139,92,246,0.12)',
            borderWidth: 3, fill: true, tension: 0.4, yAxisID: 'y',
            pointRadius: 3, pointHoverRadius: 6
          },
          {
            label: "Commandes",
            data: data.evolution.map(d => d.order_count),
            type: 'bar',
            backgroundColor: 'rgba(59,130,246,0.55)',
            borderRadius: 6, yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          ...commonPlugins,
          tooltip: {
            ...commonPlugins.tooltip,
            callbacks: {
              label: (ctx) => ctx.datasetIndex === 0
                ? "CA: " + formatCurrency(ctx.raw)
                : "Commandes: " + ctx.raw
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            position: 'left',
            title: { display: true, text: 'Revenus (FCFA)', font: { weight: '600' } },
            ticks: { callback: (v) => new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(v) }
          },
          y1: {
            position: 'right',
            title: { display: true, text: 'Commandes', font: { weight: '600' } },
            grid: { drawOnChartArea: false },
            ticks: { stepSize: 1 }
          }
        }
      }
    });
  } else if (evCtx) {
    showEmptyState(evCtx.parentElement, 'Pas de données d\'évolution pour cette période');
  }

  // ── 2. Status Doughnut ──
  const stCtx = document.getElementById('statusChart');
  if (stCtx && data.byStatus && data.byStatus.length > 0) {
    new Chart(stCtx.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: data.byStatus.map(d => (data.statusLabelsMap && data.statusLabelsMap[d.status]) || d.status),
        datasets: [{
          data: data.byStatus.map(d => d.count),
          backgroundColor: data.byStatus.map(d => (data.statusColorsMap && data.statusColorsMap[d.status]) || '#94a3b8'),
          borderWidth: 2, borderColor: '#fff', hoverOffset: 8
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: { ...commonPlugins, legend: { ...commonPlugins.legend, position: 'bottom' } }
      }
    });
  }

  // ── 3. Hourly Activity ──
  const hrCtx = document.getElementById('hourlyChart');
  if (hrCtx && data.hourlyStats) {
    const orderCounts = new Array(24).fill(0);
    data.hourlyStats.forEach(s => { if (s.hour >= 0 && s.hour < 24) orderCounts[s.hour] = s.order_count; });
    const maxCount = Math.max(...orderCounts, 1);

    new Chart(hrCtx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: Array.from({length: 24}, (_, i) => i + 'h'),
        datasets: [{
          label: 'Commandes',
          data: orderCounts,
          backgroundColor: orderCounts.map(c => {
            const intensity = c / maxCount;
            return `rgba(245,158,11,${0.3 + intensity * 0.7})`;
          }),
          borderRadius: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: commonPlugins.tooltip },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  }

  // ── 4. Top Products ──
  const tpCtx = document.getElementById('topProductsChart');
  if (tpCtx && data.topProducts && data.topProducts.length > 0) {
    new Chart(tpCtx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: data.topProducts.map(d => d.name.length > 18 ? d.name.substring(0, 18) + '…' : d.name),
        datasets: [{
          label: 'Revenus',
          data: data.topProducts.map(d => d.total_revenue),
          backgroundColor: 'rgba(16,185,129,0.75)',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: { ...commonPlugins.tooltip, callbacks: { label: (c) => formatCurrency(c.raw) } }
        },
        scales: {
          x: { ticks: { callback: (v) => new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(v) } },
          y: { grid: { display: false } }
        }
      }
    });
  }

  // ── 5. Categories Pie ──
  const catCtx = document.getElementById('categoriesChart');
  if (catCtx && data.categories && data.categories.length > 0) {
    new Chart(catCtx.getContext('2d'), {
      type: 'polarArea',
      data: {
        labels: data.categories.map(c => c.name),
        datasets: [{
          data: data.categories.map(c => c.order_count),
          backgroundColor: [
            'rgba(139,92,246,0.7)', 'rgba(59,130,246,0.7)', 'rgba(16,185,129,0.7)',
            'rgba(245,158,11,0.7)', 'rgba(236,72,153,0.7)', 'rgba(100,116,139,0.7)'
          ],
          borderWidth: 2, borderColor: '#fff'
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { ...commonPlugins, legend: { ...commonPlugins.legend, position: 'bottom' } },
        scales: { r: { grid: { color: 'rgba(0,0,0,0.05)' } } }
      }
    });
  }

  // ── 6. Customer Loyalty ──
  const custCtx = document.getElementById('customerChart');
  if (custCtx && data.customers) {
    const oneTime = data.customers.one_time || 0;
    const repeat = data.customers.repeat || 0;
    if (oneTime + repeat > 0) {
      new Chart(custCtx.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: ['1 commande (Potentiels)', 'Fidèles (>1 cmd)'],
          datasets: [{
            data: [oneTime, repeat],
            backgroundColor: ['rgba(245,158,11,0.8)', 'rgba(16,185,129,0.8)'],
            borderWidth: 2, borderColor: '#fff', hoverOffset: 6
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '60%',
          plugins: { ...commonPlugins, legend: { ...commonPlugins.legend, position: 'bottom' } }
        }
      });
    }
  }

  // ── Filter form validation ──
  const form = document.getElementById('statsFilterForm');
  if (form) {
    form.addEventListener('submit', function(e) {
      const period = document.getElementById('filterPeriod').value;
      if (period === 'custom') {
        const start = document.getElementById('filterStart').value;
        const end = document.getElementById('filterEnd').value;
        if (!start || !end) {
          e.preventDefault();
          alert('Veuillez sélectionner une date de début et de fin.');
          return;
        }
        if (new Date(start) > new Date(end)) {
          e.preventDefault();
          alert('La date de début doit être antérieure à la date de fin.');
        }
      }
    });
  }
});

function showEmptyState(container, message) {
  const canvas = container.querySelector('canvas');
  if (canvas) canvas.style.display = 'none';
  const div = document.createElement('div');
  div.className = 'chart-empty';
  div.innerHTML = '<div class="chart-empty-icon">📊</div><p>' + message + '</p>';
  container.appendChild(div);
}

function openPrintView() {
  const params = new URLSearchParams(window.location.search);
  const period = document.getElementById('filterPeriod')?.value;
  if (period) params.set('period', period);
  if (period === 'custom') {
    const s = document.getElementById('filterStart')?.value;
    const e = document.getElementById('filterEnd')?.value;
    if (s) params.set('start', s);
    if (e) params.set('end', e);
  }
  window.open('/advanced-stats/print?' + params.toString(), '_blank');
}

function toggleCustomDates() {
  const period = document.getElementById('filterPeriod').value;
  document.querySelectorAll('.custom-date-group').forEach(el => {
    el.style.display = (period === 'custom') ? 'flex' : 'none';
  });
}

function toggleComparison() {
  const sec = document.getElementById('comparisonSection');
  sec.style.display = sec.style.display === 'none' ? 'block' : 'none';
}

async function runComparison() {
  const p1s = document.getElementById('compAStart').value;
  const p1e = document.getElementById('compAEnd').value;
  const p2s = document.getElementById('compBStart').value;
  const p2e = document.getElementById('compBEnd').value;

  if (!p1s || !p1e || !p2s || !p2e) {
    alert('Veuillez remplir toutes les dates de comparaison.');
    return;
  }

  try {
    const res = await fetch(`/api/features/stats/compare?p1Start=${p1s}&p1End=${p1e}&p2Start=${p2s}&p2End=${p2e}`);
    const json = await res.json();
    if (json.success) {
      displayComparison(json.data.comparison);
    } else {
      alert('Erreur: ' + (json.error || 'Impossible de charger la comparaison'));
    }
  } catch(e) {
    console.error(e);
    alert('Erreur réseau.');
  }
}

function displayComparison(comp) {
  const resDiv = document.getElementById('comparisonResults');
  resDiv.style.display = 'grid';

  const formatCurrency = (val) => new Intl.NumberFormat('fr-FR').format(val) + ' FCFA';
  const getDiffHtml = (val) => {
    if (val > 0) return `<span class="comp-diff diff-up">↑ ${val}%</span>`;
    if (val < 0) return `<span class="comp-diff diff-down">↓ ${Math.abs(val)}%</span>`;
    return `<span class="comp-diff diff-neutral">— 0%</span>`;
  };

  resDiv.innerHTML = `
    <div class="comp-card">
      <div class="comp-title">Commandes</div>
      <div class="comp-val-p1">${comp.period1.total_orders} (Période A)</div>
      <div class="comp-val-p2">${comp.period2.total_orders} (Période B)</div>
      ${getDiffHtml(comp.variations.total_orders)}
    </div>
    <div class="comp-card">
      <div class="comp-title">Chiffre d'Affaires</div>
      <div class="comp-val-p1">${formatCurrency(comp.period1.total_revenue)} (A)</div>
      <div class="comp-val-p2">${formatCurrency(comp.period2.total_revenue)} (B)</div>
      ${getDiffHtml(comp.variations.total_revenue)}
    </div>
    <div class="comp-card">
      <div class="comp-title">Panier Moyen</div>
      <div class="comp-val-p1">${formatCurrency(comp.period1.avg_basket)} (A)</div>
      <div class="comp-val-p2">${formatCurrency(comp.period2.avg_basket)} (B)</div>
      ${getDiffHtml(comp.variations.avg_basket)}
    </div>
  `;
}
