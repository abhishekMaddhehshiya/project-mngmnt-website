# PixelForge Nexus - Threat Modeling (STRIDE)

## Overview

This document details threat modeling using the STRIDE method (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) for PixelForge Nexus.

---

## 1. SPOOFING (Identity)

### Threat 1.1: Credential Stuffing / Brute Force
**Risk**: Attacker uses stolen credentials or automated tools to compromise user accounts

**Mitigation**:
- ✓ Rate limiting: 5 login attempts per 15 minutes
- ✓ Account lockout: 2 hours after 5 failed attempts
- ✓ Strong password policy (8+ chars, mixed case, numbers, special chars)
- ✓ Failed attempt logging for detection

**Residual Risk**: Low - Multiple layers of protection

---

### Threat 1.2: Token Theft
**Risk**: Attacker steals JWT token from localStorage or network

**Mitigation**:
- ✓ HTTPS only (encryption in transit)
- ✓ Short-lived access tokens (15 min expiration)
- ✓ Refresh tokens stored securely (httpOnly cookies in production)
- ✓ Token revocation on logout
- ✓ Continuous token validation
- ✗ Future: Token blacklisting for immediate revocation

**Residual Risk**: Medium - Access window is limited

---

### Threat 1.3: Impersonation of Admin
**Risk**: Non-admin user gains admin access through privilege escalation

**Mitigation**:
- ✓ Role hardcoded in JWT token (verified server-side)
- ✓ Role immutable after token issuance
- ✓ Admin operations require re-authentication
- ✓ All admin actions logged with user ID

**Residual Risk**: Low - Multiple verification points

---

## 2. TAMPERING (Data Integrity)

### Threat 2.1: Document Tampering
**Risk**: Attacker modifies uploaded documents

**Mitigation**:
- ✓ SHA256 checksum calculated on upload
- ✓ File stored outside webroot (no direct access)
- ✓ Access control: Only authorized users can access
- ✓ Audit trail: All document access logged
- ✓ File immutability: Replace, don't modify

**Residual Risk**: Low - Multiple layers of detection

---

### Threat 2.2: JWT Token Tampering
**Risk**: Attacker modifies JWT claims (e.g., change role)

**Mitigation**:
- ✓ HMAC signature verification on every request
- ✓ Secret key never exposed (server-side only)
- ✓ Constant-time comparison prevents timing attacks
- ✗ Future: Use RS256 (asymmetric signing) for multi-service ecosystem

**Residual Risk**: Very Low - Cryptographically secure

---

### Threat 2.3: Database Injection
**Risk**: Attacker executes unintended database commands

**Mitigation**:
- ✓ Mongoose ORM prevents direct SQL (N/A to MongoDB)
- ✓ Parameterized queries (no string concatenation)
- ✓ Input validation/sanitization before DB queries
- ✓ Schema validation enforces data types
- ✓ Escape special characters

**Residual Risk**: Very Low - ORM + validation layer

---

## 3. REPUDIATION (Non-Repudiation)

### Threat 3.1: User Denies Actions
**Risk**: User denies they created/modified a project

**Mitigation**:
- ✓ `createdBy` and `lastModifiedBy` fields track user ID
- ✓ Timestamps on all records (createdAt, updatedAt)
- ✓ Audit log for sensitive operations
- ✗ Future: Digital signatures for critical operations

**Residual Risk**: Medium - Audit trail exists but not signed

---

### Threat 3.2: Admin Denies Privilege Escalation
**Risk**: Admin claims they didn't escalate a user's privileges

**Mitigation**:
- ✓ All admin actions logged with timestamp + user ID
- ✓ Before/after snapshots for user role changes
- ✓ Detailed audit trail
- ✗ Future: Cryptographic proof of actions (blockchain?)

**Residual Risk**: Medium - Depends on log integrity

---

## 4. INFORMATION DISCLOSURE (Confidentiality)

### Threat 4.1: Exposure of Passwords
**Risk**: Passwords exposed in logs, memory, or responses

**Mitigation**:
- ✓ Passwords hashed with bcrypt (not reversible)
- ✓ Passwords never logged
- ✓ Passwords never returned in API responses
- ✓ Passwords marked as `select: false` in schema
- ✓ Constant-time comparison prevents timing attacks

**Residual Risk**: Very Low - Hashed passwords only

---

### Threat 4.2: Document Exposure to Unauthorized Users
**Risk**: Attacker accesses documents they shouldn't

**Mitigation**:
- ✓ Explicit access control list (accessibleBy)
- ✓ File access requires authentication + authorization
- ✓ File path never exposed in API (only file ID)
- ✓ Each document query checks access
- ✓ File stored outside webroot
- ✓ No directory listing allowed

**Residual Risk**: Low - Multiple access checks

---

### Threat 4.3: JWT Token Exposure in URL/Logs
**Risk**: Token captured in HTTP logs, browser history, or proxies

