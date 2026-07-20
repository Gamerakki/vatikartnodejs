import { Router } from 'express';
import multer from 'multer';
import { companyController } from './company.controller';
import { validateAuth, requireOwner } from '../../middlewares/auth';
import { companyCustomerGroupRouter } from './companyCustomerGroup.router';
import { whatsappTemplateController } from '../whatsapp-template/whatsappTemplate.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Public route to resolve subdomain
router.get('/resolve-subdomain/:subdomain', companyController.resolveSubdomain);
router.post('/business-enquiry', companyController.createBusinessEnquiry);

// All company routes require auth
router.use(validateAuth);

router.use('/customer-groups', companyCustomerGroupRouter);

router.get('/whatsapp-share-template', whatsappTemplateController.fetchProductShareTemplate.bind(whatsappTemplateController));
router.post('/whatsapp-share-template', requireOwner, whatsappTemplateController.saveProductShareTemplate.bind(whatsappTemplateController));

// Note: multipart form handles logo upload
router.post('/save', requireOwner, upload.single('logo_img_path'), companyController.saveCompany);
router.post('/save-social-media', requireOwner, companyController.saveSocialMedia);
router.get('/fetch-data', companyController.fetchCompanyData);

router.patch('/save-support-contact-details', requireOwner, companyController.saveCompanySupportContactDetails);
router.get('/fetch-support-contact-details', companyController.fetchCompanySupportContactDetails);

router.patch('/save-sales-contact-details', requireOwner, companyController.saveCompanySalesContactDetails);
router.get('/fetch-sales-contact-details', companyController.fetchCompanySalesContactDetails);
router.patch('/watermark', requireOwner, companyController.updateWatermark);
router.patch('/download-options', requireOwner, companyController.updateDownloadOptions);
router.get('/policies', companyController.fetchCompanyPolicies);
router.patch('/policies', requireOwner, companyController.updateCompanyPolicies);

export const companyRouter = router;
