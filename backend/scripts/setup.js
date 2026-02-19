#!/usr/bin/env node

/**
 * SECURITY: Setup Script for PixelForge Nexus
 * 
 * This script initializes the system by:
 * 1. Connecting to MongoDB
 * 2. Creating initial admin user
 * 3. Verifying database indexes
 * 4. Setting up security configurations
 */

import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';
import User from './models/User.js';
import config from './config/config.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (prompt) => {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
};

async function setupSystem() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  PixelForge Nexus - System Setup                      ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  try {
    // 1. Connect to MongoDB
    console.log('1️⃣  Connecting to MongoDB...');
    await mongoose.connect(config.mongodbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✓ MongoDB connected successfully\n');

    // 2. Check if admin already exists
    console.log('2️⃣  Checking for existing admin accounts...');
    const adminCount = await User.countDocuments({ role: 'admin' });
    
    if (adminCount > 0) {
      console.log(`✓ Found ${adminCount} existing admin account(s)\n`);
      const continueSetup = await question('Continue with setup? (y/n): ');
      if (continueSetup.toLowerCase() !== 'y') {
        console.log('Setup cancelled.');
        process.exit(0);
      }
    }

    // 3. Create admin user
    console.log('\n3️⃣  Creating initial admin account...');
    const adminUsername = await question('Admin username (email): ');
    const adminEmail = await question('Admin email: ');
    const adminPassword = await question('Admin password (min 8 chars): ');
    const adminFullName = await question('Admin full name: ');

    // Validate inputs
    if (!adminUsername || !adminEmail || !adminPassword || !adminFullName) {
      throw new Error('All fields are required');
    }

    if (adminPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Create admin user
    const existingUser = await User.findOne({
      $or: [{ username: adminUsername }, { email: adminEmail }],
    });

    if (existingUser) {
      console.log('⚠️  Username or email already exists');
      const overwrite = await question('Overwrite existing user? (y/n): ');
      if (overwrite.toLowerCase() === 'y') {
        await User.deleteOne({ _id: existingUser._id });
        console.log('✓ Existing user deleted');
      } else {
        throw new Error('User already exists');
      }
    }

    const adminUser = new User({
      username: adminUsername,
      email: adminEmail,
      password: adminPassword,
      fullName: adminFullName,
      role: 'admin',
      isActive: true,
    });

    await adminUser.save();
    console.log('✓ Admin user created successfully\n');

    // 4. Create test users (optional)
    console.log('4️⃣  Creating test users...');
    const createTestUsers = await question('Create test users for development? (y/n): ');

    if (createTestUsers.toLowerCase() === 'y') {
      const testUsers = [
        {
          username: 'lead@pixelforge.local',
          email: 'lead@pixelforge.local',
          password: 'Lead@123456',
          fullName: 'Test Project Lead',
          role: 'project-lead',
        },
        {
          username: 'developer@pixelforge.local',
          email: 'developer@pixelforge.local',
          password: 'Dev@123456',
          fullName: 'Test Developer',
          role: 'developer',
        },
      ];

      for (const userData of testUsers) {
        const existing = await User.findOne({ email: userData.email });
        if (!existing) {
          const user = new User(userData);
          await user.save();
          console.log(`✓ Created ${userData.role}: ${userData.username}`);
        } else {
          console.log(`⏭️  ${userData.role} already exists: ${userData.username}`);
        }
      }
    }

    // 5. Verify database indexes
    console.log('\n5️⃣  Verifying database indexes...');
    try {
      // Ensure indexes exist
      await User.collection.ensureIndex({ email: 1 });
      await User.collection.ensureIndex({ username: 1 });
      console.log('✓ Database indexes verified\n');
    } catch (err) {
      console.log('⚠️  Could not verify indexes (usually not critical)\n');
    }

    // 6. Display summary
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║  Setup Complete! 🎉                                  ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    console.log('📋 Summary:');
    console.log(`  - Admin account created: ${adminUsername}`);
    console.log(`  - Email: ${adminEmail}`);
    console.log(`  - Database: Connected to ${config.mongodbUri}`);
    console.log(`  - Environment: ${config.nodeEnv}`);

    console.log('\n🚀 Next Steps:');
    console.log('  1. Start the backend: npm run dev');
    console.log('  2. Start the frontend: npm start (from frontend/)');
    console.log('  3. Login with your admin credentials');
    console.log('  4. Create additional users in the admin panel');

    console.log('\n🔒 Security Reminders:');
    console.log('  - Change test credentials in production');
    console.log('  - Set strong JWT secrets in .env');
    console.log('  - Enable HTTPS in production');
    console.log('  - Configure CORS_ORIGIN correctly');
    console.log('  - Set up backups and monitoring');

    console.log('\n📖 Documentation:');
    console.log('  - See README.md for complete documentation');
    console.log('  - See ARCHITECTURE.md for system design');
    console.log('  - See THREAT_MODEL.md for security analysis');
    console.log('  - See FORMAL_METHODS.md for access control verification\n');

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Setup Error:', error.message);
    rl.close();
    process.exit(1);
  }
}

// Run setup
setupSystem();
