import { Router } from 'express';
import { productController } from './product.controller';
import { validateAuth } from '../../middlewares/auth';

const router = Router();

// All product routes require authentication
router.use(validateAuth);

router.post('/gen-product-img-upload-url', productController.uploadProductUrlGenerator);
router.post('/create', productController.createProduct);
router.get('/fetch-list/:catalogue_id', productController.fetchProductsByCatalogue);
router.patch('/save-basic-info', productController.saveBasicInfo);
router.patch('/save-variant-options', productController.saveVariantOptions);
router.patch('/save-inventory', productController.saveInventory);

router.get('/fetch-basic-info/:product_id', productController.fetchBasicInfo);
router.get('/fetch-inventory/:product_id', productController.fetchInventory);

router.get('/inventory/list', productController.fetchInventoryList);
router.get('/inventory/stats', productController.fetchInventoryStats);
router.patch('/inventory/restock', productController.restockInventory);

export const productRouter = router;
