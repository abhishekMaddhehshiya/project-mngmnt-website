/**
 * SECURITY DECISION: Authentication Middleware
 * 
 * 1. Enforces JWT-based authentication on protected routes
 * 2. Extracts token from Authorization header (Bearer scheme)
 * 3. Validates token signature and expiration
 * 4. Injects user context into request for downstream handlers
 * 5. Handles multiple error scenarios with detailed logging
 * 
 * Why Bearer tokens: Standard HTTP authentication mechanism,
 * prevents tokens being sent in query params (which get logged)
 */

import { verifyAccessToken, decodeToken } from '../utils/jwt.js';
import User from '../models/User.js';

/**
 * SECURITY: Protect routes that require authentication
 * Extract and validate JWT from Authorization header
 */
export const authenticate = async (req, res, next) => {
  try {
    // SECURITY: Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token provided',
      });
    }
    
    // Extract token (skip "Bearer " prefix)
    const token = authHeader.slice(7);
    
    // SECURITY: Verify token signature and expiration
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      // SECURITY: Return 401 for invalid tokens (includes expired)
      return res.status(401).json({
        success: false,
        message: error.message,
      });
    }
    
    // SECURITY: Verify user still exists and is active
    const user = await User.findById(payload.sub);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or account is inactive',
      });
    }
    
    // SECURITY: Check if password was changed after token was issued
    if (user.passwordChangedAfter(payload.iat)) {
      return res.status(401).json({
        success: false,
        message: 'Password recently changed. Please login again.',
      });
    }
    
    // SECURITY: Attach user to request context for downstream handlers
    req.user = {
      id: payload.sub,
      role: payload.role,
      email: user.email,
    };
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal authentication error',
    });
  }
};

/**
 * SECURITY: Middleware factory for role-based access control
 * Restricts routes to specific roles
 * 
 * Usage: app.get('/admin', authorize('admin'), handler)
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // authenticate() must run first to set req.user
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    // Check if user's role is in allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
      });
    }
    
    next();
  };
};

/**
 * SECURITY: Optional authentication - allows request even without token
 * Useful for endpoints that have different behavior for auth'd users
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      
      try {
        const payload = verifyAccessToken(token);
        const user = await User.findById(payload.sub);
        
        if (user && user.isActive) {
          req.user = {
            id: payload.sub,
            role: payload.role,
            email: user.email,
          };
        }
      } catch (error) {
        // Silently ignore invalid tokens in optional auth
      }
    }
    
    next();
  } catch (error) {
    // Silently fail for optional auth
    next();
  }
};

/**
 * SECURITY: Middleware to check if user is locked out due to failed attempts
 */
export const checkAccountLock = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }
    
    const user = await User.findById(req.user.id);
    
    if (user && user.isLocked()) {
      return res.status(403).json({
        success: false,
        message: 'Account is locked due to too many failed login attempts. Please try again later.',
      });
    }
    
    next();
  } catch (error) {
    next();
  }
};
