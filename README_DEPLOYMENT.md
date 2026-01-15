# SPHAiRPlatform - Quick Deployment Reference

## Quick Start

### 1. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Generate secure tokens
echo "SESSION_SECRET=$(openssl rand -base64 32)" >> .env
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
echo "PLATFORM_SERVICE_TOKEN=$(openssl rand -base64 32)" >> .env
```

### 2. Deploy with Docker

```bash
# Build and start
docker-compose up -d

# Initialize database
docker-compose exec app npm run setup-db

# Check health
curl http://localhost:3001/api/platform/health
```

### 3. Secure Update Service

The platform includes a **secure update mechanism** (not a backdoor) that requires:

- **Service Token**: Set `PLATFORM_SERVICE_TOKEN` in `.env`
- **IP Whitelisting** (optional): Set `PLATFORM_UPDATE_IPS` in `.env`
- **Authentication**: All update requests must include service token header

**Update Example:**
```bash
curl -X POST http://your-server:3001/api/platform/updates/apply \
  -H "X-Platform-Service-Token: your_service_token" \
  -H "Content-Type: application/json" \
  -d '{"version": "1.1.0", "updateType": "minor"}'
```

## Key Features

✅ **Secure Updates**: Authenticated update service with audit logging  
✅ **No Backdoors**: All access requires proper authentication  
✅ **Rollback Capability**: Safe rollback to previous versions  
✅ **Multi-Client Support**: Shared or dedicated infrastructure  
✅ **Health Monitoring**: Built-in health checks  
✅ **CI/CD Ready**: GitHub Actions workflow included  

## Documentation

- **[Deployment Guide](./DEPLOYMENT_GUIDE.md)** - Complete deployment instructions
- **[Deployment Architecture](./DEPLOYMENT_ARCHITECTURE.md)** - Architecture details
- **[Security Implementation](./server/SECURITY_IMPLEMENTATION.md)** - Security measures

## Important Security Notes

⚠️ **Never commit service tokens to version control**  
⚠️ **Use different tokens for each environment**  
⚠️ **Rotate tokens regularly**  
⚠️ **Limit update IPs to your administrative IPs only**  

## Support

For detailed deployment instructions, troubleshooting, and best practices, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).
