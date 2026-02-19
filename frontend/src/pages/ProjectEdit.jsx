import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import useAuthStore from '../store/authStore';
import apiClient from '../lib/api';

const ProjectEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [formState, setFormState] = useState({
    name: '',
    description: '',
    deadline: '',
    priority: 'medium',
    status: 'active',
    projectLead: '',
  });
  const [developers, setDevelopers] = useState([]);
  const [projectLeads, setProjectLeads] = useState([]);
  const [assignedDevelopers, setAssignedDevelopers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProject = async () => {
      try {
        const response = await apiClient.get(`/projects/${id}`);
        const project = response.data.data.project;

        setFormState({
          name: project.name,
          description: project.description || '',
          deadline: project.deadline ? project.deadline.slice(0, 10) : '',
          priority: project.priority || 'medium',
          status: project.status || 'active',
          projectLead: project.projectLead?._id || '',
        });
        setAssignedDevelopers(project.assignedDevelopers?.map((dev) => dev._id) || []);
      } catch (err) {
        setError('Failed to load project.');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [id]);

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
    setSaving(true);
    setError('');

    try {
      const payload = {
        ...formState,
        assignedDevelopers,
      };

      if (user?.role !== 'admin') {
        delete payload.projectLead;
      }

      await apiClient.put(`/projects/${id}`, payload);
      navigate(`/projects/${id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update project.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell title="Edit Project" subtitle="Loading project data...">
        <div className="loading">Loading...</div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Edit Project"
      subtitle="Refine scope, ownership, and delivery status."
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

            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={formState.status}
                onChange={handleChange}
                className="select"
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="on-hold">On hold</option>
                <option value="cancelled">Cancelled</option>
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
            <label>Assigned developers</label>
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
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => navigate(`/projects/${id}`)}
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
    </AppShell>
  );
};

export default ProjectEdit;
