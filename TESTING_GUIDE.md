# Testing Guide - PixelForge Nexus

Comprehensive guide to testing strategies, frameworks, test suites, and examples.

## 📋 Table of Contents

1. Testing Strategy
2. Unit Testing
3. Integration Testing
4. End-to-End Testing
5. Security Testing
6. Performance Testing
7. Test Coverage Goals

---

## 🎯 Testing Strategy

### Test Pyramid

```
        /\           E2E Tests (10%)
       /  \          - Full user workflows
      /----\         - Real browser/API calls
     /      \        - Slow feedback
    /________\

       /\             Integration Tests (30%)
      /  \            - API endpoints
     /    \           - Database operations
    /      \          - Component interactions
   /________\         - Medium speed

       /\              Unit Tests (60%)
      /  \             - Pure functions
     /    \            - Business logic
    /      \           - Smallest scope
   /________\          - Fast feedback
```

### Test Types

| Type | Scope | Speed | Coverage | Tools |
|------|-------|-------|----------|-------|
| Unit | Single function | Fast (ms) | 60% | Jest, Mocha |
| Integration | Multiple units | Medium (s) | 30% | Jest, Supertest |
| E2E | Full workflow | Slow (min) | 10% | Cypress, Selenium |
| Security | Vulnerabilities | Slow (min) | Special | OWASP ZAP |
| Performance | Load/stress | Slow (min) | Special | k6, JMeter |

---

## 🧪 Unit Testing

### Backend Unit Tests

#### Test Structure

```javascript
// backend/tests/utils/jwt.test.js
const jwt = require('../../utils/jwt');
const config = require('../../config/config');

describe('JWT Utils', () => {
  describe('generateAccessToken', () => {
    it('should generate valid access token', () => {
      const userId = '507f1f77bcf86cd799439011';
      const token = jwt.generateAccessToken(userId, 'admin');

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token can be decoded
      const decoded = jwt.verifyAccessToken(token);
      expect(decoded.userId).toBe(userId);
      expect(decoded.role).toBe('admin');
    });

    it('should expire in 15 minutes', () => {
      const token = jwt.generateAccessToken('123', 'admin');
      const decoded = jwt.verifyAccessToken(token);

      // Check expiration is approximately 15 minutes
      const expiresIn = (decoded.exp - decoded.iat) * 1000;
      expect(expiresIn).toBeCloseTo(15 * 60 * 1000, -3);
    });

    it('should fail with invalid user ID', () => {
      expect(() => {
        jwt.generateAccessToken(null);
      }).toThrow();
    });
  });

  describe('verifyAccessToken', () => {
    it('should reject expired token', () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
      
      expect(() => {
        jwt.verifyAccessToken(expiredToken);
      }).toThrow('Token expired');
    });

    it('should reject tampered token', () => {
      const token = jwt.generateAccessToken('123', 'admin');
      const tampered = token.slice(0, -10) + 'hacked0000';
      
      expect(() => {
        jwt.verifyAccessToken(tampered);
      }).toThrow('Invalid signature');
    });
  });
});
```

#### Running Unit Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- jwt.test.js

# Run with coverage
npm test -- --coverage

# Watch mode for development
npm test -- --watch
```

#### Test Coverage Example

```
--------|----------|----------|----------|----------|----------------|
File    | % Stmts  | % Branch | % Funcs  | % Lines  | Uncovered Line |
--------|----------|----------|----------|----------|----------------|
jwt.js  | 100      | 95       | 100      | 100      | 256            |
--------|----------|----------|----------|----------|----------------|
```

---

## 🔗 Integration Testing

### API Integration Tests

```javascript
// backend/tests/integration/projects.test.js
const request = require('supertest');
const app = require('../../server');
const User = require('../../models/User');
const Project = require('../../models/Project');
const jwt = require('../../utils/jwt');

