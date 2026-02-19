# PixelForge Nexus - Production Deployment Guide

This guide covers deploying PixelForge Nexus to production with proper security, scalability, and reliability.

## 🔐 Pre-Deployment Security Checklist

### Environment Configuration
- [ ] Generate strong JWT secrets (32+ characters)
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] Set NODE_ENV=production
- [ ] Configure CORS_ORIGIN to exact frontend domain
- [ ] Use environment-specific secrets management (AWS Secrets Manager, Vault, etc.)
- [ ] Never commit .env or secrets to version control

### Database Security
- [ ] MongoDB uses strong password
- [ ] MongoDB connection uses authentication
- [ ] Enable MongoDB encryption at rest
- [ ] Use MongoDB Atlas with IP whitelisting OR private VPC network
- [ ] Configure automated backups with encryption
- [ ] Test backup restoration procedures
- [ ] Set up read replicas for high availability

### SSL/TLS Configuration
- [ ] Obtain SSL certificate (Let's Encrypt recommended)
- [ ] Configure HTTPS on backend and frontend
- [ ] Set HSTS header (Strict-Transport-Security)
- [ ] Ensure certificates auto-renew
- [ ] Use TLS 1.2+ minimum

### Backend Security
- [ ] Install security dependencies: `npm audit fix`
- [ ] Set bcrypt rounds to 10-12 (don't increase without testing)
- [ ] Configure rate limiting thresholds
- [ ] Disable any debug endpoints
- [ ] Enable logging and monitoring
- [ ] Set up log aggregation (ELK, Splunk, CloudWatch)

### Frontend Security
- [ ] Build optimized production bundle: `npm run build`
- [ ] Set Content-Security-Policy headers
- [ ] Enable X-Frame-Options: DENY
- [ ] Set X-Content-Type-Options: nosniff
- [ ] Disable source maps in production
- [ ] Configure CSP for API endpoints

### Infrastructure Security
- [ ] Use reverse proxy/load balancer (nginx, HAProxy)
- [ ] Set up DDoS protection (Cloudflare, AWS Shield)
- [ ] Enable Web Application Firewall (WAF)
- [ ] Configure firewall rules (whitelist known IPs)
- [ ] Enable VPC security groups
- [ ] Disable unnecessary ports and services

---

## 📦 Deployment Options

### Option 1: Docker Deployment (Recommended)

```dockerfile
# Dockerfile.backend
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy application
COPY backend/ .

# Create uploads directory
RUN mkdir -p uploads

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

EXPOSE 5000

CMD ["npm", "start"]
```

```dockerfile
# Dockerfile.frontend
FROM node:18-alpine as build

WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

# Serve with nginx
FROM nginx:alpine

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    environment:
      NODE_ENV: production
      MONGODB_URI: mongodb://mongo:27017/pixelforge-prod
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      CORS_ORIGIN: https://yourdomain.com
    depends_on:
      - mongo
    networks:
      - pixelforge

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "443:443"
    networks:
      - pixelforge

  mongo:
    image: mongo:5.0
    volumes:
      - mongo-data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
    networks:
      - pixelforge

volumes:
  mongo-data:

networks:
  pixelforge:
```

```bash
# Deploy with Docker Compose
docker-compose -f docker-compose.yml up -d
```

### Option 2: Cloud Deployment (AWS Example)

#### Using Elastic Beanstalk

```bash
# Install EB CLI
pip install awsebcli

# Initialize EB application
eb init -p node.js-18 pixelforge-nexus

# Create environment
eb create pixelforge-prod

# Deploy
eb deploy

# Monitor
eb status
eb logs
```

#### Using ECS + Fargate

```bash
# Build and push to ECR
aws ecr create-repository --repository-name pixelforge-backend
aws ecr get-login-password | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com
docker tag pixelforge-backend:latest <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/pixelforge-backend:latest
docker push <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/pixelforge-backend:latest

# Create ECS task definition, service, and cluster
# Use CloudFormation or AWS Console
```

### Option 3: Kubernetes Deployment

```yaml
# k8s-backend.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pixelforge-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: pixelforge-backend
  template:
    metadata:
      labels:
        app: pixelforge-backend
    spec:
      containers:
      - name: backend
        image: pixelforge-backend:1.0.0
        ports:
        - containerPort: 5000
        env:
        - name: NODE_ENV
          value: "production"
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: pixelforge-secrets
              key: mongodb-uri
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: pixelforge-secrets
              key: jwt-secret
        - name: JWT_REFRESH_SECRET
          valueFrom:
            secretKeyRef:
              name: pixelforge-secrets
              key: jwt-refresh-secret
        resources:
          requests:
            cpu: "500m"
            memory: "512Mi"
          limits:
            cpu: "1000m"
            memory: "1Gi"
        livenessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 5
          periodSeconds: 10

---
apiVersion: v1
kind: Service
metadata:
  name: pixelforge-backend-service
spec:
  selector:
    app: pixelforge-backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 5000
  type: LoadBalancer
```

```bash
# Deploy to Kubernetes
kubectl apply -f k8s-backend.yaml
kubectl apply -f k8s-frontend.yaml
kubectl apply -f k8s-mongo.yaml

# Monitor
kubectl get pods
kubectl logs -f deployment/pixelforge-backend
```

---

## 🔐 Production Configuration

### Nginx Reverse Proxy Configuration

```nginx
# nginx.conf
upstream backend {
  server backend:5000;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;

server {
  listen 443 ssl http2;
  server_name yourdomain.com;

  # SSL Configuration
  ssl_certificate /etc/ssl/certs/cert.pem;
  ssl_certificate_key /etc/ssl/private/key.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;

  # Security Headers
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
  add_header X-Frame-Options "DENY" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-XSS-Protection "1; mode=block" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;

  # Frontend
  location / {
    root /usr/share/nginx/html;
    try_files $uri /index.html;
    expires 1h;
    add_header Cache-Control "public, immutable";
  }

  # API - with rate limiting
  location /api/ {
    limit_req zone=api_limit burst=20 nodelay;
    proxy_pass http://backend;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
    proxy_connect_timeout 10s;
  }

  # Login endpoint - stricter rate limit
  location /api/auth/login {
    limit_req zone=login_limit burst=5 nodelay;
    proxy_pass http://backend;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

# HTTP to HTTPS redirect
server {
  listen 80;
  server_name yourdomain.com;
  return 301 https://$server_name$request_uri;
}
```

### MongoDB Connection (Production)

```javascript
// Use MongoDB Atlas for managed databases
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/pixelforge-prod?retryWrites=true&w=majority&ssl=true

// Or self-hosted with authentication
MONGODB_URI=mongodb://user:password@mongo-host:27017/pixelforge-prod?authSource=admin
```

---

## 📊 Monitoring & Logging

### Application Metrics to Track

```javascript
// Prometheus metrics example
import promClient from 'prom-client';

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const loginAttempts = new promClient.Counter({
  name: 'login_attempts_total',
  help: 'Total login attempts',
  labelNames: ['status']
});

// Export metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});
```

### Logging Configuration

```bash
# Using ELK Stack
# Elasticsearch - log storage
# Logstash - log processing
# Kibana - log visualization

# Winston configuration for logging
npm install winston winston-elasticsearch

# Send logs to centralized system
const winston = require('winston');
const elasticsearchTransport = require('winston-elasticsearch');

const logger = winston.createLogger({
  transports: [
    new elasticsearchTransport({
      level: 'info',
      clientOpts: { node: 'http://elasticsearch:9200' },
      index: 'pixelforge-logs'
    })
  ]
});
```

### Alerting

```bash
# Setup alerts for:
- Failed login attempts > 20 in 15 min
- 401/403 errors > threshold
- API response time > 5s
- Database connection failures
- Disk space < 10%
- Memory usage > 80%
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: cd backend && npm ci && npm test
      - run: cd frontend && npm ci && npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to AWS
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          # Build and deploy
          npm run build
          aws s3 sync build/ s3://pixelforge-prod/
          # Invalidate CloudFront
          aws cloudfront create-invalidation --distribution-id ${{ secrets.DISTRIBUTION_ID }} --paths "/*"
```

---

## 🛡️ Security Hardening

### Application Security Manager (WAF) Rules

```yaml
rules:
  - rule_name: "Block SQLi"
    patterns: ["'; DROP", "UNION SELECT", "1=1"]
    action: "BLOCK"
  
  - rule_name: "Block XSS"
    patterns: ["<script", "javascript:", "onerror="]
    action: "BLOCK"
  
  - rule_name: "Rate Limit"
    rate: "1000req/min"
    action: "BLOCK"
```

### API Protection

```javascript
// API Key authentication (optional layer)
app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey && apiKey === process.env.API_KEY) {
    next();
  } else {
    res.status(401).json({ message: 'Invalid API key' });
  }
});
```

---

## 📋 Post-Deployment Verification

```bash
# 1. Health check
curl https://yourdomain.com/health

# 2. Verify HTTPS
curl -I https://yourdomain.com

# 3. Check security headers
curl -I https://yourdomain.com
# Should show Strict-Transport-Security, X-Frame-Options, etc.

# 4. Test login
curl -X POST https://yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@example.com","password":"password"}'

# 5. Monitor logs
kubectl logs -f deployment/pixelforge-backend

# 6. Run security scan
npm audit
