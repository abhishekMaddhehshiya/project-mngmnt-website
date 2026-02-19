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
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadFile, setUploadFile] = useState(null);
  const [classification, setClassification] = useState('internal');
  const [error, setError] = useState('');
  const [docError, setDocError] = useState('');
  const [docLoading, setDocLoading] = useState(false);
  const [messageContent, setMessageContent] = useState('');
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageError, setMessageError] = useState('');
  const [reviewResponse, setReviewResponse] = useState('');

  const canManage = user?.role === 'admin' || user?.role === 'project-lead';
  const isDeveloper = user?.role === 'developer';

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

  const loadMessages = async () => {
    try {
      const response = await apiClient.get(`/messages/project/${id}`);
      setMessages(response.data.data.messages || []);
    } catch (err) {
      console.error('Unable to load messages.');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadProject(), loadDocuments(), loadMessages()]);
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

  const handleSendMessage = async (event, type = 'message') => {
    event.preventDefault();
    setMessageError('');

    if (!messageContent.trim()) {
      setMessageError('Message cannot be empty.');
      return;
    }

    try {
      setMessageLoading(true);
      await apiClient.post(`/messages/project/${id}`, {
        content: messageContent,
        type,
      });
      setMessageContent('');
      await loadMessages();
      if (type === 'completion-request') {
        setMessageError('');
      }
    } catch (err) {
      setMessageError(err.response?.data?.message || 'Failed to send message.');
    } finally {
      setMessageLoading(false);
    }
  };

  const handleReviewCompletion = async (messageId, approved) => {
    try {
      setMessageLoading(true);
      await apiClient.post(`/messages/${messageId}/review`, {
        approved,
        response: reviewResponse,
      });
      setReviewResponse('');
      await Promise.all([loadProject(), loadMessages()]);
    } catch (err) {
      setMessageError(err.response?.data?.message || 'Failed to review request.');
    } finally {
      setMessageLoading(false);
    }
  };

  const hasPendingCompletionRequest = messages.some(
    (m) => m.type === 'completion-request' && !m.reviewedBy
  );

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

      {/* Messages Section */}
      <section className="card">
        <div className="section-header">
          <div>
            <h2>Project Messages</h2>
            <p className="muted">Communication and completion requests</p>
          </div>
        </div>

        {messageError && <div className="banner error">{messageError}</div>}

        {/* Send Message Form */}
        <form className="message-form" onSubmit={handleSendMessage}>
          <textarea
            className="textarea"
            placeholder="Type your message..."
            value={messageContent}
            onChange={(e) => setMessageContent(e.target.value)}
            rows={3}
            disabled={messageLoading}
          />
          <div className="message-actions">
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={messageLoading || !messageContent.trim()}
            >
              {messageLoading ? 'Sending...' : 'Send Message'}
            </button>
            {isDeveloper && project.status === 'active' && !hasPendingCompletionRequest && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={(e) => handleSendMessage(e, 'completion-request')}
                disabled={messageLoading || !messageContent.trim()}
              >
                Request Completion
              </button>
            )}
          </div>
        </form>

        {/* Messages List */}
        <div className="messages-list">
          {messages.length === 0 ? (
            <p className="muted">No messages yet. Start a conversation!</p>
          ) : (
            messages.map((msg) => (
              <div 
                key={msg._id} 
                className={`message-item ${msg.type !== 'message' ? 'message-request' : ''} ${
                  msg.type === 'completion-approved' ? 'message-approved' : ''
                } ${msg.type === 'completion-rejected' ? 'message-rejected' : ''}`}
              >
                <div className="message-header">
                  <strong>{msg.sender?.fullName}</strong>
                  <span className="message-role">{msg.sender?.role}</span>
                  <span className="message-time">
                    {new Date(msg.createdAt).toLocaleString()}
                  </span>
                  {msg.type === 'completion-request' && !msg.reviewedBy && (
                    <span className="message-badge pending">Pending Review</span>
                  )}
                  {msg.type === 'completion-approved' && (
                    <span className="message-badge approved">Approved</span>
                  )}
                  {msg.type === 'completion-rejected' && (
                    <span className="message-badge rejected">Rejected</span>
                  )}
                </div>
                <p className="message-content">{msg.content}</p>
                
                {/* Review Response */}
                {msg.reviewResponse && (
                  <div className="review-response">
                    <strong>Response from {msg.reviewedBy?.fullName}:</strong>
                    <p>{msg.reviewResponse}</p>
                  </div>
                )}

                {/* Review Actions for Admin/Project Lead */}
                {canManage && msg.type === 'completion-request' && !msg.reviewedBy && (
                  <div className="review-actions">
                    <input
                      type="text"
                      className="input"
                      placeholder="Add a response (optional)..."
                      value={reviewResponse}
                      onChange={(e) => setReviewResponse(e.target.value)}
                    />
                    <div className="review-buttons">
                      <button
                        className="btn btn-primary"
                        onClick={() => handleReviewCompletion(msg._id, true)}
                        disabled={messageLoading}
                      >
                        Approve & Complete
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleReviewCompletion(msg._id, false)}
                        disabled={messageLoading}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </AppShell>
  );
};

export default ProjectDetail;
