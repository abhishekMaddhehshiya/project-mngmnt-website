/**
 * SECURITY DECISION: Message Controller
 * 
 * Role-based access control:
 * - Developer: Can send messages and request completion in assigned projects
 * - Admin/Project Lead: Can view all messages, review completion requests, and mark project completed
 */

import Message from '../models/Message.js';
import Project from '../models/Project.js';

/**
 * SECURITY: Check if user has access to project
 */
const hasProjectAccess = (user, project) => {
  if (user.role === 'admin') return true;
  
  const getId = (field) => {
    if (!field) return null;
    if (typeof field === 'object' && field._id) return field._id.toString();
    return field.toString();
  };
  
  if (user.role === 'project-lead') {
    const projectLeadId = getId(project.projectLead);
    const createdById = getId(project.createdBy);
    if (projectLeadId === user.id || createdById === user.id) return true;
  }
  
  if (user.role === 'developer') {
    const devIds = project.assignedDevelopers?.map(dev => getId(dev)) || [];
    if (devIds.includes(user.id)) return true;
  }
  
  return false;
};

/**
 * SECURITY: Get messages for a project
 */
export const getProjectMessages = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }
    
    // Check access
    if (!hasProjectAccess(req.user, project)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this project',
      });
    }
    
    const messages = await Message.find({ project: projectId })
      .populate('sender', 'username fullName role')
      .populate('reviewedBy', 'username fullName role')
      .sort({ createdAt: -1 })
      .limit(100);
    
    res.status(200).json({
      success: true,
      data: { messages },
    });
  } catch (error) {
    console.error('Get project messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * SECURITY: Send a message in a project
 */
export const sendMessage = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { content, type = 'message' } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required',
      });
    }
    
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }
    
    // Check access
    if (!hasProjectAccess(req.user, project)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this project',
      });
    }
    
    // Validate message type based on role
    let messageType = type;
    if (type === 'completion-request') {
      // Only developers can request completion
      if (req.user.role !== 'developer') {
        return res.status(403).json({
          success: false,
          message: 'Only developers can request project completion',
        });
      }
      
      // Check if there's already a pending completion request
      const pendingRequest = await Message.findOne({
        project: projectId,
        type: 'completion-request',
        reviewedBy: null,
      });
      
      if (pendingRequest) {
        return res.status(400).json({
          success: false,
          message: 'There is already a pending completion request for this project',
        });
      }
    }
    
    const message = new Message({
      project: projectId,
      sender: req.user.id,
      content: content.trim(),
      type: messageType,
    });
    
    await message.save();
    await message.populate('sender', 'username fullName role');
    
    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: { message },
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * SECURITY: Review completion request (Admin/Project Lead only)
 */
export const reviewCompletionRequest = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { approved, response } = req.body;
    
    // Only admin and project-lead can review
    if (!['admin', 'project-lead'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins and project leads can review completion requests',
      });
    }
    
    const message = await Message.findById(messageId).populate('project');
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }
    
    if (message.type !== 'completion-request') {
      return res.status(400).json({
        success: false,
        message: 'This message is not a completion request',
      });
    }
    
    if (message.reviewedBy) {
      return res.status(400).json({
        success: false,
        message: 'This completion request has already been reviewed',
      });
    }
    
    // Check access to project
    const project = await Project.findById(message.project);
    if (!hasProjectAccess(req.user, project)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this project',
      });
    }
    
    // Update message with review
    message.reviewedBy = req.user.id;
    message.reviewedAt = new Date();
    message.reviewResponse = response || '';
    message.type = approved ? 'completion-approved' : 'completion-rejected';
    await message.save();
    
    // If approved, update project status
    if (approved) {
      await Project.findByIdAndUpdate(message.project, {
        status: 'completed',
        lastModifiedBy: req.user.id,
      });
    }
    
    await message.populate('sender', 'username fullName role');
    await message.populate('reviewedBy', 'username fullName role');
    
    res.status(200).json({
      success: true,
      message: approved ? 'Project marked as completed' : 'Completion request rejected',
      data: { message },
    });
  } catch (error) {
    console.error('Review completion request error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * SECURITY: Get pending completion requests (Admin/Project Lead)
 */
export const getPendingCompletionRequests = async (req, res) => {
  try {
    // Only admin and project-lead can view pending requests
    if (!['admin', 'project-lead'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }
    
    let projectFilter = {};
    
    // Project leads only see requests for their projects
    if (req.user.role === 'project-lead') {
      const userProjects = await Project.find({
        $or: [
          { projectLead: req.user.id },
          { createdBy: req.user.id },
        ],
      }).select('_id');
      
      projectFilter = { project: { $in: userProjects.map(p => p._id) } };
    }
    
    const requests = await Message.find({
      ...projectFilter,
      type: 'completion-request',
      reviewedBy: null,
    })
      .populate('sender', 'username fullName role')
      .populate('project', 'name status')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      data: { requests },
    });
  } catch (error) {
    console.error('Get pending requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
