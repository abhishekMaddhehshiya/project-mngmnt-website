# PixelForge Nexus - System Architecture & Security Design

## 1. System Overview

PixelForge Nexus is a secure project management system designed with security-first principles. The system manages projects, assigns developers, and enables secure document sharing with role-based access control.

### Key Principles
- **Defense in Depth**: Multiple layers of security controls
- **Principle of Least Privilege**: Users get minimum required permissions
- **Secure by Default**: Security controls are mandatory, not optional
- **Fail Secure**: System defaults to deny access on errors

---

## 2. Architecture

### 2.1 Layered Architecture

```
┌─────────────────────────────────────────────┐
│         React Frontend (Port 3000)          │
│    - Authentication Context                  │
│    - Role-Based UI Components               │
│    - Secure Token Management                │
└──────────────┬──────────────────────────────┘
               │ HTTPS
               ↓
┌─────────────────────────────────────────────┐
│   API Gateway / Load Balancer               │
│   - CORS Validation                         │
│   - Rate Limiting                           │
└──────────────┬──────────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────┐
│    Express.js Backend (Port 5000)           │
├─────────────────────────────────────────────┤
│ Middleware Layer                             │
│ - Authentication (JWT)                       │
│ - Authorization (RBAC)                       │
│ - Input Validation & Sanitization          │
│ - Rate Limiting per endpoint                │
│ - Security Headers                          │
├─────────────────────────────────────────────┤
│ Controller Layer                             │
│ - authController   (login, refresh, logout) │
│ - userController   (admin user management)  │
│ - projectController (project CRUD)          │
│ - documentController (secure file handling) │
├─────────────────────────────────────────────┤
│ Model/Schema Layer (Mongoose)               │
│ - User (with password hashing)              │
│ - Project (with access control)             │
│ - Document (with audit trail)               │
├─────────────────────────────────────────────┤
│ Service/Utility Layer                       │
│ - JWT token generation/validation           │
│ - File validation & checksums               │
│ - Encryption utilities                      │
└──────────────┬──────────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────┐
│   MongoDB Database                          │
│   - Encrypted at rest                       │
│   - Proper indexing                         │
│   - Access control at DB level              │
└─────────────────────────────────────────────┘
```

### 2.2 Request Flow

```
Client Request
    ↓
[Security Middleware]
    ├─ Helmet (security headers)
    ├─ CORS validation
    ├─ Rate limiting
    └─ Request logging
    ↓
[Input Validation & Sanitization]
    ├─ Parameter validation
    ├─ Type checking
    └─ Injection prevention
    ↓
[Authentication (if protected route)]
    ├─ JWT extraction & validation
    ├─ User existence check
    └─ Account status check
    ↓
[Authorization (role-based)]
    ├─ Required role check
    └─ Resource ownership check
    ↓
[Business Logic]
    ├─ Database operations
    ├─ Audit logging
    └─ File operations (if applicable)
    ↓
[Response Formatting]
    ├─ Sensitive data removal
    ├─ Error handling
    └─ Secure headers
    ↓
Client Response
```

---

## 3. Security Decisions & Rationale

### 3.1 Authentication (JWT + bcrypt)

**Decision**: Use JWT for stateless authentication + bcrypt for password hashing

**Rationale**:
- JWT tokens are stateless, allowing horizontal scaling
- bcrypt is intentionally slow (configurable rounds), defeating brute force attacks
- Two-token system (access + refresh) limits damage from token theft
- Access token expiration (15 min) minimizes exposure window
- Refresh token expiration (7 days) provides reasonable user experience

**Implementation**:
```
Login Flow:
1. User submits username + password
2. Lookup user in database (by username or email)
3. Hash provided password with stored salt
4. Compare with stored password hash (constant-time)
5. On success: Generate access + refresh tokens, track last login
6. On failure: Increment failed attempts, lock account after 5 attempts (2 hours)

Token Format:
- Access Token: {sub: userId, role: userRole, type: 'access'}
  Signed with HS256, expires in 15 minutes
- Refresh Token: {sub: userId, type: 'refresh'}
  Signed with different secret, expires in 7 days
```

### 3.2 Authorization (Role-Based Access Control)

**Decision**: Implement granular RBAC with explicit role-based rules

**Rationale**:
- Clear separation of concerns between admin, project lead, and developer roles
- Explicit access checks prevent accidental permission grants
- Database design ensures access control is enforced at query level

**Role Definitions**:
- **Admin**: Full system control, manages users, projects, all documents
- **Project Lead**: Manages assigned projects, assigns developers, uploads documents
- **Developer**: Views assigned projects, views assigned documents only

