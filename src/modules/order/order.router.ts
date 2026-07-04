import { Router } from 'express';
import { orderController } from './order.controller';
import { validateAuth } from '../../middlewares/auth';

const router = Router();

// Public order booking (does not require auth)
router.post('/public/book', orderController.bookOrder);
router.get('/public/customer/:phone', orderController.fetchPublicOrdersByCustomerPhone);
router.post('/public/activity', orderController.trackStorefrontActivity);

// All other order routes require auth
router.use(validateAuth);

router.get('/fetch-list', orderController.fetchOrders);
router.get('/fetch-data/:order_id', orderController.fetchOrderById);
router.patch('/update-status', orderController.updateOrderStatus);
router.patch('/update-discount', orderController.updateOrderDiscount);
router.patch('/update-shipping', orderController.updateOrderShipping);
router.get('/export/pdf/:order_id', orderController.exportOrderPdf);
router.post('/export/pdf/email/:order_id', orderController.emailOrderPdf);
router.get('/export/pdf-brochure/:catalogue_id', orderController.exportCatalogueBrochurePdf);

export const orderRouter = router;
