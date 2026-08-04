import { prisma } from '../../config/database';
import { generateToken, isTokenValid } from '../../config/jwt';
import { logger } from '../../config/logger';

function normalizePhone(phone: string): string {
  return String(phone || '').replace(/\D/g, '').slice(-15);
}

export class OtpService {
  async sendOtp(phoneRaw: string): Promise<{ phone: string; otp: string }> {
    const phone = normalizePhone(phoneRaw);
    if (phone.length < 10) {
      throw new Error('Valid phone number is required');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.otpVerification.deleteMany({ where: { phone } });
    await prisma.otpVerification.create({
      data: { phone, otp, expiresAt },
    });

    logger.info(`[otp] OTP for ${phone}: ${otp} (expires ${expiresAt.toISOString()})`);
    console.log(`[otp] OTP sent to ${phone}: ${otp}`);

    // Optional SMS/WhatsApp hook when configured
    if (process.env.OTP_WEBHOOK_URL) {
      try {
        await fetch(process.env.OTP_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, otp, channel: 'whatsapp_sms' }),
        });
      } catch (err) {
        logger.warn('[otp] webhook send failed', err);
      }
    }

    return { phone, otp };
  }

  async verifyOtp(phoneRaw: string, otpRaw: string): Promise<{ phone: string; sessionToken: string }> {
    const phone = normalizePhone(phoneRaw);
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
      '1', // 1 hour buyer session after OTP verify
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
    const phone = normalizePhone(String(claims.verified_phone));
    if (expectedPhone) {
      const expected = normalizePhone(expectedPhone);
      if (expected && phone !== expected && !phone.endsWith(expected) && !expected.endsWith(phone)) {
        throw new Error('OTP verification required');
      }
    }
    return phone;
  }
}

export const otpService = new OtpService();
