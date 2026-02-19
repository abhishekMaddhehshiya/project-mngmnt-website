/**
 * SECURITY DECISION: Main Server Entry Point
 * 
 * Initializes:
 * 1. Express application
 * 2. Security middleware (helmet, CORS, rate limiting)
 * 3. Database connection (MongoDB)
 * 4. Request logging
 * 5. API routes
 * 6. Error handling
 * 
 * Follows principle of "secure by default"
 */

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import config from './config/config.js';
import { seedDatabase } from './utils/seedDatabase.js';
import {
  securityHeaders,
  globalRateLimit,
  sanitizeParams,
  requestLogger,
  errorHandler,
  secureResponse,
} from './middleware/security.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import assignableRoutes from './routes/assignableRoutes.js';
import messageRoutes from './routes/messageRoutes.js';

const app = express();

/**
 * SECURITY: Trust proxy for X-Forwarded-For header
 * Important when running behind reverse proxy/load balancer
 */
if (config.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

/**
 * SECURITY: CORS Configuration
 * Restrict to known origins only
 */
app.use(cors({
  origin: config.corsOrigin.split(','),
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 24 hours
}));

/**
 * SECURITY: Helmet middleware - set security headers
 */
app.use(securityHeaders);

/**
 * SECURITY: Global rate limiting
 */
app.use(globalRateLimit);

/**
 * SECURITY: Response headers for security
 */
app.use(secureResponse);

/**
 * SECURITY: Parse JSON bodies with limit
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

/**
 * SECURITY: Sanitize input parameters
 */
app.use(sanitizeParams);

/**
 * SECURITY: Request logging for audit trail
 */
app.use(requestLogger);

/**
 * SECURITY: Health check endpoint (no auth required, useful for load balancers)
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

/**
 * SECURITY: API Routes with prefix
 */
app.use('/api/auth', authRoutes);
app.use('/api/users', assignableRoutes);  // Must be before userRoutes to match /assignable first
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/messages', messageRoutes);

/**
 * SECURITY: 404 Not Found handler
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
  });
});

/**
 * SECURITY: Global error handler
 * Must be last middleware
 */
app.use(errorHandler);

/**
 * SECURITY: Database Connection
 * Connects to MongoDB with error handling
 */
const connectDatabase = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(config.mongodbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✓ MongoDB connected successfully');
    
    // Seed demo users in development
    if (config.nodeEnv === 'development') {
      console.log('\nSeeding demo users...');
      await seedDatabase();
      console.log('');
    }
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

/**
 * SECURITY: Server startup
 */
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();
    
    // Start server
    const server = app.listen(config.port, () => {
      console.log(`\n${'='.repeat(60)}`);
      console.log('PixelForge Nexus - Secure Project Management System');
      console.log(`${'='.repeat(60)}`);
      console.log(`Server running at http://localhost:${config.port}`);
      console.log(`Environment: ${config.nodeEnv}`);
      console.log(`CORS Origin: ${config.corsOrigin}`);
      console.log(`${'='.repeat(60)}\n`);
    });
    
    /**
     * SECURITY: Graceful shutdown handler
     * Closes database connection on SIGTERM/SIGINT
     */
    const shutdown = async (signal) => {
      console.log(`\n✓ ${signal} signal received. Shutting down gracefully...`);
      
      server.close(() => {
        console.log('✓ Server closed');
      });
      
      try {
        await mongoose.disconnect();
        console.log('✓ Database disconnected');
        process.exit(0);
      } catch (error) {
        console.error('✗ Error during shutdown:', error);
        process.exit(1);
      }
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    /**
     * SECURITY: Unhandled rejection handler
     */
    process.on('unhandledRejection', (error) => {
      console.error('✗ Unhandled Rejection:', error);
      process.exit(1);
    });
  } catch (error) {
    console.error('✗ Server startup failed:', error);
    process.exit(1);
  }
};

// Start server
startServer();

export default app;
