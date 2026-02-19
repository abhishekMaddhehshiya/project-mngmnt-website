# Security Configuration Guide for PixelForge Nexus

This document provides detailed security configurations and hardening steps for production deployment.

## 🔐 Pre-Deployment Verification Checklist

### Cryptographic Configuration

```bash
# 1. Verify JWT secrets are strong (32+ bytes)
echo $JWT_SECRET | wc -c  # Should be >= 32

# 2. Generate new secrets if needed
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -base64 32)

# 3. Store in secure vault (AWS Secrets Manager, HashiCorp Vault, etc.)
aws secretsmanager create-secret --name pixelforge/jwt-secret --secret-string "$JWT_SECRET"
```

### Environment Security

```bash
# 1. Verify .env is not in version control
git check-ignore .env  # Should return: .env

# 2. Create production .env with strong values
cp .env.example .env.production

# 3. Set restricted permissions
chmod 600 .env.production

# 4. Enable audit logging
export NODE_DEBUG="*:*"  # For development only, remove in production
```

### Database Hardening

```javascript
// MongoDB Security Options
const mongoOptions = {
  // Use authentication
  authSource: 'admin',
  
  // Network security
  useNewUrlParser: true,
  useUnifiedTopology: true,
  
  // SSL/TLS
  ssl: true,
  sslValidate: true,
  sslCA: [fs.readFileSync('path/to/ca.pem')],
  
  // Connection pooling
  maxPoolSize: 10,
  minPoolSize: 5,
  
  // Timeouts
  serverSelectionTimeoutMS: 5000,
  setServerSelectionTimeout: 5000,
  
  // Retry logic
  retryWrites: true,
  retryReads: true
};

mongoose.connect(process.env.MONGODB_URI, mongoOptions);
```

### Application Hardening

```javascript
// backend/config/security.js
const securityConfig = {
  // Content Security Policy
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],  // Consider removing unsafe-inline
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.yourdomain.com"],
        fontSrc: ["'self'", "https://fonts.googleapis.com"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        pluginTypes: []
      }
    },
    hsts: {
      maxAge: 31536000,  // 1 year
      includeSubDomains: true,
      preload: true
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  },
  
  // CORS - strictly limit origins
  cors: {
    origin: process.env.CORS_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 86400
  },
  
  // Rate limiting - aggressive for production
  globalRateLimit: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 100,  // 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health';
    },
    keyGenerator: (req) => {
      // Use X-Forwarded-For if behind proxy
      return req.get('X-Forwarded-For') || req.ip;
    }
  },
  
  authRateLimit: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 5,  // 5 login attempts
    skipSuccessfulRequests: true,  // Don't count successful logins
    skipFailedRequests: false  // Count failed attempts
  },
  
  // Session configuration
  session: {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,  // HTTPS only
      httpOnly: true,  // No JavaScript access
      sameSite: 'Strict',  // CSRF protection
      maxAge: 24 * 60 * 60 * 1000  // 24 hours
    }
  },
  
  // Password requirements
  passwordRequirements: {
    minLength: 12,  // Production: longer passwords
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialCharacters: true
  },
  
  // Bcrypt configuration
  bcryptRounds: 12  // Production: higher rounds (slower)
};

module.exports = securityConfig;
```

---

## 🛡️ Defense Strategies

### 1. Input Validation & Sanitization

```javascript
// Comprehensive input validation
const { body, validationResult } = require('express-validator');

const validateInput = [
  // Whitelist allowed characters
  body('username')
    .trim()
    .isEmail()
    .normalizeEmail()
    .isLength({ min: 3, max: 100 }),
  
  body('password')
    .isLength({ min: 12 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[a-zA-Z\d@$!%*?&]/, 'g'),
  
  // File uploads - strict validation
  (req, res, next) => {
    if (req.file) {
      const MIME_TYPES = ['application/pdf', 'application/msword', 'text/plain'];
      const MAX_SIZE = 5 * 1024 * 1024;  // 5MB
      
      if (!MIME_TYPES.includes(req.file.mimetype)) {
        return res.status(400).json({ message: 'Invalid file type' });
      }
      if (req.file.size > MAX_SIZE) {
        return res.status(400).json({ message: 'File too large' });
      }
    }
    next();
  }
];

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Log detailed errors for debugging
    console.error('Validation errors:', errors.array());
    
    // Return generic error to client (no details)
    return res.status(400).json({ 
      message: 'Invalid input provided'
    });
  }
  next();
};
```