**Mitigation**:
- ✓ Tokens in Authorization header (not query params)
- ✓ HTTPS only (no local logging of Authorization header)
- ✓ Refresh tokens httpOnly cookies (in production)
- ✓ Short-lived access tokens
- ✓ Token not logged in application logs

**Residual Risk**: Low - Standard practice with limitations

---

### Threat 4.4: Database Dump/Backup Exposure
**Risk**: Backup files containing plaintext or poorly protected data

**Mitigation**:
- ✓ Passwords hashed with bcrypt
- ✓ MFA secrets encrypted (if enabled)
- ✓ Document files stored separately from database
- ✗ Future: Database-level encryption at rest
- ✗ Future: Encrypted backups with separate key management

**Residual Risk**: Medium - Depends on backup security

---

### Threat 4.5: Error Messages Revealing System Details
**Risk**: Stack traces leak information about system architecture

**Mitigation**:
- ✓ Generic error messages in production
- ✓ Stack traces only shown in development
- ✓ Database errors don't include schema info
- ✓ File system errors don't reveal paths

**Residual Risk**: Very Low - Sanitized error responses

---

## 5. DENIAL OF SERVICE (DoS)

### Threat 5.1: Login Rate Limiting Bypass
**Risk**: Attacker uses distributed IPs to bypass rate limiting

**Mitigation**:
- ✓ Per-IP rate limiting
- ✓ Per-username+ IP rate limiting
- ✓ Account lockout after failures
- ✗ Future: Behavioral analysis (new device, new location)
- ✗ Future: IP reputation checking

**Residual Risk**: Medium - Advanced attackers may bypass

---

### Threat 5.2: File Upload DoS
**Risk**: Attacker uploads many large files to exhaust disk space

**Mitigation**:
- ✓ File size limit: 5MB per file
- ✓ Rate limiting on upload endpoints
- ✓ Storage quota per user (future)
- ✓ Duplicate file detection via checksum (future)
- ✗ Disk space monitoring needs to be implemented

**Residual Risk**: Medium - Admin monitoring required

---

### Threat 5.3: Resource Exhaustion
**Risk**: Attacker makes many requests to expensive endpoints

**Mitigation**:
- ✓ Global rate limit: 100 req/15 min per IP
- ✓ Connection timeouts
- ✓ Query result limits (pagination)
- ✓ Database connection pooling

**Residual Risk**: Low - Layered protection

---

### Threat 5.4: Password Reset Flooding
**Risk**: Even though system has no self-registration, if password reset exists...

**Mitigation**:
- ✓ No password reset endpoint (admin resets only)
- ✓ Rate limit on password change (inherits from auth rate limit)

**Residual Risk**: Very Low - No vulnerable endpoint

---

## 6. ELEVATION OF PRIVILEGE (Escalation)

### Threat 6.1: Developer Escalating to Admin
**Risk**: Developer somehow gains admin role

**Mitigation**:
- ✓ Role is immutable in JWT (once issued)
- ✓ Role verification on every admin request
- ✓ Role only changeable by database/admin
- ✓ Admin actions logged with audit trail
- ✓ Role changes require direct database modification

**Residual Risk**: Low - Requires database compromise

---

### Threat 6.2: Developer Accessing Other Project's Documents
**Risk**: Developer requests documents from projects they're not assigned to

**Mitigation**:
- ✓ Document queries check accessibleBy list
- ✓ Every document download verified against project assignment
- ✓ File path never exposed (only through API)
- ✓ Direct URL access fails without authorization

**Residual Risk**: Very Low - Per-request verification

---

### Threat 6.3: Project Lead Accessing Admin Functions
**Risk**: Project lead somehow calls admin-only endpoints

**Mitigation**:
- ✓ `authorize('admin')` middleware on admin routes
- ✓ Role check happens before controller executes
- ✓ Every protected route has explicit role check
- ✓ No fallback or backdoors

**Residual Risk**: Very Low - Explicit middleware

---

### Threat 6.4: Modified JWT Granting Higher Privilege
**Risk**: Client modifies JWT to change role

**Mitigation**:
- ✓ HMAC signature invalidates if modified
- ✓ Signature verified on server before use
- ✓ Secret key on server only (never exposed to client)
- ✓ HS256 (HMAC) is cryptographically secure

**Residual Risk**: Very Low - Cryptographically secure

---

## 7. Security Control Summary

### High Priority (Critical)
- [x] Password hashing with bcrypt
- [x] JWT authentication with signature verification
- [x] Role-based access control (RBAC)
- [x] Input validation and sanitization
- [x] Rate limiting on sensitive endpoints
- [x] Document access control
- [x] HTTPS support

### Medium Priority (Important)
- [x] Security headers (Helmet)
- [x] Audit logging
- [x] Account lockout on failed attempts
- [x] File upload validation
- [x] CORS configuration
- [x] Error handling (no info disclosure)
- [ ] MFA support (future)
- [ ] GeoIP-based anomaly detection (future)

