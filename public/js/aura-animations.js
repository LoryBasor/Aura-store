/**
 * ================================================
 * AURA ANIMATIONS — Script UI Global
 * ================================================
 * Ne modifie aucune logique métier existante.
 * Uniquement des effets visuels et animations.
 */

(function () {
  'use strict';

  /* ================================================
     1. INTERSECTION OBSERVER — Reveal au scroll
     ================================================ */
  function initRevealAnimations() {
    const elements = document.querySelectorAll(
      '.reveal:not(.revealed), .reveal-left:not(.revealed), .reveal-right:not(.revealed), .reveal-scale:not(.revealed)'
    );

    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target); // Une seule fois
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    elements.forEach((el) => observer.observe(el));
  }

  /* ================================================
     2. NAVBAR — Glassmorphism au scroll
     ================================================ */
  function initNavbarScrollEffect() {
    const navbar = document.querySelector('.marketplace-navbar');
    if (!navbar) return;

    let ticking = false;

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrolled = window.scrollY > 20;
          navbar.classList.toggle('navbar-scrolled', scrolled);
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ================================================
     3. COUNTER ANIMATION — Chiffres animés
     ================================================ */
  function animateCounter(el, target, duration = 1200) {
    const startTime = performance.now();
    const startValue = 0;

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (target - startValue) * eased);

      el.textContent = current.toLocaleString('fr-FR');

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  function initCounters() {
    const counterEls = document.querySelectorAll('[data-counter]');
    if (!counterEls.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target;
            const target = parseInt(el.dataset.counter, 10) || 0;
            animateCounter(el, target);
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.5 }
    );

    counterEls.forEach((el) => observer.observe(el));
  }

  /* ================================================
     4. RIPPLE EFFECT — Sur les boutons
     ================================================ */
  function initRippleEffect() {
    // Applique sur tous les boutons ayant la classe btn-ripple
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-ripple, .btn, .btn-aura, .btn-login, .search-btn');
      if (!btn) return;

      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const size = Math.max(rect.width, rect.height) * 2;

      const ripple = document.createElement('span');
      ripple.classList.add('ripple-circle');
      ripple.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        left: ${x - size / 2}px;
        top: ${y - size / 2}px;
      `;

      btn.style.position = 'relative';
      btn.style.overflow = 'hidden';
      btn.appendChild(ripple);

      ripple.addEventListener('animationend', () => ripple.remove());
    });
  }

  /* ================================================
     5. LAZY LOADING — Images avec fade-in
     ================================================ */
  function initLazyImages() {
    const images = document.querySelectorAll('img[loading="lazy"], .product-image, .store-logo');

    images.forEach((img) => {
      // Ajoute un état de chargement
      img.style.opacity = '0';
      img.style.transition = 'opacity 0.4s ease';

      if (img.complete) {
        img.style.opacity = '1';
      } else {
        img.addEventListener('load', () => {
          img.style.opacity = '1';
        });

        img.addEventListener('error', () => {
          img.style.opacity = '1'; // Afficher même en cas d'erreur
        });
      }
    });
  }

  /* ================================================
     6. SMOOTH HOVER — Cartes produits
     ================================================ */
  function initCardHoverEffects() {
    const cards = document.querySelectorAll('.product-card, .store-card, .category-card');

    cards.forEach((card) => {
      card.addEventListener('mouseenter', () => {
        card.style.willChange = 'transform';
      });

      card.addEventListener('mouseleave', () => {
        card.style.willChange = 'auto';
      });
    });
  }

  /* ================================================
     7. FLOATING ACTIONS — Animation d'entrée
     ================================================ */
  function initFloatingActions() {
    const fabContainer = document.querySelector('.floating-actions, .fab-container');
    if (!fabContainer) return;

    // Animation d'entrée retardée
    setTimeout(() => {
      fabContainer.style.transition = 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.34,1.56,0.64,1)';
      fabContainer.style.opacity = '1';
      fabContainer.style.transform = 'translateY(0)';
    }, 800);

    // Style initial
    fabContainer.style.opacity = '0';
    fabContainer.style.transform = 'translateY(20px)';
  }

  /* ================================================
     8. STAGGER ANIMATION — Grilles de cartes
     ================================================ */
  function initStaggerGrids() {
    const grids = document.querySelectorAll(
      '.products-grid, .stores-grid, .categories-grid, .carousel-track'
    );

    grids.forEach((grid) => {
      const items = Array.from(grid.children).slice(0, 12);
      items.forEach((item, i) => {
        item.style.animationDelay = `${i * 0.06}s`;
        item.classList.add('reveal', `reveal-delay-${Math.min(i + 1, 5)}`);
      });
    });

    // On rappelle l'observer pour s'assurer que ces nouveaux éléments `.reveal` sont bien affichés
    initRevealAnimations();
  }

  /* ================================================
     9. SKELETON LOADERS → Remplacement progressif
     ================================================ */
  function initSkeletonRemoval() {
    // Retire les squelettes une fois le DOM chargé
    const skeletons = document.querySelectorAll('.skeleton-card');
    skeletons.forEach((sk) => {
      sk.style.transition = 'opacity 0.3s ease';
      sk.style.opacity = '0';
      setTimeout(() => sk.remove(), 300);
    });
  }

  /* ================================================
     10. MOBILE — Touch feedback amélioré
     ================================================ */
  function initTouchFeedback() {
    if (!('ontouchstart' in window)) return;

    document.addEventListener('touchstart', (e) => {
      const target = e.target.closest('a, button, .product-card, .store-card, .category-card');
      if (!target) return;

      target.style.transform = 'scale(0.97)';
      target.style.transition = 'transform 0.1s ease';
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      const target = e.target.closest('a, button, .product-card, .store-card, .category-card');
      if (!target) return;

      setTimeout(() => {
        target.style.transform = '';
      }, 150);
    }, { passive: true });
  }

  /* ================================================
     11. INPUT ANIMATIONS — Focus premium
     ================================================ */
  function initInputAnimations() {
    const inputs = document.querySelectorAll(
      '.form-input, .filter-input, .filter-select, .search-input, .input-premium'
    );

    inputs.forEach((input) => {
      const wrapper = input.closest('.form-group, .filter-group, .search-box');

      input.addEventListener('focus', () => {
        if (wrapper) wrapper.classList.add('input-focused');
      });

      input.addEventListener('blur', () => {
        if (wrapper) wrapper.classList.remove('input-focused');
      });
    });
  }

  /* ================================================
     12. PAGE TRANSITION — Entrée fluide
     ================================================ */
  function initPageTransition() {
    document.documentElement.style.opacity = '0';
    document.documentElement.style.transition = 'opacity 0.3s ease';

    window.addEventListener('load', () => {
      document.documentElement.style.opacity = '1';
    });
  }

  /* ================================================
     13. HERO PARTICLES — Particules animées
     ================================================ */
  function initHeroParticles() {
    const particleContainer = document.querySelector('.hero-particles');
    if (!particleContainer) return;

    const count = window.innerWidth < 768 ? 8 : 16;

    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.className = 'hero-particle';

      const size = Math.random() * 6 + 3;
      const x = Math.random() * 100;
      const delay = Math.random() * 8;
      const duration = Math.random() * 10 + 8;
      const tx = (Math.random() - 0.5) * 200;
      const ty = -(Math.random() * 150 + 50);

      particle.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}%;
        bottom: 0;
        background: rgba(224,252,252,${Math.random() * 0.4 + 0.2});
        border-radius: 50%;
        --tx: ${tx}px;
        --ty: ${ty}px;
        animation: particle-float ${duration}s ${delay}s ease-in-out infinite;
        pointer-events: none;
      `;

      particleContainer.appendChild(particle);
    }
  }

  /* ================================================
     14. SEARCH INPUT — Animation focus hero
     ================================================ */
  function initHeroSearch() {
    const searchInput = document.querySelector('#searchInput, .search-input');
    const searchBtn = document.querySelector('#searchBtn, .search-btn');

    if (!searchInput) return;

    // Redirect vers la page produits avec le terme de recherche
    function doSearch() {
      const q = searchInput.value.trim();
      if (q) {
        window.location.href = `/marketplace/products?search=${encodeURIComponent(q)}`;
      }
    }

    if (searchBtn) {
      searchBtn.addEventListener('click', doSearch);
    }

    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') doSearch();
    });
  }

  /* ================================================
     15. NAVBAR MOBILE — Fermeture au clic extérieur
     ================================================ */
  function enhanceNavbarMobile() {
    // Le JS existant (marketplace-navbar.js) gère déjà le toggle.
    // On ajoute seulement la fermeture au scroll sur mobile.
    const menu = document.querySelector('#navbarMenu');
    const toggle = document.querySelector('#navbarToggle');
    if (!menu || !toggle) return;

    // Fermer le menu si on scroll plus de 50px
    let lastScrollY = window.scrollY;
    window.addEventListener('scroll', () => {
      if (window.scrollY - lastScrollY > 50 && menu.classList.contains('active')) {
        menu.classList.remove('active');
        toggle.classList.remove('active');
      }
      lastScrollY = window.scrollY;
    }, { passive: true });
  }

  /* ================================================
     16. STAT CARDS — Micro-animation au survol
     ================================================ */
  function initStatCards() {
    const statCards = document.querySelectorAll('.stat-card');

    statCards.forEach((card) => {
      const icon = card.querySelector('.stat-icon');

      card.addEventListener('mouseenter', () => {
        if (icon) {
          icon.style.transform = 'rotate(10deg) scale(1.1)';
          icon.style.transition = 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)';
        }
      });

      card.addEventListener('mouseleave', () => {
        if (icon) {
          icon.style.transform = '';
        }
      });
    });
  }

  /* ================================================
     INITIALISATION — DOMContentLoaded
     ================================================ */
  function init() {
    initRevealAnimations();
    initNavbarScrollEffect();
    initCounters();
    initRippleEffect();
    initLazyImages();
    initCardHoverEffects();
    initFloatingActions();
    initHeroParticles();
    initHeroSearch();
    enhanceNavbarMobile();
    initInputAnimations();
    initTouchFeedback();
    initStatCards();

    // Stagger + skeletons après un court délai (pour pas bloquer le rendu)
    setTimeout(() => {
      initStaggerGrids();
      initSkeletonRemoval();
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
