/**
 * SECURITY DECISION: Document Management Routes
 * 
 * File upload with security (Cloudinary integration):
 * - POST /projects/:projectId/documents/upload (admin, project-lead)
 * - GET /projects/:projectId/documents (all assigned users)
 * - GET /documents/:id (view metadata)
 * - GET /documents/:id/download (download with access control)
 * - DELETE /documents/:id (uploader or admin)
 */

import express from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../middleware/auth.js';
import config from '../config/config.js';
import * as documentController from '../controllers/documentController.js';

const router = express.Router();

/**
 * SECURITY: Configure multer for file uploads
 * - Store in memory for Cloudinary upload
 * - Limit file size to prevent DoS
 * - Validate file before uploading to cloud
 */
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // SECURITY: File type validation - first-line defense
  const allowedMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxFileSize, // 5MB
  },
});

/**
 * SECURITY: All document routes require authentication
 */
router.use(authenticate);

/**
 * SECURITY: List documents in project
 * Only users with access to project can see its documents
 */
router.get('/project/:projectId', documentController.listProjectDocuments);

/**
 * SECURITY: Upload document to project
 * Only admin and project-lead can upload
 */
router.post(
  '/project/:projectId/upload',
  authorize('admin', 'project-lead'),
  upload.single('file'),
  documentController.uploadDocument
);

/**
 * SECURITY: Get document metadata (with access control)
 */
router.get('/:id', documentController.viewDocument);

/**
 * SECURITY: Update document metadata
 * Only admin and assigned project-lead can update
 */
router.put(
  '/:id',
  authorize('admin', 'project-lead'),
  documentController.updateDocument
);

/**
 * SECURITY: Download document (with audit logging)
 */
router.get('/:id/download', documentController.downloadDocument);

/**
 * SECURITY: Delete document
 */
router.delete('/:id', documentController.deleteDocument);

/**
 * SECURITY: Error handling for multer
 */
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: `File size exceeds maximum allowed (${config.maxFileSize} bytes)`,
      });
    }
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  next(error);
});

export default router;
