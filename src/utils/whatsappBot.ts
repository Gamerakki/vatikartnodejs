import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { logger } from '../config/logger';
import { usePrismaAuthState } from './whatsappDbAuth';

let sock: WASocket | null = null;
let initializing = false;
let reconnectAttempts = 0;
let pairingRequested = false;

const MAX_RECONNECT = 10;
const PAIRING_PHONE = (process.env.WHATSAPP_BOT_PHONE || '918898109059').replace(/\D/g, '');

export function isWhatsAppBotReady(): boolean {
  return Boolean(sock);
}

export async function initWhatsAppBot(): Promise<void> {
  if (process.env.WHATSAPP_BOT_ENABLED === 'false') {
    logger.info('[WhatsApp Bot] Disabled via WHATSAPP_BOT_ENABLED=false');
    return;
  }

  if (initializing) return;
  initializing = true;

  try {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await usePrismaAuthState();

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: ['VatiKart Bot', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });

    sock.ev.on('creds.update', saveCreds);

    // Prefer pairing code for headless Render (QR still logged as fallback)
    if (!sock.authState.creds.registered && !pairingRequested) {
      pairingRequested = true;
      setTimeout(async () => {
        try {
          if (!sock || sock.authState.creds.registered) return;
          const code = await sock.requestPairingCode(PAIRING_PHONE);
          console.log(`\n👉 WHATSAPP PAIRING CODE FOR ${PAIRING_PHONE}: ${code}\n`);
          logger.info(`[WhatsApp Bot] Pairing code for ${PAIRING_PHONE}: ${code}`);
        } catch (err) {
          console.warn('[WhatsApp Bot] Pairing request error:', err);
          logger.warn('[WhatsApp Bot] Pairing request error', err);
        }
      }, 4000);
    }

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('[WhatsApp Bot] QR available (fallback) — scan with WhatsApp on 8898109059:');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'open') {
        reconnectAttempts = 0;
        pairingRequested = false;
        console.log('[WhatsApp Bot] Connected & active permanently via PostgreSQL Auth!');
        logger.info('[WhatsApp Bot] Connected & active permanently via PostgreSQL Auth');
      } else if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)
          ?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        sock = null;
        logger.warn(`[WhatsApp Bot] Connection closed (code=${statusCode ?? 'unknown'})`);

        if (shouldReconnect && reconnectAttempts < MAX_RECONNECT) {
          reconnectAttempts += 1;
          const delayMs = Math.min(30_000, Math.max(5000, 2000 * reconnectAttempts));
          logger.info(`[WhatsApp Bot] Reconnecting in ${delayMs}ms (attempt ${reconnectAttempts})`);
          setTimeout(() => {
            initializing = false;
            void initWhatsAppBot();
          }, delayMs);
        } else if (statusCode === DisconnectReason.loggedOut) {
          pairingRequested = false;
          logger.error(
            '[WhatsApp Bot] Logged out — clear whatsapp_bot_auth rows or re-pair with code/QR',
          );
          initializing = false;
        } else {
          initializing = false;
        }
      }
    });
  } catch (err) {
    sock = null;
    initializing = false;
    logger.error('[WhatsApp Bot] Failed to initialize', err);
  } finally {
    // Keep initializing=true until connection settles or reconnect schedules reset it
    if (sock) initializing = false;
  }
}

export async function sendDirectWhatsAppOtp(phoneRaw: string, otp: string): Promise<boolean> {
  if (!sock) {
    logger.warn('[WhatsApp Bot] Socket not ready — OTP not sent via WhatsApp');
    return false;
  }

  const cleanPhone = String(phoneRaw || '').replace(/\D/g, '');
  if (cleanPhone.length < 10) return false;

  const jid =
    cleanPhone.length === 10
      ? `91${cleanPhone}@s.whatsapp.net`
      : `${cleanPhone}@s.whatsapp.net`;

  const text =
    `Your VatiKart verification code is: *${otp}*\n\nValid for 10 minutes.`;

  try {
    await sock.sendMessage(jid, { text });
    console.log(`[otp] Direct WhatsApp OTP sent to ${jid} from 8898109059`);
    logger.info(`[otp] Direct WhatsApp OTP sent to ${jid}`);
    return true;
  } catch (err) {
    console.warn('[otp] Baileys sendMessage failed', err);
    logger.warn('[otp] Baileys sendMessage failed', err);
    return false;
  }
}
