# SPHAiRPlatform Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying SPHAiRPlatform as a subscription-based service, including secure update mechanisms and CI/CD pipelines.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Deployment Architecture](#deployment-architecture)
3. [Initial Setup](#initial-setup)
4. [Docker Deployment](#docker-deployment)
5. [Update Mechanism](#update-mechanism)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Security Best Practices](#security-best-practices)
8. [Monitoring and Maintenance](#monitoring-and-maintenance)

## Prerequisites

### Server Requirements

- **OS**: Ubuntu 20.04+ or similar Linux distribution
- **CPU**: 2+ cores recommended
- **RAM**: 4GB+ recommended
- **Disk**: 50GB+ SSD recommended
- **Network**: Stable internet connection

### Software Requirements

- Docker 20.10+
- Docker Compose 2.0+
- Git
- Node.js 18+ (for local development)
- PostgreSQL 15+ (if not using Docker)
- Redis 7+ (if not using Docker)

### Environment Variables

Create a `.env` file with the following variables:

```env
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=solar_om_db
DB_USER=postgres
DB_PASSWORD=your_secure_password_here

# Redis
REDIS_ENABLED=true
REDIS_URL=redis://redis:6379

# Security
SESSION_SECRET=your_random_secret_here_min_32_chars
JWT_SECRET=your_random_secret_here_min_32_chars

# Platform Update Service (IMPORTANT: Change these!)
PLATFORM_SERVICE_TOKEN=your_secure_service_token_here_min_32_chars
PLATFORM_UPDATE_IPS=your.ip.address.here,another.ip.if.needed
PLATFORM_UPDATE_SERVER_URL=https://your-update-server.com

# Optional: Update Signature Verification
PLATFORM_UPDATE_PUBLIC_KEY=your_public_key_here_for_signed_updates

# Application
NODE_ENV=production
PORT=3001
```

**Security Note**: 
- Generate strong, random secrets using: `openssl rand -base64 32`
- Store `PLATFORM_SERVICE_TOKEN` securely - this is your "key" for remote updates
- Limit `PLATFORM_UPDATE_IPS` to your administrative IP addresses only

## Deployment Architecture

See [DEPLOYMENT_ARCHITECTURE.md](./DEPLOYMENT_ARCHITECTURE.md) for detailed architecture diagrams and models.

## Initial Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd ChecksheetsApp
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
nano .env
```

### 3. Generate Secrets

```bash
# Generate session secret
echo "SESSION_SECRET=$(openssl rand -base64 32)" >> .env

# Generate JWT secret
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env

# Generate platform service token
echo "PLATFORM_SERVICE_TOKEN=$(openssl rand -base64 32)" >> .env
```

### 4. Set Up Update Service Authentication

**IMPORTANT**: The `PLATFORM_SERVICE_TOKEN` is your secure authentication for remote updates. 

- Store this token securely (use a password manager)
- Never commit this token to version control
- Rotate this token regularly
- Use different tokens for different environments (staging/production)

### 5. Build and Start Services

```bash
# Build Docker images
docker-compose build

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f app
```

### 6. Initialize Database

```bash
# Run database setup
docker-compose exec app npm run setup-db
```

### 7. Verify Deployment

```bash
# Check health
curl http://localhost:3001/api/platform/health

# Check version
curl http://localhost:3001/api/platform/version
```

## Docker Deployment

### Using Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f app

# Restart services
docker-compose restart app
```

### Using Docker Directly

```bash
# Build image
docker build -t sphairplatform:latest .

# Run container
docker run -d \
  --name sphairplatform-app \
  -p 3001:3001 \
  -e DB_HOST=your_db_host \
  -e DB_PASSWORD=your_password \
  -e PLATFORM_SERVICE_TOKEN=your_token \
  sphairplatform:latest
```

## Update Mechanism

### Overview

SPHAiRPlatform uses a **secure, authenticated update service** - NOT a traditional backdoor. All updates require:
1. Valid service token authentication
2. Optional IP whitelisting
3. Audit logging of all update operations
4. Rollback capability

### Security Model

**No Backdoors**: All access requires proper authentication via `PLATFORM_SERVICE_TOKEN`.

**Service Account Pattern**: Use dedicated service accounts (tokens) for update operations, not user accounts.

**Audit Trail**: All update operations are logged to `platform_updates` table.

**Version Control**: All deployments are versioned and can be rolled back.

### Remote Update Process

#### 1. Check for Updates

```bash
curl -X GET http://your-server:3001/api/platform/updates/check
```

#### 2. Apply Update (Requires Authentication)

```bash
curl -X POST http://your-server:3001/api/platform/updates/apply \
  -H "Content-Type: application/json" \
  -H "X-Platform-Service-Token: your_platform_service_token" \
  -d '{
    "version": "1.1.0",
    "updateType": "minor"
  }'
```

#### 3. Check Update Status

```bash
curl -X GET http://your-server:3001/api/platform/updates/status/update-1234567890 \
  -H "X-Platform-Service-Token: your_platform_service_token"
```

#### 4. View Update History

```bash
curl -X GET http://your-server:3001/api/platform/updates/history \
  -H "X-Platform-Service-Token: your_platform_service_token"
```

#### 5. Rollback if Needed

```bash
curl -X POST http://your-server:3001/api/platform/updates/rollback \
  -H "Content-Type: application/json" \
  -H "X-Platform-Service-Token: your_platform_service_token"
```

### Update Script (Client-Side)

Create a secure update script for your local machine:

```bash
#!/bin/bash
# update-deployment.sh

SERVER_URL=$1
SERVICE_TOKEN=$2
VERSION=$3

if [ -z "$SERVER_URL" ] || [ -z "$SERVICE_TOKEN" ] || [ -z "$VERSION" ]; then
  echo "Usage: ./update-deployment.sh <server-url> <service-token> <version>"
  exit 1
fi

echo "Applying update to $SERVER_URL..."

RESPONSE=$(curl -s -X POST "$SERVER_URL/api/platform/updates/apply" \
  -H "Content-Type: application/json" \
  -H "X-Platform-Service-Token: $SERVICE_TOKEN" \
  -d "{\"version\": \"$VERSION\", \"updateType\": \"patch\"}")

echo "$RESPONSE" | jq '.'

UPDATE_ID=$(echo "$RESPONSE" | jq -r '.updateId')

if [ "$UPDATE_ID" != "null" ]; then
  echo "Update ID: $UPDATE_ID"
  echo "Monitoring update status..."
  
  # Poll for status
  while true; do
    STATUS=$(curl -s -X GET "$SERVER_URL/api/platform/updates/status/$UPDATE_ID" \
      -H "X-Platform-Service-Token: $SERVICE_TOKEN" | jq -r '.status')
    
    echo "Status: $STATUS"
    
    if [ "$STATUS" == "completed" ] || [ "$STATUS" == "failed" ]; then
      break
    fi
    
    sleep 5
  done
fi
```

**Usage:**
```bash
chmod +x update-deployment.sh
./update-deployment.sh https://client-server.com your_service_token 1.1.0
```

## CI/CD Pipeline

### GitHub Actions Workflow

The repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that:

1. **Builds** the application on push to main branch
2. **Tests** the application
3. **Deploys** to staging automatically
4. **Deploys** to production on tagged releases

### Setting Up CI/CD

1. **Create GitHub Actions Secrets**:
   - `DEPLOYMENT_SERVER`: Your deployment server address
   - `DEPLOYMENT_TOKEN`: SSH key or deployment token
   - `PLATFORM_SERVICE_TOKEN`: Service token for updates

2. **Configure Workflow**:
   - Edit `.github/workflows/deploy.yml`
   - Update deployment steps for your infrastructure

3. **Trigger Deployments**:
   - Push to `main` → Deploys to staging
   - Tag release (`v1.1.0`) → Deploys to production

### Manual Deployment

```bash
# Build and deploy
./scripts/deploy.sh production v1.1.0
```

## Security Best Practices

### 1. Service Token Security

- **Never commit tokens to version control**
- **Use different tokens per environment**
- **Rotate tokens regularly** (quarterly recommended)
- **Store tokens in secure vault** (password manager, secrets manager)
- **Limit token access** (IP whitelisting)

### 2. Network Security

- **Use HTTPS** for all deployments
- **Implement firewall rules** (only allow necessary ports)
- **Use VPN** for administrative access
- **Enable IP whitelisting** for update endpoints

### 3. Database Security

- **Use strong passwords**
- **Enable SSL/TLS** for database connections
- **Regular backups** (daily recommended)
- **Limit database access** (network restrictions)

### 4. Update Security

- **Sign updates** cryptographically (optional but recommended)
- **Test updates in staging** before production
- **Always backup** before updates
- **Monitor after updates**
- **Have rollback plan** ready

### 5. Monitoring

- **Set up health checks**
- **Monitor error rates**
- **Track resource usage**
- **Alert on failures**

## Monitoring and Maintenance

### Health Monitoring

```bash
# Health check endpoint
curl http://your-server:3001/api/platform/health
```

### Log Monitoring

```bash
# View application logs
docker-compose logs -f app

# View specific log files
tail -f server/logs/app.log
tail -f server/logs/update-*.log
```

### Backup Management

```bash
# Manual database backup
docker-compose exec postgres pg_dump -U postgres solar_om_db > backup.sql

# Restore from backup
docker-compose exec -T postgres psql -U postgres solar_om_db < backup.sql
```

### Update Management

- **Schedule regular updates** (monthly recommended)
- **Test in staging first**
- **Notify clients** before major updates
- **Maintain version history**
- **Document all changes**

## Multi-Client Deployment

### Tenant Isolation

For multiple clients on shared infrastructure:

1. **Separate Databases**: Each client has their own database
2. **Shared Application**: Single application instance
3. **Tenant Routing**: Route requests based on subdomain or path

### Configuration Management

```env
# Client 1
DB_NAME=client1_db
COMPANY_NAME=Client 1 Name

# Client 2
DB_NAME=client2_db
COMPANY_NAME=Client 2 Name
```

## Troubleshooting

### Update Fails

1. Check update logs: `tail -f server/logs/update-*.log`
2. Check application logs: `docker-compose logs app`
3. Verify service token
4. Check IP whitelist
5. Verify database connectivity

### Rollback Required

1. Get last successful update: `/api/platform/updates/history`
2. Execute rollback: `/api/platform/updates/rollback`
3. Verify application health
4. Investigate failure cause

### Service Won't Start

1. Check logs: `docker-compose logs app`
2. Verify environment variables
3. Check database connection
4. Verify port availability
5. Check disk space

## Support and Maintenance

### Update Schedule

- **Security patches**: Apply immediately
- **Minor updates**: Monthly
- **Major updates**: Quarterly (with client notification)

### Client Communication

- Notify clients before major updates
- Provide update notes
- Schedule maintenance windows
- Document all changes

## Additional Resources

- [Deployment Architecture](./DEPLOYMENT_ARCHITECTURE.md)
- [Security Implementation](./server/SECURITY_IMPLEMENTATION.md)
- [API Documentation](./server/API_DOCUMENTATION.md)
