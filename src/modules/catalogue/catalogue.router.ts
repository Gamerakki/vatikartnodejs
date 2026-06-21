import { Router } from 'express';
import { catalogueController } from './catalogue.controller';
import { validateAuth, requireOwner } from '../../middlewares/auth';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

// Public catalogue routes
router.get('/public/:catalogue_id/products', catalogueController.fetchPublicCatalogueProducts);
router.post('/public/:catalogue_id/request-access', catalogueController.createAccessRequest);
router.get('/public/:catalogueId/export/pdf', catalogueController.exportCataloguePdf);
router.get('/public/:catalogueId/export/excel', catalogueController.exportCatalogueExcel);

// All other catalogue routes require authentication
router.use(validateAuth);

router.post('/save', requireOwner, catalogueController.saveCatalogue);
router.post('/clone/:catalogue_id', catalogueController.cloneCatalogue);
router.get('/fetch-list', catalogueController.fetchCatalogues);
router.get('/fetch-data/:catalogue_id', catalogueController.fetchCatalogueData);
router.delete('/delete', requireOwner, catalogueController.deleteCatalogue);
router.patch('/privacy/:catalogue_id', requireOwner, catalogueController.updateCataloguePrivacy);

router.get('/access-requests', catalogueController.fetchAccessRequests);
router.patch('/access-request/:access_id', catalogueController.updateAccessRequest);
router.patch('/access-request/approve-all/:catalogueId', catalogueController.approveAllAccessRequests);

router.get('/fetch-deleted-list', catalogueController.fetchDeletedCatalogues);
router.get('/fetch-deleted-data/:catalogue_id', catalogueController.fetchDeletedCatalogueData);
router.patch('/restore', requireOwner, catalogueController.restoreCatalogue);
router.put('/:catalogueId/banner', requireOwner, upload.single('banner_image'), catalogueController.updateCatalogueBanner);

export const catalogueRouter = router;
