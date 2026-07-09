document.addEventListener('DOMContentLoaded', () => {
  // Récupérer l'email depuis l'URL
  const urlParams = new URLSearchParams(window.location.search);
  const email = urlParams.get('email');
  
  if (!email) {
    window.location.href = '/forgot-password';
    return;
  }
  
  document.getElementById('email').value = email;

  // Gestion des inputs OTP
  const otpInputs = document.querySelectorAll('.otp-input');
  
  otpInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      if (e.target.value.length > 1) {
        e.target.value = e.target.value.slice(0, 1);
      }
      if (e.target.value !== '' && index < otpInputs.length - 1) {
        otpInputs[index + 1].focus();
      }
    });
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
        otpInputs[index - 1].focus();
      }
    });
    
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      if (pastedData) {
        for (let i = 0; i < pastedData.length; i++) {
          if (i < otpInputs.length) {
            otpInputs[i].value = pastedData[i];
          }
        }
        const focusIndex = Math.min(pastedData.length, 5);
        otpInputs[focusIndex].focus();
      }
    });
  });

  // Gestion du formulaire
  const form = document.getElementById('resetForm');
  const submitBtn = document.getElementById('submitBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    let code = '';
    otpInputs.forEach(input => code += input.value);
    
    if (code.length !== 6) {
      UI.showNotification('Erreur', 'Veuillez saisir les 6 chiffres du code.', 'error');
      return;
    }

    const newPassword = document.getElementById('newPassword').value;

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      const resp = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, new_password: newPassword })
      });

      const data = await resp.json();

      if (resp.ok) {
        UI.showNotification('Succès', 'Mot de passe modifié avec succès.', 'success');
        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);
      } else {
        UI.showNotification('Erreur', data.message || 'Une erreur est survenue.', 'error');
        // Vider l'OTP si erreur
        otpInputs.forEach(input => input.value = '');
        otpInputs[0].focus();
      }
    } catch (err) {
      UI.showNotification('Erreur', 'Impossible de joindre le serveur.', 'error');
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  });
});
