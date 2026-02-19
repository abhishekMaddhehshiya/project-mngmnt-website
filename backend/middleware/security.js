/**
 * SECURITY DECISION: Global Security Middleware
 * 
 * 1. CORS: Restrict cross-origin requests to known origins
 * 2. Helmet: Set secure HTTP headers (CSP, X-Frame-Options, etc.)
 * 3. Rate Limiting: Prevent brute force and DoS attacks
 * 4. Input Validation: Sanitize and validate all inputs
 * 5. Request Logging: Track request patterns for security analysis
 * 
 * Applies to all routes by default
 */

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { body, param, query, validationResult } from 'express-validator';
import config from '../config/config.js';

/**
 * SECURITY: Helmet middleware sets secure HTTP headers
 * - X-Content-Type-Options: nosniff (prevent MIME sniffing)
 * - X-Frame-Options: deny (prevent clickjacking)
 * - Strict-Transport-Security (HSTS)
 * - Content-Security-Policy: restrict script sources
 * - Remove X-Powered-By header
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
});

/**
 * SECURITY: Rate limiting to prevent brute force attacks
 * Applied globally with stricter limits for auth endpoints
 */
export const globalRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // SECURITY: Skip rate limiting for health checks
  skip: (req) => req.path === '/health',
});

/**
 * SECURITY: Stricter rate limiting for authentication endpoints
 * Prevents credential stuffing and brute force attacks
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: 'Too many login attempts. Please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  // SECURITY: Use IP + username to identify attacker
  keyGenerator: (req) => {
    return `${req.ip}:${req.body.username}`;
  },
});

/**
 * SECURITY: Middleware for handling validation errors
 * Should be called after validation chains
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // SECURITY: Log validation failures (potential attack)
    console.warn('Validation errors from IP:', req.ip, errors.array());
    
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
      })),
    });
  }
  
  next();
};

/**
 * SECURITY: Input validation chain for user creation/update
 */
export const validateUserInput = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be 3-50 characters')
    .matches(/^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$/)
    .withMessage('Username must be a valid email format')
    .normalizeEmail(),
  
  body('email')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('password')
    .optional()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),
  
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be 2-100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Full name contains invalid characters'),
  
  body('role')
    .isIn(['admin', 'project-lead', 'developer'])
    .withMessage('Invalid role'),
];

/**
 * SECURITY: Input validation for login
 */
export const validateLoginInput = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

/**
 * SECURITY: Input validation for project creation
 */
export const validateProjectInput = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 255 })
    .withMessage('Project name must be 3-255 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Description must not exceed 5000 characters'),
  
  body('deadline')
    .isISO8601()
    .withMessage('Invalid deadline format')
    .custom(value => {
      if (new Date(value) <= new Date()) {
        throw new Error('Deadline must be in the future');
      }
      return true;
    }),
  
  body('priority')
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid priority level'),
];

/**
 * SECURITY: Prevent parameter pollution and injection
 */
export const sanitizeParams = (req, res, next) => {
  // Remove potential injection payloads
  const sanitize = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove null bytes
        obj[key] = obj[key].replace(/\x00/g, '');
        // SECURITY: Prevent script injection in params
        obj[key] = obj[key].replace(/<script[^>]*>.*?<\/script>/gi, '');
      }
    }
  };
  
  sanitize(req.body);
  sanitize(req.query);
  sanitize(req.params);
  
  next();
};

/**
 * SECURITY: Request logging for audit trail
 */
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // SECURITY: Log security-relevant information
    if (req.user || res.statusCode >= 400) {
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.path} - ` +
        `Status: ${res.statusCode} - ` +
        `User: ${req.user?.id || 'anonymous'} - ` +
        `IP: ${req.ip} - ` +
        `Duration: ${duration}ms`
      );
    }
  });
  
  next();
};

/**
 * SECURITY: Error handling middleware
 * Ensures errors don't expose sensitive information
 */
export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  // SECURITY: Don't expose stack traces in production
  const isDevelopment = config.nodeEnv === 'development';
  
  const response = {
    success: false,
    message: err.message || 'Internal server error',
  };
  
  if (isDevelopment) {
    response.stack = err.stack;
  }
  
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json(response);
};

/**
 * SECURITY: Middleware to set secure response headers
 */
export const secureResponse = (req, res, next) => {
  // SECURITY: Prevent caching of sensitive data
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  });
  
  next();
};
