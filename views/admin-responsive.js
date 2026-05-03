/**
 * AURA ADMIN — MOBILE RESPONSIVE JS
 * Gestion du menu hamburger, sidebar, et comportements mobiles
 */

(function () {
  'use strict';

  /* ─────────────────────────────────────────
     SIDEBAR HAMBURGER
     ───────────────────────────────────────── */
  function initSidebar() {
    const sidebar = document.querySelector('.sidebar, #sidebar, [data-sidebar]');
    const overlay = document.querySelector('.sidebar-overlay');
    const hamburger = document.querySelector('.hamburger-btn, #hamburgerBtn');

    if (!sidebar) return;

    // Créer l'overlay s'il n'existe pas
    let sidebarOverlay = overlay;
    if (!sidebarOverlay) {
      sidebarOverlay = document.createElement('div');
      sidebarOverlay.className = 'sidebar-overlay';
      document.body.appendChild(sidebarOverlay);
    }

    // Créer le bouton hamburger si absent
    let hamburgerBtn = hamburger;
    if (!hamburgerBtn) {
      hamburgerBtn = document.createElement('button');
      hamburgerBtn.className = 'hamburger-btn';
      hamburgerBtn.setAttribute('aria-label', 'Menu');
      hamburgerBtn.setAttribute('aria-expanded', 'false');
      hamburgerBtn.innerHTML = '☰';

      // Insérer dans la topbar ou au début du body
      const topbar = document.querySelector('.topbar, .admin-topbar, header');
      if (topbar) {
        topbar.insertBefore(hamburgerBtn, topbar.firstChild);
      } else {
        document.body.insertBefore(hamburgerBtn, document.body.firstChild);
      }
    }

    function openSidebar() {
      sidebar.classList.add('open');
      sidebarOverlay.classList.add('active');
      hamburgerBtn.innerHTML = '✕';
      hamburgerBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
      sidebar.classList.remove('open');
      sidebarOverlay.classList.remove('active');
      hamburgerBtn.innerHTML = '☰';
      hamburgerBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    hamburgerBtn.addEventListener('click', function () {
      const isOpen = sidebar.classList.contains('open');
      isOpen ? closeSidebar() : openSidebar();
    });

    sidebarOverlay.addEventListener('click', closeSidebar);

    // Fermer avec Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sidebar.classList.contains('open')) {
        closeSidebar();
      }
    });

    // Fermer automatiquement si on agrandit la fenêtre
    window.addEventListener('resize', function () {
      if (window.innerWidth > 768) {
        closeSidebar();
      }
    });
  }

  /* ─────────────────────────────────────────
     TABLES RESPONSIVE
     ───────────────────────────────────────── */
  function initResponsiveTables() {
    const tables = document.querySelectorAll('.table');

    tables.forEach(function (table) {
      const container = table.closest('.table-container');
      if (!container) return;

      // Ajouter class table-cards si la table a des data-label
      const hasDataLabels = table.querySelector('td[data-label]');
      if (hasDataLabels) {
        table.classList.add('table-cards');
      }

      // Ajouter hint de scroll si pas déjà présent
      let hint = container.previousElementSibling;
      if (!hint || !hint.classList.contains('table-scroll-hint')) {
        hint = document.createElement('div');
        hint.className = 'table-scroll-hint';
        hint.textContent = '← Glisser pour voir plus →';
        container.parentNode.insertBefore(hint, container);
      }

      // Vérifier si la table déborde
      function checkOverflow() {
        if (hint) {
          hint.style.display = (table.scrollWidth > container.clientWidth) ? 'block' : 'none';
        }
      }

      checkOverflow();
      window.addEventListener('resize', checkOverflow);
    });
  }

  /* ─────────────────────────────────────────
     FORMULAIRES DE FILTRES RESPONSIVE
     ───────────────────────────────────────── */
  function initFilterForms() {
    // Les formulaires de filtre avec grid hardcodé en inline
    const filterForms = document.querySelectorAll(
      'form[method="GET"], .card form, form[style*="grid"]'
    );

    filterForms.forEach(function (form) {
      form.classList.add('filter-form-responsive');

      // Wraper les selects de filtre pour qu'ils soient width:100% sur mobile
      const selects = form.querySelectorAll('select[style*="width"]');
      selects.forEach(function (sel) {
        sel.style.setProperty('width', '100%', '');
      });
    });
  }

  /* ─────────────────────────────────────────
     GRILLES INLINE → CLASSES CSS
     ───────────────────────────────────────── */
  function patchInlineGrids() {
    // Les éléments avec style grid hardcodé qu'on doit rendre responsive
    const gridPatterns = [
      { selector: '[style*="grid-template-columns:2fr 1fr"]', cls: 'grid-2fr-1fr' },
      { selector: '[style*="grid-template-columns: 2fr 1fr"]', cls: 'grid-2fr-1fr' },
      { selector: '[style*="grid-template-columns:1fr 1fr"]', cls: 'grid-2col' },
      { selector: '[style*="grid-template-columns: 1fr 1fr"]', cls: 'grid-2col' },
      { selector: '[style*="grid-template-columns:1fr 2fr"]', cls: 'grid-1fr-2fr' },
      { selector: '[style*="grid-template-columns: 1fr 2fr"]', cls: 'grid-1fr-2fr' },
      { selector: '[style*="minmax(400px"]', cls: 'grid-auto-fit-400' },
      { selector: '[style*="repeat(3,1fr)"]', cls: 'grid-3col' },
      { selector: '[style*="repeat(3, 1fr)"]', cls: 'grid-3col' },
      { selector: '[style*="repeat(auto-fit, minmax(200px"]', cls: 'grid-auto-fit-200' },
    ];

    gridPatterns.forEach(function (pattern) {
      document.querySelectorAll(pattern.selector).forEach(function (el) {
        el.classList.add(pattern.cls);
      });
    });
  }

  /* ─────────────────────────────────────────
     PAGE HEADER ACTIONS RESPONSIVE
     ───────────────────────────────────────── */
  function initPageHeaderActions() {
    const pageHeaders = document.querySelectorAll('.page-header');

    pageHeaders.forEach(function (header) {
      // Wrapper les boutons du header dans un div.page-header-actions si pas déjà fait
      const actionDivs = header.querySelectorAll(':scope > div:not(:first-child), :scope > a, :scope > button');
      if (actionDivs.length > 0) {
        // Vérifier si déjà wrapé
        const lastChild = header.lastElementChild;
        if (lastChild && lastChild !== header.firstElementChild) {
          if (!lastChild.classList.contains('page-header-actions')) {
            lastChild.classList.add('page-header-actions');
          }
        }
      }
    });
  }

  /* ─────────────────────────────────────────
     MODAL ACCESSIBLE
     ───────────────────────────────────────── */
  function initModals() {
    // Fermer modal en cliquant sur l'overlay
    document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });

    // Fermer avec Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(function (m) {
          m.classList.remove('active');
        });
      }
    });
  }

  /* ─────────────────────────────────────────
     SWIPE TO CLOSE SIDEBAR (tactile)
     ───────────────────────────────────────── */
  function initSwipeGestures() {
    const sidebar = document.querySelector('.sidebar, #sidebar');
    if (!sidebar) return;

    let startX = 0;
    let startY = 0;
    let isDragging = false;

    document.addEventListener('touchstart', function (e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isDragging = true;
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
      if (!isDragging) return;
      isDragging = false;

      const deltaX = e.changedTouches[0].clientX - startX;
      const deltaY = e.changedTouches[0].clientY - startY;

      // Swipe horizontal dominant
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX < 0 && sidebar.classList.contains('open')) {
          // Swipe gauche → fermer sidebar
          sidebar.classList.remove('open');
          document.querySelector('.sidebar-overlay')?.classList.remove('active');
          document.body.style.overflow = '';
        } else if (deltaX > 0 && startX < 30 && !sidebar.classList.contains('open') && window.innerWidth <= 768) {
          // Swipe droit depuis le bord gauche → ouvrir sidebar
          sidebar.classList.add('open');
          document.querySelector('.sidebar-overlay')?.classList.add('active');
          document.body.style.overflow = 'hidden';
        }
      }
    }, { passive: true });
  }

  /* ─────────────────────────────────────────
     INIT GLOBAL
     ───────────────────────────────────────── */
  function init() {
    initSidebar();
    initResponsiveTables();
    initFilterForms();
    patchInlineGrids();
    initPageHeaderActions();
    initModals();
    initSwipeGestures();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
