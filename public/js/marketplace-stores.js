// public/js/marketplace-stores.js
// Gestion des filtres pour la page boutiques du marketplace

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('filterForm');
  const sortSelect = document.getElementById('sortSelect');
  if (!form) return;

  const updateFilters = () => {
    const formData = new FormData(form);
    const params = new URLSearchParams(window.location.search);

    for (const [key, value] of formData.entries()) {
      if (value) params.set(key, value);
      else params.delete(key);
    }

    if (sortSelect && sortSelect.value) params.set('sort', sortSelect.value);
    params.delete('page');
    window.location.href = '?' + params.toString();
  };

  form.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('change', (e) => {
      if (e.target.type !== 'text') updateFilters();
    });
  });

  const searchBtn = document.getElementById('storeSearchBtn');
  if (searchBtn) searchBtn.addEventListener('click', updateFilters);

  const searchInput = document.getElementById('storeSearchInput');
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); updateFilters(); }
    });
  }

  if (sortSelect) sortSelect.addEventListener('change', updateFilters);

  const clearBtn = document.getElementById('clearFilters');
  if (clearBtn) clearBtn.addEventListener('click', () => { window.location.href = window.location.pathname; });

  const filterToggle = document.getElementById('filterToggle');
  const filtersSidebar = document.querySelector('.filters-sidebar');
  const closeFilters = document.getElementById('closeFilters');

  if (filterToggle && filtersSidebar) filterToggle.addEventListener('click', () => filtersSidebar.classList.add('open'));
  if (closeFilters && filtersSidebar) closeFilters.addEventListener('click', () => filtersSidebar.classList.remove('open'));
});