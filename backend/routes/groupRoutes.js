const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const authenticateToken = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

router.post('/create', groupController.createGroup);
router.get('/my', groupController.getMyGroups);
router.get('/public', groupController.getAllPublicGroups);
router.post('/join', groupController.joinGroup);
router.post('/add-member', groupController.addMember);

// Individual group routes - be careful with ordering
router.get('/:groupId/messages', groupController.getGroupMessages);
router.get('/:groupId/members', groupController.getGroupMembers);
router.put('/:groupId', groupController.updateGroup);

router.post('/messages', groupController.sendGroupMessage);

module.exports = router;
