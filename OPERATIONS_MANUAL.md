# Operations Manual - PixelForge Nexus Production System

Complete guide for Day-2 operations, maintenance, troubleshooting, and disaster recovery.

## 📋 Table of Contents

1. Daily Operations
2. Maintenance Tasks
3. Monitoring & Alerting
4. Backup & Disaster Recovery
5. Troubleshooting Guide
6. Scaling & Capacity Planning
7. Compliance & Audit

---

## 📅 Daily Operations

### Morning Checklist

```bash
#!/bin/bash
# daily-check.sh

echo "🌅 PixelForge Nexus Daily Operations Checklist"
echo "================================================"

# 1. System Health
echo "1. Checking system health..."
curl -s https://yourdomain.com/health | jq . || echo "❌ Health check failed"

# 2. Database Status
echo "2. Checking database..."
mongosh "mongodb+srv://user:pass@cluster.mongodb.net/pixelforge-prod" \
  --eval "db.adminCommand('ping')" || echo "❌ Database unavailable"

# 3. Redis Cache Status
echo "3. Checking Redis..."
redis-cli ping || echo "❌ Redis unavailable"

# 4. Recent Errors
echo "4. Checking recent errors (last 1 hour)..."
grep "ERROR\|CRITICAL" /var/log/pixelforge/*.log | tail -20

# 5. Failed Login Attempts
echo "5. Checking failed login attempts..."
grep "Failed login" /var/log/pixelforge/auth.log | \
  awk '{print $NF}' | sort | uniq -c | sort -rn | head -10

# 6. Disk Space
echo "6. Checking disk space..."
df -h | tail -3

# 7. Certificate Expiration
echo "7. Checking SSL certificate expiration..."
openssl s_client -connect yourdomain.com:443 -showcerts </dev/null 2>/dev/null | \
  grep "Issuer:\|Not After"

# 8. Database Backups
echo "8. Checking latest backups..."
ls -lh /backups/mongodb/ | tail -5

# 9. API Response Time
echo "9. Measuring API response time..."
time curl -s https://yourdomain.com/api/projects >/dev/null

# 10. Alerts Summary
echo "10. Checking active alerts..."
curl -s http://prometheus:9090/api/v1/alerts | jq '.data.alerts | length'

echo ""
echo "✅ Daily checklist complete!"
```

### Hourly Monitoring

```bash
#!/bin/bash
# hourly-check.sh

# Run every hour via cron
# 0 * * * * /scripts/hourly-check.sh

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Check API availability
curl -f https://yourdomain.com/api/projects -H "Authorization: Bearer TOKEN" \
  >/dev/null 2>&1 || {
    echo "$TIMESTAMP: API DOWN" >> /var/log/alerts.log
    # Send alert
    curl -X POST http://slack-webhook-url \
      -H 'Content-Type: application/json' \
      -d "{\"text\": \"🚨 API DOWN at $TIMESTAMP\"}"
  }

# Check database replication lag
mongosh --eval "rs.status()" | grep "optimeDate" >> /var/log/replication.log

# Record metrics
echo "$TIMESTAMP: $(curl -s https://yourdomain.com/metrics | grep http_requests_total)" \
  >> /var/log/metrics.log
```

### User Management

```bash
# Create new admin user
node backend/scripts/setup.js << EOF
y
admin@company.com
Admin123!@#
John Admin
admin
n
EOF

# Reset user password
mongosh << EOF
use pixelforge-prod
db.users.updateOne(
  { email: "user@example.com" },
  { $set: { accountLocked: false, loginAttempts: 0 } }
)
EOF

# Deactivate user
curl -X PATCH https://yourdomain.com/api/admin/users/userId/deactivate \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json"

# List all active users
mongosh << EOF
use pixelforge-prod
db.users.find({ active: true }, { email: 1, role: 1, lastLogin: 1 })
EOF
```

---

## 🔧 Maintenance Tasks

### Weekly Maintenance

