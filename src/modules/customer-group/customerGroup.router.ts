import { Router } from 'express';
import { validateAuth } from '../../middlewares/auth';
import { customerGroupController } from './customerGroup.controller';

const router = Router();

router.use(validateAuth);

router.get('/list', customerGroupController.fetchGroups);
router.post('/save', customerGroupController.saveGroup);
router.delete('/:group_id', customerGroupController.deleteGroup);

router.get('/:group_id/members', customerGroupController.fetchGroupMembers);
router.post('/member', customerGroupController.addGroupMember);
router.delete('/member/:member_id', customerGroupController.deleteGroupMember);

router.get('/:group_id/pricing', customerGroupController.fetchGroupPricing);
router.put('/pricing', customerGroupController.saveGroupPricing);

export const customerGroupRouter = router;
