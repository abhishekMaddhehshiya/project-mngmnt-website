/**
 * SECURITY DECISION: Authentication Controller
 * 
 * Handles:
 * 1. User login with credential validation
 * 2. Token generation and refresh
 * 3. Account lockout after failed attempts (brute force protection)
 * 4. MFA support (optional)
 * 
 * All endpoints use HTTPS in production
 */

import User from '../models/User.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';


/**
 * SECURITY: Login endpoint
 * Validates credentials and issues JWT tokens
 */
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    // console.log(username)
    
    // SECURITY: Find user by username
    // IMPORTANT: Must select password field explicitly (marked as select: false in schema)
    const user = await User.findOne({ 
      $or: [{ username }, { email: username }] 
    }).select('+password');
    // console.log(user)
    
    // SECURITY: Check if user exists (don't reveal which exists)
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }
    // console.log(user)
    // SECURITY: Check if account is locked due to too many failed attempts
    if (user.isLocked()) {
      return res.status(403).json({
        success: false,
        message: 'Account is locked due to too many failed login attempts. Please try again later.',
      });
    }
    
    // SECURITY: Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated',
      });
    }
    
    // SECURITY: Verify password using constant-time comparison
    const isPasswordValid = await user.verifyPassword(password);
    // console.log(isPasswordValid)
    if (!isPasswordValid) {
      // SECURITY: Increment failed login attempts
      await user.incLoginAttempts();
      
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }
    
    // SECURITY: Check if MFA is enabled (optional feature)
    if (user.mfaEnabled) {
      // Return flag to client to prompt for MFA
      return res.status(200).json({
        success: true,
        message: 'MFA verification required',
        mfaRequired: true,
        tempToken: generateAccessToken(user._id, user.role), // Short-lived temp token
      });
    }
    
    // SECURITY: Clear failed login attempts on successful login
    await user.resetLoginAttempts();
    
    // SECURITY: Generate tokens
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);
    
    // SECURITY: Return tokens (refresh token should be HttpOnly cookie in production)
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toJSON(), // Excludes sensitive fields
        accessToken,
        refreshToken, // In production, set as HttpOnly cookie
        expiresIn: 900, // 15 minutes in seconds
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * SECURITY: Refresh token endpoint
 * Issues new access token without re-authenticating
 */
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required',
      });
    }
    
    // SECURITY: Verify refresh token signature and expiration
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: error.message,
      });
    }
    
    // SECURITY: Verify user still exists
    const user = await User.findById(payload.sub);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or account is inactive',
      });
    }
    
    // SECURITY: Generate new access token
    const newAccessToken = generateAccessToken(user._id, user.role);
    
    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken,
        expiresIn: 900, // 15 minutes in seconds
      },
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * SECURITY: Logout endpoint
 * In production with token blacklisting:
 * 1. Store refresh token in blacklist (Redis)
 * 2. Invalidate all user sessions
 * For now, client-side handling is sufficient
 */
export const logout = (req, res) => {
  // SECURITY: Client should delete tokens from storage
  // In production, invalidate refresh token in server-side blacklist
  res.status(200).json({
    success: true,
    message: 'Logout successful',
    data: {
      // Client should remove stored tokens
      instruction: 'Remove stored access and refresh tokens',
    },
  });
};

/**
 * SECURITY: Get current user profile
 * Useful for client-side to verify logged-in state
 */
export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        user: user.toJSON(),
      },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * SECURITY: Change password endpoint
 * Requires proving old password to prevent CSRF attacks
 */
export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    
    // SECURITY: Validate new password matches confirmation
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
      });
    }
    
    // SECURITY: Fetch user with password field
    const user = await User.findById(req.user.id).select('+password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    // SECURITY: Verify old password
    const isOldPasswordValid = await user.verifyPassword(oldPassword);
    
    if (!isOldPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Old password is incorrect',
      });
    }
    
    // SECURITY: Update password (hash happens in pre-save middleware)
    user.password = newPassword;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
      data: {
        user: user.toJSON(),
      },
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