**Access Control Matrix**:
```
Resource      | Admin | Project Lead | Developer | Comment
──────────────┼───────┼──────────────┼───────────┼─────────
Create User   |  ✓    |      ✗       |     ✗     | Admin only
List Users    |  ✓    |      ✗       |     ✗     | Admin only
Update User   |  ✓    |      ✗       |     ✗     | Admin only
Delete User   |  ✓    |      ✗       |     ✗     | Admin only
──────────────┼───────┼──────────────┼───────────┼─────────
Create Project|  ✓    |      ✓       |     ✗     | Admin & Leads
List Projects |  All  |    Own       |  Assigned | Role-based filtering
View Project  |  All  |    Own       |  Assigned | Check membership
Update Project|  ✓    |   Own        |     ✗     | Admin & owner
Delete Project|  ✓    |      ✗       |     ✗     | Admin only
Assign Dev    |  ✓    |   Own        |     ✗     | Lead can assign to own
──────────────┼───────┼──────────────┼───────────┼─────────
Upload Doc    |  ✓    |   Own Proj   |     ✗     | Admin & Lead only
List Docs     |  All  |   Own Proj   |  Assigned | Check access list
View Doc Meta |  All  |   Own Proj   |  Assigned | Check access list
Download Doc  |  All  |   Own Proj   |  Assigned | Log access, verify
Delete Doc    | ✓ or  |              |     ✗     | Admin or uploader
              | Upload|              |           |
```

### 3.3 Input Validation & Sanitization

**Decision**: Validate ALL inputs, both client and server-side

**Rationale**:
- Client validation is for UX; server-side is for security
- Never trust client input
- Prevent injection attacks, XSS, malformed requests

**Implementation Layers**:
1. **Type Validation**: Express middleware checks field types
2. **Format Validation**: Regex/format checking (email, URL, dates)
3. **Range Validation**: Min/max lengths, numeric ranges
4. **Whitelist Validation**: Only allow known good values (roles, statuses)
5. **Sanitization**: Remove/escape dangerous characters
6. **Encoding**: Protect against XSS in responses

### 3.4 Password Security

**Decision**: Use bcrypt with 10+ rounds, enforce strong passwords

**Rationale**:
- bcrypt's slowness is a feature, not a bug (defeats high-speed hashing)
- Strong passwords prevent dictionary/rainbow table attacks
- 10 rounds = ~100ms per login on modern hardware

**Password Requirements**:
- Minimum 8 characters
- Must contain: uppercase, lowercase, number, special character
- No dictionary words or common patterns
- New password must differ from previous 5 passwords (future enhancement)

### 3.5 File Upload Security

**Decision**: Whitelist file types, validate MIME types, store outside webroot

**Rationale**:
- Blacklists are ineffective (too many extensions)
- MIME type validation prevents double-extension attacks
- Storing outside webroot prevents direct execution
- Checksums detect tampering/corruption

**File Upload Controls**:
1. File extension whitelist: pdf, doc, docx, txt, xlsx, xls, pptx
2. MIME type validation at upload
3. File size limit: 5MB per file
4. Store with sanitized name + timestamp + random suffix
5. Calculate SHA256 checksum
6. Store actual file outside webroot
7. Access only through authenticated API endpoints
8. Log all access (download/view) in audit trail

### 3.6 Rate Limiting & Brute Force Protection

**Decision**: Multi-layered rate limiting + account lockout

**Rationale**:
- Prevents credential stuffing attacks
- Slows down automated attacks
- Temporary lockout is better than permanent

**Implementation**:
- Global rate limit: 100 requests/15 minutes per IP
- Login endpoint: 5 attempts/15 minutes per username+IP
- Account lockout: After 5 failed attempts, lock for 2 hours
- Clear lockout on successful login

### 3.7 Database Security

**Decision**: Use Mongoose with validation, proper indexing, access control

**Rationale**:
- Schema validation ensures data integrity
- Indexes improve query efficiency (important for access control checks)
- Connection pooling handles concurrent requests safely
- Use parameterized queries (escape user input automatically)

**Indexes**:
- `User`: `email`, `username` (unique)
- `Project`: `projectLead`, `createdBy`, `assignedDevelopers`, `status`
- `Document`: `project`, `uploadedBy`, `accessibleBy.userId`, `filePath`

---

## 4. Data Models