### 2. Authentication Hardening

```javascript
// Implement account lockout strategy
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 2 * 60 * 60 * 1000;  // 2 hours

async function login(username, password) {
  let user = await User.findOne({ username });
  
  // Check if account is locked
  if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS && 
      user.lockUntil > Date.now()) {
    throw new Error('Account locked. Try again later.');
  }
  
  // Verify password (timing-safe comparison via bcrypt)
  const isValid = await user.verifyPassword(password);
  
  if (!isValid) {
    // Increment failed attempts
    user.loginAttempts += 1;
    
    if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCK_TIME);
    }
    
    await user.save();
    throw new Error('Invalid credentials');
  }
  
  // Successful login - reset attempts
  user.loginAttempts = 0;
  user.lockUntil = undefined;
  user.lastLogin = new Date();
  await user.save();
  
  // Generate tokens with claims
  const accessToken = jwt.sign(
    {
      userId: user._id,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),  // Issued at
      pip: user.passwordChangedDate || 0  // Password issued put (detect password changes)
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  
  return { accessToken, user };
}
```

### 3. Authorization Enforcement

```javascript
// Multi-layer authorization checks

// Layer 1: Route-level (@middleware)
app.delete('/api/projects/:id', 
  authenticate,
  authorize('admin', 'project-lead'),  // Role check
  deleteProject
);

// Layer 2: Controller-level (explicit checks)
async function deleteProject(req, res) {
  const project = await Project.findById(req.params.id);
  
  if (!project) {
    return res.status(404).json({ message: 'Not found' });
  }
  
  // Check ownership
  if (project.createdBy.toString() !== req.user._id.toString() && 
      req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  
  await Project.deleteOne({ _id: req.params.id });
  res.json({ message: 'Deleted' });
}

// Layer 3: Model-level (database queries)
// Ensure only authorized records are returned
const userProjects = await Project.find({
  $or: [
    { createdBy: userId },
    { projectLead: userId },
    { assignedDevelopers: userId }
  ]
});
```

### 4. Secure File Handling

```javascript
// File upload security
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs').promises;

const uploadConfig = multer.diskStorage({
  destination: async (req, file, cb) => {
    // Store in secure directory outside web root
    const dir = `/secure/uploads/${req.user._id}`;
    await fs.mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Generate random filename, preserve extension
    const ext = path.extname(file.originalname);
    const name = crypto.randomBytes(16).toString('hex');
    cb(null, `${name}${ext}`);
  }
});

const upload = multer({
  storage: uploadConfig,
  limits: {
    fileSize: 5 * 1024 * 1024,  // 5MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const ALLOWED_TYPES = ['application/pdf', 'text/plain'];
    
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      cb(new Error('Invalid file type'));
    } else {
      cb(null, true);
    }
  }
});

// Calculate file checksum for integrity verification
async function calculateChecksum(filePath) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  
  return new Promise((resolve, reject) => {
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}
```

### 5. Secure Logging

```javascript
// Never log sensitive data
const sanitizeLog = (data) => {
  const sanitized = { ...data };
  delete sanitized.password;
  delete sanitized.token;
  delete sanitized.refreshToken;
  delete sanitized.creditCard;
  delete sanitized.ssn;
  return sanitized;
};

// Log to secure location
const logger = require('winston');
logger.add(new logger.transports.File({
  filename: '/secure/logs/app.log',
  chmod: 0o600,  // Read/write by owner only
  maxsize: 10 * 1024 * 1024,  // 10MB rotation
  maxFiles: 30
}));

// Log security events
logger.info('User login', {
  userId: user._id,
  ip: req.ip,
  timestamp: new Date()
});
```

### 6. Error Handling

```javascript
// Generic error responses (no internal details)
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Don't expose stack traces
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'An error occurred'
    : err.message;
  
  res.status(statusCode).json({
    message,
    ...(process.env.NODE_ENV !== 'production' && { error: err })
  });
});
```

---

## 🔍 Security Testing

### Automated Security Scanning

```bash
# npm audit - check dependencies for vulnerabilities
npm audit

# snyk - comprehensive vulnerability scanning
npm install -g snyk
snyk auth
snyk test

# OWASP ZAP - dynamic application scanning
docker run -t owasp/zap pro \
  -cmd "-quickurl https://yourdomain.com" \
  -report /results/report.html

# SonarQube - code quality and security
docker run --rm sonarqube
# Run: sonar-scanner -Dsonar.projectKey=pixelforge
```