```bash
#!/bin/bash
# weekly-maintenance.sh

echo "🔧 Weekly Maintenance Tasks"
echo "============================"

# 1. Database Optimization
echo "1. Optimizing database..."
mongosh pixelforge-prod << EOF
db.projects.reIndex()
db.users.reIndex()
db.documents.reIndex()
EOF

# 2. Clear old logs
echo "2. Archiving old logs..."
find /var/log/pixelforge -name "*.log" -mtime +30 -exec gzip {} \;

# 3. Update dependencies
echo "3. Checking for security updates..."
cd /app/backend && npm audit --audit-level=moderate
cd /app/frontend && npm audit --audit-level=moderate

# 4. SSL certificate check
echo "4. Checking SSL certificate status..."
openssl s_client -connect yourdomain.com:443 -showcerts </dev/null 2>/dev/null | \
  grep -A2 "Validity"

# 5. Database statistics
echo "5. Collecting database statistics..."
mongosh pixelforge-prod << EOF
db.stats()
EOF

# 6. Disk usage report
echo "6. Disk usage report..."
du -sh /app/* /data/* /backups/* 2>/dev/null | sort -h

echo "✅ Weekly maintenance complete!"
```

### Monthly Maintenance

```bash
#!/bin/bash
# monthly-maintenance.sh

echo "🔧 Monthly Maintenance Tasks"
echo "=============================="

# 1. Full backup verification
echo "1. Verifying backups..."
mongorestore --dryRun --archive=/backups/latest.backup

# 2. Test restore procedure
echo "2. Testing restore on test environment..."
# Restore to staging database
mongorestore --archive=/backups/latest.backup \
  --nsFrom="pixelforge-prod.*" \
  --nsTo="pixelforge-test.*"

# 3. Security audit
echo "3. Running security audit..."
npm audit > /tmp/npm-audit-$(date +%Y-%m-%d).json

# 4. Performance analysis
echo "4. Analyzing performance..."
# Generate performance report
mongosh pixelforge-prod << EOF
db.system.profile.find({ millis: { $gt: 100 } }).limit(10)
EOF

# 5. Update documentation
echo "5. Updating operational documentation..."
# Capture current metrics and versions

# 6. Compliance check
echo "6. Compliance verification..."
# Verify GDPR, security standards compliance

echo "✅ Monthly maintenance complete!"
```

### Security Patching

```bash
#!/bin/bash
# security-patch.sh

echo "🔒 Security Patching Procedure"
echo "================================"

# 1. Check for vulnerabilities
echo "1. Checking for security vulnerabilities..."
npm audit --json > /tmp/npm-audit.json

HIGH_VULNZ=$(jq '.vulnerabilities | length' /tmp/npm-audit.json)

if [ "$HIGH_VULNZ" -gt 0 ]; then
  echo "⚠️  Found $HIGH_VULNZ vulnerabilities"
  
  # 2. Update to staging first
  echo "2. Deploying patches to staging..."
  cd /app/backend && npm update
  cd /app/frontend && npm update
  npm test
  
  # 3. Run security tests
  echo "3. Running security tests..."
  npm run test:security
  
  # 4. Get approval
  echo "4. Waiting for approval..."
  read -p "Approve patches for production? (y/n) " approval
  
  if [ "$approval" == "y" ]; then
    # 5. Deploy to production
    echo "5. Deploying to production..."
    docker-compose build
    docker-compose up -d
    
    # 6. Verify deployment
    echo "6. Verifying deployment..."
    curl -f https://yourdomain.com/health
    
    echo "✅ Patches deployed successfully"
  fi
fi
```

---

## 📊 Monitoring & Alerting

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - localhost:9093

rule_files:
  - '/etc/prometheus/rules/*.yml'

scrape_configs:
  - job_name: 'pixelforge-backend'
    static_configs:
      - targets: ['localhost:5000']
    scrape_interval: 5s
  
  - job_name: 'mongodb'
    static_configs:
      - targets: ['localhost:27017']
  
  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:6379']