### 4.1 User Model
```javascript
{
  _id: ObjectId,
  username: String (unique, email format),
  email: String (unique, normalized),
  password: String (bcrypt hash, not returned in responses),
  role: String (enum: admin, project-lead, developer),
  fullName: String,
  isActive: Boolean,
  lastLogin: Date,
  mfaEnabled: Boolean (future feature),
  mfaSecret: String (never exposed),
  passwordChangedAt: Date,
  loginAttempts: Number,
  lockUntil: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### 4.2 Project Model
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  deadline: Date,
  status: String (enum: active, completed, on-hold, cancelled),
  createdBy: ObjectId (ref: User),
  projectLead: ObjectId (ref: User),
  assignedDevelopers: [ObjectId] (ref: User),
  priority: String (enum: low, medium, high, critical),
  lastModifiedBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date
}
```

### 4.3 Document Model
```javascript
{
  _id: ObjectId,
  fileName: String (sanitized),
  originalFileName: String,
  filePath: String (disk location, not exposed),
  fileSize: Number,
  mimeType: String (validated),
  project: ObjectId (ref: Project),
  uploadedBy: ObjectId (ref: User),
  accessibleBy: [{
    userId: ObjectId (ref: User),
    role: String (admin, project-lead, developer)
  }],
  classification: String (public, internal, confidential, secret),
  checksum: String (SHA256),
  accessLog: [{
    userId: ObjectId,
    accessedAt: Date,
    action: String (viewed, downloaded)
  }],
  createdAt: Date,
  updatedAt: Date
}
```

---

## 5. Error Handling & Logging

### 5.1 Error Strategy

**Decision**: Return appropriate HTTP status codes without exposing internal details

```
200 OK        - Successful GET/POST/PUT
201 Created   - Resource created
204 No Content- Successful DELETE
400 Bad Request - Invalid input, validation failure
401 Unauthorized - Missing/invalid authentication
403 Forbidden - Authenticated but insufficient permissions
404 Not Found - Resource doesn't exist
409 Conflict - Resource already exists (duplicate)
429 Too Many Requests - Rate limited
500 Internal Server Error - Server error (no details in production)
```

### 5.2 Logging

**Information Logged**:
- Authentication attempts (success/failure)
- Authorization denials
- Data modifications (create, update, delete)
- File access (download, view)
- Failed validations
- Rate limit violations
- Configuration errors at startup

**Information NOT Logged**:
- Passwords or password hashes
- JWT tokens
- Credit card numbers
- MFA secrets
- API keys

---

## 6. Deployment Considerations

### 6.1 Environment Configuration

**Production** (./env.production):
- JWT secrets: Strong random 32+ character strings
- Database: Use connection pooling, SSL/TLS
- CORS: Restrict to exact frontend domain
- Rate limiting: Adjust based on load
- HTTPS: Mandatory
- Security headers: All enabled

**Development** (./env.example):
- Use dev credentials for testing
- May disable HTTPS (only for dev)
- Log verbose information
- Allow localhost CORS

### 6.2 Security Checklist

- [ ] Change default JWT secrets
- [ ] Set strong database password (not in code)
- [ ] Enable HTTPS/TLS (production)
- [ ] Enable security headers
- [ ] Set proper CORS origin
- [ ] Configure rate limiting thresholds
- [ ] Set up database backups
- [ ] Enable database encryption
- [ ] Implement log aggregation
- [ ] Set up monitoring & alerts
- [ ] Regular security audits
- [ ] Dependency updates (npm audit)

---

## 7. Technology Stack Justification

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Backend | Node.js/Express | Async/non-blocking, good for I/O, large ecosystem |
| Frontend | React | Component-based, good for role-based UX |
| Database | MongoDB | Flexible schema, good for rapid development |
| Password Hashing | bcrypt | Industry standard, intentionally slow |
| Authentication | JWT | Stateless, scalable, standard |
| Rate Limiting | express-rate-limit | Lightweight, effective |
| Security Headers | Helmet | Comprehensive header management |
| Validation | express-validator | Flexible, industry standard |
| Testing | Jest + Supertest | Complete test suite capability |

---

## 8. Future Security Enhancements

1. **MFA (Multi-Factor Authentication)**
   - TOTP (Time-based One-Time Password)
   - Email-based OTP
   - Backup codes

2. **Advanced Threat Detection**
   - Anomaly detection (unusual login locations/times)
   - IP reputation checking
   - Device fingerprinting

3. **Encryption**
   - End-to-end encryption for documents
   - Database field-level encryption for sensitive data

4. **Audit & Compliance**
   - Detailed audit logs with immutability
   - GDPR compliance features
   - SOC 2 certification

5. **API Security**
   - API key management
   - OAuth2/OpenID Connect
   - OIDC federation

---

## Document History

- **Version 1.0** - Initial design
- **Date**: February 2026
- **Author**: PixelForge Nexus Security Team
