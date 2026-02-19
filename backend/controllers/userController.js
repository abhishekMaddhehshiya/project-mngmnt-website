/**
 * SECURITY DECISION: User Management Controller
 * 
 * Admin-only operations:
 * 1. Create users (no self-registration)
 * 2. Update user information
 * 3. Delete users
 * 4. List users with role filtering
 * 5. Reset user passwords
 */

import User from '../models/User.js';

/**
 * SECURITY: List all users (admin only)
 * Supports filtering by role
 */
export const listUsers = async (req, res) => {
  try {
    const { role } = req.query;
    
    // SECURITY: Build filter object safely
    const filter = {};
    if (role && ['admin', 'project-lead', 'developer'].includes(role)) {
      filter.role = role;
    }
    
    const users = await User.find(filter).select('-password -mfaSecret');
    
    res.status(200).json({
      success: true,
      data: {
        count: users.length,
        users,
      },
    });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * SECURITY: Get user by ID
 */
export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -mfaSecret');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * SECURITY: Create user (admin only)
 * No self-registration to prevent unauthorized access
 */
export const createUser = async (req, res) => {
  try {
    const { username, email, password, fullName, role } = req.body;
    
    // SECURITY: Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
    });
    
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Username or email already exists',
      });
    }
    
    // SECURITY: Create new user with validated inputs
    const newUser = new User({
      username,
      email,
      password, // Will be hashed in pre-save middleware
      fullName,
      role: role || 'developer',
    });
    
    await newUser.save();
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: newUser.toJSON(),
      },
    });
  } catch (error) {
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message),
      });
    }
    
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * SECURITY: Update user (admin only)
 * Can update: fullName, role, email, and account status
 * Cannot update: password (use changePassword endpoint)
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, role, isActive } = req.body;
    
    // SECURITY: Prevent updating password through this endpoint
    if (req.body.password) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update password through this endpoint. Use /change-password',
      });
    }
    
    // SECURITY: Build safe update object
    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (email) updateData.email = email;
    if (role && ['admin', 'project-lead', 'developer'].includes(role)) {
      updateData.role = role;
    }
    if (isActive !== undefined) updateData.isActive = isActive;
    
    const user = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: { user: user.toJSON() },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message),
      });
    }
    
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * SECURITY: Delete user (admin only)
 * Soft or hard delete depends on data retention policy
 */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // SECURITY: Prevent admin from deleting themselves
    if (req.user.id === id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account',
      });
    }
    
    const user = await User.findByIdAndDelete(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * SECURITY: Reset user password
 * Admin function to reset user password
 * User should change this on first login
 */
export const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { tempPassword } = req.body;
    
    if (!tempPassword || tempPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Temporary password must be at least 8 characters',
      });
    }
    
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    // SECURITY: Update password (will be hashed in pre-save)
    user.password = tempPassword;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Password reset successfully',
      data: {
        user: user.toJSON(),
        instruction: 'User should change password on next login',
      },
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * SECURITY: Deactivate user account
 * Alternative to deletion (softer approach)
 */
export const deactivateUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // SECURITY: Prevent admin from deactivating themselves
    if (req.user.id === id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own account',
      });
    }
    
    const user = await User.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'User account deactivated successfully',
      data: { user: user.toJSON() },
    });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
