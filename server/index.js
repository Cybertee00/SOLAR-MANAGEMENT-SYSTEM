require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const { Pool } = require('pg');

// Security middleware
const { securityHeaders, sanitizeRequestBody, limitRequestSize, validateUUIDParams } = require('./middleware/security');
const { standardLimiter, authLimiter, sensitiveOperationLimiter, speedLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3001;

// Create uploads directory FIRST
const fs = require('fs');
const path = require('path');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory');
}

// ============================================================================
// CRITICAL: Image serving route MUST be FIRST, before ALL middleware
// This prevents any middleware from interfering with CORS/CORP headers
// ============================================================================

// Removed debug logging - images confirmed working in Chrome

app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);
  
  console.log(`[UPLOADS] Request for: ${filename}`);
  
  // Security check: prevent directory traversal
  const resolvedPath = path.resolve(filePath);
  const uploadsDir = path.resolve(__dirname, 'uploads');
  if (!resolvedPath.startsWith(uploadsDir)) {
    console.error('[UPLOADS] Directory traversal blocked');
    return res.status(403).send('Forbidden');
  }
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error('[UPLOADS] File not found:', filePath);
    return res.status(404).send('Not found');
  }
  
  // Determine content type
  const ext = path.extname(filename).toLowerCase();
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };
  const contentType = contentTypes[ext] || 'application/octet-stream';
  
  // Read and send file with explicit headers
  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error('[UPLOADS] Read error:', err);
      return res.status(500).send('Error');
    }
    
    // Use writeHead to set ALL headers atomically
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': data.length,
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cache-Control': 'public, max-age=31536000'
    });
    
    console.log(`[UPLOADS] ✅ Headers set via writeHead`);
    console.log(`[UPLOADS] ✅ Sending ${data.length} bytes`);
    console.log(`========================================\n`);
    res.end(data, 'binary');
  });
});

// Security headers (Helmet.js) - After static files, before API routes
// Exclude /uploads from Helmet to prevent interference with image serving
app.use((req, res, next) => {
  if (req.path.startsWith('/uploads')) {
    return next(); // Skip Helmet for static files
  }
  securityHeaders(req, res, next);
});

// Trust proxy for accurate IP addresses (important for rate limiting)
// Set this if behind a reverse proxy (nginx, load balancer, etc.)
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// CORS configuration
// In production, set CORS_ORIGIN to specific allowed origins
const corsOrigin = process.env.CORS_ORIGIN || 'true'; // Allow all in dev, specific origins in prod
let corsOriginConfig;
if (corsOrigin === 'true' || corsOrigin === true) {
  corsOriginConfig = true; // Allow all origins
} else if (typeof corsOrigin === 'string') {
  corsOriginConfig = corsOrigin.split(',').map(origin => origin.trim());
} else {
  corsOriginConfig = true; // Default to allow all
}

// Apply CORS to all routes EXCEPT /uploads (static files have their own CORS handling)
app.use((req, res, next) => {
  // Skip CORS for static files - they have their own middleware
  if (req.path.startsWith('/uploads')) {
    return next();
  }
  // Apply CORS to all other routes
  cors({
    origin: corsOriginConfig,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400 // 24 hours
  })(req, res, next);
});

// Request size limits (prevent DoS via large payloads)
// Default: 10MB for JSON, 50MB for file uploads
const jsonLimit = process.env.API_JSON_LIMIT || '10mb';
app.use(bodyParser.json({ limit: jsonLimit }));
app.use(bodyParser.urlencoded({ extended: true, limit: jsonLimit }));
app.use(limitRequestSize(jsonLimit));

// Sanitize request body (remove dangerous characters)
app.use(sanitizeRequestBody);

// Validate UUID parameters (secondary SQL injection defense)
// Only apply to routes that actually have UUID parameters
// NOTE: Do NOT apply to /api/upload/:filename (uses filenames, not UUIDs)
// NOTE: Do NOT apply to /api/inventory/:id (inventory routes don't use UUID paths, except slips)
// Apply to specific patterns that use UUIDs:
app.use('/api/users/:id', validateUUIDParams);
app.use('/api/tasks/:id', validateUUIDParams);
app.use('/api/assets/:id', validateUUIDParams);
app.use('/api/checklist-templates/:id', validateUUIDParams);
app.use('/api/checklist-responses/:id', validateUUIDParams);
app.use('/api/cm-letters/:id', validateUUIDParams);
app.use('/api/api-tokens/:id', validateUUIDParams);
app.use('/api/webhooks/:id', validateUUIDParams);
app.use('/api/inventory/slips/:id', validateUUIDParams); // Only slips use UUIDs
// Also apply to nested routes like /api/tasks/:id/start
app.use('/api/tasks/:id/:action', validateUUIDParams);
app.use('/api/cm-letters/:id/:action', validateUUIDParams);
app.use('/api/api-tokens/:id/:action', validateUUIDParams);
app.use('/api/webhooks/:id/:action', validateUUIDParams);
app.use('/api/users/:id/:action', validateUUIDParams);

// Session configuration with secure defaults
// CRITICAL: SESSION_SECRET must be set in production environment
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV === 'production') {
  console.error('ERROR: SESSION_SECRET environment variable is required in production!');
  process.exit(1);
}

