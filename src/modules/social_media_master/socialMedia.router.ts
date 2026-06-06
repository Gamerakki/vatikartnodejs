import { Router } from 'express';
import { socialMediaController } from './socialMedia.controller';
import { validateAuth } from '../../middlewares/auth';

const router = Router();

// Require auth
router.use(validateAuth);

router.get('/fetch-social-medias', socialMediaController.fetchSocialMediaMaster);
router.get('/fetch-company-social-medias', socialMediaController.fetchCompanySocialMedia);

export const socialMediaRouter = router;
