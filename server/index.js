require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const { Pool } = require('pg');

// Security middleware
const { securityHeaders, sanitizeRequestBody, limitRequestSize, validateUUIDParams } = require('./middleware/security');
// Rate limiting removed for frequent use - can be re-enabled if needed
// const { standardLimiter, authLimiter, sensitiveOperationLimiter, speedLimiter } = require('./middleware/rateLimiter');

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
// Create profiles subdirectory
const profilesDir = path.join(__dirname, 'uploads', 'profiles');
if (!fs.existsSync(profilesDir)) {
  fs.mkdirSync(profilesDir, { recursive: true });
  console.log('Created uploads/profiles directory');
}

// ============================================================================
// CRITICAL: Image serving route MUST be FIRST, before ALL middleware
// This prevents any middleware from interfering with CORS/CORP headers
// ============================================================================

// Removed debug logging - images confirmed working in Chrome

// Serve profile images from /uploads/profiles/
app.get('/uploads/profiles/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', 'profiles', filename);
  
  // Security check: prevent directory traversal
  const resolvedPath = path.resolve(filePath);
  const profilesDir = path.resolve(__dirname, 'uploads', 'profiles');
  if (!resolvedPath.startsWith(profilesDir)) {
    console.error('[UPLOADS] Directory traversal blocked');
    return res.status(403).send('Forbidden');
  }
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error('[UPLOADS] Profile image not found:', filePath);
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
  const contentType = contentTypes[ext] || 'image/jpeg';
  
  // Read and serve file with proper headers
  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error('[UPLOADS] Error reading profile image:', err);
      return res.status(500).send('Error reading file');
    }
    
    // Set headers for profile images
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': data.length,
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
    });
    res.end(data, 'binary');
  });
});

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

// Trust proxy for accurate IP addresses (important for rate limiting)
// Dev Tunnels acts as a reverse proxy, so we need to trust it
// This also allows req.secure to work correctly for HTTPS detection
// MUST be set BEFORE CORS and other middleware
// Only enable if explicitly set (not for localhost)
if (process.env.TRUST_PROXY === 'true' || process.env.DEV_TUNNELS === 'true') {
  app.set('trust proxy', 1);
  console.log('Trust proxy enabled (for Dev Tunnels/port forwarding)');
}

// Explicit OPTIONS handler for CORS preflight - MUST be first
// This ensures preflight requests are handled immediately
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  const corsOrigin = process.env.CORS_ORIGIN || 'true';
  let allowedOrigin = '*';
  
  if (corsOrigin === 'true' || corsOrigin === true) {
    allowedOrigin = origin || '*';
  } else if (typeof corsOrigin === 'string' && corsOrigin !== 'true') {
    const allowedOrigins = corsOrigin.split(',').map(o => o.trim());
    if (origin && allowedOrigins.includes(origin)) {
      allowedOrigin = origin;
    } else {
      allowedOrigin = allowedOrigins[0] || '*';
    }
  } else if (origin) {
    allowedOrigin = origin;
  }
  
  res.header('Access-Control-Allow-Origin', allowedOrigin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  res.sendStatus(200);
});

// CORS configuration - MUST be applied BEFORE Helmet and other middleware
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
// This MUST be before Helmet to ensure CORS headers are set correctly
const corsMiddleware = cors({
  origin: corsOriginConfig,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Type'],
  maxAge: 86400, // 24 hours
  preflightContinue: false, // Let CORS handle OPTIONS requests
  optionsSuccessStatus: 200 // Some legacy browsers (IE11) choke on 204
});

app.use((req, res, next) => {
  // Skip CORS for static files - they have their own middleware
  if (req.path.startsWith('/uploads')) {
    return next();
  }
  // Apply CORS to all other routes
  corsMiddleware(req, res, next);
});