app.use(session({
  secret: sessionSecret || 'CHANGE-THIS-SECRET-IN-PRODUCTION-USE-RANDOM-STRING',
  resave: false, // Don't save session if unmodified
  saveUninitialized: false, // Don't create session until something is stored
  name: 'sessionId', // Don't use default 'connect.sid' for security
  cookie: {
    secure: process.env.NODE_ENV === 'production' && process.env.HTTPS_ENABLED === 'true', // HTTPS only in production
    httpOnly: true, // Prevent XSS attacks
    sameSite: 'strict', // CSRF protection
    maxAge: parseInt(process.env.SESSION_MAX_AGE_MS || '86400000', 10) // 24 hours default
  },
  // Use secure session store in production (Redis recommended)
  // For now using memory store (not suitable for production with multiple servers)
  // Important: session is saved automatically when response is sent if session was modified
}));

// Uploads directory and static file serving moved to the top (before security headers)
// fs and path are already declared at the top of the file

// Serve uploaded images - MUST be AFTER CORS but BEFORE rate limiting and routes
// Static files should be accessible without authentication or rate limiting
// This allows images to be served directly via /uploads/filename
// Use a custom middleware to ensure CORS headers are set correctly
app.use('/uploads', (req, res, next) => {
  // Set CORS headers before serving the file
  // For static files (images), we allow all origins since they're public resources
  // Images loaded via <img> tags may not send Origin headers, so we use *
  const origin = req.headers.origin;
  
  // Always allow all origins for static files (no credentials needed)
  // This works for both XHR/fetch requests (with Origin) and <img> tags (without Origin)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
  
  // Handle OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
}, express.static(path.join(__dirname, 'uploads')));

// Global rate limiting (applies to all routes)
// Speed limiter: adds delay after many requests (prevents rapid-fire attacks)
app.use(speedLimiter);

// Standard rate limiter for general API endpoints
// Can be overridden per-route with stricter limits
app.use('/api', standardLimiter);

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Optional API token auth (Bearer tok_...)
const apiTokenAuth = require('./middleware/apiTokenAuth');
app.use(apiTokenAuth(pool));

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully');
  }
});

// Routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const assetsRoutes = require('./routes/assets');
const checklistTemplatesRoutes = require('./routes/checklistTemplates');
const tasksRoutes = require('./routes/tasks');
const checklistResponsesRoutes = require('./routes/checklistResponses');
const cmLettersRoutes = require('./routes/cmLetters');
const uploadRoutes = require('./routes/upload');
const apiTokensRoutes = require('./routes/apiTokens');
const webhooksRoutes = require('./routes/webhooks');
const inventoryRoutes = require('./routes/inventory');

// Swagger (OpenAPI) docs
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
const openapiSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'Solar O&M Maintenance API', version: '1.0.0' },
    servers: [{ url: '/api' }, { url: '/api/v1' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer' },
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'connect.sid' }
      }
    }
  },
  apis: [] // minimal spec for now (we can expand with annotations later)
});
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

// Authentication routes (no auth required)
// Apply strict rate limiting to auth endpoints to prevent brute force
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/change-password', sensitiveOperationLimiter);
app.use('/api/auth', authRoutes(pool));

// Protected routes
app.use('/api/users', usersRoutes(pool));
app.use('/api/assets', assetsRoutes(pool));
app.use('/api/checklist-templates', checklistTemplatesRoutes(pool));
app.use('/api/tasks', tasksRoutes(pool));
app.use('/api/checklist-responses', checklistResponsesRoutes(pool));
app.use('/api/cm-letters', cmLettersRoutes(pool));
app.use('/api/upload', uploadRoutes(pool));
app.use('/api/api-tokens', apiTokensRoutes(pool));
app.use('/api/webhooks', webhooksRoutes(pool));
app.use('/api/inventory', inventoryRoutes(pool));

// Versioned API (v1) - mirrors /api for integration stability
app.use('/api/v1/auth', authRoutes(pool));
app.use('/api/v1/users', usersRoutes(pool));
app.use('/api/v1/assets', assetsRoutes(pool));
app.use('/api/v1/checklist-templates', checklistTemplatesRoutes(pool));
app.use('/api/v1/tasks', tasksRoutes(pool));
app.use('/api/v1/checklist-responses', checklistResponsesRoutes(pool));
app.use('/api/v1/cm-letters', cmLettersRoutes(pool));
app.use('/api/v1/upload', uploadRoutes(pool));
app.use('/api/v1/api-tokens', apiTokensRoutes(pool));
app.use('/api/v1/webhooks', webhooksRoutes(pool));
app.use('/api/v1/inventory', inventoryRoutes(pool));

// Create reports directory if it doesn't exist - ALL REPORTS SAVED HERE
const reportsDir = path.join(__dirname, 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
  console.log('Created reports directory:', reportsDir);
  console.log('All reports (Word/Excel) will be saved to:', path.resolve(reportsDir));
} else {
  console.log('Reports directory exists:', path.resolve(reportsDir));
}

// Create templates directory structure if it doesn't exist
const templatesDir = path.join(__dirname, 'templates');
const wordTemplatesDir = path.join(templatesDir, 'word');
const excelTemplatesDir = path.join(templatesDir, 'excel');

[wordTemplatesDir, excelTemplatesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('Created templates directory:', dir);
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Solar O&M API is running',
    timestamp: new Date().toISOString(),
    session: req.session ? 'active' : 'none'
  });
});

// Test auth endpoint
app.get('/api/auth/test', (req, res) => {
  res.json({ 
    message: 'Auth endpoint is accessible',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access from network: http://YOUR_IP:${PORT}/api`);
});

module.exports = app;

