document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('forgotForm');
  const submitBtn = document.getElementById('submitBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    if (!email) return;

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      const resp = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await resp.json();

      if (resp.ok) {
        UI.showNotification('Succès', 'Code envoyé avec succès.', 'success');
        setTimeout(() => {
          window.location.href = `/reset-password?email=${encodeURIComponent(email)}`;
        }, 1000);
      } else {
        UI.showNotification('Erreur', data.message || 'Une erreur est survenue.', 'error');
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
      }
    } catch (err) {
      UI.showNotification('Erreur', 'Impossible de joindre le serveur.', 'error');
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  });
});
