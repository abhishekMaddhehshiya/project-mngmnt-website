/**
 * SECURITY DECISION: Message Routes
 * 
 * Role-based access:
 * - All authenticated: View messages in their accessible projects
 * - Developer: Send messages and request completion
 * - Admin/Project Lead: Review completion requests
 */

import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import * as messageController from '../controllers/messageController.js';

const router = express.Router();

/**
 * SECURITY: All message routes require authentication
 */
router.use(authenticate);

/**
 * SECURITY: Get messages for a specific project
 * Access controlled by project membership
 */
router.get('/project/:projectId', messageController.getProjectMessages);

/**
 * SECURITY: Send a message to a project
 * Access controlled by project membership
 */
router.post('/project/:projectId', messageController.sendMessage);

/**
 * SECURITY: Get pending completion requests (Admin/Project Lead only)
 */
router.get(
  '/completion-requests',
  authorize('admin', 'project-lead'),
  messageController.getPendingCompletionRequests
);

/**
 * SECURITY: Review a completion request (Admin/Project Lead only)
 */
router.post(
  '/:messageId/review',
  authorize('admin', 'project-lead'),
  messageController.reviewCompletionRequest
);

export default router;
