import { Router } from 'express';
import { otpController } from './otp.controller';

const router = Router();

router.post('/send', otpController.send);
router.post('/verify', otpController.verify);

export const otpRouter = router;
