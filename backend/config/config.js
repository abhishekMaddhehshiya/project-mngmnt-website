/**
 * SECURITY DECISION: Centralized configuration management
 * 
 * This module enforces security constraints at startup:
 * 1. All required environment variables must be present
 * 2. Validates configuration values for security constraints
 * 3. Prevents common misconfigurations (e.g., default secrets)
 * 4. Acts as single source of truth for configuration
 * 
 * Why: Centralized config prevents accidental exposure of secrets
 * and ensures security policies are enforced consistently.
 */

import dotenv from 'dotenv';

dotenv.config();

const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  
  // Database
  mongodbUri: process.env.MONGODB_URI,
  
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    expiration: process.env.JWT_EXPIRATION || '15m',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },
  
  // Bcrypt
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN,
  
  // File Upload
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB default
  allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'pdf,doc,docx,txt').split(','),
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  
  // MFA
  mfaEnabled: process.env.MFA_ENABLED === 'true',
  totpWindow: parseInt(process.env.TOTP_WINDOW || '1', 10),
};

/**
 * SECURITY: Validate critical configuration at startup
 * This prevents the application from running with insecure defaults
 */
const validateConfig = () => {
  const errors = [];
  
  // MongoDB URI is required
  if (!config.mongodbUri) {
    errors.push('MONGODB_URI environment variable is required');
  }
  
  // JWT secrets must be strong (at least 32 characters)
  if (!config.jwt.secret || config.jwt.secret.length < 32) {
    errors.push(
      'JWT_SECRET must be at least 32 characters long. ' +
      'Use: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  
  if (!config.jwt.refreshSecret || config.jwt.refreshSecret.length < 32) {
    errors.push(
      'JWT_REFRESH_SECRET must be at least 32 characters long. ' +
      'Use: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  
  // CORS origin must be configured
  if (!config.corsOrigin) {
    errors.push('CORS_ORIGIN environment variable is required');
  }
  
  // Bcrypt rounds should be 10-12 for security
  if (config.bcryptRounds < 10) {
    errors.push(
      `BCRYPT_ROUNDS should be at least 10 for security (current: ${config.bcryptRounds})`
    );
  }
  
  // File upload size should reasonable
  if (config.maxFileSize < 1024) {
    errors.push('MAX_FILE_SIZE should be at least 1024 bytes');
  }
  
  if (errors.length > 0) {
    console.error('Configuration Validation Errors:');
    errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }
};

// Validate on import
if (process.env.NODE_ENV !== 'test') {
  validateConfig();
}

export default config;
