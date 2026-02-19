/**
 * SECURITY DECISION: Message Model
 * 
 * 1. Messages are tied to specific projects
 * 2. Developers can send messages and request completion
 * 3. Admin/Project Lead can review and respond
 * 4. Audit trail via timestamps
 */

import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    // Reference to project
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project reference is required'],
      index: true,
    },
    
    // Message sender
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender is required'],
    },
    
    // Message content
    content: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
      minlength: [1, 'Message cannot be empty'],
      maxlength: [2000, 'Message must not exceed 2000 characters'],
    },
    
    // Message type
    type: {
      type: String,
      enum: ['message', 'completion-request', 'completion-approved', 'completion-rejected'],
      default: 'message',
    },
    
    // For completion requests - reviewed by admin/lead
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    
    reviewedAt: {
      type: Date,
    },
    
    // Review response/reason
    reviewResponse: {
      type: String,
      maxlength: [1000, 'Review response must not exceed 1000 characters'],
    },
    
    // Read status
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient project message queries
messageSchema.index({ project: 1, createdAt: -1 });

// Virtual for formatted date
messageSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
});

// Ensure virtuals are included in JSON
messageSchema.set('toJSON', { virtuals: true });
messageSchema.set('toObject', { virtuals: true });

const Message = mongoose.model('Message', messageSchema);

export default Message;
