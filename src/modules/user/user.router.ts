import { Router } from 'express';
import { userController } from './user.controller';
import { validateAuth, validateNoAuth, validateOptionalAuth } from '../../middlewares/auth';

const router = Router();

router.post('/register', validateNoAuth, userController.register);
router.get('/check-email-address', validateOptionalAuth, userController.checkEmailAddress);
router.post('/login', validateNoAuth, userController.login);
router.get('/check-duplicate-username', validateOptionalAuth, userController.checkDuplicateUsername);

// Authenticated route
router.get('/validate-token', validateAuth, userController.validateToken);
router.post('/push-token', validateAuth, userController.savePushToken);

export const userRouter = router;