// Security headers (Helmet.js) - After CORS, before API routes
// Exclude /uploads from Helmet to prevent interference with image serving
app.use((req, res, next) => {
  if (req.path.startsWith('/uploads')) {
    return next(); // Skip Helmet for static files
  }
  securityHeaders(req, res, next);
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

// Determine cookie settings based on environment
// For localhost (HTTP), we need secure: false and sameSite: 'lax'
// For Dev Tunnels/port forwarding (HTTPS), we need secure: true and sameSite: 'none'
const isDevTunnels = process.env.DEV_TUNNELS === 'true' || 
                     process.env.PORT_FORWARDING === 'true' ||
                     process.env.ALLOW_CROSS_ORIGIN_COOKIES === 'true';

// For localhost, we're using HTTP, so secure must be false
// Only use secure: true if explicitly using HTTPS or in production with HTTPS
const isHTTPS = process.env.HTTPS_ENABLED === 'true' || 
                (process.env.NODE_ENV === 'production' && !process.env.ALLOW_HTTP);

// For localhost (HTTP): secure=false, sameSite='lax'
// For HTTPS/Dev Tunnels: secure=true, sameSite='none'
const cookieSecure = isHTTPS && (isDevTunnels || process.env.NODE_ENV === 'production');
const cookieSameSite = isDevTunnels && cookieSecure ? 'none' : 'lax';

// Request logging middleware - Log all API requests for debugging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const path = req.path;
  const query = Object.keys(req.query).length > 0 ? `?${new URLSearchParams(req.query).toString()}` : '';
  const user = req.session?.username || req.session?.userId || 'anonymous';
  const role = req.session?.role || 'none';
  
  console.log(`[${timestamp}] ${method} ${path}${query} - User: ${user} (${role})`);
  
  // Log request body for POST/PUT/PATCH (but limit size to avoid spam)
  if (['POST', 'PUT', 'PATCH'].includes(method) && req.body && Object.keys(req.body).length > 0) {
    const bodyStr = JSON.stringify(req.body);
    if (bodyStr.length < 500) {
      console.log(`[${timestamp}] Request body:`, req.body);
    } else {
      console.log(`[${timestamp}] Request body: (too large, ${bodyStr.length} chars)`);
    }
  }
  
  // Log response when it finishes
  const originalSend = res.send;
  res.send = function(data) {
    console.log(`[${timestamp}] ${method} ${path}${query} - Response: ${res.statusCode}`);
    originalSend.apply(res, arguments);
  };
  
  next();
});

app.use(session({
  secret: sessionSecret || 'CHANGE-THIS-SECRET-IN-PRODUCTION-USE-RANDOM-STRING',
  resave: false, // Don't save session if unmodified
  saveUninitialized: false, // Don't create session until something is stored
  name: 'sessionId', // Don't use default 'connect.sid' for security
  cookie: {
    secure: cookieSecure, // false for localhost (HTTP), true for HTTPS
    httpOnly: true, // Prevent XSS attacks
    sameSite: cookieSameSite, // 'none' for cross-origin (Dev Tunnels), 'lax' for same-origin (localhost)
    maxAge: parseInt(process.env.SESSION_MAX_AGE_MS || '86400000', 10), // 24 hours default
    domain: undefined // Don't set domain to allow cross-subdomain cookies
  },
  // Use secure session store in production (Redis recommended)
  // For now using memory store (not suitable for production with multiple servers)
  // Important: session is saved automatically when response is sent if session was modified
}));

console.log(`Session cookie configuration: secure=${cookieSecure}, sameSite=${cookieSameSite}, isHTTPS=${isHTTPS}, isDevTunnels=${isDevTunnels}`);

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

// Rate limiting removed - system will be used frequently
// If needed, can be re-enabled via environment variables or by uncommenting below
// app.use(speedLimiter);
// app.use('/api', standardLimiter);

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

// Test CORS endpoint (for debugging)
app.get('/api/test-cors', (req, res) => {
  res.json({ 
    message: 'CORS is working!',
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
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
const earlyCompletionRequestsRoutes = require('./routes/earlyCompletionRequests');
const notificationsRoutes = require('./routes/notifications');

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
// Rate limiting removed for frequent use - can be re-enabled if needed
// app.use('/api/auth/login', authLimiter);
// app.use('/api/auth/change-password', sensitiveOperationLimiter);
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
app.use('/api/spare-requests', require('./routes/spareRequests')(pool));
app.use('/api/early-completion-requests', earlyCompletionRequestsRoutes(pool));
app.use('/api/notifications', notificationsRoutes(pool));

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

// Schedule reminder notifications (check daily at midnight)
// This runs a check for tasks scheduled 3 days from now
const { scheduleReminders } = require('./utils/notifications');
setInterval(async () => {
  try {
    await scheduleReminders(pool);
  } catch (error) {
    console.error('Error scheduling reminders:', error);
  }
}, 24 * 60 * 60 * 1000); // Run every 24 hours

// Also run on server start (after a short delay to ensure DB is ready)
setTimeout(async () => {
  try {
    await scheduleReminders(pool);
  } catch (error) {
    console.error('Error running initial reminder check:', error);
  }
}, 5000); // Run 5 seconds after server start

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access from network: http://YOUR_IP:${PORT}/api`);
  console.log('Reminder notification scheduler started');
});

module.exports = app;

