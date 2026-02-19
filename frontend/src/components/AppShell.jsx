import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

const AppShell = ({ title, subtitle, actions, children }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  const roleLabel = (role) => {
    if (!role) return 'Unknown';
    return role
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const roleClass = (role) => {
    switch (role) {
      case 'admin':
        return 'badge-admin';
      case 'project-lead':
        return 'badge-lead';
      case 'developer':
        return 'badge-dev';
      default:
        return 'badge-default';
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark" />
          <div>
            <span className="brand-title">PixelForge Nexus</span>
            <span className="brand-subtitle">Secure Project Ops</span>
          </div>
        </div>

        <nav className="app-nav">
          <Link className={isActive('/dashboard') ? 'active' : ''} to="/dashboard">
            Dashboard
          </Link>
          {(user?.role === 'admin' || user?.role === 'project-lead') && (
            <Link className={isActive('/projects/create') ? 'active' : ''} to="/projects/create">
              New Project
            </Link>
          )}
          {user?.role === 'admin' && (
            <Link className={isActive('/users') ? 'active' : ''} to="/users">
              Users
            </Link>
          )}
          <Link className={isActive('/account-settings') ? 'active' : ''} to="/account-settings">
            Settings
          </Link>
        </nav>

        <div className="app-user">
          <div className="user-meta">
            <span className="user-name">{user?.fullName}</span>
            <span className={`role-badge ${roleClass(user?.role)}`}>
              {roleLabel(user?.role)}
            </span>
          </div>
          <button className="btn btn-ghost" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="page-header">
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="page-actions">{actions}</div>}
        </div>
        {children}
      </main>
    </div>
  );
};

export default AppShell;