### Low Priority (Nice to Have)
- [ ] Intrusion detection
- [ ] Honeypot endpoints
- [ ] Advanced analytics
- [ ] Hardware security tokens

---

## 8. Attack Scenarios & Responses

### Scenario 1: Credential Stuffing Attack
**Attacker**: Has list of 100 username/password pairs from other breaches
**Attack**: Tries to login with each pair

**Response**:
1. Rate limit triggers after 5 attempts per IP per username
2. Account lockout happens for 2 hours
3. Admin sees spike in failed logins
4. Attacker's IP is flagged for review

**Outcome**: **Defended** ✓

---

### Scenario 2: IDOR (Insecure Direct Object Reference)
**Attacker**: Developer tries to access document they weren't assigned to
**Attack**: Direct API request: `GET /api/documents/61234567890abcdef`

**Response**:
1. Controller fetches document
2. Checks `canAccessDocument()` function
3. Verifies user ID is in accessibleBy list
4. Returns 403 Forbidden

**Outcome**: **Defended** ✓

---

### Scenario 3: Privilege Escalation via JWT
**Attacker**: Changes JWT role from "developer" to "admin"
**Attack**: Tampers with JWT in browser dev tools

**Response**:
1. JWT signature no longer valid
2. Server rejects as invalid token when verifying signature
3. Request fails with 401 Unauthorized

**Outcome**: **Defended** ✓

---

### Scenario 4: File Upload Malware
**Attacker**: Uploads executable (.exe) as project document
**Attack**: Tries to put malware on server

**Response**:
1. Multer fileFilter rejects non-allowed MIME types
2. Document controller validates extension
3. File is not saved
4. Returns 400 Bad Request

**Outcome**: **Defended** ✓

---

### Scenario 5: Database Injection
**Attacker**: Username field contains `{$ne: null}`
**Attack**: NoSQL injection to bypass authentication

**Response**:
1. Mongoose schema expects string type
2. Input validation checks email format
3. Direct object in username field fails validation
4. Request rejected with 400 Bad Request

**Outcome**: **Defended** ✓

---

## 9. Assumptions & Trust Boundaries

### Trust Assumptions
- ✓ Server not compromised
- ✓ HTTPS/TLS working correctly
- ✓ Database server is secure
- ✓ Admin/developers are trusted for their role
- ✗ Client browser is secure (XSS possible if compromised)

### Trust Boundaries
```
┌─────────────────────────────────────────┐
│         TRUSTED BOUNDARY                 │
│    (Server-side validation happens)     │
│         ↓                                │
│  ┌──────────────────────────┐           │
│  │   Express.js Backend      │           │
│  │   - Validation            │           │
│  │   - Authentication        │           │
│  │   - Authorization         │           │
│  └──────────────────────────┘           │
│         ↑                                │
│         │ HTTPS/TLS                     │
│         ↑                                │
│  ┌──────────────────────────┐           │
│  │   Client (Untrusted)     │           │
│  │   - Browser              │           │
│  │   - May have XSS malware │           │
│  └──────────────────────────┘           │
└─────────────────────────────────────────┘
```

---

## 10. Risk Assessment Matrix

| Threat | Severity | Likelihood | Risk | Status |
|--------|----------|-----------|------|--------|
| Brute Force Login | High | Medium | High | **Mitigated** ✓ |
| Token Theft | Critical | Low | Medium | **Mitigated** ✓ |
| Privilege Escalation | Critical | Very Low | Low | **Mitigated** ✓ |
| Document IDOR | High | Very Low | Low | **Mitigated** ✓ |
| Password Exposure | Critical | Very Low | Low | **Mitigated** ✓ |
| File Upload Malware | High | Low | Medium | **Mitigated** ✓ |
| Database Injection | Critical | Very Low | Very Low | **Mitigated** ✓ |
| Cookie Theft | High | Medium | High | **Mitigated** ✓ |
| DDoS Attack | High | High | High | **Partially Mitigated** ⚠ |
| Backup Exposure | High | Very Low | Low | **Partially Mitigated** ⚠ |

---

## 11. Recommendations

1. **Immediate (Sprint 1)**:
   - [x] Implement rate limiting
   - [x] Enable HTTPS (production)
   - [x] Set up logging
   - [x] Configure CORS

2. **Short-term (Sprint 2-3)**:
   - [ ] MFA support
   - [ ] API key authentication
   - [ ] Disaster recovery plan
   - [ ] Security documentation review

3. **Long-term (Quarter 2)**:
   - [ ] Penetration testing
   - [ ] Security audit
   - [ ] SOC 2 compliance
   - [ ] Red team exercise

---

## Document History

- **Version 1.0** - Initial threat model
- **Date**: February 2026
- **Threat Model Method**: STRIDE
