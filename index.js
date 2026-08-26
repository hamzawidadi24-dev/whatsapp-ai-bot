const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { GoogleGenAI } = require('@google/genai');
const pino = require('pino');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Server', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) console.log('Scan QR Code from logs:', qr);
        if (connection === 'close') {
            const reconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (reconnect) startBot();
        } else if (connection === 'open') {
            console.log('🤖 البوت شغال الآن على السيرفر المجاني!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const m of messages) {
            if (!m.message || m.key.fromMe) continue;
            const text = m.message.conversation || m.message.extendedTextMessage?.text;
            const sender = m.key.remoteJid;
            if (text) {
                try {
                    const response = await ai.models.generateContent({
                        model: 'gemini-1.5-flash',
                        contents: text,
                        config: { systemInstruction: "أنت مساعد ذكي لخدمة الزبناء. أجب باختصار باللغة العربية." }
                    });
                    await sock.sendMessage(sender, { text: response.text });
                } catch (err) {
                    console.error("Error:", err.message);
                }
            }
        }
    });
}
startBot();
