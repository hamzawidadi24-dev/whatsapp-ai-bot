// ==========================================
// WhatsApp Bot b Gemini AI (Mجاني وخدام 24/24 f Render)
// ==========================================

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ---------- Config ----------
// Hna 7ot l "System Prompt" - kifach bghiti l bot ywajeb (b darija, français, etc)
const SYSTEM_PROMPT = `Nta bot dyal khedma dyal [سمي شركتك/خدمتك هنا].
Jaweb b darija maghribiya, b tariqa mohtarama o mofida.
Ila chi haja ma3reftihach, gol l client bach yestena rd men chi wa7d mn l ekip.`;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // ghadi ndirouha f Render Environment Variables
const PORT = process.env.PORT || 3000;

// ---------- Gemini Setup ----------
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

async function getAIReply(userMessage) {
  try {
    const result = await model.generateContent(
      `${SYSTEM_PROMPT}\n\nRisala dyal client: "${userMessage}"\n\nJawebek:`
    );
    return result.response.text();
  } catch (err) {
    console.error('Gemini error:', err);
    return 'Sme7 lia, kayn chi mochkil daba. 3awd jarreb men be3d.';
  }
}

// ---------- Express server (bach Render ybqa 3aref l bot 7ay + bach n3ardo l QR) ----------
const app = express();
let latestQR = null;
let botStatus = 'Katbda...';

app.get('/', async (req, res) => {
  if (latestQR) {
    const qrImage = await QRCode.toDataURL(latestQR);
    res.send(`
      <html dir="rtl">
        <body style="text-align:center; font-family:sans-serif; padding:40px;">
          <h2>Scan hada l QR b WhatsApp dyalek</h2>
          <p>WhatsApp > Réglages > Appareils connectés > Connecter un appareil</p>
          <img src="${qrImage}" style="width:300px;" />
          <p>Status: ${botStatus}</p>
        </body>
      </html>
    `);
  } else {
    res.send(`<html dir="rtl"><body style="text-align:center; font-family:sans-serif; padding:40px;"><h2>Status: ${botStatus}</h2></body></html>`);
  }
});

app.listen(PORT, () => console.log(`Server khedam 3la port ${PORT}`));

// ---------- WhatsApp Client ----------
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
    ],
  },
});

client.on('qr', (qr) => {
  console.log('QR jdid, dor l page dyal Render bach tchouf QR code');
  latestQR = qr;
  botStatus = 'Kayntader QR scan';
  qrcode.generate(qr, { small: true }); // ghadi yban ossi f logs
});

client.on('ready', () => {
  console.log('Bot khedam! WhatsApp mrbota.');
  botStatus = 'Khedam ✅';
  latestQR = null;
});

client.on('disconnected', () => {
  botStatus = 'Manqte3 ❌';
});

client.on('message', async (message) => {
  // Ma tjawebch f les groupes (ila bghiti tjaweb f groupes, 7yed had l condition)
  const chat = await message.getChat();
  if (chat.isGroup) return;

  console.log(`Risala jdida men ${message.from}: ${message.body}`);

  const reply = await getAIReply(message.body);
  await chat.sendMessage(reply);
});

client.initialize();
