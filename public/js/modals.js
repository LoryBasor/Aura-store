// public/js/modals.js

function openFeedbackModal() {
  document.getElementById('feedbackModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeFeedbackModal() {
  document.getElementById('feedbackModal').style.display = 'none';
  document.body.style.overflow = '';
  document.getElementById('feedbackForm').reset();
  document.getElementById('feedbackRating').value = '';
  document.querySelectorAll('.star-rating span').forEach(s => s.classList.remove('active'));
}

function openReportModal(type, targetId) {
  document.getElementById('reportType').value = type;
  document.getElementById('reportTargetId').value = targetId;
  document.getElementById('reportModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeReportModal() {
  document.getElementById('reportModal').style.display = 'none';
  document.body.style.overflow = '';
  document.getElementById('reportForm').reset();
}

function openSupportModal() {
  document.getElementById('supportModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeSupportModal() {
  document.getElementById('supportModal').style.display = 'none';
  document.body.style.overflow = '';
  document.getElementById('supportForm').reset();
}

document.addEventListener('DOMContentLoaded', () => {
  // --- FEEDBACK MODAL ---
  const stars = document.querySelectorAll('.star-rating span');
  const ratingInput = document.getElementById('feedbackRating');

  if (stars && ratingInput) {
    stars.forEach(star => {
      star.addEventListener('click', function() {
        const value = this.getAttribute('data-value');
        ratingInput.value = value;
        stars.forEach(s => {
          if (s.getAttribute('data-value') <= value) s.classList.add('active');
          else s.classList.remove('active');
        });
      });
    });
  }

  const feedbackForm = document.getElementById('feedbackForm');
  if (feedbackForm) {
    feedbackForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rating = ratingInput.value;
      const comment = document.getElementById('feedbackComment').value.trim();
      const btn = document.getElementById('feedbackSubmitBtn');

      if (!rating) {
        if(typeof UI !== 'undefined') UI.showNotification('Erreur', 'Veuillez donner une note', 'error');
        else alert('Veuillez donner une note');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Envoi...';

      try {
        const resp = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating, comment })
        });
        const data = await resp.json();

        if (resp.ok) {
          if(typeof UI !== 'undefined') UI.showNotification('Succès', 'Merci pour votre avis !', 'success');
          else alert('Merci pour votre avis !');
          closeFeedbackModal();
        } else {
          if(typeof UI !== 'undefined') UI.showNotification('Erreur', data.message, 'error');
          else alert(data.message);
        }
      } catch (err) {
        if(typeof UI !== 'undefined') UI.showNotification('Erreur', 'Impossible de joindre le serveur.', 'error');
        else alert('Erreur serveur');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Soumettre l\'avis';
      }
    });
  }

  // --- REPORT MODAL ---
  const reportForm = document.getElementById('reportForm');
  if (reportForm) {
    reportForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const type = document.getElementById('reportType').value;
      const targetId = document.getElementById('reportTargetId').value;
      const reason = document.getElementById('reportReason').value;
      const details = document.getElementById('reportDetails').value.trim();
      const btn = document.getElementById('reportSubmitBtn');

      btn.disabled = true;
      btn.textContent = 'Envoi...';

      try {
        const endpoint = type === 'product' ? '/api/reports/product' : '/api/reports/store';
        const payload = type === 'product' ? { product_id: targetId, reason, details } : { store_id: targetId, reason, details };

        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await resp.json();

        if (resp.ok) {
          if(typeof UI !== 'undefined') UI.showNotification('Signalement envoyé', 'Merci pour votre signalement. Nos équipes vont vérifier.', 'success');
          else alert('Signalement envoyé.');
          closeReportModal();
        } else {
          if(typeof UI !== 'undefined') UI.showNotification('Erreur', data.message, 'error');
          else alert(data.message);
        }
      } catch (err) {
        if(typeof UI !== 'undefined') UI.showNotification('Erreur', 'Impossible de joindre le serveur.', 'error');
        else alert('Erreur serveur');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Envoyer le signalement';
      }
    });
  }

  // --- SUPPORT MODAL ---
  const supportForm = document.getElementById('supportForm');
  if (supportForm) {
    supportForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const name = document.getElementById('supportName').value.trim();
      const email = document.getElementById('supportEmail').value.trim() || undefined;
      const subject = document.getElementById('supportSubject').value.trim();
      const message = document.getElementById('supportMessage').value.trim();
      const btn = document.getElementById('supportSubmitBtn');

      btn.disabled = true;
      btn.textContent = 'Envoi...';

      try {
        const resp = await fetch('/api/messages/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, subject, message })
        });
        const data = await resp.json();

        if (resp.ok) {
          if(typeof UI !== 'undefined') UI.showNotification('Message envoyé', 'Votre demande a bien été transmise à notre équipe.', 'success');
          else alert('Message envoyé.');
          closeSupportModal();
        } else {
          if(typeof UI !== 'undefined') UI.showNotification('Erreur', data.message, 'error');
          else alert(data.message);
        }
      } catch (err) {
        if(typeof UI !== 'undefined') UI.showNotification('Erreur', 'Impossible de joindre le serveur.', 'error');
        else alert('Erreur serveur');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Envoyer';
      }
    });
  }
});
