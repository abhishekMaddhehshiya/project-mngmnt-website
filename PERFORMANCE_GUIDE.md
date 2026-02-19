# Performance Optimization & Scalability Guide

This guide provides strategies to optimize PixelForge Nexus for high-traffic production environments.

## ⚡ Backend Performance Optimization

### 1. Database Query Optimization

```javascript
// backend/utils/queryOptimization.js

// ❌ BAD: N+1 query problem
async function getProjectsWithUsers() {
  const projects = await Project.find();
  const result = [];
  
  for (const project of projects) {
    const lead = await User.findById(project.projectLead);
    result.push({ ...project.toObject(), lead });
  }
  
  return result;
}

// ✅ GOOD: Use populate with selected fields
async function getProjectsWithUsers() {
  return await Project.find()
    .populate('projectLead', 'fullName email role')  // Only needed fields
    .populate('createdBy', 'fullName')
    .lean()  // Return plain objects (faster)
    .exec();
}

// ✅ BETTER: Use MongoDB aggregation pipeline
async function getProjectsWithUsers() {
  return await Project.aggregate([
    {
      $lookup: {
        from: 'users',
        localField: 'projectLead',
        foreignField: '_id',
        as: 'lead'
      }
    },
    {
      $unwind: '$lead'
    },
    {
      $project: {
        name: 1,
        description: 1,
        'lead.fullName': 1,
        'lead.email': 1,
        'lead.role': 1
      }
    },
    {
      $limit: 100  // Pagination
    }
  ]);
}

// Monitoring slow queries
mongoose.set('debug', process.env.DEBUG_QUERIES === 'true');

// Add query timeout
const queryTimeout = 5000;  // 5 seconds
User.find().maxTime(queryTimeout);
```

### 2. Caching Strategy

```javascript
// backend/utils/cache.js
const redis = require('redis');
const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  socket: { reconnectStrategy: () => new Error('retry later') }
});

const CACHE_TTL = 300;  // 5 minutes

// Cache wrapper
async function getCachedUser(userId) {
  const cacheKey = `user:${userId}`;
  
  // Try cache first
  let user = await client.get(cacheKey);
  if (user) {
    return JSON.parse(user);
  }
  
  // Database fallback
  user = await User.findById(userId).lean();
  
  if (user) {
    // Cache for 5 minutes
    await client.setEx(cacheKey, CACHE_TTL, JSON.stringify(user));
  }
  
  return user;
}

// Cache invalidation on update
async function updateUser(userId, updateData) {
  const user = await User.findByIdAndUpdate(userId, updateData, { new: true });
  
  // Invalidate cache
  await client.del(`user:${userId}`);
  
  return user;
}

// Cache key strategies
const cacheKeys = {
  user: (id) => `user:${id}`,
  project: (id) => `project:${id}`,
  projectList: (userId) => `projects:${userId}`,
  userPermissions: (userId) => `perms:${userId}`,
  
  // Pattern-based invalidation
  allUsersPattern: 'user:*',
  allProjectsPattern: 'project:*'
};

// Batch cache invalidation
async function invalidateUserRelated(userId) {
  const keys = await client.keys(`user:${userId}:*`);
  if (keys.length > 0) {
    await client.del(keys);
  }
}
```

### 3. Connection Pooling

```javascript
// backend/config/database.js

const mongoOptions = {
  // Connection pooling
  maxPoolSize: 50,  // Max connections in pool
  minPoolSize: 10,  // Min connections in pool
  maxIdleTimeMS: 60000,  // Close idle connections after 60s
  
  // Connection timeout
  serverSelectionTimeoutMS: 5000,
  
  // Monitoring
  monitorCommands: process.env.DEBUG_MONGO === 'true',
  
  // Connection events
  socketTimeoutMS: 45000,
  family: 4  // Use IPv4
};

// Monitor pool usage
mongoose.connection.on('open', () => {
  console.log('MongoDB connected');
});

// Query timeout per operation
async function queryWithTimeout(promise, timeoutMs = 5000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
    )
  ]);
}
```

### 4. Pagination for Large Result Sets

```javascript
// backend/controllers/projectController.js

async function listProjects(req, res) {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);  // Max 100
    const skip = (page - 1) * limit;
    
    // Build query
    let query = {};
    
    if (req.user.role === 'developer') {
      query = { assignedDevelopers: req.user._id };
    } else if (req.user.role === 'project-lead') {
      query = { $or: [{ projectLead: req.user._id }, { createdBy: req.user._id }] };
    }
    
    // Parallel execution
    const [projects, total] = await Promise.all([
      Project.find(query)
        .lean()
        .select('name description projectLead status -_id')  // Only needed fields
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec(),
      Project.countDocuments(query)
    ]);
    
    res.json({
      data: projects,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching projects' });
  }
}
```