```

### Alert Rules

```yaml
# rules.yml
groups:
  - name: pixelforge_alerts
    rules:
      # API unavailable for 5 minutes
      - alert: APIDown
        expr: up{job="pixelforge-backend"} == 0
        for: 5m
        annotations:
          summary: "API is down"
          severity: critical
      
      # High CPU usage
      - alert: HighCPU
        expr: 'node_cpu_usage_percent > 80'
        for: 5m
        annotations:
          summary: "High CPU usage detected"
          severity: warning
      
      # High memory usage
      - alert: HighMemory
        expr: 'node_memory_usage_percent > 85'
        for: 5m
        annotations:
          summary: "High memory usage detected"
          severity: warning
      
      # Database connection pool exhausted
      - alert: DBConnectionPoolFull
        expr: 'mongodb_connections_used >= 50'
        for: 2m
        annotations:
          summary: "Database connection pool exhausted"
          severity: critical
      
      # Large number of failed logins
      - alert: HighFailedLogins
        expr: 'increase(login_attempts_total{status="failed"}[15m]) > 20'
        for: 5m
        annotations:
          summary: "High number of failed login attempts"
          severity: warning
      
      # Slow API response time
      - alert: SlowAPI
        expr: 'histogram_quantile(0.95, request_duration_seconds) > 2'
        for: 10m
        annotations:
          summary: "API response time degraded"
          severity: warning
      
      # SSL certificate expiring
      - alert: CertificateExpiring
        expr: 'ssl_cert_not_after - time() < 7 * 24 * 60 * 60'
        annotations:
          summary: "SSL certificate expiring in 7 days"
          severity: warning
```

### Alertmanager Configuration

```yaml
# alertmanager.yml
global:
  resolve_timeout: 5m
  slack_api_url: 'YOUR_SLACK_WEBHOOK'
  pagerduty_url: 'https://events.pagerduty.com/v2/enqueue'

route:
  receiver: 'default'
  group_by: ['alertname', 'job']
  group_wait: 10s
  repeat_interval: 12h
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty'
      repeat_interval: 15m
    
    - match:
        severity: warning
      receiver: 'slack'
    
    - match:
        alertname: CertificateExpiring
      receiver: 'email'
      repeat_interval: 24h

receivers:
  - name: 'default'
    slack_configs:
      - channel: '#alerts'
  
  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: YOUR_SERVICE_KEY
  
  - name: 'email'
    email_configs:
      - to: 'ops@company.com'
```

---

## 💾 Backup & Disaster Recovery

### Automated Backup Strategy

```bash
#!/bin/bash
# backup-strategy.sh

BACKUP_DIR="/backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🔄 Backup & Recovery Strategy"
echo "=============================="

# 1. Daily Incremental Backup
echo "1. Daily incremental backup..."
mongodump \
  --uri="${MONGODB_URI}" \
  --archive="${BACKUP_DIR}/incremental_${TIMESTAMP}.backup" \
  --gzip

# 2. Weekly Full Backup
if [ $(date +%w) -eq 0 ]; then  # Sunday
  echo "2. Weekly full backup..."
  mongodump \
    --uri="${MONGODB_URI}" \
    --archive="${BACKUP_DIR}/full_weekly_${TIMESTAMP}.backup" \
    --gzip
    
  # Upload to S3
  aws s3 cp "${BACKUP_DIR}/full_weekly_${TIMESTAMP}.backup" \
    "s3://pixelforge-backups/weekly/"
fi

# 3. Monthly Full Backup
if [ $(date +%d) -eq 01 ]; then  # 1st of month
  echo "3. Monthly full backup..."
  mongodump \
    --uri="${MONGODB_URI}" \
    --archive="${BACKUP_DIR}/full_monthly_${TIMESTAMP}.backup" \
    --gzip
    
  # Upload to S3 + Glacier
  aws s3 cp "${BACKUP_DIR}/full_monthly_${TIMESTAMP}.backup" \
    "s3://pixelforge-backups-archive/monthly/"
fi

# 4. Cleanup old backups
echo "4. Cleaning old backups..."
find "${BACKUP_DIR}" -type f -mtime +${RETENTION_DAYS} -delete

# 5. Backup application files
echo "5. Backing up application files..."
tar -czf "${BACKUP_DIR}/app_${TIMESTAMP}.tar.gz" /app/backend /app/frontend

