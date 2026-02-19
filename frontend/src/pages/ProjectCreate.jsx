import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import useAuthStore from '../store/authStore';
import apiClient from '../lib/api';

const ProjectCreate = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [formState, setFormState] = useState({
    name: '',
    description: '',
    deadline: '',
    priority: 'medium',
    projectLead: '',
  });
  const [developers, setDevelopers] = useState([]);
  const [projectLeads, setProjectLeads] = useState([]);
  const [assignedDevelopers, setAssignedDevelopers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadUsers = async () => {
      if (!user) return;

      try {
        if (user.role === 'admin') {
          const [leadResponse, devResponse] = await Promise.all([
            apiClient.get('/users', { params: { role: 'project-lead' } }),
            apiClient.get('/users', { params: { role: 'developer' } }),
          ]);

          setProjectLeads(leadResponse.data.data.users || []);
          setDevelopers(devResponse.data.data.users || []);
        } else if (user.role === 'project-lead') {
          const response = await apiClient.get('/users/assignable');
          setDevelopers(response.data.data.users || []);
        }
      } catch (err) {
        setError('Unable to load user directory.');
      }
    };

    loadUsers();
  }, [user]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const toggleDeveloper = (id) => {
    setAssignedDevelopers((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        ...formState,
        assignedDevelopers,
      };

      if (user?.role !== 'admin') {
        delete payload.projectLead;
      }

      const response = await apiClient.post('/projects', payload);
      navigate(`/projects/${response.data.data.project._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create project.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell
      title="Create Project"
      subtitle="Launch a new initiative with clear timelines and ownership."
    >
      <section className="card">
        <form className="form" onSubmit={handleSubmit}>
          {error && <div className="banner error">{error}</div>}

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="name">Project name</label>
              <input
                id="name"
                name="name"
                value={formState.name}
                onChange={handleChange}
                className="input"
                placeholder="Rebuild client onboarding"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="deadline">Deadline</label>
              <input
                id="deadline"
                name="deadline"
                type="date"
                value={formState.deadline}
                onChange={handleChange}
                className="input"
                required
              />
            </div>

            <div className="form-group full">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={formState.description}
                onChange={handleChange}
                className="textarea"
                rows="4"
                placeholder="Define the scope, success metrics, and constraints."
              />
            </div>

            <div className="form-group">
              <label htmlFor="priority">Priority</label>
              <select
                id="priority"
                name="priority"
                value={formState.priority}
                onChange={handleChange}
                className="select"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            {user?.role === 'admin' && (
              <div className="form-group">
                <label htmlFor="projectLead">Project lead</label>
                <select
                  id="projectLead"
                  name="projectLead"
                  value={formState.projectLead}
                  onChange={handleChange}
                  className="select"
                >
                  <option value="">Assign later</option>
                  {projectLeads.map((lead) => (
                    <option key={lead._id} value={lead._id}>
                      {lead.fullName} ({lead.email})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="divider" />

          <div className="form-group">
            <label>Assign developers</label>
            <div className="chip-list">
              {developers.length === 0 && (
                <p className="muted">No developers available yet.</p>
              )}
              {developers.map((dev) => (
                <label key={dev._id} className="chip">
                  <input
                    type="checkbox"
                    checked={assignedDevelopers.includes(dev._id)}
                    onChange={() => toggleDeveloper(dev._id)}
                  />
                  <span>{dev.fullName}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Project'}
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => navigate('/dashboard')}
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
    </AppShell>
  );
};

export default ProjectCreate;