### 5. Batch Processing

```javascript
// backend/utils/batch.js

// Process large updates in batches
async function batchUpdateProjects(projectIds, updateData, batchSize = 100) {
  for (let i = 0; i < projectIds.length; i += batchSize) {
    const batch = projectIds.slice(i, i + batchSize);
    
    await Project.updateMany(
      { _id: { $in: batch } },
      updateData,
      { runValidators: false }  // Skip validation for speed
    );
    
    // Avoid blocking event loop
    await new Promise(resolve => setImmediate(resolve));
  }
}

// Parallel batch processing
async function batchProcessUsers(users, processor, concurrency = 5) {
  const results = [];
  
  for (let i = 0; i < users.length; i += concurrency) {
    const batch = users.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(user => processor(user))
    );
    results.push(...batchResults);
  }
  
  return results;
}
```

### 6. Index Optimization

```javascript
// backend/models/Project.js

const projectSchema = new Schema({
  name: String,
  projectLead: { type: Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  assignedDevelopers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, enum: ['active', 'completed'] },
  createdAt: { type: Date, default: Date.now }
});

// Add strategic indexes
projectSchema.index({ projectLead: 1 });  // Single-field
projectSchema.index({ createdBy: 1 });
projectSchema.index({ assignedDevelopers: 1 });
projectSchema.index({ status: 1 });

// Compound index for common queries
projectSchema.index({ projectLead: 1, status: 1 });
projectSchema.index({ createdAt: -1 });  // Descending for sorting

// Text index for full-text search
projectSchema.index({ name: 'text', description: 'text' });

// TTL index for temporary data
projectSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 * 30 });

// Sparse index for optional fields
projectSchema.index({ deletedAt: 1 }, { sparse: true });

// Index usage analysis
async function analyzeIndexUsage() {
  const stats = await Project.collection.stats();
  console.log('Index usage:', stats.indexSizes);
}
```

---

## ⚡ Frontend Performance Optimization

### 1. Code Splitting & Lazy Loading

```javascript
// frontend/src/App.jsx
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Lazy load pages
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProjectDetails = lazy(() => import('./pages/ProjectDetails'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));

// Loading fallback
const LoadingFallback = () => <div>Loading...</div>;

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/projects/:id" element={<ProjectDetails />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
```

### 2. Bundle Analysis & Optimization

```bash
# package.json scripts
"analyze": "source-map-explorer 'build/static/js/*.js'",
"build": "react-scripts build && npm run analyze"

# Install analyzer
npm install source-map-explorer --save-dev
```

### 3. Image Optimization

```javascript
// frontend/src/components/ProjectCard.jsx
import { lazy, Suspense } from 'react';

// Lazy load images
<img
  src="project-thumbnail.jpg"
  alt="Project thumbnail"
  loading="lazy"
  width="300"
  height="200"
  decoding="async"
/>

// Use modern formats
<picture>
  <source srcSet="image.webp" type="image/webp" />
  <source srcSet="image.jpg" type="image/jpeg" />
  <img src="image.jpg" alt="Fallback" />
</picture>

// Implement image caching
const imageCache = new Map();

function CachedImage({ src, alt, ...props }) {
  if (!imageCache.has(src)) {
    imageCache.set(src, src);
  }
  
  return <img src={imageCache.get(src)} alt={alt} {...props} />;
}
```

### 4. State Management Optimization

```javascript
// frontend/src/store/authStore.js - Already optimized with Zustand

// Additional optimization for large stores
import create from 'zustand';
import { devtools, persist } from 'zustand/middleware';

const useAuthStore = create(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        isAuthenticated: false,
        
        // Selector to prevent unnecessary re-renders
        getRole: () => get().user?.role,
        isAdmin: () => get().user?.role === 'admin',
        
        login: async (username, password) => {
          // Implementation
        }
      }),
      { name: 'auth-storage' }
    )
  )
);

// Consumer - Only subscribe to needed state
const AdminPanel = () => {
  // Only re-render when isAdmin changes
  const isAdmin = useAuthStore(state => state.user?.role === 'admin');
  
  if (!isAdmin) return null;
  
  return <div>Admin content</div>;
};
```

### 5. API Request Optimization

