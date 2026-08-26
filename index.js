// ==========================================
// WhatsApp Bot b Gemini AI - b Baileys (khafif, bla Chrome/Puppeteer)
// ==========================================

const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
} = require('@whiskeysockets/baileys');
const P = require('pino');
const express = require('express');
const QRCode = require('qrcode');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ---------- Config ----------
// Hna 7ot l "System Prompt" - kifach bghiti l bot ywajeb (b darija, français, etc)
const SYSTEM_PROMPT = `Nta bot dyal khedma dyal [سمي شركتك/خدمتك هنا].
Jaweb b darija maghribiya, b tariqa mohtarama o mofida.
Ila chi haja ma3reftihach, gol l client bach yestena rd men chi wa7d mn l ekip.`;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
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

// ---------- Express server (bach n3ardo l QR) ----------
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

// ---------- WhatsApp Connection (Baileys) ----------
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: P({ level: 'silent' }),
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQR = qr;
      botStatus = 'Kayntader QR scan';
      console.log('QR jdid, dor l page dyal Render bach tchouf QR code');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      botStatus = 'Manqte3, kaya3awed...';
      console.log('Connection closed, reconnecting:', shouldReconnect);
      if (shouldReconnect) connectToWhatsApp();
    } else if (connection === 'open') {
      console.log('Bot khedam! WhatsApp mrbota.');
      botStatus = 'Khedam ✅';
      latestQR = null;
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    // Ma tjawebch f les groupes (ila bghiti tjaweb f groupes, 7yed had l condition)
    if (msg.key.remoteJid?.endsWith('@g.us')) return;

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      '';

    if (!text) return;

    console.log(`Risala jdida men ${msg.key.remoteJid}: ${text}`);

    const reply = await getAIReply(text);
    await sock.sendMessage(msg.key.remoteJid, { text: reply });
  });
}

connectToWhatsApp();
