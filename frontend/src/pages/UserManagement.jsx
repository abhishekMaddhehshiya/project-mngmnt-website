import React, { useEffect, useState } from 'react';
import AppShell from '../components/AppShell';
import useAuthStore from '../store/authStore';
import apiClient from '../lib/api';

const emptyCreateForm = {
  username: '',
  email: '',
  password: '',
  fullName: '',
  role: 'developer',
};

const UserManagement = () => {
  const { user } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [filterRole, setFilterRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [resetPasswordId, setResetPasswordId] = useState(null);
  const [tempPassword, setTempPassword] = useState('');

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/users', {
        params: filterRole ? { role: filterRole } : {},
      });
      setUsers(response.data.data.users || []);
    } catch (err) {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [filterRole]);

  const handleCreateChange = (event) => {
    const { name, value } = event.target;
    setCreateForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setError('');

    try {
      await apiClient.post('/users', createForm);
      setCreateForm(emptyCreateForm);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create user.');
    }
  };

  const startEdit = (selectedUser) => {
    setEditingUser(selectedUser);
    setEditForm({
      fullName: selectedUser.fullName,
      email: selectedUser.email,
      role: selectedUser.role,
      isActive: selectedUser.isActive,
    });
  };

  const handleUpdateUser = async (event) => {
    event.preventDefault();
    setError('');

    try {
      await apiClient.put(`/users/${editingUser._id}`, editForm);
      setEditingUser(null);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update user.');
    }
  };

  const handleDeactivate = async (userId) => {
    try {
      await apiClient.patch(`/users/${userId}/deactivate`);
      await loadUsers();
    } catch (err) {
      setError('Failed to deactivate user.');
    }
  };

  const handleDelete = async (userId) => {
    try {
      await apiClient.delete(`/users/${userId}`);
      await loadUsers();
    } catch (err) {
      setError('Failed to delete user.');
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();

    if (!resetPasswordId) return;

    try {
      await apiClient.post(`/users/${resetPasswordId}/reset-password`, {
        tempPassword,
      });
      setResetPasswordId(null);
      setTempPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password.');
    }
  };

  return (
    <AppShell
      title="User Management"
      subtitle="Admin controls for roles, access, and lifecycle."
    >
      {error && <div className="banner error">{error}</div>}

      <div className="grid two-col">
        <section className="card">
          <h2>Create User</h2>
          <form className="form" onSubmit={handleCreateUser}>
            <div className="form-group">
              <label htmlFor="fullName">Full name</label>
              <input
                id="fullName"
                name="fullName"
                className="input"
                value={createForm.fullName}
                onChange={handleCreateChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="username">Username (email)</label>
              <input
                id="username"
                name="username"
                className="input"
                value={createForm.username}
                onChange={handleCreateChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                className="input"
                value={createForm.email}
                onChange={handleCreateChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Temporary password</label>
              <input
                id="password"
                name="password"
                type="password"
                className="input"
                value={createForm.password}
                onChange={handleCreateChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="role">Role</label>
              <select
                id="role"
                name="role"
                className="select"
                value={createForm.role}
                onChange={handleCreateChange}
              >
                <option value="admin">Admin</option>
                <option value="project-lead">Project Lead</option>
                <option value="developer">Developer</option>
              </select>
            </div>
            <button className="btn btn-primary" type="submit">
              Create User
            </button>
          </form>
        </section>

        <section className="card">
          <h2>Edit User</h2>
          {!editingUser ? (
            <p className="muted">Select a user from the list to edit.</p>
          ) : (
            <form className="form" onSubmit={handleUpdateUser}>
              <div className="form-group">
                <label htmlFor="editFullName">Full name</label>
                <input
                  id="editFullName"
                  name="fullName"
                  className="input"
                  value={editForm.fullName || ''}
                  onChange={handleEditChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="editEmail">Email</label>
                <input
                  id="editEmail"
                  name="email"
                  className="input"
                  value={editForm.email || ''}
                  onChange={handleEditChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="editRole">Role</label>
                <select
                  id="editRole"
                  name="role"
                  className="select"
                  value={editForm.role || 'developer'}
                  onChange={handleEditChange}
                >
                  <option value="admin">Admin</option>
                  <option value="project-lead">Project Lead</option>
                  <option value="developer">Developer</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="editActive">Active</label>
                <select
                  id="editActive"
                  name="isActive"
                  className="select"
                  value={String(editForm.isActive)}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      isActive: event.target.value === 'true',
                    }))
                  }
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              <div className="form-actions">
                <button className="btn btn-primary" type="submit">
                  Save Changes
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      </div>

      <section className="card">
        <div className="section-header">
          <div>
            <h2>User Directory</h2>
            <p className="muted">All active accounts and role assignments.</p>
          </div>
          <select
            className="select"
            value={filterRole}
            onChange={(event) => setFilterRole(event.target.value)}
          >
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="project-lead">Project Lead</option>
            <option value="developer">Developer</option>
          </select>
        </div>

        {loading ? (
          <div className="loading">Loading users...</div>
        ) : (
          <div className="table">
            <div className="table-row header">
              <span>Name</span>
              <span>Email</span>
              <span>Role</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {users.map((item) => (
              <div key={item._id} className="table-row">
                <span>{item.fullName}</span>
                <span>{item.email}</span>
                <span className={`role-tag ${item.role}`}>{item.role}</span>
                <span>{item.isActive ? 'Active' : 'Inactive'}</span>
                <div className="table-actions">
                  <button className="btn btn-ghost" onClick={() => startEdit(item)}>
                    Edit
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setResetPasswordId(item._id)}
                  >
                    Reset Password
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={item._id === user?._id}
                    onClick={() => handleDeactivate(item._id)}
                  >
                    Deactivate
                  </button>
                  <button
                    className="btn btn-danger"
                    disabled={item._id === user?._id}
                    onClick={() => handleDelete(item._id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {resetPasswordId && (
        <section className="card">
          <h2>Reset Password</h2>
          <form className="form" onSubmit={handleResetPassword}>
            <div className="form-group">
              <label htmlFor="tempPassword">Temporary password</label>
              <input
                id="tempPassword"
                className="input"
                type="password"
                value={tempPassword}
                onChange={(event) => setTempPassword(event.target.value)}
                required
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit">
                Reset Password
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => {
                  setResetPasswordId(null);
                  setTempPassword('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}
    </AppShell>
  );
};

export default UserManagement;
