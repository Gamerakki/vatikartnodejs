import { prisma } from '../../config/database';
import { generateToken, isTokenValid } from '../../config/jwt';
import { logger } from '../../config/logger';
import { sendDirectWhatsAppOtp } from '../../utils/whatsappBot';

function normalizePhone(phone: string): string {
  return String(phone || '').replace(/\D/g, '').slice(-15);
}

export class OtpService {
  async sendOtp(phoneRaw: string): Promise<{ phone: string }> {
    const cleanPhone = normalizePhone(phoneRaw);
    if (cleanPhone.length < 10) {
      throw new Error('Valid phone number is required');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const phone = cleanPhone.slice(-10);

    await prisma.otpVerification.deleteMany({ where: { phone } });
    await prisma.otpVerification.create({
      data: { phone, otp, expiresAt },
    });

    logger.info(`[otp] OTP generated for ${phone} (expires ${expiresAt.toISOString()})`);

    const sent = await sendDirectWhatsAppOtp(phone, otp);
    if (!sent) {
      logger.warn(`[otp] WhatsApp delivery failed for ${phone} — bot may be offline / QR not scanned`);
    }

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
