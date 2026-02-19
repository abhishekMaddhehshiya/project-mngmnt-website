/**
 * SECURITY DECISION: Authentication Routes
 * 
 * Public endpoints with rate limiting:
 * - POST /auth/login (strict rate limit for brute force protection)
 * - POST /auth/register (if enabled)
 * 
 * Protected endpoints:
 * - POST /auth/refresh-token (all authenticated users)
 * - POST /auth/logout (all authenticated users)
 * - GET /auth/me (all authenticated users)
 * - PUT /auth/change-password (all authenticated users)
 */

import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { 
  validateLoginInput, 
  handleValidationErrors,
  authRateLimit
} from '../middleware/security.js';
import * as authController from '../controllers/authController.js';

const router = express.Router();

/**
 * SECURITY: Login endpoint with strict rate limiting
 * Prevents credential stuffing and brute force attacks
 */
router.post('/login', authRateLimit, validateLoginInput, handleValidationErrors, authController.login);

/**
 * SECURITY: Refresh token endpoint (all authenticated users)
 */
router.post('/refresh-token', authController.refreshToken);

/**
 * SECURITY: Logout endpoint
 */
router.post('/logout', authenticate, authController.logout);

/**
 * SECURITY: Get current user profile
 */
router.get('/me', authenticate, authController.getCurrentUser);

/**
 * SECURITY: Change password (requires old password)
 */
router.put('/change-password', authenticate, authController.changePassword);

export default router;
