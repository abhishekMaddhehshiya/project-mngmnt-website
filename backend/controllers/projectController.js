/**
 * SECURITY DECISION: Project Controller
 * 
 * Role-based access control:
 * - Admin: Create, read, update, delete any project
 * - Project Lead: Manage own projects and assign developers
 * - Developer: View only assigned projects
 */

import Project from '../models/Project.js';
import User from '../models/User.js';

/**
 * SECURITY: List projects based on user role
 */
export const listProjects = async (req, res) => {
  try {
    let filter = {};
    
    // SECURITY: Role-based filtering
    if (req.user.role === 'developer') {
      // Developers only see assigned projects
      filter.assignedDevelopers = req.user.id;
    } else if (req.user.role === 'project-lead') {
      // Project leads see their projects
      filter.$or = [
        { projectLead: req.user.id },
        { createdBy: req.user.id },
      ];
    }
    // Admins see all projects (empty filter)
    
    const projects = await Project.find(filter)
      .populate('createdBy', 'username email fullName role')
      .populate('projectLead', 'username email fullName role')
      .populate('assignedDevelopers', 'username email fullName');
    
    res.status(200).json({
      success: true,
      data: {
        count: projects.length,
        projects,
      },
    });
  } catch (error) {
    console.error('List projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * SECURITY: Get project by ID with access control check
 */
export const getProject = async (req, res) => {
  try {
    const { id } = req.params;
    
    const project = await Project.findById(id)
      .populate('createdBy', 'username email fullName role')
      .populate('projectLead', 'username email fullName role')
      .populate('assignedDevelopers', 'username email fullName');
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }
    
    // SECURITY: Check if user has access to this project
    if (!hasProjectAccess(req.user, project)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this project',
      });
    }
    
    res.status(200).json({
      success: true,
      data: { project },
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * SECURITY: Create project (admin or project lead)
 */
export const createProject = async (req, res) => {
  try {
    const { name, description, deadline, priority, projectLead, assignedDevelopers } = req.body;
    
    // SECURITY: Validate project lead if provided
    if (projectLead) {
      const lead = await User.findById(projectLead);
      if (!lead || !['admin', 'project-lead'].includes(lead.role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid project lead',
        });
      }
    }
    
    // SECURITY: Validate assigned developers
    let validDevelopers = [];
    if (assignedDevelopers && Array.isArray(assignedDevelopers)) {
      const developers = await User.find({
        _id: { $in: assignedDevelopers },
        role: 'developer',
      });
      
      if (developers.length !== assignedDevelopers.length) {
        return res.status(400).json({
          success: false,
          message: 'Some assigned users are not developers',
        });
      }
      
      validDevelopers = developers.map(d => d._id);
    }
    
    // SECURITY: Create project with creator info
    const newProject = new Project({
      name,
      description,
      deadline,
      priority: priority || 'medium',
      createdBy: req.user.id,
      projectLead: projectLead || req.user.id,
      assignedDevelopers: validDevelopers,
      lastModifiedBy: req.user.id,
    });
    
    await newProject.save();
    
    // Populate references
    await newProject.populate('createdBy', 'username email fullName role');
    await newProject.populate('projectLead', 'username email fullName role');
    await newProject.populate('assignedDevelopers', 'username email fullName');
    
    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: { project: newProject },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message),
      });
    }
    
    console.error('Create project error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * SECURITY: Update project with access control check
 */
export const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, deadline, status, priority, projectLead, assignedDevelopers } = req.body;
    
    const project = await Project.findById(id);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }
    
    // SECURITY: Check access control
    if (!canModifyProject(req.user, project)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to modify this project',
      });
    }
    
    // SECURITY: Build safe update object
    const updateData = { lastModifiedBy: req.user.id };
    
    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (deadline) updateData.deadline = deadline;
    if (status && ['active', 'completed', 'on-hold', 'cancelled'].includes(status)) {
      updateData.status = status;
    }
    if (priority && ['low', 'medium', 'high', 'critical'].includes(priority)) {
      updateData.priority = priority;
    }
    
    // SECURITY: Validate and update projectLead
    if (projectLead) {
      const lead = await User.findById(projectLead);
      if (!lead || !['admin', 'project-lead'].includes(lead.role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid project lead',
        });
      }
      updateData.projectLead = projectLead;
    }
    
    // SECURITY: Validate and update assignedDevelopers
    if (assignedDevelopers && Array.isArray(assignedDevelopers)) {
      const developers = await User.find({
        _id: { $in: assignedDevelopers },
        role: 'developer',
      });
      
      if (developers.length !== assignedDevelopers.length) {
        return res.status(400).json({
          success: false,
          message: 'Some assigned users are not developers',
        });
      }
      
      updateData.assignedDevelopers = assignedDevelopers;
    }
    
    const updatedProject = await Project.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy projectLead assignedDevelopers', 'username email fullName role');
    
    res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: { project: updatedProject },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message),
      });
    }
    
    console.error('Update project error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * SECURITY: Delete project (admin only)
 */
export const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    
    const project = await Project.findById(id);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }
    
    // SECURITY: Only admin can delete projects
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can delete projects',
      });
    }
    
    await Project.findByIdAndDelete(id);
    
    res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * SECURITY: Check if user has read access to project
 */
function hasProjectAccess(user, project) {
  // Admin has access to everything
  if (user.role === 'admin') return true;
  
  // Helper to get ID string from populated or unpopulated field
  const getId = (field) => {
    if (!field) return null;
    if (typeof field === 'object' && field._id) return field._id.toString();
    return field.toString();
  };
  
  // Project lead sees own projects
  if (user.role === 'project-lead') {
    const projectLeadId = getId(project.projectLead);
    const createdById = getId(project.createdBy);
    if (projectLeadId === user.id || createdById === user.id) {
      return true;
    }
  }
  
  // Developers see assigned projects
  if (user.role === 'developer') {
    const devIds = project.assignedDevelopers?.map(dev => getId(dev)) || [];
    if (devIds.includes(user.id)) {
      return true;
    }
  }
  
  return false;
}

/**
 * SECURITY: Check if user can modify project
 */
function canModifyProject(user, project) {
  // Admin can modify anything
  if (user.role === 'admin') return true;
  
  // Helper to get ID string from populated or unpopulated field
  const getId = (field) => {
    if (!field) return null;
    if (typeof field === 'object' && field._id) return field._id.toString();
    return field.toString();
  };
  
  // Project lead can modify their own projects
  if (user.role === 'project-lead') {
    const projectLeadId = getId(project.projectLead);
    const createdById = getId(project.createdBy);
    if (projectLeadId === user.id || createdById === user.id) {
      return true;
    }
  }
  
  // Developers cannot modify
  return false;
}
