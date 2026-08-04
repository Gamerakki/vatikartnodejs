import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WASocket,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import path from 'path';
import { logger } from '../config/logger';

let sock: WASocket | null = null;
let initializing = false;
let reconnectAttempts = 0;

const AUTH_DIR = process.env.BAILEYS_AUTH_DIR || path.join(process.cwd(), 'baileys_auth_info');
const MAX_RECONNECT = 10;

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
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('[WhatsApp Bot] Scan this QR code in WhatsApp on 8898109059:');
        qrcode.generate(qr, { small: true });
        logger.info('[WhatsApp Bot] QR code generated — scan with WhatsApp Linked Devices');
      }

      if (connection === 'open') {
        reconnectAttempts = 0;
        console.log('[WhatsApp Bot] Connected successfully to WhatsApp!');
        logger.info('[WhatsApp Bot] Connected successfully');
      } else if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)
          ?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        sock = null;
        logger.warn(`[WhatsApp Bot] Connection closed (code=${statusCode ?? 'unknown'})`);

        if (shouldReconnect && reconnectAttempts < MAX_RECONNECT) {
          reconnectAttempts += 1;
          const delayMs = Math.min(30_000, 2000 * reconnectAttempts);
          logger.info(`[WhatsApp Bot] Reconnecting in ${delayMs}ms (attempt ${reconnectAttempts})`);
          setTimeout(() => {
            initializing = false;
            void initWhatsAppBot();
          }, delayMs);
        } else if (statusCode === DisconnectReason.loggedOut) {
          logger.error('[WhatsApp Bot] Logged out — delete baileys_auth_info and restart to re-scan QR');
          initializing = false;
        } else {
          initializing = false;
        }
      }
    });
  } catch (err) {
    sock = null;
    logger.error('[WhatsApp Bot] Failed to initialize', err);
  } finally {
    // Allow future reconnects after the first setup completes (unless reconnect scheduled)
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
