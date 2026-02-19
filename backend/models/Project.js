/**
 * SECURITY DECISION: Project Model with Access Control
 * 
 * 1. Project has explicit ownership (admin or project lead)
 * 2. Status field controlled to prevent unauthorized state changes
 * 3. Assigned users tracked for access control checks
 * 4. Audit trail via timestamps
 */

import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    // SECURITY: Project identification
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      minlength: [3, 'Project name must be at least 3 characters'],
      maxlength: [255, 'Project name must not exceed 255 characters'],
    },
    
    description: {
      type: String,
      maxlength: [5000, 'Description must not exceed 5000 characters'],
      trim: true,
    },
    
    // SECURITY: Project deadline
    deadline: {
      type: Date,
      validate: {
        validator: function(v) {
          return v > new Date();
        },
        message: 'Deadline must be in the future',
      },
    },
    
    // SECURITY: Controlled status field
    status: {
      type: String,
      enum: ['active', 'completed', 'on-hold', 'cancelled'],
      default: 'active',
    },
    
    // SECURITY: Project ownership with role separation
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    projectLead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      validate: {
        isAsync: true,
        validator: async function(v) {
          if (!v) return true; // Optional field
          const User = (await import('./User.js')).default;
          const user = await User.findById(v);
          return user && ['admin', 'project-lead'].includes(user.role);
        },
        message: 'Project lead must have admin or project-lead role',
      },
    },
    
    // SECURITY: Assigned developers (explicit access control)
    assignedDevelopers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        validate: {
          isAsync: true,
          validator: async function(v) {
            const User = (await import('./User.js')).default;
            const user = await User.findById(v);
            return user && user.role === 'developer';
          },
          message: 'Assigned users must have developer role',
        },
      },
    ],
    
    // SECURITY: Project priority for resource allocation
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    
    // SECURITY: Audit trail
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

/**
 * SECURITY: Index for faster access control queries
 */
projectSchema.index({ projectLead: 1 });
projectSchema.index({ createdBy: 1 });
projectSchema.index({ assignedDevelopers: 1 });
projectSchema.index({ status: 1 });

/**
 * SECURITY: Ensure proper access control on updates
 */
projectSchema.pre('findByIdAndUpdate', async function(next) {
  const update = this.getUpdate();
  
  // Validate status transitions
  if (update.status) {
    const validStatuses = ['active', 'completed', 'on-hold', 'cancelled'];
    if (!validStatuses.includes(update.status)) {
      next(new Error('Invalid status value'));
    }
  }
  
  // Track who made the change (done at controller level)
  next();
});

/**
 * SECURITY: Custom JSON serialization
 */
projectSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

export default mongoose.model('Project', projectSchema);
