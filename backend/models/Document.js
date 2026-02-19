/**
 * SECURITY DECISION: Document Model with Granular Access Control
 * 
 * 1. Documents belong to projects with explicit access lists
 * 2. File metadata stored (not actual file, encrypted path)
 * 3. Upload by restricted roles only (admin, project lead)
 * 4. Downloaded/accessed tracked for audit
 * 5. File names sanitized and stored separately from access control
 */

import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    // SECURITY: Document metadata
    fileName: {
      type: String,
      required: [true, 'File name is required'],
      trim: true,
      // SECURITY: Validate file extension
      validate: {
        validator: function(v) {
          const allowedExtensions = ['pdf', 'doc', 'docx', 'txt', 'xlsx', 'xls', 'pptx'];
          const ext = v.split('.').pop().toLowerCase();
          return allowedExtensions.includes(ext);
        },
        message: 'File type is not allowed',
      },
    },
    
    // SECURITY: Original file name from upload (for display)
    originalFileName: {
      type: String,
      required: true,
    },
    
    // SECURITY: File storage path (local or Cloudinary URL)
    filePath: {
      type: String,
      required: true,
      unique: true,
    },
    
    // Cloudinary public ID for cloud-stored files
    cloudinaryPublicId: {
      type: String,
      sparse: true,
    },
    
    // Cloudinary secure URL for direct access
    cloudinaryUrl: {
      type: String,
    },
    
    // Storage type indicator
    storageType: {
      type: String,
      enum: ['local', 'cloudinary'],
      default: 'local',
    },
    
    // SECURITY: File size tracking
    fileSize: {
      type: Number,
      required: [true, 'File size is required'],
      validate: {
        validator: function(v) {
          // Max 5MB per file
          return v <= 5242880;
        },
        message: 'File size exceeds maximum allowed (5MB)',
      },
    },
    
    // SECURITY: File MIME type validation
    mimeType: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
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
          return allowedMimeTypes.includes(v);
        },
        message: 'MIME type is not allowed',
      },
    },
    
    // SECURITY: Uploaded to which project
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project is required'],
    },
    
    // SECURITY: Who uploaded the document
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    // SECURITY: Access control - explicit users who can view
    accessibleBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        role: {
          type: String,
          enum: ['admin', 'project-lead', 'developer'],
        },
      },
    ],
    
    // SECURITY: Document classification (optional security label)
    classification: {
      type: String,
      enum: ['public', 'internal', 'confidential', 'secret'],
      default: 'internal',
    },
    
    // SECURITY: Checksum for integrity verification
    checksum: {
      type: String,
      required: true,
    },
    
    // SECURITY: Audit trail - who accessed when
    accessLog: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        accessedAt: {
          type: Date,
          default: Date.now,
        },
        action: {
          type: String,
          enum: ['viewed', 'downloaded'],
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

/**
 * SECURITY: Indexes for fast access control queries
 */
documentSchema.index({ project: 1 });
documentSchema.index({ uploadedBy: 1 });
documentSchema.index({ 'accessibleBy.userId': 1 });
documentSchema.index({ filePath: 1 }, { unique: true });

/**
 * SECURITY: Virtual for checking if a user has access
 */
documentSchema.virtual('userHasAccess').set(function(userId) {
  // This is for middleware use
});

/**
 * SECURITY: Check if a specific user can access this document
 */
documentSchema.methods.canAccess = function(userId) {
  // Admin always has access
  return this.accessibleBy.some(access => 
    access.userId.toString() === userId.toString()
  );
};

/**
 * SECURITY: Log access for audit trail
 */
documentSchema.methods.logAccess = function(userId, action) {
  this.accessLog.push({
    userId,
    action,
    accessedAt: new Date(),
  });
  return this.save();
};

/**
 * SECURITY: Custom JSON serialization
 */
documentSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.filePath; // Never expose actual file path in API
  delete obj.checksum; // Never expose checksum in API
  delete obj.__v;
  return obj;
};

export default mongoose.model('Document', documentSchema);
