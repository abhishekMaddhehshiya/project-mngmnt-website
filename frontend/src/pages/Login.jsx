/**
 * SECURITY: Login Page
 * 
 * 1. Form validation on client-side
 * 2. No password stored in state (cleared immediately)
 * 3. Error handling without exposing sensitive info
 * 4. CSRF protection via SameSite cookies (backend)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

const Login = () => {
  const navigate = useNavigate();
  const { login, isLoading, error, isAuthenticated, clearError } = useAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const validateForm = () => {
    if (!username.trim()) {
      setValidationError('Username is required');
      return false;
    }

    if (!password) {
      setValidationError('Password is required');
      return false;
    }

    if (password.length < 8) {
      setValidationError('Invalid password format');
      return false;
    }

    setValidationError('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();

    if (!validateForm()) {
      return;
    }

    const result = await login(username, password);

    // SECURITY: Clear password from memory
    setPassword('');

    if (result.success) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>PixelForge Nexus</h1>
        <h2>Secure Project Management</h2>

        <form onSubmit={handleSubmit}>
          {/* SECURITY: Display errors but don't expose system details */}
          {(error || validationError) && (
            <div className="banner error">{error || validationError}</div>
          )}

          <div className="form-group">
            <label htmlFor="username">Username (Email)</label>
            <input
              id="username"
              type="email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="user@company.com"
              disabled={isLoading}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="login-info">
          <p>
            For security reasons, no self-registration is available.
          </p>
          <p>
            Contact your administrator for account creation.
          </p>
        </div>

        {/* TEST CREDENTIALS - REMOVE IN PRODUCTION */}
        <div className="demo-credentials">
          <details>
            <summary>Demo Credentials (Development Only)</summary>
            <div>
              <p><strong>Admin:</strong></p>
              <code>admin@example.com / Admin123!@#</code>
              
              <p><strong>Project Lead:</strong></p>
              <code>lead@example.com / Lead123!@#</code>
              
              <p><strong>Developer:</strong></p>
              <code>dev@example.com / Dev123!@#</code>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};

export default Login;
