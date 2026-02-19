# PixelForge Nexus - Secure Project Management System

A production-grade, security-first project management system with role-based access control, secure file handling, and comprehensive authentication mechanisms.

## 🔐 Security Features

- **JWT Authentication** with access + refresh token strategy
- **bcrypt Password Hashing** with configurable rounds
- **Role-Based Access Control (RBAC)** - Admin, Project Lead, Developer
- **Rate Limiting** - Brute force protection
- **Account Lockout** - After 5 failed login attempts (2 hours)
- **Secure File Uploads** - Type validation, size limits, checksums
- **Input Validation & Sanitization** - XSS and injection prevention
- **Security Headers** - Helmet.js for comprehensive header protection
- **Audit Logging** - Track all sensitive operations
- **CORS Configuration** - Restricted to known origins
- **Password Strength Enforcement** - Mixed case, numbers, special characters

## 📋 System Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design, layered architecture, and data flow diagrams.

## 🎯 Threat Modeling

See [THREAT_MODEL.md](./THREAT_MODEL.md) for comprehensive STRIDE threat analysis and mitigation strategies.

## 📐 Formal Methods

See [FORMAL_METHODS.md](./FORMAL_METHODS.md) for formal access control specifications, proofs of correctness, and state machines.

## 🛠️ Tech Stack

### Backend
- **Node.js + Express.js** - RESTful API server
- **MongoDB + Mongoose** - Document-oriented database with schema validation
- **JWT** - Stateless authentication
- **bcryptjs** - Password hashing
- **Helmet.js** - Secure HTTP headers
- **express-rate-limit** - Rate limiting
- **Multer** - Secure file uploads
- **express-validator** - Input validation

### Frontend
- **React 18** - UI framework
- **React Router v6** - Client-side routing
- **Zustand** - State management
- **Axios** - HTTP client with interceptors
- **CSS3** - Styling with responsive design

### Testing
- **Jest** - Unit testing framework
- **Supertest** - HTTP assertion library

## 📦 Installation & Setup

### Prerequisites
```bash
- Node.js 16+ (LTS recommended)
- MongoDB 5.0+
- npm or yarn
```

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Edit .env with your configuration:
# - Set strong JWT secrets (use: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
# - Configure MongoDB connection
# - Set CORS_ORIGIN to your frontend URL
# - Adjust rate limiting thresholds

# Generate strong secrets for production:
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Create uploads directory
mkdir -p uploads

# Start server (development with nodemon)
npm run dev

# Or production mode
npm start
```

### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Configure environment
echo "REACT_APP_API_URL=http://localhost:5000/api" > .env

# Start development server
npm start
```

## 🔑 Test Credentials

**For Development Only** - These are demo accounts created via backend/config/.env

| Role | Username | Password |
|------|----------|----------|
| Admin | admin@pixelforge.local | Admin@123456 |
| Project Lead | lead@pixelforge.local | Lead@123456 |
| Developer | developer@pixelforge.local | Dev@123456 |

> ⚠️ **IMPORTANT**: Remove test credentials and create real user accounts in production!

## 📝 API Endpoints

### Authentication

```
POST /api/auth/login
  Body: { username: string, password: string }
  Response: { accessToken, refreshToken, user }

POST /api/auth/refresh-token
  Body: { refreshToken: string }
  Response: { accessToken }

POST /api/auth/logout
  Headers: Authorization: Bearer {token}

GET /api/auth/me
  Headers: Authorization: Bearer {token}
  Response: { user }

PUT /api/auth/change-password
  Headers: Authorization: Bearer {token}
  Body: { oldPassword, newPassword, confirmPassword }
```

### Projects

```
GET /api/projects
  Headers: Authorization: Bearer {token}
  Response: { projects[] } (filtered by role)

GET /api/projects/:id
  Headers: Authorization: Bearer {token}
  Response: { project }

POST /api/projects
  Headers: Authorization: Bearer {token}
  Body: { name, description, deadline, priority, projectLead, assignedDevelopers }
  Required Role: admin, project-lead

PUT /api/projects/:id
  Headers: Authorization: Bearer {token}
  Body: { name, description, deadline, status, priority, projectLead, assignedDevelopers }
  Required Role: admin, project-lead

DELETE /api/projects/:id
  Headers: Authorization: Bearer {token}
  Required Role: admin
```

### Documents

```
POST /api/documents/project/:projectId/upload
  Headers: Authorization: Bearer {token}
  Body: FormData with file
  Required Role: admin, project-lead

GET /api/documents/project/:projectId
  Headers: Authorization: Bearer {token}
  Response: { documents[] }

GET /api/documents/:id
  Headers: Authorization: Bearer {token}
  Response: { document }

GET /api/documents/:id/download
  Headers: Authorization: Bearer {token}
  (Binary file download with access logging)

DELETE /api/documents/:id
  Headers: Authorization: Bearer {token}
  Can delete: uploader or admin
```

### Users (Admin Only)

```
GET /api/users
  Headers: Authorization: Bearer {token}
  Query: ?role=admin|project-lead|developer
  Required Role: admin

GET /api/users/:id
  Headers: Authorization: Bearer {token}
  Required Role: admin

POST /api/users
  Headers: Authorization: Bearer {token}
  Body: { username, email, password, fullName, role }
  Required Role: admin

PUT /api/users/:id
  Headers: Authorization: Bearer {token}
  Body: { fullName, email, role, isActive }
  Required Role: admin

DELETE /api/users/:id
  Headers: Authorization: Bearer {token}
  Required Role: admin

PATCH /api/users/:id/deactivate
  Headers: Authorization: Bearer {token}
  Required Role: admin

POST /api/users/:id/reset-password
  Headers: Authorization: Bearer {token}
  Body: { tempPassword }
  Required Role: admin
```

