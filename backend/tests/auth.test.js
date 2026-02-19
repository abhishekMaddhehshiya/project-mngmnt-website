/**
 * SECURITY: Authentication Tests
 * 
 * Test cases:
 * 1. Valid login with correct credentials
 * 2. Failed login with incorrect password
 * 3. Failed login with non-existent user
 * 4. Account lockout after failed attempts
 * 5. Token refresh
 * 6. Password change
 * 7. Invalid JWT tokens
 */

import request from 'supertest';
import app from '../server.js';
import User from '../models/User.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';

describe('Authentication Tests', () => {
  let testUser;
  let accessToken;
  let refreshToken;
  
  // Setup test data before tests
  beforeAll(async () => {
    // Create test user
    testUser = new User({
      username: 'test.user@example.com',
      email: 'test.user@example.com',
      password: 'TestPassword@123',
      fullName: 'Test User',
      role: 'developer',
    });
    await testUser.save();
    
    // Generate tokens
    accessToken = generateAccessToken(testUser._id, testUser.role);
    refreshToken = generateRefreshToken(testUser._id);
  });
  
  // Cleanup after tests
  afterAll(async () => {
    await User.deleteMany({ email: /test.user/ });
  });
  
  /**
   * TEST: Valid login returns tokens
   */
  describe('POST /api/auth/login', () => {
    test('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'test.user@example.com',
          password: 'TestPassword@123',
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.id).toBeDefined();
    });
    
    /**
     * TEST: Invalid password returns 401
     */
    test('should reject login with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'test.user@example.com',
          password: 'WrongPassword@123',
        });
      
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      // SECURITY: Don't reveal if user exists
      expect(res.body.message).toContain('Invalid username or password');
    });
    
    /**
     * TEST: Non-existent user returns 401
     */
    test('should reject login for non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent@example.com',
          password: 'password@123',
        });
      
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
    
    /**
     * TEST: Missing credentials returns 400
     */
    test('should reject login without credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
  
  /**
   * TEST: Refresh token functionality
   */
  describe('POST /api/auth/refresh-token', () => {
    test('should refresh token with valid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken })
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });
    
    /**
     * TEST: Invalid refresh token returns 401
     */
    test('should reject invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'invalid.token.here' })
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
  
  /**
   * TEST: Change password functionality
   */
  describe('PUT /api/auth/change-password', () => {
    test('should change password with valid old password', async () => {
      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          oldPassword: 'TestPassword@123',
          newPassword: 'NewPassword@456',
          confirmPassword: 'NewPassword@456',
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
    
    /**
     * TEST: Wrong old password returns 401
     */
    test('should reject password change with wrong old password', async () => {
      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          oldPassword: 'WrongOldPassword@123',
          newPassword: 'NewPassword@456',
          confirmPassword: 'NewPassword@456',
        });
      
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
    
    /**
     * TEST: Mismatched passwords return 400
     */
    test('should reject password change with mismatched passwords', async () => {
      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          oldPassword: 'TestPassword@123',
          newPassword: 'NewPassword@456',
          confirmPassword: 'DifferentPassword@456',
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
  
  /**
   * TEST: Protected route access
   */
  describe('Protected Routes', () => {
    test('should return 401 without authentication token', async () => {
      const res = await request(app)
        .get('/api/auth/me');
      
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
    
    /**
     * TEST: Valid token grants access
     */
    test('should access protected route with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBeDefined();
    });
    
    /**
     * TEST: Invalid token returns 401
     */
    test('should reject request with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here');
      
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
    
    /**
     * TEST: Malformed authorization header
     */
    test('should reject request with malformed auth header', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'InvalidFormat token');
      
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
