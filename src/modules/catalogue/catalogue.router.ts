import { Router } from 'express';
import { catalogueController } from './catalogue.controller';
import { validateAuth } from '../../middlewares/auth';

const router = Router();

// All catalogue routes require authentication
router.use(validateAuth);

router.post('/save', catalogueController.saveCatalogue);
router.get('/fetch-list', catalogueController.fetchCatalogues);
router.get('/fetch-data/:catalogue_id', catalogueController.fetchCatalogueData);
router.delete('/delete', catalogueController.deleteCatalogue);

router.get('/fetch-deleted-list', catalogueController.fetchDeletedCatalogues);
router.get('/fetch-deleted-data/:catalogue_id', catalogueController.fetchDeletedCatalogueData);
router.patch('/restore', catalogueController.restoreCatalogue);

export const catalogueRouter = router;
