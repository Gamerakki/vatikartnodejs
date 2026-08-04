import { prisma } from '../../config/database';
import { generateToken, isTokenValid } from '../../config/jwt';
import { logger } from '../../config/logger';

const WHATSAPP_SENDER_NUMBER = '918898109059';

function normalizePhone(phone: string): string {
  return String(phone || '').replace(/\D/g, '').slice(-15);
}

async function sendWhatsAppOtp(formattedPhone: string, otp: string): Promise<void> {
  const otpMessage =
    `Your VatiKart verification code is: *${otp}*\n\n` +
    'Valid for 10 minutes. Do not share this code with anyone.';

  const whatsappEndpoint = process.env.WHATSAPP_SENDER_URL || 'http://localhost:3001/send-message';

  try {
    const response = await fetch(whatsappEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderNumber: WHATSAPP_SENDER_NUMBER,
        recipientNumber: formattedPhone,
        message: otpMessage,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`WhatsApp sender HTTP ${response.status}: ${body.slice(0, 200)}`);
    }

    console.log(`[otp] Real WhatsApp message sent to ${formattedPhone} from 8898109059`);
    logger.info(`[otp] WhatsApp OTP dispatched to ${formattedPhone} via ${whatsappEndpoint}`);
  } catch (err) {
    console.warn('[otp] Self-hosted WhatsApp send error', err);
    logger.warn('[otp] Self-hosted WhatsApp send error', err);
  }
}

export class OtpService {
  async sendOtp(phoneRaw: string): Promise<{ phone: string }> {
    const cleanPhone = normalizePhone(phoneRaw);
    if (cleanPhone.length < 10) {
      throw new Error('Valid phone number is required');
    }

    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Store last-10 for lookup consistency with order phone normalization
    const phone = cleanPhone.slice(-10);

    await prisma.otpVerification.deleteMany({ where: { phone } });
    await prisma.otpVerification.create({
      data: { phone, otp, expiresAt },
    });

    // Server-side only log — never returned to clients
    logger.info(`[otp] OTP generated for ${phone} (expires ${expiresAt.toISOString()})`);

    await sendWhatsAppOtp(formattedPhone, otp);

    return { phone };
  }

  async verifyOtp(phoneRaw: string, otpRaw: string): Promise<{ phone: string; sessionToken: string }> {
    const phone = normalizePhone(phoneRaw).slice(-10);
    const otp = String(otpRaw || '').trim();

    if (phone.length < 10 || !/^\d{6}$/.test(otp)) {
      throw new Error('Invalid or expired OTP');
    }

    const row = await prisma.otpVerification.findFirst({
      where: { phone, otp },
      orderBy: { createdAt: 'desc' },
    });

    if (!row || row.expiresAt.getTime() < Date.now()) {
      throw new Error('Invalid or expired OTP');
    }

    // Single-use: delete on successful verify
    await prisma.otpVerification.deleteMany({ where: { phone } });

    const sessionToken = generateToken(
      {
        otp_session: true,
        verified_phone: phone,
      },
      '1',
    );

    return { phone, sessionToken };
  }

  assertVerifiedSession(authHeader: string | undefined, expectedPhone?: string): string {
    if (!authHeader) {
      throw new Error('OTP verification required');
    }
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : authHeader.trim();
    const claims = isTokenValid(token);
    if (!claims?.otp_session || !claims.verified_phone) {
      throw new Error('OTP verification required');
    }
    const phone = normalizePhone(String(claims.verified_phone)).slice(-10);
    if (expectedPhone) {
      const expected = normalizePhone(expectedPhone).slice(-10);
      if (expected && phone !== expected) {
        throw new Error('OTP verification required');
      }
    }
    return phone;
  }
}

export const otpService = new OtpService();