## 🧪 Testing

### Run All Tests
```bash
cd backend
npm test
```

### Run Security Tests
```bash
npm run test:security
```

### Run Authentication Tests
```bash
npm run test:auth
```

### Coverage Report
```bash
npm test -- --coverage
```

## 🔍 Security Testing Guide

### Manual Testing Checklist

1. **Authentication**
   - [ ] Login with correct credentials succeeds
   - [ ] Login with wrong password fails
   - [ ] Account locks after 5 failed attempts
   - [ ] Tokens expire and require refresh
   - [ ] Refresh token works correctly
   - [ ] Logout clears tokens

2. **Authorization**
   - [ ] Developer cannot create projects
   - [ ] Developer cannot upload documents
   - [ ] Developer only sees assigned projects
   - [ ] Project Lead can modify own projects
   - [ ] Admin can access all resources
   - [ ] Non-admin cannot access user management

3. **File Upload**
   - [ ] Valid PDF uploads successfully
   - [ ] Invalid .exe file rejected
   - [ ] File size > 5MB rejected
   - [ ] Wrong MIME type rejected
   - [ ] Checksum verified on upload

4. **Input Validation**
   - [ ] SQL/NoSQL injection rejected
   - [ ] XSS payloads sanitized
   - [ ] Invalid email format rejected
   - [ ] Weak passwords rejected
   - [ ] Script tags removed from input

5. **Rate Limiting**
   - [ ] 5 login attempts triggers lockout
   - [ ] General rate limit applies globally
   - [ ] Rate limit resets after window

## 🚀 Deployment

### Production Checklist

```bash
# 1. Set strong secrets
JWT_SECRET=<generate-strong-secret>
JWT_REFRESH_SECRET=<generate-strong-secret>

# 2. Use production database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/pixelforge-prod

# 3. Enable HTTPS
NODE_ENV=production

# 4. Set correct CORS origin
CORS_ORIGIN=https://yourdomain.com

# 5. Use environment-specific secrets management
# - AWS Secrets Manager, HashiCorp Vault, or similar

# 6. Enable security headers
# - All HTTPS
# - HSTS enabled
# - CSP configured

# 7. Set up monitoring and logging
# - ELK Stack, Splunk, or CloudWatch
# - Alert on failed login attempts
# - Alert on 403 errors

# 8. Database backups
# - Automated daily backups
# - Encrypted backup storage
# - Test recovery procedures

# 9. Dependency updates
# npm audit
# npm update

# 10. Security scanning
# npm audit
# OWASP ZAP scanning
# Penetration testing
```

## 📊 Monitoring & Alerting

### Key Metrics to Monitor

- Failed login attempts per user
- Account lockouts
- Unauthorized access attempts (403)
- Rate limit violations
- File upload patterns
- API response times
- Database query performance

### Log Aggregation

All sensitive operations are logged in the format:
```
[TIMESTAMP] METHOD ENDPOINT - Status: CODE - User: USER_ID - IP: IP_ADDRESS - Duration: DURATIONms
```

## 🔐 Security Best Practices

### For Administrators

1. **User Management**
   - Use strong, unique passwords for admin accounts
   - Regularly review user access
   - Deactivate unused accounts
   - Implement MFA for admins (when available)

2. **Monitoring**
   - Review audit logs regularly
   - Set up alerts for suspicious activity
   - Monitor unusual login patterns
   - Track document access patterns

3. **Maintenance**
   - Regular security updates (npm audit)
   - Database backups and recovery tests
   - Certificate rotation (HTTPS)
   - Dependency updates

### For Developers

1. **API Usage**
   - Store tokens securely (not in cookies or URL)
   - Use HTTPS only
   - Validate responses
   - Handle 401/403 errors appropriately

2. **Frontend Security**
   - Content Security Policy (CSP)
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - No hardcoded secrets

## 🐛 Troubleshooting

### MongoDB Connection Failed
```bash
# Check MongoDB is running
mongod

# Verify connection string in .env
MONGODB_URI=mongodb://localhost:27017/pixelforge-nexus

# For MongoDB Atlas, ensure IP whitelisting
```

### Rate Limit Too Strict
Edit `.env`:
```
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000
```

### CORS Errors
Ensure frontend URL matches CORS_ORIGIN in `.env`:
```
CORS_ORIGIN=http://localhost:3000
```

### Token Expired Errors
Tokens expire every 15 minutes. Use refresh token to get new access token:
```javascript
POST /api/auth/refresh-token
{ refreshToken: "..." }
```

### Failed File Uploads
- Check file size (max 5MB)
- Verify file type (pdf, doc, docx, txt, xlsx, xls, pptx)
- Check system has write permission to `./uploads` directory

## 📚 Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design and architecture
- [THREAT_MODEL.md](./THREAT_MODEL.md) - Security threat analysis
- [FORMAL_METHODS.md](./FORMAL_METHODS.md) - Formal verification of access control

## 📄 License

MIT License - See LICENSE file for details

## ✅ Compliance & Standards

- ✓ OWASP Top 10 mitigation
- ✓ NIST Cybersecurity Framework principles
- ✓ Secure coding standards
- ✓ Data protection practices
- ✓ Audit trail maintenance

## 🙏 Acknowledgments

Developed as a comprehensive secure system implementation emphasizing:
- Security-first architecture
- Defense in depth
- Principle of least privilege
- Secure by default
- Clear documentation

## 📞 Support

For issues, questions, or security concerns:
1. Check the documentation
2. Review the test cases
3. Check the troubleshooting guide
4. For security issues: Do NOT open public issues; contact security team privately

---

**Last Updated**: February 2026
**Version**: 1.0.0
**Status**: Production Ready
