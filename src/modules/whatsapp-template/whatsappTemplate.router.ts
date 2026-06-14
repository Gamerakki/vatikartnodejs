import { Router } from 'express';
import { validateAuth } from '../../middlewares/auth';
import { whatsappTemplateController } from './whatsappTemplate.controller';

const router = Router();

router.post('/compile', whatsappTemplateController.compile);

router.use(validateAuth);
router.get('/settings', whatsappTemplateController.fetchSettings);
router.put('/settings', whatsappTemplateController.saveSettings);

export const whatsappTemplateRouter = router;
