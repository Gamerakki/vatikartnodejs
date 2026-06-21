import { Router } from 'express';
import { validateAuth, requireOwner } from '../../middlewares/auth';
import { whatsappTemplateController } from './whatsappTemplate.controller';

const router = Router();

router.post('/compile', whatsappTemplateController.compile);

router.use(validateAuth);
router.get('/settings', whatsappTemplateController.fetchSettings);
router.put('/settings', requireOwner, whatsappTemplateController.saveSettings);

export const whatsappTemplateRouter = router;
