require('dotenv').config();
const { sendEmail } = require('./src/services/emailService');

async function testEmail() {
  console.log('Testing email system...');
  console.log('SMTP_HOST:', process.env.SMTP_HOST || 'smtp-relay.brevo.com (default)');
  console.log('SMTP_USER:', process.env.SMTP_USER || 'Not set');
  console.log('SMTP_PORT:', process.env.SMTP_PORT || '587 (default)');

  const targetEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER || 'bryantzoua4@gmail.com';
  console.log('Sending test email to:', targetEmail);

  try {
    const result = await sendEmail({ 
      to: targetEmail,
      subject: 'Test Email — Aura Store',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f8f9fa; border-radius: 12px;">
          <h2 style="color: #5C6C73;">✅ Test du système d'email</h2>
          <p>Ceci est un email de test généré par le script <strong>test-email.js</strong>.</p>
          <p>Si vous recevez ce message, la configuration SMTP de la plateforme Aura Store fonctionne correctement.</p>
        </div>
      `,
      text: 'Test du système d\'email. Si vous recevez ce message, la configuration SMTP fonctionne.'
    });

    if (result) {
      console.log('✅ Email envoyé avec succès !');
    } else {
      console.log('❌ L\'envoi de l\'email a échoué. Vérifiez la configuration SMTP dans le fichier .env');
    }
  } catch (error) {
    console.error('Erreur lors du test:', error);
  }
}

testEmail();
