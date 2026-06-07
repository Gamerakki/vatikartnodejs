import { Router } from 'express';
import { orderController } from './order.controller';
import { validateAuth } from '../../middlewares/auth';

const router = Router();

// Public order booking (does not require auth)
router.post('/public/book', orderController.bookOrder);

// All other order routes require auth
router.use(validateAuth);

router.get('/fetch-list', orderController.fetchOrders);
router.get('/fetch-data/:order_id', orderController.fetchOrderById);
router.patch('/update-status', orderController.updateOrderStatus);
router.patch('/update-discount', orderController.updateOrderDiscount);
router.patch('/update-shipping', orderController.updateOrderShipping);

export const orderRouter = router;
