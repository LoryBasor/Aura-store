/**
 * public/js/marketplace-navbar.js
 * Gestion du toggle du menu mobile de la navbar marketplace
 */
document.addEventListener('DOMContentLoaded', () => {
  const navbarToggle = document.getElementById('navbarToggle');
  const navbarMenu   = document.getElementById('navbarMenu');

  if (!navbarToggle || !navbarMenu) return;

  navbarToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    navbarToggle.classList.toggle('active');
    navbarMenu.classList.toggle('active');
  });

  // Fermer le menu en cliquant hors du panneau
  document.addEventListener('click', (e) => {
    if (navbarMenu.classList.contains('active')) {
      if (!navbarMenu.contains(e.target) && e.target !== navbarToggle) {
        navbarToggle.classList.remove('active');
        navbarMenu.classList.remove('active');
      }
    }
  });

  // Fermer le menu lors du clic sur un lien
  navbarMenu.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navbarToggle.classList.remove('active');
      navbarMenu.classList.remove('active');
    });
  });

  // --- Logique Modale Feedback ---
  const fbModalOverlay = document.getElementById('mkFeedbackModalOverlay');
  const openFbBtn = document.getElementById('openFeedbackModalBtn');
  const closeFbBtn = document.getElementById('mkCloseFeedbackModal');
  const cancelFbBtn = document.getElementById('mkCancelFeedbackBtn');
  const fbForm = document.getElementById('mkFeedbackForm');

  if (fbModalOverlay && openFbBtn) {
    const closeFbModal = () => {
      fbModalOverlay.classList.remove('open');
      if (fbForm) fbForm.reset();
    };

    openFbBtn.addEventListener('click', (e) => {
      e.preventDefault();
      fbModalOverlay.classList.add('open');
    });

    if (closeFbBtn) closeFbBtn.addEventListener('click', closeFbModal);
    if (cancelFbBtn) cancelFbBtn.addEventListener('click', closeFbModal);
    
    fbModalOverlay.addEventListener('click', (e) => {
      if (e.target === fbModalOverlay) closeFbModal();
    });

    if (fbForm) {
      fbForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('mkSubmitFeedbackBtn');
        const rating = fbForm.querySelector('input[name="rating"]:checked')?.value;
        const category = document.getElementById('mkFeedbackCategory').value;
        const comment = document.getElementById('mkFeedbackComment').value;

        if (!rating) {
          alert('Veuillez sélectionner une note.');
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Envoi...';

        try {
          const resp = await fetch('/api/feedback/marketplace', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating, category, comment })
          });
          
          if (resp.ok) {
            alert('Merci pour votre avis !');
            closeFbModal();
          } else {
            const data = await resp.json();
            alert(data.message || 'Une erreur est survenue.');
          }
        } catch (error) {
          alert('Erreur réseau. Veuillez réessayer.');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Envoyer mon avis';
        }
      });
    }
  }
});
