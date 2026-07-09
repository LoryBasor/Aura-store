document.addEventListener('DOMContentLoaded', () => {
  const form      = document.getElementById('loginForm');
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      UI.showNotification('Champs manquants', 'Veuillez remplir tous les champs.', 'error');
      return;
    }

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await resp.json();

      if (resp.ok) {
        UI.showNotification('Connexion réussie', 'Bienvenue ! Redirection en cours…', 'success');
        setTimeout(() => { 
          // Redirection intelligente selon le rôle
          const user = data.data.user;
          if (user.role === 'SUPER_ADMIN') {
            window.location.href = '/admin/dashboard';
          } else {
            window.location.href = '/dashboard';
          }
        }, 800);
      } else {
        // Erreurs serveur spécifiques
        if (data.requiresOTP) {
          localStorage.setItem('aura_pending_email', email);
          UI.showNotification('Email non vérifié', 'Veuillez vérifier votre adresse email. Redirection...', 'warning');
          setTimeout(() => {
            window.location.href = '/verify-otp?email=' + encodeURIComponent(email);
          }, 1500);
        } else {
          const msg = data.message || data.error || 'Email ou mot de passe incorrect.';
          UI.showNotification('Échec de connexion', msg, 'error');
        }
      }
    } catch (err) {
      UI.showNotification('Erreur réseau', 'Impossible de joindre le serveur. Réessayez.', 'error');
    } finally {
      UI.hideLoader();
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  });
});
