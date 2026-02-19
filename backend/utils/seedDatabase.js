/**
 * SECURITY: Database Seeding
 * 
 * Creates default demo users on first startup
 * Should only run in development environment
 */

import User from '../models/User.js';

const DEMO_USERS = [
  {
    email: 'admin@example.com',
    password: 'Admin123!@#',
    fullName: 'Admin User',
    role: 'admin',
    username: 'admin@example.com'
  },
  {
    email: 'lead@example.com',
    password: 'Lead123!@#',
    fullName: 'Project Lead',
    role: 'project-lead',
    username: 'lead@example.com'
  },
  {
    email: 'dev@example.com',
    password: 'Dev123!@#',
    fullName: 'Developer',
    role: 'developer',
    username: 'dev@example.com'
  }
];

/**
 * Seed database with demo users
 * Call this after database connection is established
 */
export async function seedDatabase() {
  try {
    for (const userData of DEMO_USERS) {
      const existingUser = await User.findOne({ email: userData.email });
      
      if (!existingUser) {
        const user = new User(userData);
        await user.save();
        console.log(`✓ Created demo user: ${userData.email} (${userData.role})`);
      } else {
        console.log(`⏭️  Demo user already exists: ${userData.email}`);
      }
    }
  } catch (error) {
    console.error('Error seeding database:', error.message);
  }
}
