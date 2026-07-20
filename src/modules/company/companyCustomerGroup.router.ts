import { Router } from 'express';
import { requireOwner } from '../../middlewares/auth';
import { customerGroupController } from '../customer-group/customerGroup.controller';

const router = Router();

router.get('/', customerGroupController.fetchGroups.bind(customerGroupController));
router.post('/', requireOwner, customerGroupController.createGroup.bind(customerGroupController));
router.put('/:id', requireOwner, customerGroupController.updateGroup.bind(customerGroupController));
router.delete('/:id', requireOwner, customerGroupController.deleteGroupByParam.bind(customerGroupController));
router.post('/:id/prices', requireOwner, customerGroupController.saveGroupPricesByParam.bind(customerGroupController));
router.post('/:id/assign', requireOwner, customerGroupController.assignCustomersByParam.bind(customerGroupController));

export const companyCustomerGroupRouter = router;
