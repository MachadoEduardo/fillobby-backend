import { Router } from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import * as controller from './groups.controller.js';
import { 
    createGroupSchema, 
    listGroupsSchema, 
    groupParamSchema, 
    updateGroupSchema, 
    joinGroupSchema, 
    listMembersSchema, 
    memberParamSchema, 
    roleSchema, 
    transferSchema 
} from './groups.validation.js';

const router = Router();
router.use(authMiddleware);
router.post('/', validate(createGroupSchema), controller.create);
router.get('/', validate(listGroupsSchema), controller.list);
router.post('/join', validate(joinGroupSchema), controller.join);
router.post('/:groupId/leave', validate(groupParamSchema), controller.leave);
router.get('/:groupId', validate(groupParamSchema), controller.detail);
router.patch('/:groupId', validate(updateGroupSchema), controller.update);
router.delete('/:groupId', validate(groupParamSchema), controller.remove);
router.get('/:groupId/members', validate(listMembersSchema), controller.members);
router.patch('/:groupId/members/:userId/role', validate(roleSchema), controller.changeRole);
router.delete('/:groupId/members/:userId', validate(memberParamSchema), controller.removeMember);
router.post('/:groupId/members/:userId/restore', validate(memberParamSchema), controller.restoreMember);
router.post('/:groupId/transfer-owner', validate(transferSchema), controller.transferOwner);
router.post('/:groupId/regenerate-invite', validate(groupParamSchema), controller.regenerateInvite);

export default router;
