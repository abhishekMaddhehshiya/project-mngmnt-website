/**
 * SECURITY: Dashboard Page
 * 
 * 1. Role-based UI rendering
 * 2. Only shows features user has access to
 * 3. Displays user information securely
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import apiClient from '../lib/api';
import AppShell from '../components/AppShell';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Fetch projects
    const fetchProjects = async () => {
      try {
        const response = await apiClient.get('/projects');
        setProjects(response.data.data.projects);
        setError('');
      } catch (err) {
        setError('Failed to load projects');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [user, navigate]);


  return (
    <AppShell
      title="Dashboard"
      subtitle="Your active programs, deadlines, and team ownership."
      actions={
        user?.role !== 'developer' ? (
          <Link to="/projects/create" className="btn btn-primary">
            Create Project
          </Link>
        ) : null
      }
    >
      {error && <div className="banner error">{error}</div>}

      {loading ? (
        <div className="loading">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <p>No projects available.</p>
          {user?.role !== 'developer' && (
            <Link to="/projects/create" className="btn btn-primary">
              Create New Project
            </Link>
          )}
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map(project => (
            <div key={project._id} className="project-card">
              <div className="project-header">
                <h3>{project.name}</h3>
                <span className={`status-badge status-${project.status}`}>
                  {project.status}
                </span>
              </div>
              <p className="project-description">{project.description}</p>
              <div className="project-meta">
                <span className="priority">Priority: {project.priority}</span>
                <span className="deadline">
                  Deadline: {project.deadline ? new Date(project.deadline).toLocaleDateString() : 'TBD'}
                </span>
              </div>
              <div className="project-actions">
                <Link to={`/projects/${project._id}`} className="btn btn-secondary">
                  View Details
                </Link>
                {(user?.role === 'admin' || user?.role === 'project-lead') && (
                  <Link to={`/projects/${project._id}/edit`} className="btn btn-ghost">
                    Edit
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
};

export default Dashboard;
