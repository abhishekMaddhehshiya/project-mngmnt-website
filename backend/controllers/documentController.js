/**
 * SECURITY DECISION: Document Controller (File Management)
 * 
 * Security measures:
 * 1. Only admin and project-lead can upload
 * 2. File type and size validation
 * 3. Checksum for integrity verification
 * 4. Access control - only assigned users can view
 * 5. Audit trail for all access
 * 6. Cloud storage via Cloudinary
 */

import crypto from 'crypto';
import path from 'path';
import Document from '../models/Document.js';
import Project from '../models/Project.js';
import config from '../config/config.js';
import { uploadToCloudinary, deleteFromCloudinary, isCloudinaryConfigured } from '../utils/cloudinary.js';

/**
 * SECURITY: Calculate file checksum for integrity from buffer
 */
const calculateChecksumFromBuffer = (buffer) => {
  const hash = crypto.createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex');
};

/**
 * SECURITY: Validate file safety
 */
const validateUploadFile = (file) => {
  // SECURITY: Check file size
  if (file.size > config.maxFileSize) {
    throw new Error(`File size exceeds maximum allowed (${config.maxFileSize} bytes)`);
  }
  
  // SECURITY: Check file extension
  const ext = path.extname(file.originalname).slice(1).toLowerCase();
  if (!config.allowedFileTypes.includes(ext)) {
    throw new Error(`File type .${ext} is not allowed`);
  }
  
  // SECURITY: Check MIME type
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ];
  
  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new Error(`MIME type ${file.mimetype} is not allowed`);
  }
  
  return true;
};

/**
 * SECURITY: Sanitize file name for storage
 */
const sanitizeFileName = (originalName) => {
  // Remove path separators and dangerous characters
  const sanitized = originalName
    .replace(/[/\\]/g, '_')
    .replace(/[<>:"|?*\x00-\x1f]/g, '_')
    .substring(0, 255);
  
  // Add unique prefix to prevent collisions
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  const ext = path.extname(sanitized);
  const name = path.basename(sanitized, ext);
  
  return `${name}_${timestamp}_${random}${ext}`;
};

/**
 * SECURITY: List documents for project (with access control)
 */
export const listProjectDocuments = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // SECURITY: Verify user has access to project
    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }
    
    // SECURITY: Check project access
    if (!canAccessProject(req.user, project)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this project',
      });
    }
    
    // SECURITY: Find documents based on user role
    // Admin and assigned project leads can see all documents in the project
    // Helper to get ID string from populated or unpopulated field
    const getId = (field) => {
      if (!field) return null;
      if (typeof field === 'object' && field._id) return field._id.toString();
      return field.toString();
    };
    
    let documents;
    if (req.user.role === 'admin' || 
        (req.user.role === 'project-lead' && 
         (getId(project.projectLead) === req.user.id ||
          getId(project.createdBy) === req.user.id))) {
      // Admin and assigned project leads see all project documents
      documents = await Document.find({ project: projectId })
        .populate('uploadedBy', 'username email fullName')
        .sort({ createdAt: -1 });
    } else {
      // Other users see only documents they have explicit access to
      documents = await Document.find({
        project: projectId,
        'accessibleBy.userId': req.user.id,
      })
        .populate('uploadedBy', 'username email fullName')
        .sort({ createdAt: -1 });
    }
    
    res.status(200).json({
      success: true,
      data: {
        count: documents.length,
        documents,
      },
    });
  } catch (error) {
    console.error('List documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * SECURITY: Upload document to project (Cloudinary)
 */
export const uploadDocument = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // SECURITY: Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided',
      });
    }
    
    // SECURITY: Verify project exists
    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }
    
    // SECURITY: Check if user can upload to this project
    if (!canUploadToProject(req.user, project)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to upload documents to this project',
      });
    }
    
    // SECURITY: Validate file
    try {
      validateUploadFile(req.file);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    
    // SECURITY: Calculate checksum for integrity from buffer
    const checksum = calculateChecksumFromBuffer(req.file.buffer);
    
    // Upload to Cloudinary
    const sanitizedName = sanitizeFileName(req.file.originalname);
    let cloudinaryResult;
    
    try {
      cloudinaryResult = await uploadToCloudinary(req.file.buffer, {
        public_id: sanitizedName.replace(/\.[^.]+$/, ''), // Remove extension for public_id
        resource_type: 'raw',
        folder: `pixelforge-documents/${projectId}`,
      });
    } catch (uploadError) {
      console.error('Cloudinary upload error:', uploadError);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload file to cloud storage',
      });
    }
    
    // SECURITY: Build accessible users list (project team)
    const accessibleBy = [];
    
    // Project lead has access
    if (project.projectLead) {
      accessibleBy.push({
        userId: project.projectLead,
        role: 'project-lead',
      });
    }
    
    // Assigned developers have access
    if (project.assignedDevelopers) {
      project.assignedDevelopers.forEach(devId => {
        accessibleBy.push({
          userId: devId,
          role: 'developer',
        });
      });
    }
    
    // Admin has implicit access (coded in canAccessDocument)
    
    // SECURITY: Create document record with Cloudinary info
    const document = new Document({
      fileName: sanitizedName,
      originalFileName: req.file.originalname,
      filePath: cloudinaryResult.secure_url,
      cloudinaryPublicId: cloudinaryResult.public_id,
      cloudinaryUrl: cloudinaryResult.secure_url,
      storageType: 'cloudinary',
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      project: projectId,
      uploadedBy: req.user.id,
      accessibleBy,
      checksum,
      classification: req.body.classification || 'internal',
    });
    
    await document.save();
    
    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: { document },
    });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * SECURITY: Download document with access control and audit logging
 */
