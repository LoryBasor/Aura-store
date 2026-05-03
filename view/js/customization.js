/**
 * customization.js
 * Gère la prévisualisation en direct et la sauvegarde des personnalisations.
 */

document.addEventListener('DOMContentLoaded', () => {
  const initData = window.__SSR_CUSTOMIZATION__ || {};

  // Formulaires
  const headerForm = document.getElementById('headerForm');
  const layoutForm = document.getElementById('layoutForm');
  const colorsForm = document.getElementById('colorsForm');
  const optionsForm = document.getElementById('optionsForm');

  // Éléments d'entrée
  const inputs = {
    store_title: document.getElementById('storeTitle'),
    store_description: document.getElementById('storeDescription'),
    order_message: document.getElementById('orderMessage'),
    font_family: document.getElementById('fontFamily'),
    button_style: document.getElementById('buttonStyle'),
    primary_color: document.getElementById('primaryColor'),
    secondary_color: document.getElementById('secondaryColor'),
    background_color: document.getElementById('backgroundColor'),
    title_color: document.getElementById('titleColor'),
    description_color: document.getElementById('descriptionColor'),
    text_color: document.getElementById('textColor'),
    footer_text: document.getElementById('footerText'),
    show_product_count: document.getElementById('showProductCount'),
    show_social_links: document.getElementById('showSocialLinks')
  };

  // Éléments de prévisualisation
  const preview = {
    box: document.getElementById('livePreviewBox'),
    banner: document.getElementById('previewBanner'),
    title: document.getElementById('previewTitle'),
    desc: document.getElementById('previewDesc'),
    count: document.getElementById('previewCount'),
    layout: document.getElementById('previewLayout'),
    orderMsg: document.getElementById('previewOrderMsg'),
    socials: document.getElementById('previewSocials'),
    footerText: document.getElementById('previewFooterText')
  };

  // --- LIVE PREVIEW LOGIC ---

  function updateLivePreview() {
    if (!preview.box) return;

    // 1. Couleurs
    preview.box.style.backgroundColor = inputs.background_color.value;
    preview.banner.style.backgroundColor = inputs.primary_color.value;
    preview.title.style.color = inputs.title_color.value;
    preview.desc.style.color = inputs.description_color.value;

    // 2. Textes
    preview.title.textContent = inputs.store_title.value || 'Ma Boutique';
    preview.desc.textContent = inputs.store_description.value || 'Bienvenue dans notre boutique en ligne.';
    preview.orderMsg.textContent = inputs.order_message.value;
    preview.orderMsg.style.color = inputs.primary_color.value;
    preview.footerText.textContent = inputs.footer_text.value || '© 2026 Boutique';

    // 3. Typographie
    preview.box.style.fontFamily = inputs.font_family.value.includes('Playfair')
      ? '"Playfair Display", serif'
      : inputs.font_family.value.includes('Courier')
        ? '"Courier New", monospace'
        : `${inputs.font_family.value}, sans-serif`;

    // 4. Layout
    const layoutRadio = document.querySelector('input[name="product_layout"]:checked');
    const isList = layoutRadio && layoutRadio.value === 'list';
    preview.layout.style.gridTemplateColumns = isList ? '1fr' : '1fr 1fr';

    const cards = preview.layout.querySelectorAll('div > div:first-child');
    cards.forEach(imgBox => {
      if (isList) {
        imgBox.style.width = '100px';
        imgBox.style.height = '100px';
        imgBox.parentElement.style.display = 'flex';
      } else {
        imgBox.style.width = '100%';
        imgBox.style.height = '120px';
        imgBox.parentElement.style.display = 'block';
      }
    });

    const textElements = preview.layout.querySelectorAll('div > div:nth-child(2) > div:first-child');
    textElements.forEach(t => t.style.color = inputs.text_color.value);

    const priceElements = preview.layout.querySelectorAll('div > div:nth-child(2) > div:nth-child(2)');
    priceElements.forEach(p => p.style.color = inputs.secondary_color.value);

    // Boutons
    const btns = preview.layout.querySelectorAll('.preview-btn');
    const bStyle = inputs.button_style.value;
    const pColor = inputs.primary_color.value;

    btns.forEach(btn => {
      btn.style.borderRadius = (bStyle === 'rounded') ? '9999px' : '4px';
      if (bStyle === 'outline') {
        btn.style.background = 'transparent';
        btn.style.color = pColor;
        btn.style.border = `1px solid ${pColor}`;
      } else {
        btn.style.background = pColor;
        btn.style.color = 'white';
        btn.style.border = 'none';
      }
    });

    // 5. Options
    preview.count.style.display = inputs.show_product_count.checked ? 'block' : 'none';
    preview.socials.style.display = inputs.show_social_links.checked ? 'flex' : 'none';
  }

  // Écouter tous les changements
  Object.values(inputs).forEach(input => {
    if (input) {
      input.addEventListener('input', updateLivePreview);
      input.addEventListener('change', updateLivePreview);
    }
  });

  const layoutRadios = document.querySelectorAll('input[name="product_layout"]');
  layoutRadios.forEach(r => r.addEventListener('change', updateLivePreview));

  // --- SAVE LOGIC (API) ---

  async function saveSettings(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Enregistrement...';
    btn.disabled = true;

    const data = {
      store_title: inputs.store_title.value,
      store_description: inputs.store_description.value,
      order_message: inputs.order_message.value,
      font_family: inputs.font_family.value,
      product_layout: document.querySelector('input[name="product_layout"]:checked').value,
      button_style: inputs.button_style.value,
      primary_color: inputs.primary_color.value,
      secondary_color: inputs.secondary_color.value,
      background_color: inputs.background_color.value,
      title_color: inputs.title_color.value,
      description_color: inputs.description_color.value,
      text_color: inputs.text_color.value,
      footer_text: inputs.footer_text.value,
      show_product_count: inputs.show_product_count.checked,
      show_social_links: inputs.show_social_links.checked
    };

    try {
      const response = await fetch('/api/features/customization', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const resData = await response.json();
      if (response.ok) {
        UI.showNotification('Succès', 'Personnalisation sauvegardée avec succès !', 'success');
      } else {
        UI.showNotification('Erreur', resData.message || 'Impossible de sauvegarder.', 'error');
      }
    } catch (err) {
      console.error(err);
      UI.showNotification('Erreur réseau', 'Impossible de contacter le serveur.', 'error');
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }

  if (headerForm) headerForm.addEventListener('submit', saveSettings);
  if (layoutForm) layoutForm.addEventListener('submit', saveSettings);
  if (colorsForm) colorsForm.addEventListener('submit', saveSettings);
  if (optionsForm) optionsForm.addEventListener('submit', saveSettings);

  // --- MEDIA UPLOAD ---
  async function uploadMedia(file, type) {
    const formData = new FormData();
    formData.append(type, file);

    try {
      const response = await fetch(`/api/features/customization/${type}`, {
        method: 'POST',
        body: formData
      });
      if (response.ok) {
        UI.showNotification('Succès', `${type === 'logo' ? 'Logo' : 'Bannière'} uploadé(e) avec succès !`, 'success');
        setTimeout(() => window.location.reload(), 1000);
      } else {
        UI.showNotification('Erreur', `Échec de l'envoi du ${type === 'logo' ? 'logo' : 'de la bannière'}.`, 'error');
      }
    } catch (err) {
      UI.showNotification('Erreur réseau', 'Impossible de contacter le serveur.', 'error');
    }
  }

  const logoUpload = document.getElementById('logoUpload');
  if (logoUpload) {
    logoUpload.addEventListener('change', (e) => {
      if (e.target.files[0]) uploadMedia(e.target.files[0], 'logo');
    });
  }

  const bannerUpload = document.getElementById('bannerUpload');
  if (bannerUpload) {
    bannerUpload.addEventListener('change', (e) => {
      if (e.target.files[0]) uploadMedia(e.target.files[0], 'banner');
    });
  }

  // Suppression Médias
  const deleteLogoBtn = document.querySelector('[data-action="delete-logo"]');
  if (deleteLogoBtn) {
    deleteLogoBtn.addEventListener('click', async () => {
      if (confirm('Supprimer le logo ?')) {
        const resp = await fetch('/api/features/customization/logo', { method: 'DELETE' });
        if (resp.ok) {
          UI.showNotification('Logo supprimé', 'Le logo a été retiré.', 'info');
          setTimeout(() => window.location.reload(), 800);
        } else {
          UI.showNotification('Erreur', 'Impossible de supprimer le logo.', 'error');
        }
      }
    });
  }

  const deleteBannerBtn = document.querySelector('[data-action="delete-banner"]');
  if (deleteBannerBtn) {
    deleteBannerBtn.addEventListener('click', async () => {
      if (confirm('Supprimer la bannière ?')) {
        const resp = await fetch('/api/features/customization/banner', { method: 'DELETE' });
        if (resp.ok) {
          UI.showNotification('Bannière supprimée', 'La bannière a été retirée.', 'info');
          setTimeout(() => window.location.reload(), 800);
        } else {
          UI.showNotification('Erreur', 'Impossible de supprimer la bannière.', 'error');
        }
      }
    });
  }

  // Réinitialiser tout
  const resetBtn = document.querySelector('[data-action="reset-customization"]');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('Êtes-vous sûr de vouloir réinitialiser TOUS les réglages par défaut ?')) {
        const resp = await fetch('/api/features/customization/reset', { method: 'POST' });
        if (resp.ok) {
          UI.showNotification('Réinitialisé', 'Tous les réglages ont été remis par défaut.', 'success');
          setTimeout(() => window.location.reload(), 1000);
        } else {
          UI.showNotification('Erreur', 'La réinitialisation a échoué.', 'error');
        }
      }
    });
  }

  // Initial preview sync
  updateLivePreview();
});
