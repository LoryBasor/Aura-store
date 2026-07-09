document.addEventListener('DOMContentLoaded', () => {
  // Récupérer l'email depuis l'URL ou le localStorage
  const urlParams = new URLSearchParams(window.location.search);
  let email = urlParams.get('email');
  
  if (!email) {
    email = localStorage.getItem('aura_pending_email');
  }
  
  if (!email) {
    window.location.href = '/login';
    return;
  }
  
  document.getElementById('email').value = email;
  document.getElementById('displayEmail').textContent = email;

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
    
    // Supporter le copier-coller
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
  const form = document.getElementById('verifyForm');
  const submitBtn = document.getElementById('submitBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    let code = '';
    otpInputs.forEach(input => code += input.value);
    
    if (code.length !== 6) {
      UI.showNotification('Erreur', 'Veuillez saisir les 6 chiffres du code.', 'error');
      return;
    }

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      const resp = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });

      const data = await resp.json();

      if (resp.ok) {
        localStorage.removeItem('aura_pending_email');
        UI.showNotification('Succès', 'Votre compte a été activé ! Redirection...', 'success');
        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);
      } else {
        UI.showNotification('Erreur', data.message || 'Code incorrect', 'error');
        // Vider les champs si erreur
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

  // Gestion du renvoi
  const resendBtn = document.getElementById('resendBtn');
  const countdownSpan = document.getElementById('countdown');
  let countdownInterval;

  function startCountdown(seconds) {
    resendBtn.style.display = 'none';
    countdownSpan.style.display = 'inline';
    
    let timeLeft = seconds;
    countdownSpan.textContent = `Attendez ${timeLeft}s avant de renvoyer`;
    
    countdownInterval = setInterval(() => {
      timeLeft--;
      countdownSpan.textContent = `Attendez ${timeLeft}s avant de renvoyer`;
      
      if (timeLeft <= 0) {
        clearInterval(countdownInterval);
        resendBtn.style.display = 'inline';
        countdownSpan.style.display = 'none';
      }
    }, 1000);
  }

  resendBtn.addEventListener('click', async () => {
    resendBtn.disabled = true;
    
    try {
      const resp = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await resp.json();

      if (resp.ok) {
        UI.showNotification('Succès', 'Un nouveau code a été envoyé.', 'success');
        startCountdown(60);
      } else {
        UI.showNotification('Erreur', data.message, 'error');
        if (resp.status === 429) {
          // Extraction des secondes de l'erreur
          const match = data.message.match(/(\d+)/);
          if (match) startCountdown(parseInt(match[0]));
        }
      }
    } catch (err) {
      UI.showNotification('Erreur', 'Impossible de joindre le serveur.', 'error');
    } finally {
      resendBtn.disabled = false;
    }
  });
});
