/**
 * SECURITY DECISION: JWT Token Management
 * 
 * 1. Two-token system: Access token (short-lived) + Refresh token (long-lived)
 * 2. Access tokens expire in 15 minutes (limits exposure window)
 * 3. Refresh tokens expire in 7 days (stored securely on client/server)
 * 4. Prevents token theft/reuse with proper validation
 * 5. Claims include role and permissions for authorization
 * 
 * Why two tokens:
 * - Access token theft limited by short expiration
 * - User stays logged in with refresh token
 * - Can revoke refresh tokens for logout
 */

import jwt from 'jsonwebtoken';
import config from '../config/config.js';

/**
 * SECURITY: Generate access token with role claims
 */
export const generateAccessToken = (userId, role) => {
  return jwt.sign(
    {
      sub: userId, // Subject claim
      role: role,
      type: 'access',
    },
    config.jwt.secret,
    {
      expiresIn: config.jwt.expiration,
      algorithm: 'HS256',
      issuer: 'pixelforge-nexus',
      audience: 'pixelforge-nexus-client',
    }
  );
};

/**
 * SECURITY: Generate refresh token (stored securely on client)
 */
export const generateRefreshToken = (userId) => {
  return jwt.sign(
    {
      sub: userId,
      type: 'refresh',
    },
    config.jwt.refreshSecret,
    {
      expiresIn: config.jwt.refreshExpiration,
      algorithm: 'HS256',
      issuer: 'pixelforge-nexus',
    }
  );
};

/**
 * SECURITY: Verify access token and extract claims
 */
export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret, {
      algorithms: ['HS256'],
      issuer: 'pixelforge-nexus',
      audience: 'pixelforge-nexus-client',
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Access token has expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid access token');
    }
    throw error;
  }
};

/**
 * SECURITY: Verify refresh token
 */
export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret, {
      algorithms: ['HS256'],
      issuer: 'pixelforge-nexus',
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Refresh token has expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid refresh token');
    }
    throw error;
  }
};

/**
 * SECURITY: Decode token without verification (for error messages only)
 */
export const decodeToken = (token) => {
  return jwt.decode(token);
};
