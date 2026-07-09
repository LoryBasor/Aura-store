// public/js/vendor-messages.js

function openNewTicketModal() {
  const modal = document.getElementById('newTicketModal');
  if(modal) modal.style.display = 'flex';
}

function closeNewTicketModal() {
  const modal = document.getElementById('newTicketModal');
  if(modal) modal.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  // Create Ticket
  const newTicketForm = document.getElementById('newTicketForm');
  if (newTicketForm) {
    newTicketForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const subject = document.getElementById('ticketSubject').value.trim();
      const message = document.getElementById('ticketMessage').value.trim();
      
      try {
        const resp = await fetch('/api/messages/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject, initial_message: message })
        });
        
        if (resp.ok) {
          const data = await resp.json();
          window.location.href = `/dashboard/messages?ticket=${data.data.id}`;
        }
      } catch (e) {
        console.error(e);
      }
    });
  }

  // Send message
  const sendMessageForm = document.getElementById('sendMessageForm');
  if (sendMessageForm) {
    sendMessageForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentConversationId = document.getElementById('currentConversationId').value;
      if(!currentConversationId) return;

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
        const resp = await fetch(`/api/messages/conversations/${currentConversationId}/messages`, {
          method: 'POST',
          body: formData
        });
        
        if(resp.ok) {
          window.location.reload();
        } else {
          const data = await resp.json();
          if(typeof UI !== 'undefined') UI.showNotification('Erreur', data.message, 'error');
          else alert(data.message);
        }
      } catch(err) {
        console.error(err);
      } finally {
        btn.disabled = false;
      }
    });
  }

  // Scroll to bottom of chat
  const chatMessages = document.getElementById('chatMessages');
  if(chatMessages) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
});
