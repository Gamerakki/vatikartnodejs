import { Router } from 'express';
import { validateAuth, requireOwner } from '../../middlewares/auth';
import { customerGroupController } from './customerGroup.controller';

const router = Router();

router.use(validateAuth);

router.get('/list', customerGroupController.fetchGroups);
router.post('/save', requireOwner, customerGroupController.saveGroup);
router.delete('/:group_id', requireOwner, customerGroupController.deleteGroup);

router.get('/:group_id/members', customerGroupController.fetchGroupMembers);
router.post('/member', requireOwner, customerGroupController.addGroupMember);
router.delete('/member/:member_id', requireOwner, customerGroupController.deleteGroupMember);

router.get('/:group_id/pricing', customerGroupController.fetchGroupPricing);
router.put('/pricing', requireOwner, customerGroupController.saveGroupPricing);

export const customerGroupRouter = router;