### Manual Testing

```bash
# 1. Test HTTPS
curl -I https://yourdomain.com
# Verify: Upgrade-Insecure-Requests, Strict-Transport-Security

# 2. Test security headers
curl -I https://yourdomain.com | grep -E "X-Frame|X-Content|X-XSS|Strict"

# 3. Test authentication
curl -X POST https://yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"P@ssw0rd123"}'

# 4. Test rate limiting
for i in {1..10}; do
  curl -X POST https://yourdomain.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"wrong"}'
done
# Expect 429 Too Many Requests after 5 attempts

# 5. Test authorization
TOKEN="your_token_here"
curl -X GET https://yourdomain.com/api/admin/users \
  -H "Authorization: Bearer $TOKEN"

# 6. Test input validation
curl -X POST https://yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"<script>alert(1)</script>","password":"p"}'
# Expect validation error, no XSS reflection
```

---

## 📊 Monitoring & Alerting

### Key Metrics to Monitor

```text
Authentication:
- Failed login attempts per minute
- Account lockouts
- Unusual login locations
- Token refresh rate

Application:
- API response time (p50, p95, p99)
- Error rate (4xx, 5xx)
- Request throughput
- CPU and memory usage

Database:
- Query performance
- Connection pool utilization
- Slow queries
- Replication lag

Infrastructure:
- Disk space usage
- Network latency
- Certificate expiration
- Backup success rate
```

### Alert Thresholds

```yaml
alerts:
  critical:
    - failed_logins > 20/min → Page on-call
    - 5xx_error_rate > 5% → Page on-call
    - disk_free < 5% → Page immediately
    - ssl_cert_expires < 7days → Email daily
  
  warning:
    - response_time_p95 > 2s → Email team
    - 4xx_error_rate > 10% → Email team
    - cpu_usage > 80% → Email team
```

---

## ✅ Final Verification

```bash
#!/bin/bash
# final-verification.sh

echo "🔐 Security Verification Script"
echo "=================================="

# 1. Check environment
echo "1. Checking environment..."
[ -z "$NODE_ENV" ] && echo "ERROR: NODE_ENV not set" || echo "✓ NODE_ENV=$NODE_ENV"
[ -z "$JWT_SECRET" ] && echo "ERROR: JWT_SECRET not set" || echo "✓ JWT_SECRET set"
[ ${#JWT_SECRET} -lt 32 ] && echo "ERROR: JWT_SECRET too short" || echo "✓ JWT_SECRET >= 32 chars"

# 2. Check HTTPS
echo "2. Checking HTTPS..."
curl -sk -o /dev/null -w "%{http_code}" https://yourdomain.com | grep -q "200" && echo "✓ HTTPS working" || echo "ERROR: HTTPS failed"

# 3. Check security headers
echo "3. Checking security headers..."
curl -sI https://yourdomain.com | grep -q "Strict-Transport-Security" && echo "✓ HSTS enabled" || echo "ERROR: HSTS missing"
curl -sI https://yourdomain.com | grep -q "X-Frame-Options" && echo "✓ X-Frame-Options set" || echo "ERROR: X-Frame-Options missing"

# 4. Check database connection
echo "4. Checking database..."
npm run test:db && echo "✓ Database connected" || echo "ERROR: Database connection failed"

# 5. Run security tests
echo "5. Running security tests..."
npm run test:security && echo "✓ Security tests passed" || echo "ERROR: Security tests failed"

# 6. Check dependencies
echo "6. Checking dependencies..."
npm audit > /dev/null 2>&1 && echo "✓ No vulnerable dependencies" || echo "WARNING: Review vulnerable dependencies"

echo ""
echo "✅ Verification complete!"
```

---

## 🚨 Incident Response

### In Case of Security Breach

1. **Immediate Actions** (first hour)
   - Revoke all active refresh tokens
   - Rotate JWT secrets
   - Enable enhanced logging
   - Alert security team

2. **Investigation** (first 24 hours)
   - Review access logs for anomalies
   - Identify affected users
   - Check backup integrity
   - Preserve forensic evidence

3. **Remediation**
   - Reset compromised passwords
   - Notify affected users
   - Patch vulnerabilities
   - Re-deploy with new secrets
   - Monitor for re-exploitation

4. **Post-Incident**
   - Conduct security audit
   - Update threat model
   - Implement additional controls
   - Document lessons learned