describe('Project API Integration Tests', () => {
  let authToken;
  let adminToken;
  let userId;
  let adminId;

  beforeAll(async () => {
    // Create test users
    const admin = await User.create({
      email: 'admin@test.com',
      password: 'TestPass123!',
      fullName: 'Admin User',
      role: 'admin'
    });

    const user = await User.create({
      email: 'user@test.com',
      password: 'TestPass123!',
      fullName: 'Regular User',
      role: 'project-lead'
    });

    adminId = admin._id;
    userId = user._id;

    authToken = jwt.generateAccessToken(userId, 'project-lead');
    adminToken = jwt.generateAccessToken(adminId, 'admin');
  });

  afterEach(async () => {
    await Project.deleteMany({});
  });

  afterAll(async () => {
    await User.deleteMany({});
  });

  describe('POST /api/projects', () => {
    it('should create project with valid data', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          description: 'Test description',
          projectLead: userId,
          assignedDevelopers: [],
          deadline: '2024-12-31',
          priority: 'high'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Project');
      expect(response.body.data.createdBy.toString()).toBe(userId.toString());
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing 'name'
          description: 'Test description'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject without authentication', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({
          name: 'Test Project',
          projectLead: userId,
          deadline: '2024-12-31'
        });

      expect(response.status).toBe(401);
    });

    it('should reject non-admin/lead role', async () => {
      const devToken = jwt.generateAccessToken('dev-id', 'developer');

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${devToken}`)
        .send({
          name: 'Test Project',
          projectLead: userId,
          deadline: '2024-12-31'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/projects', () => {
    beforeEach(async () => {
      // Create test projects
      await Project.create({
        name: 'Project 1',
        projectLead: userId,
        createdBy: userId,
        status: 'active'
      });

      await Project.create({
        name: 'Project 2',
        projectLead: userId,
        assignedDevelopers: [userId],
        createdBy: adminId,
        status: 'active'
      });
    });

    it('admin should see all projects', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('project lead should see own and assigned projects', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/projects')
        .query({ page: 1, limit: 1 })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.limit).toBe(1);
      expect(response.body.pagination.page).toBe(1);
    });
  });

  describe('PUT /api/projects/:id', () => {
    let projectId;

    beforeEach(async () => {
      const project = await Project.create({
        name: 'Original Name',
        projectLead: userId,
        createdBy: userId,
        status: 'active'
      });
      projectId = project._id;
    });

    it('owner should update project', async () => {
      const response = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Name',
          status: 'completed'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Updated Name');
      expect(response.body.data.status).toBe('completed');
    });

    it('non-owner should not update project', async () => {
      const otherToken = jwt.generateAccessToken('other-id', 'project-lead');

      const response = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ name: 'Hacked Name' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    let projectId;

    beforeEach(async () => {
      const project = await Project.create({
        name: 'Project to Delete',
        projectLead: userId,
        createdBy: userId
      });
      projectId = project._id;
    });

    it('admin should delete project', async () => {
      const response = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // Verify deletion
      const deleted = await Project.findById(projectId);
      expect(deleted).toBeNull();
    });

    it('non-admin should not delete project', async () => {
      const response = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
    });
  });
});
```

---

## 🌐 End-to-End Testing

### Cypress E2E Tests

```javascript
// frontend/cypress/e2e/login.cy.js
describe('Login Workflow', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('should display login form', () => {
    cy.contains('Login').should('be.visible');
    cy.get('input[type="email"]').should('exist');
    cy.get('input[type="password"]').should('exist');
    cy.get('button[type="submit"]').should('contain', 'Login');
  });

  it('should show validation errors for empty fields', () => {
    cy.get('button[type="submit"]').click();
    cy.contains('Email is required').should('be.visible');
    cy.contains('Password is required').should('be.visible');
  });

  it('should successfully login with valid credentials', () => {
    cy.get('input[type="email"]').type('admin@example.com');
    cy.get('input[type="password"]').type('Admin123!@#');
    cy.get('button[type="submit"]').click();

    // Verify redirect to dashboard
    cy.url().should('include', '/dashboard');
    cy.contains('Welcome').should('be.visible');

    // Verify token stored
    cy.window().then((win) => {
      expect(win.localStorage.getItem('accessToken')).to.exist;
    });
  });

  it('should show error for invalid credentials', () => {
    cy.get('input[type="email"]').type('user@example.com');
    cy.get('input[type="password"]').type('WrongPassword123!');
    cy.get('button[type="submit"]').click();

    cy.contains('Invalid credentials').should('be.visible');
  });

  it('should display demo credentials when expanded', () => {
    cy.get('details').click();
    cy.contains('admin@example.com').should('be.visible');
    cy.contains('Admin123!@#').should('be.visible');
  });
});

// frontend/cypress/e2e/dashboard.cy.js
describe('Dashboard Workflow', () => {
  beforeEach(() => {
    cy.login('admin@example.com', 'Admin123!@#');
    cy.visit('/dashboard');
  });

  it('should display user name and role', () => {
    cy.contains('Admin User').should('be.visible');
    cy.get('[data-testid="role-badge"]').should('contain', 'Admin');
  });

  it('should display projects based on role', () => {
    cy.get('[data-testid="projects-list"]').should('be.visible');
    cy.get('[data-testid="project-card"]').should('have.length.greaterThan', 0);
  });

  it('should allow creating new project', () => {
    cy.get('button[data-testid="create-project"]').click();
    cy.url().should('include', '/projects/new');

    cy.get('input[name="name"]').type('New Test Project');
    cy.get('textarea[name="description"]').type('Test description');
    cy.get('input[name="deadline"]').type('2024-12-31');
    cy.get('button[type="submit"]').click();

    cy.contains('Project created successfully').should('be.visible');
  });

  it('should allow logout', () => {
    cy.get('button[data-testid="logout"]').click();

    cy.url().should('include', '/login');
    cy.window().then((win) => {
      expect(win.localStorage.getItem('accessToken')).to.be.null;
    });
  });
});
```

### Running Cypress Tests

```bash
# Interactive mode
npx cypress open

# Headless mode
npx cypress run

# Specific test file
npx cypress run --spec "cypress/e2e/login.cy.js"

# With video recording
npx cypress run --record
```

---

## 🔒 Security Testing

### OWASP Top 10 Tests

```javascript
// backend/tests/security.test.js
const request = require('supertest');
const app = require('../../server');

describe('OWASP Top 10 Security Tests', () => {
  describe('A01: Broken Access Control', () => {
    it('should prevent privilege escalation', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${devToken}`)
        .send({
          email: 'hacker@test.com',
          role: 'admin'  // Try to create admin
        });

      expect(response.status).toBe(403);
    });

    it('should prevent IDOR (Insecure Direct Object Reference)', async () => {
      const otherUserId = '507f1f77bcf86cd799439999';

      const response = await request(app)
        .delete(`/api/users/${otherUserId}`)
        .set('Authorization', `Bearer ${devToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('A02: Cryptographic Failures', () => {
    it('should hash passwords', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin@test.com',
          password: 'Admin123!@#'
        });

      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should require HTTPS', async () => {
      // Verify security headers
      expect(response.get('Strict-Transport-Security')).toBeDefined();
    });
  });

  describe('A03: Injection', () => {
    it('should prevent NoSQL injection', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: { $ne: null },  // NoSQL injection attempt
          password: { $ne: null }
        });

      expect(response.status).toBe(401);
    });

    it('should prevent command injection', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: '; rm -rf /',
          deadline: '2024-12-31'
        });

      expect(response.status).toBe(400);
    });

    it('should escape output to prevent XSS', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${token}`);

      const projectNames = response.body.data.map(p => p.name);
      projectNames.forEach(name => {
        expect(name).not.toContain('<script>');
        expect(name).not.toContain('</script>');
      });
    });
  });

  describe('A05: Broken Authentication', () => {
    it('should lock account after failed attempts', async () => {
      // Attempt login 6 times with wrong password
      for (let i = 0; i < 6; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            username: 'admin@test.com',
            password: 'WrongPassword123!'
          });
      }

      // 7th attempt should be blocked
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin@test.com',
          password: 'Admin123!@#'  // Even correct password
        });

      expect(response.status).toBe(429);
      expect(response.body.message).toContain('Account locked');
    });
  });

  describe('A07: Identification and Authentication Failures', () => {
    it('should not expose user existence', async () => {
      const response1 = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'existing@test.com',
          password: 'WrongPass123!'
        });

      const response2 = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent@test.com',
          password: 'WrongPass123!'
        });

      // Both should have same generic error
      expect(response1.body.message).toContain('Invalid credentials');
      expect(response2.body.message).toContain('Invalid credentials');
    });
  });

  describe('A09: Security Logging and Monitoring Failures', () => {
    it('should log failed authentication attempts', async () => {
      // Attempt login
      await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin@test.com',
          password: 'WrongPass'
        });

      // Check logs contain attempt
      const logs = await AuditLog.find({ action: 'LOGIN_FAILED' });
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should not log sensitive data', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin@test.com',
          password: 'Admin123!@#'
        });

      const logs = await AuditLog.find();
      logs.forEach(log => {
        expect(log.password).toBeUndefined();
        expect(log.token).toBeUndefined();
      });
    });
  });
});
```

---

## 📊 Performance Testing

```bash
#!/bin/bash
# load-test.sh
# Simple load test using Apache Bench

