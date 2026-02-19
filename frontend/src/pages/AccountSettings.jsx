import React, { useState } from 'react';
import AppShell from '../components/AppShell';
import useAuthStore from '../store/authStore';

const AccountSettings = () => {
  const { user, changePassword, isLoading, error, clearError } = useAuthStore();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearError();
    setSuccessMessage('');

    if (!oldPassword || !newPassword || !confirmPassword) {
      return;
    }

    const result = await changePassword(oldPassword, newPassword, confirmPassword);

    if (result.success) {
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMessage('Password updated successfully.');
    }
  };

  return (
    <AppShell
      title="Account Settings"
      subtitle="Manage your security credentials and account details."
    >
      <div className="grid two-col">
        <section className="card">
          <h2>Profile</h2>
          <div className="info-list">
            <div>
              <span>Full Name</span>
              <strong>{user?.fullName}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{user?.email}</strong>
            </div>
            <div>
              <span>Role</span>
              <strong>{user?.role}</strong>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Change Password</h2>
          <form onSubmit={handleSubmit} className="form">
            {error && <div className="banner error">{error}</div>}
            {successMessage && <div className="banner success">{successMessage}</div>}

            <div className="form-group">
              <label htmlFor="oldPassword">Current password</label>
              <input
                id="oldPassword"
                type="password"
                value={oldPassword}
                onChange={(event) => setOldPassword(event.target.value)}
                className="input"
                autoComplete="current-password"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">New password</label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="input"
                autoComplete="new-password"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm new password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="input"
                autoComplete="new-password"
                disabled={isLoading}
              />
            </div>

            <button className="btn btn-primary" type="submit" disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
};

export default AccountSettings;
