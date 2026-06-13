import { Router } from 'express';
import multer from 'multer';
import { companyController } from './company.controller';
import { validateAuth } from '../../middlewares/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Public route to resolve subdomain
router.get('/resolve-subdomain/:subdomain', companyController.resolveSubdomain);

// All company routes require auth
router.use(validateAuth);

// Note: multipart form handles logo upload
router.post('/save', upload.single('logo_img_path'), companyController.saveCompany);
router.post('/save-social-media', companyController.saveSocialMedia);
router.get('/fetch-data', companyController.fetchCompanyData);

router.patch('/save-support-contact-details', companyController.saveCompanySupportContactDetails);
router.get('/fetch-support-contact-details', companyController.fetchCompanySupportContactDetails);

router.patch('/save-sales-contact-details', companyController.saveCompanySalesContactDetails);
router.get('/fetch-sales-contact-details', companyController.fetchCompanySalesContactDetails);
router.patch('/watermark', companyController.updateWatermark);

export const companyRouter = router;
