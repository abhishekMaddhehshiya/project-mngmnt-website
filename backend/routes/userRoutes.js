/**
 * SECURITY DECISION: User Management Routes
 * 
 * Admin-only endpoints:
 * - GET /users (list all users)
 * - POST /users (create user)
 * - GET /users/:id (get user details)
 * - PUT /users/:id (update user)
 * - DELETE /users/:id (delete user)
 * - PATCH /users/:id/deactivate (deactivate user)
 * - POST /users/:id/reset-password (reset password)
 */

import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateUserInput, handleValidationErrors } from '../middleware/security.js';
import * as userController from '../controllers/userController.js';

const router = express.Router();

/**
 * SECURITY: All user routes require authentication
 * Only admins can access these endpoints
 */
router.use(authenticate, authorize('admin'));

/**
 * SECURITY: List users with optional role filtering
 */
router.get('/', userController.listUsers);

/**
 * SECURITY: Get specific user
 */
router.get('/:id', userController.getUser);

/**
 * SECURITY: Create new user (no self-registration)
 */
router.post('/', validateUserInput, handleValidationErrors, userController.createUser);

/**
 * SECURITY: Update user information
 */
router.put('/:id', userController.updateUser);

/**
 * SECURITY: Delete user account
 */
router.delete('/:id', userController.deleteUser);

/**
 * SECURITY: Deactivate user (soft delete)
 */
router.patch('/:id/deactivate', userController.deactivateUser);

/**
 * SECURITY: Reset user password
 */
router.post('/:id/reset-password', userController.resetUserPassword);

export default router;
