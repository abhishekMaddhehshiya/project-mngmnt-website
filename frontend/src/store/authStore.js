/**
 * SECURITY: Authentication Store (Zustand)
 * 
 * Centralized state management for:
 * 1. Authentication status
 * 2. User information with role
 * 3. Login/logout operations
 * 4. Token management
 */

import { create } from 'zustand';
import apiClient, { setTokens, clearStorage, getTokens } from '../lib/api';

/**
 * SECURITY: Auth Store
 */
export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  /**
   * SECURITY: Initialize auth state from storage
   */
  initializeAuth: () => {
    const user = localStorage.getItem('user');
    const tokens = getTokens();

    if (user && tokens.accessToken) {
      set({
        user: JSON.parse(user),
        isAuthenticated: true,
      });
    }
  },

  /**
   * SECURITY: Login with credentials
   */
  login: async (username, password) => {
    set({ isLoading: true, error: null });

    try {
      const response = await apiClient.post('/auth/login', {
        username,
        password,
      });

      const { user, accessToken, refreshToken } = response.data.data;

      // SECURITY: Store tokens and user
      setTokens(accessToken, refreshToken);
      localStorage.setItem('user', JSON.stringify(user));

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      set({
        isLoading: false,
        error: message,
      });
      return { success: false, error: message };
    }
  },

  /**
   * SECURITY: Logout and clear tokens
   */
  logout: async () => {
    set({ isLoading: true });

    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    }

    // SECURITY: Clear storage regardless of API response
    clearStorage();

    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  },

  /**
   * SECURITY: Get current user
   */
  getCurrentUser: async () => {
    set({ isLoading: true });

    try {
      const response = await apiClient.get('/auth/me');
      const { user } = response.data.data;

      localStorage.setItem('user', JSON.stringify(user));

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });

      return user;
    } catch (error) {
      console.error('Get user error:', error);
      clearStorage();
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
      return null;
    }
  },

  /**
   * SECURITY: Change password
   */
  changePassword: async (oldPassword, newPassword, confirmPassword) => {
    set({ isLoading: true, error: null });

    try {
      const response = await apiClient.put('/auth/change-password', {
        oldPassword,
        newPassword,
        confirmPassword,
      });

      set({
        isLoading: false,
        error: null,
      });

      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Password change failed';
      set({
        isLoading: false,
        error: message,
      });
      return { success: false, error: message };
    }
  },

  /**
   * SECURITY: Clear error state
   */
  clearError: () => {
    set({ error: null });
  },
}));

export default useAuthStore;