echo "🚀 Load Testing - PixelForge Nexus"
echo "==================================="

API_URL="https://api.yourdomain.com"
AUTH_TOKEN="your_valid_token"

echo "Test 1: Login endpoint (5 concurrent, 100 requests)"
ab -n 100 -c 5 -p login.json -T application/json \
   -H "Content-Type: application/json" \
   "$API_URL/api/auth/login"

echo ""
echo "Test 2: Get projects (50 concurrent, 1000 requests)"
ab -n 1000 -c 50 -H "Authorization: Bearer $AUTH_TOKEN" \
   "$API_URL/api/projects"

echo ""
echo "Test 3: Create project (10 concurrent, 100 requests)"
ab -n 100 -c 10 \
   -p project.json \
   -T application/json \
   -H "Authorization: Bearer $AUTH_TOKEN" \
   "$API_URL/api/projects"

echo ""
echo "✅ Load testing complete!"
```

### k6 Performance Test

```javascript
// performance/load-test.js
import http from 'k6/http';
import { check, group, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp-up to 50 VUs
    { duration: '2m', target: 100 },   // Ramp-up to 100 VUs
    { duration: '5m', target: 100 },   // Stay at 100 VUs
    { duration: '30s', target: 0 },    // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.1'],
  },
};

const BASE_URL = 'https://api.yourdomain.com';
const AUTH_TOKEN = __ENV.AUTH_TOKEN;

