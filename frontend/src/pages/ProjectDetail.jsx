import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import useAuthStore from '../store/authStore';
import apiClient from '../lib/api';

const ProjectDetail = () => {
  const { id } = useParams();
  const { user } = useAuthStore();
  const [project, setProject] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadFile, setUploadFile] = useState(null);
  const [classification, setClassification] = useState('internal');
  const [error, setError] = useState('');
  const [docError, setDocError] = useState('');
  const [docLoading, setDocLoading] = useState(false);

  const canManage = user?.role === 'admin' || user?.role === 'project-lead';

  const loadProject = async () => {
    try {
      const response = await apiClient.get(`/projects/${id}`);
      setProject(response.data.data.project);
    } catch (err) {
      setError('Failed to load project details.');
    }
  };

  const loadDocuments = async () => {
    try {
      const response = await apiClient.get(`/documents/project/${id}`);
      setDocuments(response.data.data.documents || []);
    } catch (err) {
      setDocError('Unable to load documents.');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadProject(), loadDocuments()]);
      setLoading(false);
    };

    loadData();
  }, [id]);

  const handleUpload = async (event) => {
    event.preventDefault();
    setDocError('');

    if (!uploadFile) {
      setDocError('Select a file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('classification', classification);

    try {
      setDocLoading(true);
      await apiClient.post(`/documents/project/${id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadFile(null);
      await loadDocuments();
    } catch (err) {
      setDocError(err.response?.data?.message || 'Failed to upload document.');
    } finally {
      setDocLoading(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      const response = await apiClient.get(`/documents/${doc._id}/download`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = window.document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.originalFileName || 'document');
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setDocError('Download failed.');
    }
  };

  const handleDelete = async (documentId) => {
    try {
      await apiClient.delete(`/documents/${documentId}`);
      await loadDocuments();
    } catch (err) {
      setDocError('Failed to delete document.');
    }
  };

  if (loading) {
    return (
      <AppShell title="Project Details" subtitle="Loading project data...">
        <div className="loading">Loading...</div>
      </AppShell>
    );
  }

  if (!project) {
    return (
      <AppShell title="Project Details" subtitle="Project not available.">
        <div className="banner error">{error || 'Project not found.'}</div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={project.name}
      subtitle={project.description || 'No description provided.'}
      actions={
        canManage ? (
          <Link className="btn btn-secondary" to={`/projects/${project._id}/edit`}>
            Edit Project
          </Link>
        ) : null
      }
    >
      {error && <div className="banner error">{error}</div>}

      <section className="card">
        <div className="info-grid">
          <div>
            <span>Status</span>
            <strong className={`status-pill status-${project.status}`}>{project.status}</strong>
          </div>
          <div>
            <span>Priority</span>
            <strong>{project.priority}</strong>
          </div>
          <div>
            <span>Deadline</span>
            <strong>
              {project.deadline ? new Date(project.deadline).toLocaleDateString() : 'Not set'}
            </strong>
          </div>
          <div>
            <span>Project Lead</span>
            <strong>{project.projectLead?.fullName || 'Unassigned'}</strong>
          </div>
        </div>

        <div className="divider" />

        <div>
          <h3>Assigned Developers</h3>
          <div className="chip-list">
            {project.assignedDevelopers?.length ? (
              project.assignedDevelopers.map((dev) => (
                <span key={dev._id} className="chip read-only">
                  {dev.fullName}
                </span>
              ))
            ) : (
              <p className="muted">No developers assigned.</p>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <h2>Documents</h2>
            <p className="muted">Secure uploads with audit tracking.</p>
          </div>
          {canManage && (
            <form className="upload-form" onSubmit={handleUpload}>
              <input
                type="file"
                onChange={(event) => setUploadFile(event.target.files[0])}
                className="file-input"
              />
              <select
                value={classification}
                onChange={(event) => setClassification(event.target.value)}
                className="select"
              >
                <option value="public">Public</option>
                <option value="internal">Internal</option>
                <option value="confidential">Confidential</option>
                <option value="secret">Secret</option>
              </select>
              <button className="btn btn-primary" type="submit" disabled={docLoading}>
                {docLoading ? 'Uploading...' : 'Upload'}
              </button>
            </form>
          )}
        </div>

        {docError && <div className="banner error">{docError}</div>}

        <div className="doc-list">
          {documents.length === 0 ? (
            <p className="muted">No documents uploaded yet.</p>
          ) : (
            documents.map((doc) => (
              <div key={doc._id} className="doc-item">
                <div>
                  <strong>{doc.originalFileName}</strong>
                  <span className="muted">
                    {doc.classification} · {Math.round(doc.fileSize / 1024)} KB
                  </span>
                </div>
                <div className="doc-actions">
                  <button className="btn btn-ghost" onClick={() => handleDownload(doc)}>
                    Download
                  </button>
                  {(user?.role === 'admin' || doc.uploadedBy?._id === user?._id) && (
                    <button className="btn btn-danger" onClick={() => handleDelete(doc._id)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </AppShell>
  );
};

export default ProjectDetail;
