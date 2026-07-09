// public/js/admin-actions.js

// -- Avis Utilisateurs --
async function markFeedbackProcessed(id) {
  if(!confirm('Confirmez-vous que cet avis a été traité ?')) return;
  try {
    const resp = await fetch(`/api/admin/feedback/${id}/process`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    });
    if(resp.ok) {
      if(typeof UI !== 'undefined') UI.showNotification('Succès', 'Avis traité', 'success');
      else alert('Avis traité');
      window.location.reload();
    } else {
      const data = await resp.json();
      if(typeof UI !== 'undefined') UI.showNotification('Erreur', data.message || 'Erreur', 'error');
      else alert(data.message || 'Erreur');
    }
  } catch(e) { console.error(e); }
}

function handleFeedbackFilterChange() {
  const status = document.getElementById('statusFilter').value;
  window.location.href = `/admin/feedback?status=${status}`;
}

// -- Signalements --
async function updateReportStatus(type, id, status) {
  if(!confirm('Confirmez-vous cette action ?')) return;
  try {
    const resp = await fetch(`/api/reports/${type}/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if(resp.ok) {
      if(typeof UI !== 'undefined') UI.showNotification('Succès', 'Statut mis à jour', 'success');
      else alert('Statut mis à jour');
      window.location.reload();
    }
  } catch(e) { console.error(e); }
}

function handleReportFilterChange() {
  const type = document.getElementById('typeFilter').value;
  const status = document.getElementById('statusFilter').value;
  window.location.href = `/admin/reports?type=${type}&status=${status}`;
}

// -- Notifications --
async function readNotif(id, redirectUrl) {
  try {
    await fetch(`/api/admin/notifications/${id}/read`, { method: 'PUT' });
    if(redirectUrl && redirectUrl !== '#') window.location.href = redirectUrl;
    else window.location.reload();
  } catch(e) { console.error(e); }
}

async function markAllNotifsRead() {
  try {
    await fetch(`/api/admin/notifications/read-all`, { method: 'PUT' });
    window.location.reload();
  } catch(e) { console.error(e); }
}

// -- Messagerie Admin --
async function closeTicket(currentConversationId) {
  if(!currentConversationId || !confirm('Fermer ce ticket ?')) return;
  try {
    const resp = await fetch(`/api/messages/admin/conversations/${currentConversationId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' })
    });
    if(resp.ok) {
      if(typeof UI !== 'undefined') UI.showNotification('Succès', 'Ticket fermé', 'success');
      else alert('Ticket fermé');
      window.location.reload();
    }
  } catch(e) { console.error(e); }
}

document.addEventListener('DOMContentLoaded', () => {
  // Messagerie Admin — envoi de message
  const sendAdminMessageForm = document.getElementById('sendAdminMessageForm');
  if (sendAdminMessageForm) {
    sendAdminMessageForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const currentConversationId = document.getElementById('currentConversationId').value;
      const content = document.getElementById('messageContent').value.trim();
      const fileInput = document.getElementById('messageAttachment');
      const btn = document.getElementById('sendBtn');
      
      const filesCount = fileInput ? fileInput.files.length : 0;
      if(!content && filesCount === 0) return;

      btn.disabled = true;
      const formData = new FormData();
      formData.append('content', content);
      
      if (fileInput) {
        for(let i=0; i<fileInput.files.length; i++) {
          formData.append('attachments', fileInput.files[i]);
        }
      }

      try {
        const resp = await fetch(`/api/messages/admin/conversations/${currentConversationId}/messages`, {
          method: 'POST',
          body: formData
        });
        if(resp.ok) {
          window.location.reload();
        } else {
          const data = await resp.json();
          if(typeof UI !== 'undefined') UI.showNotification('Erreur', data.message || 'Erreur', 'error');
          else alert(data.message || 'Erreur');
        }
      } catch(err) { console.error(err); } 
      finally { btn.disabled = false; }
    });
  }
});
