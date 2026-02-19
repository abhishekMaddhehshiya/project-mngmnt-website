/**
 * SECURITY: Protected Route Component
 * 
 * 1. Enforces authentication before rendering
 * 2. Enforces role-based access at UI level
 * 3. Redirects to login if not authenticated
 * 4. Shows 403 if user lacks required role
 */

import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

/**
 * SECURITY: ProtectedRoute wrapper
 * 
 * Usage:
 * <ProtectedRoute requiredRoles={['admin', 'project-lead']}>
 *   <AdminPanel />
 * </ProtectedRoute>
 */
const ProtectedRoute = ({ children, requiredRoles = [] }) => {
  const { user, isAuthenticated, isLoading, initializeAuth } = useAuthStore();

  useEffect(() => {
    // Initialize auth state on mount
    if (!isAuthenticated && !isLoading) {
      initializeAuth();
    }
  }, [isAuthenticated, isLoading, initializeAuth]);

  // Still loading
  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  // Not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Role-based access control
  if (requiredRoles.length > 0 && !requiredRoles.includes(user?.role)) {
    return (
      <div className="error-page">
        <h1>403 - Forbidden</h1>
        <p>You do not have permission to access this page.</p>
        <p>Required role: {requiredRoles.join(', ')}</p>
      </div>
    );
  }

  // User is authenticated and authorized
  return children;
};

export default ProtectedRoute;