# 6. Verify backup integrity
echo "6. Verifying backup integrity..."
mongorestore --archive="${BACKUP_DIR}/incremental_${TIMESTAMP}.backup" \
  --gzip --dryRun || echo "❌ Backup corrupted!"

echo "✅ Backup complete: ${BACKUP_DIR}/incremental_${TIMESTAMP}.backup"
```

### Disaster Recovery Plan

```bash
#!/bin/bash
# disaster-recovery.sh

echo "🛟 Disaster Recovery Plan"
echo "=========================="

# SCENARIO 1: Database Corruption
echo "SCENARIO 1: Database Corruption Recovery"
echo "=========================================="
echo "1. Identify latest good backup"
LATEST_BACKUP=$(ls -t /backups/*.backup | head -1)
echo "Using backup: $LATEST_BACKUP"

echo "2. Stop application"
docker-compose down

echo "3. Restore from backup"
mongorestore --archive="${LATEST_BACKUP}" \
  --gzip \
  --drop  # Drop existing collections

echo "4. Verify data integrity"
mongosh pixelforge-prod << EOF
db.users.countDocuments()
db.projects.countDocuments()
db.documents.countDocuments()
EOF

echo "5. Restart application"
docker-compose up -d

echo "6. Run smoke tests"
curl -f https://yourdomain.com/health

# SCENARIO 2: Complete Data Loss
echo ""
echo "SCENARIO 2: Complete Data Loss Recovery"
echo "========================================"
echo "1. Restore from AWS S3 backup"
aws s3 cp s3://pixelforge-backups/monthly/latest.backup /backups/

echo "2. Follow SCENARIO 1 recovery steps"
# ... (repeat above steps)

# SCENARIO 3: Server Outage
echo ""
echo "SCENARIO 3: Server Outage Recovery"
echo "==================================="
echo "1. Spin up new server with same specs"
echo "2. Install dependencies and runtime"
echo "3. Restore application from version control"
git clone https://github.com/your-org/pixelforge.git /app

echo "4. Restore database"
# ... (restore from backup)

echo "5. Update DNS to point to new server"
echo "6. Verify all services operational"

echo "✅ Recovery complete!"
```

### Backup Testing Schedule

```
Weekly (Every Sunday):
- 1. Restore incremental backup to test environment
- 2. Run data validation tests
- 3. Verify file integrity
- 4. Clean up test database

Monthly (1st of month):
- 1. Full restore procedure
- 2. Application functionality test
- 3. Performance validation
- 4. Security scan
- 5. Document any issues

Quarterly (Every 3 months):
- 1. Complete disaster recovery simulation
- 2. Team training
- 3. Documentation update
- 4. Post-incident review
```

---

## 🔍 Troubleshooting Guide

### Common Issues

```bash
# ISSUE 1: High API Response Time
echo "Diagnosing: High API Response Time"
# 1. Check database query performance
mongosh pixelforge-prod << EOF
db.system.profile.find({ millis: { $gt: 1000 } }).limit(5)
EOF

# 2. Check Redis cache hit rate
redis-cli info stats | grep keyspace_hits

# 3. Check server CPU/memory
top -b -n 1 | head -10

# 4. Check connection pool utilization
# Look at connection_checkedout vs pool_size in logs

# ISSUE 2: Database Connection Failures
echo "Diagnosing: Database Connection Failures"
# 1. Verify MongoDB is running
mongosh --eval "db.adminCommand('ping')"

# 2. Check connection string
echo $MONGODB_URI

# 3. Check network connectivity
telnet $MONGO_HOST $MONGO_PORT

# 4. Check credentials
mongosh "mongodb+srv://user:pass@cluster.mongodb.net" --eval "db.users.countDocuments()"

# ISSUE 3: Memory Leak
echo "Diagnosing: Memory Leak"
# 1. Check memory growth over time
free -h

# 2. Check node process memory
ps aux | grep node

# 3. Generate heap dump
kill -USR2 $(pgrep -f 'node.*server.js')

# 4. Analyze with clinic.js
npx clinic doctor -- npm start

# ISSUE 4: High Failed Login Count
echo "Diagnosing: High Failed Login Count"
# 1. Check logs
tail -100 /var/log/pixelforge/auth.log | grep "Failed login"

# 2. Identify attacker IPs
grep "Failed login" /var/log/pixelforge/auth.log | \
  awk '{print $(NF-2)}' | sort | uniq -c | sort -rn

# 3. Block suspicious IPs via firewall
# iptables -A INPUT -s ATTACKER_IP -j DROP

# 4. Reset locked accounts
mongosh pixelforge-prod << EOF
db.users.updateMany(
  { loginAttempts: { $gte: 5 } },
  { $set: { loginAttempts: 0, lockUntil: null } }
)
EOF

# ISSUE 5: Disk Space Running Out
echo "Diagnosing: Low Disk Space"
# 1. Check current usage
df -h /

# 2. Find largest directories
du -sh /* | sort -rh | head -10

# 3. Clean up old logs
find /var/log -mtime +30 -delete

# 4. Clean up uploads
find /app/backend/uploads -mtime +90 -delete

# 5. Extend disk volume (if using cloud)
# aws ec2 modify-volume --size 100 --volume-id vol-xxxxx
```

---

## 📈 Scaling & Capacity Planning

### Current Capacity Limits

```
Baseline (Single Server):
- Users: 100 concurrent
- Requests/sec: 100
- Database size: 10GB
- Storage: 100GB

Scaled (3x Backend + 3x Replicas):
- Users: 10,000 concurrent
- Requests/sec: 10,000+
- Database size: 100GB+
- Storage: 1TB+

Scaling Triggers:
- When CPU usage consistently > 70%
- When memory usage consistently > 80%
- When API response time p95 > 1s
- When database connections > 40/50
```

### Scaling Procedure

```bash
#!/bin/bash
# scale-up.sh

echo "⬆️  Horizontal Scaling Procedure"
echo "================================"

# 1. Provision new servers
echo "1. Provisioning new backend servers..."
for i in {2..3}; do
  aws ec2 run-instances \
    --image-id ami-xxxxx \
    --instance-type t3.large \
    --key-name pixelforge-key \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=pixelforge-backend-$i}]"
done

# 2. Configure new servers
echo "2. Configuring new servers..."
# Install dependencies, clone repo, start services

# 3. Add to load balancer
echo "3. Adding new servers to load balancer..."
aws elbv2 register-targets \
  --target-group-arn arn:aws:elasticloadbalancing:... \
  --targets Id=i-xxxxx Id=i-xxxxx

# 4. Health check
echo "4. Performing health checks..."
# Wait for instances to pass health checks

# 5. Database scaling
echo "5. Adding MongoDB replica..."
mongosh admin << EOF
rs.add("new-mongo-host:27017", { priority: 0 })
EOF

# 6. Update frontend CDN
echo "6. Updating CDN..."
aws cloudfront create-invalidation --distribution-id ... --paths "/*"

echo "✅ Scaling complete!"
```

---

## ✅ Compliance & Audit

### Compliance Checklist

```
GDPR Compliance:
- [ ] Right to access: Users can download their data
- [ ] Right to deletion: Users can request account deletion
- [ ] Data retention: Old data deleted per policy
- [ ] Breach notification: Procedure documented
- [ ] Privacy policy: Published and current
- [ ] Consent: Collected before data processing
- [ ] DPA: Signed with data processor (hosting provider)

HIPAA Compliance (if applicable):
- [ ] Encryption in transit: TLS 1.2+
- [ ] Encryption at rest: Database encrypted
- [ ] Access control: RBAC implemented
- [ ] Audit logging: Complete trail maintained
- [ ] BAA: Signed with all vendors

SOC 2 Compliance:
- [ ] CC6.1: Access controls
- [ ] CC6.2: Change management
- [ ] CC7.1: Monitoring
- [ ] CC7.2: Monitoring effectiveness
- [ ] CC8.1: Incident response
- [ ] CC9.1: Security testing

ISO 27001 Compliance:
- [ ] A.9: Access control
- [ ] A.10: Cryptography
- [ ] A.12: Communications security
- [ ] A.13: Systems acquisition
- [ ] A.14: Development controls

PCI DSS (if handling payment):
- [ ] Data security: Encryption
- [ ] Access control: RBAC
- [ ] Log monitoring: 90-day retention
- [ ] Vulnerability scanning: Quarterly
- [ ] Network security: Firewall configured
```

### Audit Logging

```javascript
// backend/utils/auditLog.js

class AuditLogger {
  static async logAction(req, action, resource, details) {
    const auditEntry = {
      timestamp: new Date(),
      userId: req.user._id,
      username: req.user.email,
      action,            // 'CREATE', 'UPDATE', 'DELETE', 'ACCESS'
      resource,          // 'Project', 'Document', 'User'
      resourceId: resource._id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details,
      status: 'success'
    };
    
    await AuditLog.create(auditEntry);
  }
  
  static async logError(req, action, resource, error) {
    const auditEntry = {
      timestamp: new Date(),
      userId: req.user?._id,
      action,
      resource,
      ipAddress: req.ip,
      error: error.message,
      status: 'failed'
    };
    
    await AuditLog.create(auditEntry);
  }
}

// Usage
app.post('/api/projects/:id', async (req, res) => {
  try {
    const project = await Project.findByIdAndUpdate(req.params.id, req.body);
    
    await AuditLogger.logAction(req, 'UPDATE', project, {
      changes: req.body
    });
    
    res.json(project);
  } catch (error) {
    await AuditLogger.logError(req, 'UPDATE', { _id: req.params.id }, error);
    res.status(500).json({ message: 'Error updating project' });
  }
});

// Export audit logs for compliance
app.get('/api/admin/audit-logs', authorize('admin'), async (req, res) => {
  const logs = await AuditLog.find()
    .sort({ timestamp: -1 })
    .limit(10000);
  
  res.csv(logs);
});
```

### Regular Audit Schedule

```yaml
Daily:
- 1. Review failed login attempts
- 2. Check unauthorized access attempts
- 3. Verify no data exfiltration

Weekly:
- 1. Review API access patterns
- 2. Check for policy violations
- 3. Verify backup completion

Monthly:
- 1. Audit all admin actions
- 2. Review user role assignments
- 3. Verify data access logs

Quarterly:
- 1. Full security audit
- 2. Penetration test
- 3. Compliance review
- 4. Update threat model

Annually:
- 1. Complete security assessment
- 2. 3rd-party audit (SOC 2, ISO 27001)
- 3. Disaster recovery test
- 4. Policy review
```

---

## 🎯 KPIs & Metrics

```
Critical Metrics:
- API Availability: > 99.9%
- MTBF (Mean Time Between Failures): > 720 hours
- MTTR (Mean Time To Recovery): < 15 minutes
- Data Loss RPO (Recovery Point): 1 hour max
- RTO (Recovery Time): 4 hours max

Performance Metrics:
- API Response Time p95: < 500ms
- Database Query p95: < 100ms
- Page Load Time: < 2s
- Throughput: > 1,000 req/sec

Security Metrics:
- Time to patch: < 7 days for critical
- Penetration test pass rate: 100%
- Audit findings: 0 critical/high
- Failed login rate: < 0.1%

Users & Adoption:
- Monthly Active Users (MAU)
- Daily Active Users (DAU)
- Feature adoption rate
- User satisfaction score (NPS)
```

---

## 📞 Escalation Path

```
Severity | Time to Respond | Action
---------|-----------------|-------
Critical | 15 minutes      | Page on-call immediately
High     | 1 hour          | Email + Slack alert
Medium   | 4 hours         | Slack channel
Low      | 24 hours        | Ticket in system

On-Call Rotation:
- Primary: Available 24/7
- Secondary: Backup after 30 min
- Manager: Alerts after 1 hour

Contact Information:
- On-Call: [phone/email]
- Manager: [phone/email]
- Security: [phone/email]
- Incident Commander: [phone/email]
```

---

## 📖 Documentation

Keep updated:
- Runbooks for common procedures
- Architecture diagrams
- Network topology
- Recovery procedures
- Contact lists
- Vendor information
- Licenses and support contracts

Store in:
- GitHub Wiki (version controlled)
- Confluence (searchable)
- Shared drive (backed up)
- Physical copy (secure location)