export const downloadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    
    const document = await Document.findById(id);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      });
    }
    
    // SECURITY: Check if user has access
    if (!canAccessDocument(req.user, document)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this document',
      });
    }
    
    // SECURITY: Log access for audit trail
    await document.logAccess(req.user.id, 'downloaded');
    
    // For Cloudinary-stored files, redirect to the secure URL
    if (document.storageType === 'cloudinary' && document.cloudinaryUrl) {
      return res.redirect(document.cloudinaryUrl);
    }
    
    // Fallback for local files (legacy support)
    res.redirect(document.filePath);
  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * SECURITY: View document (log access)
 */
export const viewDocument = async (req, res) => {
  try {
    const { id } = req.params;
    
    const document = await Document.findById(id)
      .populate('uploadedBy', 'username email fullName');
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      });
    }
    
    // SECURITY: Check access
    if (!canAccessDocument(req.user, document)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this document',
      });
    }
    
    // SECURITY: Log access
    await document.logAccess(req.user.id, 'viewed');
    
    res.status(200).json({
      success: true,
      data: { document },
    });
  } catch (error) {
    console.error('View document error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * SECURITY: Update document metadata (admin and assigned project lead only)
 */
export const updateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { classification, accessibleBy: newAccessibleBy } = req.body;
    
    const document = await Document.findById(id).populate('project');
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      });
    }
    
    const project = await Project.findById(document.project);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Associated project not found',
      });
    }
    
    // SECURITY: Check if user can update documents in this project
    if (!canUploadToProject(req.user, project)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update documents in this project',
      });
    }
    
    // SECURITY: Update allowed fields only
    if (classification) {
      const allowedClassifications = ['public', 'internal', 'confidential', 'restricted'];
      if (!allowedClassifications.includes(classification)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid classification value',
        });
      }
      document.classification = classification;
    }
    
    // SECURITY: Update access list if provided (admin and project lead can modify)
    if (newAccessibleBy && Array.isArray(newAccessibleBy)) {
      document.accessibleBy = newAccessibleBy;
    }
    
    await document.save();
    
    res.status(200).json({
      success: true,
      message: 'Document updated successfully',
      data: { document },
    });
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * SECURITY: Delete document (uploader, admin, or assigned project lead only)
 */
export const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    
    const document = await Document.findById(id);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      });
    }
    
    // Get the associated project to check project lead access
    const project = await Project.findById(document.project);
    
    // Helper to get ID string from populated or unpopulated field
    const getId = (field) => {
      if (!field) return null;
      if (typeof field === 'object' && field._id) return field._id.toString();
      return field.toString();
    };
    
    // SECURITY: Check if user can delete
    // Admin can delete any document
    // Uploader can delete their own document
    // Project lead assigned to the project can delete any document in the project
    const isAdmin = req.user.role === 'admin';
    const isUploader = document.uploadedBy.toString() === req.user.id;
    const isAssignedProjectLead = req.user.role === 'project-lead' && project && 
      (getId(project.projectLead) === req.user.id ||
       getId(project.createdBy) === req.user.id);
    
    if (!isAdmin && !isUploader && !isAssignedProjectLead) {
      return res.status(403).json({
        success: false,
        message: 'Only admin, uploader, or assigned project lead can delete this document',
      });
    }
    
    // SECURITY: Delete file from Cloudinary
    if (document.storageType === 'cloudinary' && document.cloudinaryPublicId) {
      try {
        await deleteFromCloudinary(document.cloudinaryPublicId);
      } catch (error) {
        console.warn('Failed to delete from Cloudinary:', error.message);
      }
    }
    
    // Delete document record
    await Document.findByIdAndDelete(id);
    
    res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * SECURITY: Check if user can access project
 */
function canAccessProject(user, project) {
  // Helper to get ID string from populated or unpopulated field
  const getId = (field) => {
    if (!field) return null;
    if (typeof field === 'object' && field._id) return field._id.toString();
    return field.toString();
  };
  
  if (user.role === 'admin') return true;
  if (user.role === 'project-lead') {
    const projectLeadId = getId(project.projectLead);
    const createdById = getId(project.createdBy);
    if (projectLeadId === user.id || createdById === user.id) {
      return true;
    }
  }
  if (user.role === 'developer' &&
      project.assignedDevelopers?.some(dev => getId(dev) === user.id)) {
    return true;
  }
  return false;
}

/**
 * SECURITY: Check if user can upload to project
 */
function canUploadToProject(user, project) {
  // Helper to get ID string from populated or unpopulated field
  const getId = (field) => {
    if (!field) return null;
    if (typeof field === 'object' && field._id) return field._id.toString();
    return field.toString();
  };
  
  // Only admin and project lead can upload
  if (user.role === 'admin') return true;
  if (user.role === 'project-lead') {
    const projectLeadId = getId(project.projectLead);
    const createdById = getId(project.createdBy);
    if (projectLeadId === user.id || createdById === user.id) {
      return true;
    }
  }
  return false;
}

/**
 * SECURITY: Check if user can access document
 */
function canAccessDocument(user, document) {
  // Admin has access to everything
  if (user.role === 'admin') return true;
  
  // Check if user is in access list
  return document.accessibleBy.some(access =>
    access.userId.toString() === user.id
  );
}
