document.addEventListener('DOMContentLoaded', () => {
  const form      = document.getElementById('registerForm');
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const business_name      = document.getElementById('business_name').value.trim();
    const email              = document.getElementById('email').value.trim();
    const phone              = document.getElementById('phone').value.trim();
    const whatsapp_number    = document.getElementById('whatsapp_number').value.trim();
    const password           = document.getElementById('password').value;
    const confirm_password   = document.getElementById('confirm_password').value;

    // Validations côté client
    if (!business_name || !email || !password || !confirm_password) {
      UI.showNotification('Champs manquants', 'Veuillez remplir tous les champs obligatoires.', 'error');
      return;
    }

    if (password.length < 8) {
      UI.showNotification('Mot de passe trop court', 'Le mot de passe doit contenir au moins 8 caractères.', 'error');
      return;
    }

    if (password !== confirm_password) {
      UI.showNotification('Mots de passe différents', 'La confirmation du mot de passe ne correspond pas.', 'error');
      return;
    }

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      const resp = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_name, email, phone, whatsapp_number, password })
      });

      const data = await resp.json();

      if (resp.ok) {
        localStorage.setItem('aura_pending_email', email);
        UI.showNotification('Compte créé !', 'Votre compte a été créé avec succès. Veuillez vérifier votre adresse email.', 'success');
        setTimeout(() => { window.location.href = '/verify-otp?email=' + encodeURIComponent(email); }, 1500);
      } else {
        // Gérer les erreurs serveur (email déjà utilisé, etc.)
        const msg = data.message || data.error || 'Une erreur est survenue lors de l\'inscription.';
        UI.showNotification('Échec de l\'inscription', msg, 'error');
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
