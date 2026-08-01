const WhatsAppSessionManager = require('./src/services/whatsapp/WhatsAppSessionManager');
const db = require('./src/config/database');

async function test() {
    const sessionManager = WhatsAppSessionManager.getInstance();
    
    try {
        await sessionManager.createSession(1, 
            (qr) => console.log('QR CODE:', qr),
            () => console.log('Connected'),
            () => console.log('Disconnected'),
            true
        );
        console.log('Session initialized.');
    } catch (e) {
        console.error('Error in createSession:', e);
    }
}
test();
