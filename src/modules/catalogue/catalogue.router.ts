import { Router } from 'express';
import { catalogueController } from './catalogue.controller';
import { validateAuth } from '../../middlewares/auth';

const router = Router();

// Public catalogue routes
router.get('/public/:catalogue_id/products', catalogueController.fetchPublicCatalogueProducts);
router.post('/public/:catalogue_id/request-access', catalogueController.createAccessRequest);

// All other catalogue routes require authentication
router.use(validateAuth);

router.post('/save', catalogueController.saveCatalogue);
router.get('/fetch-list', catalogueController.fetchCatalogues);
router.get('/fetch-data/:catalogue_id', catalogueController.fetchCatalogueData);
router.delete('/delete', catalogueController.deleteCatalogue);
router.patch('/privacy/:catalogue_id', catalogueController.updateCataloguePrivacy);

router.get('/access-requests', catalogueController.fetchAccessRequests);
router.patch('/access-request/:access_id', catalogueController.updateAccessRequest);

router.get('/fetch-deleted-list', catalogueController.fetchDeletedCatalogues);
router.get('/fetch-deleted-data/:catalogue_id', catalogueController.fetchDeletedCatalogueData);
router.patch('/restore', catalogueController.restoreCatalogue);

export const catalogueRouter = router;
