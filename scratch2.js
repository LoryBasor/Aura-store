const axios = require('axios');

async function testApi() {
    try {
        // First we need to login to get a cookie, or we can just mock the request since I can't easily get the auth cookie.
        // I will just mock the express req/res.
        
        const whatsappController = require('./src/controllers/whatsapp/whatsappController');
        
        const req = { user: { id: 1 } };
        const res = {
            status: function(code) { this.statusCode = code; return this; },
            json: function(data) { console.log('RESPONSE:', JSON.stringify(data, null, 2)); return this; }
        };
        const next = (err) => console.error('NEXT ERROR:', err);
        
        console.log('Calling generateQR...');
        await whatsappController.generateQR(req, res, next);
        console.log('generateQR finished.');
        
    } catch (e) {
        console.error('Error:', e);
    }
}
testApi();
