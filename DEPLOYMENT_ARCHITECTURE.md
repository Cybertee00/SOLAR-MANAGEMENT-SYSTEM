# SPHAiRPlatform Deployment Architecture

## Overview

This document outlines the deployment architecture, CI/CD pipelines, and secure update mechanisms for SPHAiRPlatform as a subscription-based service. The architecture is designed to support multiple client deployments while maintaining security, scalability, and ease of maintenance.

## Deployment Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SPHAiRPlatform Deployment                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │     Load Balancer / Reverse Proxy       │
        │         (Nginx / Cloudflare)            │
        └─────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   App Server │    │   App Server │    │   App Server │
│   (Node.js)  │    │   (Node.js)  │    │   (Node.js)  │
└──────────────┘    └──────────────┘    └──────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
        ┌─────────────────────────────────────────┐
        │         Redis Cluster (Sessions)        │
        └─────────────────────────────────────────┘
                              │
        ┌─────────────────────────────────────────┐
        │     PostgreSQL (Primary + Replica)      │
        └─────────────────────────────────────────┘
```

### Multi-Tenant Architecture

For subscription-based deployments, each client can have:
- **Shared Infrastructure**: Same server, different databases
- **Dedicated Infrastructure**: Separate servers per client
- **Hybrid**: Shared infrastructure with data isolation

## Deployment Models

### Model 1: Shared Infrastructure (Recommended for Small-Medium Clients)

- **Database**: Separate database per client (`client1_db`, `client2_db`, etc.)
- **Application**: Single application instance with tenant routing
- **Resources**: Shared compute, Redis, and storage
- **Isolation**: Database-level isolation

**Pros:**
- Cost-effective
- Easier to manage updates
- Centralized monitoring

**Cons:**
- Potential resource contention
- Single point of failure (mitigated with load balancing)

### Model 2: Dedicated Infrastructure (Recommended for Large Clients)

- **Database**: Dedicated database server
- **Application**: Dedicated application servers
- **Resources**: Isolated compute and storage
- **Isolation**: Complete infrastructure isolation

**Pros:**
- Maximum security and performance
- Client-specific scaling
- Complete isolation

**Cons:**
- Higher cost
- More complex update process

### Model 3: Hybrid (Recommended for Mixed Client Base)

- **Database**: Separate database per client (shared or dedicated)
- **Application**: Multiple instances, grouped by client size
- **Resources**: Tiered resource allocation
- **Isolation**: Based on client tier

## Secure Update Mechanism

### Overview

Instead of traditional "backdoors", SPHAiRPlatform uses a **secure, authenticated update service** that:
- Requires proper authentication and authorization
- Logs all update activities for audit
- Uses signed updates with version control
- Supports rollback capabilities
- Only accessible to authorized platform administrators

### Update Authentication

The update mechanism uses:
1. **Service Account Authentication**: Dedicated service accounts with limited permissions
2. **JWT Tokens**: Time-limited tokens for update operations
3. **IP Whitelisting**: Only specific IPs can initiate updates (optional)
4. **Update Signatures**: All updates are cryptographically signed

### Update Workflow

```
┌─────────────────┐
│  Update Request │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  Authentication Check   │
│  - Service Account       │
│  - JWT Token            │
│  - IP Whitelist (opt)   │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Authorization Check    │
│  - Update Permission    │
│  - Environment Access   │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Update Validation      │
│  - Version Check        │
│  - Signature Verify     │
│  - Compatibility Check  │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Backup Current Version │
│  - Database Backup      │
│  - Code Backup          │
│  - Config Backup        │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Apply Update           │
│  - Stop Services        │
│  - Deploy New Code      │
│  - Run Migrations       │
│  - Start Services       │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Verify Update          │
│  - Health Check         │
│  - Smoke Tests          │
│  - Rollback if Failed   │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Log Update Activity    │
│  - Update Log           │
│  - Audit Trail          │
└─────────────────────────┘
```

## CI/CD Pipeline

### Pipeline Stages

1. **Source Control** (Git)
   - Push to main branch triggers pipeline
   - Tag releases for version control

2. **Build Stage**
   - Build frontend (React)
   - Build backend Docker image
   - Run unit tests
   - Code quality checks

3. **Test Stage**
   - Integration tests
   - Database migration tests
   - Security scans

4. **Package Stage**
   - Create versioned release package
   - Sign release with GPG
   - Generate release notes

5. **Deploy Stage** (Manual or Automatic)
   - Deploy to staging environment
   - Run smoke tests
   - Deploy to production (after approval)

### Pipeline Configuration

See `.github/workflows/deploy.yml` for GitHub Actions configuration.

## Update Service API

### Endpoints

All update endpoints require authentication via service account:

- `POST /api/platform/updates/check` - Check for available updates
- `POST /api/platform/updates/apply` - Apply an update
- `GET /api/platform/updates/status` - Get update status
- `POST /api/platform/updates/rollback` - Rollback to previous version
- `GET /api/platform/updates/history` - Get update history

### Security Requirements

- Service account authentication required
- Update operations logged to audit trail
- All updates require confirmation
- Rollback capability available

## Database Migration Strategy

### Safe Migration Process

1. **Pre-Migration Checks**
   - Backup database
   - Verify current version
   - Check compatibility

2. **Migration Execution**
   - Run migrations in transaction
   - Verify migration success
   - Update version tracking

3. **Post-Migration Verification**
   - Verify data integrity
   - Run smoke tests
   - Check application health

4. **Rollback Plan**
   - Maintain previous database backup
   - Keep previous code version
   - Document rollback steps

## Monitoring and Logging

### Monitoring

- Application health checks
- Database connection monitoring
- Redis connection monitoring
- Resource usage (CPU, Memory, Disk)
- Request rate and error rates

### Logging

- Application logs (structured logging)
- Update operation logs (audit trail)
- Access logs
- Error logs with stack traces

## Security Considerations

### Update Security

1. **No Traditional Backdoors**: All access requires proper authentication
2. **Service Accounts**: Dedicated accounts for update operations
3. **Audit Trail**: All update operations are logged
4. **Version Control**: All deployments are versioned and signed
5. **Rollback Capability**: Failed updates can be rolled back
6. **IP Whitelisting**: Option to restrict update access by IP

### Data Security

1. **Encryption at Rest**: Database encryption
2. **Encryption in Transit**: HTTPS/TLS for all connections
3. **Access Control**: Role-based access control (RBAC)
4. **Audit Logs**: All data access is logged

## Disaster Recovery

### Backup Strategy

- **Database**: Automated daily backups with retention policy
- **Code**: Version control (Git) with tagged releases
- **Configuration**: Version-controlled configuration files
- **User Data**: Regular backups of uploads and reports

### Recovery Process

1. Identify failure point
2. Restore from backup
3. Verify data integrity
4. Resume normal operations
5. Document incident

## Scaling Considerations

### Horizontal Scaling

- Multiple application servers behind load balancer
- Shared Redis cluster for session management
- Database replication (read replicas)

### Vertical Scaling

- Increase server resources (CPU, RAM)
- Optimize database queries
- Implement caching strategies

## Deployment Checklist

### Pre-Deployment

- [ ] Review and test all changes
- [ ] Update version number
- [ ] Create release notes
- [ ] Backup current deployment
- [ ] Notify stakeholders

### Deployment

- [ ] Verify authentication
- [ ] Apply update
- [ ] Run database migrations
- [ ] Verify deployment success
- [ ] Run smoke tests

### Post-Deployment

- [ ] Monitor application health
- [ ] Verify all services running
- [ ] Check error logs
- [ ] Update documentation
- [ ] Notify stakeholders of completion

## Best Practices

1. **Always backup before updates**
2. **Test updates in staging first**
3. **Use version control for all changes**
4. **Document all updates**
5. **Monitor after deployment**
6. **Have rollback plan ready**
7. **Use automated testing**
8. **Maintain audit logs**
