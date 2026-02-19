/**
 * SECURITY DECISION: Project Management Routes
 * 
 * Role-based access:
 * - Admin: Full CRUD on all projects
 * - Project Lead: CRUD on own projects, assign developers
 * - Developer: Read-only (see assigned projects)
 */

import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateProjectInput, handleValidationErrors } from '../middleware/security.js';
import * as projectController from '../controllers/projectController.js';

const router = express.Router();

/**
 * SECURITY: All project routes require authentication
 */
router.use(authenticate);

/**
 * SECURITY: List projects (visible based on role)
 * - Admin: all projects
 * - Project Lead: own projects
 * - Developer: assigned projects
 */
router.get('/', projectController.listProjects);

/**
 * SECURITY: Get project details (with access control)
 */
router.get('/:id', projectController.getProject);

/**
 * SECURITY: Create project (admin and project-lead only)
 */
router.post(
  '/',
  authorize('admin', 'project-lead'),
  validateProjectInput,
  handleValidationErrors,
  projectController.createProject
);

/**
 * SECURITY: Update project (admin and project-lead only)
 */
router.put(
  '/:id',
  authorize('admin', 'project-lead'),
  projectController.updateProject
);

/**
 * SECURITY: Delete project (admin only)
 */
router.delete('/:id', authorize('admin'), projectController.deleteProject);

export default router;
