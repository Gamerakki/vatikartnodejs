import { Request, Response } from 'express';
import { otpService } from './otp.service';

export class OtpController {
  async send(req: Request, res: Response): Promise<void> {
    try {
      const phone = String(req.body?.phone || '');
      const result = await otpService.sendOtp(phone);
      res.status(200).json({
        status: true,
        msg: 'OTP sent successfully',
        phone: result.phone,
      });
    } catch (err) {
      res.status(400).json({
        status: false,
        msg: (err as Error).message || 'Failed to send OTP',
      });
    }
  }

  async verify(req: Request, res: Response): Promise<void> {
    try {
      const phone = String(req.body?.phone || '');
      const otp = String(req.body?.otp || '');
      const result = await otpService.verifyOtp(phone, otp);
      res.status(200).json({
        status: true,
        msg: 'OTP verified successfully',
        verified_phone: result.phone,
        session_token: result.sessionToken,
      });
    } catch (err) {
      res.status(400).json({
        status: false,
        msg: 'Invalid or expired OTP',
      });
    }
  }
}

export const otpController = new OtpController();
