/**
 * SECURITY DECISION: User Model with Built-in Security
 * 
 * 1. Passwords are hashed on save using bcrypt (salted)
 * 2. Never store or transmit passwords in plaintext
 * 3. Sensitive fields are excluded from serialization by default
 * 4. Password verification is constant-time to prevent timing attacks
 * 5. Email uniqueness enforced at database level
 * 
 * Why bcrypt: Slows down brute-force attacks through intentional slowness
 */

import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [50, 'Username must not exceed 50 characters'],
      lowercase: true,
      // SECURITY: Prevent common injection patterns
      validate: {
        validator: function(v) {
          return /^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(v);
        },
        message: 'Username must be a valid email format',
      },
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function(v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Invalid email format',
      },
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // SECURITY: Don't return password by default
    },
    role: {
      type: String,
      enum: ['admin', 'project-lead', 'developer'],
      default: 'developer',
      required: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [100, 'Full name must not exceed 100 characters'],
    },
    
    // SECURITY: Account status for deactivation
    isActive: {
      type: Boolean,
      default: true,
    },
    
    // SECURITY: Track last login for anomaly detection
    lastLogin: {
      type: Date,
      default: null,
    },
    
    // SECURITY: MFA Support (optional)
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
    mfaSecret: {
      type: String,
      select: false, // Never expose this
    },
    
    // SECURITY: Track password changes
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    
    // SECURITY: Track multiple failed login attempts
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * SECURITY: Hash password before saving
 * This middleware executes whenever a document is saved
 */
userSchema.pre('save', async function(next) {
  // Only hash password if it has been modified
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    // SECURITY: Generate salt and hash password
    // bcrypt automatically handles salt generation
    const config = (await import('../config/config.js')).default;
    const salt = await bcryptjs.genSalt(config.bcryptRounds);
    this.password = await bcryptjs.hash(this.password, salt);
    this.passwordChangedAt = new Date();
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * SECURITY: Instance method for password verification
 * Uses constant-time comparison to prevent timing attacks
 */
userSchema.methods.verifyPassword = async function(candidatePassword) {
  try {
    return await bcryptjs.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password verification failed');
  }
};

/**
 * SECURITY: Check if password was changed after JWT was issued
 */
userSchema.methods.passwordChangedAfter = function(jwtTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = Math.floor(
      this.passwordChangedAt.getTime() / 1000
    );
    return jwtTimestamp < changedTimestamp;
  }
  return false;
};

/**
 * SECURITY: Handle failed login attempts (brute force protection)
 */
userSchema.methods.incLoginAttempts = async function() {
  // Reset attempts if lock has expired
  if (this.lockUntil && this.lockUntil < new Date()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
  }
  
  // Increment attempts
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours
  
  if (this.loginAttempts + 1 >= maxAttempts) {
    updates.$set = { lockUntil: new Date(Date.now() + lockTime) };
  }
  
  return this.updateOne(updates);
};

/**
 * SECURITY: Clear login attempts on successful login
 */
userSchema.methods.resetLoginAttempts = async function() {
  return this.updateOne({
    $set: { loginAttempts: 0, lastLogin: new Date() },
    $unset: { lockUntil: 1 },
  });
};

/**
 * SECURITY: Check if account is locked
 */
userSchema.methods.isLocked = function() {
  return this.lockUntil && this.lockUntil > new Date();
};

/**
 * SECURITY: Custom JSON serialization - never expose sensitive fields
 */
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.mfaSecret;
  delete obj.loginAttempts;
  delete obj.__v;
  return obj;
};

export default mongoose.model('User', userSchema);