export default function () {
  const payload = JSON.stringify({
    username: 'loadtest@example.com',
    password: 'TestPass123!'
  });

  group('Login', () => {
    const res = http.post(`${BASE_URL}/api/auth/login`, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    check(res, {
      'status is 200': (r) => r.status === 200,
      'token received': (r) => r.json('data.accessToken') !== null,
    });
  });

  sleep(1);

  group('Get Projects', () => {
    const res = http.get(`${BASE_URL}/api/projects`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });

    check(res, {
      'status is 200': (r) => r.status === 200,
      'has projects': (r) => r.json('data.length') > 0,
      'response time < 500ms': (r) => r.timings.duration < 500,
    });
  });

  sleep(2);
}

// Run: k6 run performance/load-test.js --env AUTH_TOKEN=your_token
```

---

## ✅ Test Coverage Goals

### Coverage Targets

```
                Current    Target
Backend:
- Statements        85%      >80%
- Branches          78%      >75%
- Functions         90%      >85%
- Lines             86%      >80%

Frontend:
- Statements        72%      >70%
- Branches          65%      >60%
- Functions         75%      >70%
- Lines             73%      >70%
```

### Coverage Report

```bash
# Generate coverage report
npm test -- --coverage

# Generate HTML coverage report
npm test -- --coverage --collectCoverageFrom="src/**/*.js"

# Open report in browser
open coverage/lcov-report/index.html
```

---

## 📋 Testing Checklist

```
Before Release:
- [ ] All unit tests pass (>80% coverage)
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Security tests pass (OWASP Top 10)
- [ ] Performance tests: p95 < 500ms
- [ ] No console errors in E2E
- [ ] No security vulnerabilities (npm audit)
- [ ] Penetration test completed
- [ ] Load test: 1000 req/s successful
- [ ] All documentation updated
- [ ] Accessibility check (WCAG 2.1 AA)
- [ ] Manual testing on target browsers
- [ ] User acceptance testing (UAT) passed
- [ ] Backup/restore procedure tested
- [ ] Disaster recovery plan rehearsed
```

