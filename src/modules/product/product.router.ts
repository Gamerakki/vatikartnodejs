import { Router } from 'express';
import { productController } from './product.controller';
import { validateAuth, requireOwner } from '../../middlewares/auth';

import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// All product routes require authentication
router.use(validateAuth);

router.post('/bulk-import/:catalogue_id', requireOwner, upload.single('file'), productController.bulkImportProducts);
router.post('/gen-product-img-upload-url', productController.uploadProductUrlGenerator);
router.post('/create', requireOwner, productController.createProduct);
router.get('/fetch-all', productController.fetchAllProducts);
router.get('/fetch-list/:catalogue_id', productController.fetchProductsByCatalogue);
router.patch('/save-basic-info', requireOwner, productController.saveBasicInfo);
router.patch('/save-variant-options', requireOwner, productController.saveVariantOptions);
router.patch('/save-inventory', requireOwner, productController.saveInventory);


router.get('/fetch-basic-info/:product_id', productController.fetchBasicInfo);
router.get('/fetch-inventory/:product_id', productController.fetchInventory);

router.get('/inventory/list', productController.fetchInventoryList);
router.get('/inventory/stats', productController.fetchInventoryStats);
router.patch('/inventory/restock', requireOwner, productController.restockInventory);
router.delete('/delete', requireOwner, productController.deleteProduct);

export const productRouter = router;