```javascript
// frontend/src/lib/api.js
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL,
  
  // Timeout
  timeout: 10000,
  
  // Response compression
  headers: {
    'Accept-Encoding': 'gzip, deflate',
    'Accept': 'application/json'
  }
});

// Request deduplication
const pendingRequests = new Map();

apiClient.interceptors.request.use(config => {
  const key = `${config.method}:${config.url}`;
  
  // Check for duplicate in-flight request
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }
  
  return config;
});

apiClient.interceptors.response.use(
  response => {
    const key = `${response.config.method}:${response.config.url}`;
    pendingRequests.delete(key);
    return response;
  },
  error => {
    const key = `${error.config.method}:${error.config.url}`;
    pendingRequests.delete(key);
    return Promise.reject(error);
  }
);
```

### 6. Component Memoization

```javascript
// frontend/src/components/ProjectList.jsx
import React, { memo, useMemo, useCallback } from 'react';

// Memoize heavy component
const ProjectCard = memo(({ project, onSelect }) => {
  return (
    <div onClick={() => onSelect(project._id)}>
      <h3>{project.name}</h3>
      <p>{project.description}</p>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - return true if props equal (skip re-render)
  return prevProps.project._id === nextProps.project._id;
});

export function ProjectList({ projects }) {
  // Memoize callback to prevent child re-renders
  const handleSelect = useCallback(projectId => {
    console.log('Selected:', projectId);
  }, []);
  
  // Memoize filtered list
  const filteredProjects = useMemo(() => {
    return projects.filter(p => p.status === 'active');
  }, [projects]);
  
  return (
    <div>
      {filteredProjects.map(project => (
        <ProjectCard
          key={project._id}
          project={project}
          onSelect={handleSelect}
        />
      ))}
    </div>
  );
}
```

---

## 🚀 Infrastructure Optimization

### 1. CDN Configuration

```nginx
# nginx.conf - CDN caching

# Cache static assets
location ~* \.(js|css|png|jpg|jpeg|gif|ico|woff|woff2|ttf|svg)$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
  add_header ETag "\"$file_mtime\"";
  gzip on;
  gzip_types text/css application/javascript;
}

# Don't cache HTML
location ~* \.html$ {
  expires 1h;
  add_header Cache-Control "public, must-revalidate";
}

# API responses - don't cache
location /api/ {
  expires -1;
  add_header Cache-Control "no-store, must-revalidate";
}

# Enable gzip compression
gzip on;
gzip_types text/plain text/css text/javascript application/json;
gzip_min_length 1000;
gzip_level 6;
```

### 2. Load Balancing

```nginx
# Upstream backend servers
upstream backend_servers {
  # Weighted distribution
  server backend-1.internal:5000 weight=1;
  server backend-2.internal:5000 weight=1;
  server backend-3.internal:5000 weight=1;
  
  # Health checks
  zone upstream_backend 64k;
  keepalive 32;
}

server {
  location /api/ {
    proxy_pass http://backend_servers;
    
    # Connection reuse
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    
    # Timeouts
    proxy_connect_timeout 10s;
    proxy_send_timeout 30s;
    proxy_read_timeout 30s;
  }
}
```

### 3. Monitoring & Auto-Scaling

```yaml
# kubernetes/hpa.yaml - Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: pixelforge-backend
  
  minReplicas: 2
  maxReplicas: 10
  
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
```

---

## 📊 Load Testing

```bash
# Using Apache Bench
ab -n 10000 -c 100 https://yourdomain.com/

# Using wrk (modern tool)
wrk -t12 -c400 -d30s https://yourdomain.com/

# Using k6 (developer-friendly)
k6 run load-test.js

# k6 script example
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 100,          // 100 virtual users
  duration: '30s',   // 30 seconds
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95th percentile < 500ms
  }
};

export default function () {
  const res = http.get('https://yourdomain.com/api/projects');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500
  });
}
```

---

## ✅ Performance Checklist

```
Backend:
- [ ] Database indexes optimized
- [ ] N+1 queries eliminated
- [ ] Caching implemented (Redis)
- [ ] Connection pooling configured
- [ ] Query timeouts set
- [ ] Batch processing for large operations
- [ ] Slow query monitoring enabled

Frontend:
- [ ] Code splitting implemented
- [ ] Lazy loading for routes and components
- [ ] Bundle size < 100KB (gzipped)
- [ ] Images optimized
- [ ] CSS critical path optimized
- [ ] Service worker for offline support
- [ ] Compression enabled (gzip/brotli)

Infrastructure:
- [ ] CDN configured
- [ ] Load balancing enabled
- [ ] Auto-scaling configured
- [ ] Database replicas set up
- [ ] Monitoring and alerting active
- [ ] Load testing passed (target: 1000 req/s)
- [ ] Response time p95 < 500ms
```

