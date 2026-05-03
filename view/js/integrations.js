/**
 * integrations.js
 * Gestion des réseaux sociaux et messages WhatsApp
 */

document.addEventListener('DOMContentLoaded', () => {
  const integrations = window.__SSR_INTEGRATIONS__ || {};
  
  // Éléments
  const forms = {
    whatsapp: document.getElementById('whatsappForm'),
    instagram: document.getElementById('instagramForm'),
    facebook: document.getElementById('facebookForm'),
    message: document.getElementById('customMessageForm')
  };

  const inputs = {
    whatsappNumber: document.getElementById('whatsappNumber'),
    whatsappEnabled: document.getElementById('whatsappEnabled'),
    instagramUrl: document.getElementById('instagramUrl'),
    instagramEnabled: document.getElementById('instagramEnabled'),
    facebookUrl: document.getElementById('facebookUrl'),
    facebookEnabled: document.getElementById('facebookEnabled'),
    customOrderMessage: document.getElementById('customOrderMessage')
  };

  // Initialisation des valeurs
  function initValues() {
    if (integrations.whatsapp_number) inputs.whatsappNumber.value = integrations.whatsapp_number;
    if (integrations.whatsapp_enabled) inputs.whatsappEnabled.checked = !!integrations.whatsapp_enabled;
    
    if (integrations.instagram_url) inputs.instagramUrl.value = integrations.instagram_url;
    if (integrations.instagram_enabled) inputs.instagramEnabled.checked = !!integrations.instagram_enabled;
    
    if (integrations.facebook_url) inputs.facebookUrl.value = integrations.facebook_url;
    if (integrations.facebook_enabled) inputs.facebookEnabled.checked = !!integrations.facebook_enabled;
    
    if (integrations.custom_order_message) inputs.customOrderMessage.value = integrations.custom_order_message;
    
    updatePreview();
  }

  // --- SAUVEGARDE COMMUNE ---
  async function saveIntegrations(data) {
    UI.showLoader();
    try {
      const resp = await fetch('/api/features/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (resp.ok) {
        UI.showNotification('Succès', 'Configurations mises à jour', 'success');
      } else {
        const err = await resp.json();
        UI.showNotification('Erreur', err.message || 'Échec de la sauvegarde', 'error');
      }
    } catch (err) {
      UI.showNotification('Erreur', 'Erreur réseau', 'error');
    } finally {
      UI.hideLoader();
    }
  }

  // Submit Handlers
  forms.whatsapp?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveIntegrations({
      whatsapp_number: inputs.whatsappNumber.value,
      whatsapp_enabled: inputs.whatsappEnabled.checked
    });
  });

  forms.instagram?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveIntegrations({
      instagram_url: inputs.instagramUrl.value,
      instagram_enabled: inputs.instagramEnabled.checked
    });
  });

  forms.facebook?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveIntegrations({
      facebook_url: inputs.facebookUrl.value,
      facebook_enabled: inputs.facebookEnabled.checked
    });
  });

  forms.message?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveIntegrations({
      custom_order_message: inputs.customOrderMessage.value
    });
  });

  // --- PREVIEW MESSAGE ---
  function updatePreview() {
    const previewEl = document.getElementById('messagePreview');
    if (!previewEl) return;
    
    let text = inputs.customOrderMessage.value || 'Bonjour, je souhaite commander {{product_name}} au prix de {{product_price}} {{currency}}.';
    
    // Remplacement factice pour la preview
    text = text.replace('{{product_name}}', '<strong>iPhone 15 Pro</strong>')
               .replace('{{product_price}}', '<strong>850 000</strong>')
               .replace('{{currency}}', '<strong>FCFA</strong>')
               .replace('{{quantity}}', '<strong>1</strong>');
    
    previewEl.innerHTML = `
      <div style="background: #e5ddd5; padding: 12px; border-radius: 8px; font-family: sans-serif; position: relative; max-width: 90%;">
        <div style="background: white; padding: 8px 12px; border-radius: 8px; font-size: 14px; line-height: 1.4; box-shadow: 0 1px 0.5px rgba(0,0,0,0.13);">
          ${text.replace(/\n/g, '<br>')}
          <div style="text-align: right; font-size: 11px; color: #999; margin-top: 4px;">10:45 ✅✅</div>
        </div>
        <div style="position: absolute; left: -8px; top: 0; width: 0; height: 0; border-top: 8px solid white; border-left: 8px solid transparent;"></div>
      </div>
    `;
  }

  inputs.customOrderMessage?.addEventListener('input', updatePreview);

  // --- TEST WHATSAPP ---
  AppUtils.delegate(document, 'click', '[data-action="test-whatsapp"]', async () => {
    const number = inputs.whatsappNumber.value;
    if (!number) {
      UI.showNotification('Erreur', 'Veuillez saisir un numéro d\'abord', 'error');
      return;
    }
    
    UI.showLoader();
    try {
      const resp = await fetch('/api/features/integrations/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp_number: number })
      });
      
      if (resp.ok) {
        const data = await resp.json();
        UI.showNotification('Succès', 'Lien de test généré', 'success');
        if (data.data && data.data.test_url) {
          window.open(data.data.test_url, '_blank');
        }
      } else {
        UI.showNotification('Erreur', 'Échec du test', 'error');
      }
    } catch (err) {
      UI.showNotification('Erreur', 'Erreur réseau', 'error');
    } finally {
      UI.hideLoader();
    }
  });

  initValues();
});
