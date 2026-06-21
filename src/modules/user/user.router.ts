import { Router } from 'express';
import { userController } from './user.controller';
import { validateAuth, validateNoAuth, validateOptionalAuth, requireOwner } from '../../middlewares/auth';

const router = Router();

router.post('/register', validateNoAuth, userController.register);
router.get('/check-email-address', validateOptionalAuth, userController.checkEmailAddress);
router.post('/login', validateNoAuth, userController.login);
router.get('/check-duplicate-username', validateOptionalAuth, userController.checkDuplicateUsername);

// Authenticated routes
router.get('/validate-token', validateAuth, userController.validateToken);
router.post('/push-token', validateAuth, userController.savePushToken);

// Team management (OWNER only for mutations)
router.get('/team', validateAuth, userController.fetchTeam);
router.post('/invite', validateAuth, requireOwner, userController.inviteTeamMember);
router.delete('/team/:userId', validateAuth, requireOwner, userController.removeTeamMember);

export const userRouter = router;
