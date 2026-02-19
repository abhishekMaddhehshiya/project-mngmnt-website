import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import * as userController from '../controllers/userController.js';

const router = express.Router();

/**
 * Route for project leads to get assignable developers
 * (developers only) they can add to their projects
 */
router.get('/assignable', authenticate, authorize('admin', 'project-lead'), async (req, res) => {
  try {
    const User = (await import('../models/User.js')).default;
    const users = await User.find({ role: 'developer', isActive: true }).select('-password -mfaSecret');

    res.status(200).json({
      success: true,
      data: { users },
    });
  } catch (error) {
    console.error('Assignable users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

export default router;
