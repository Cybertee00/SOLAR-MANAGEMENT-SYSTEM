/**
 * Organization Storage Utilities
 * Manages file storage paths scoped by organization slug (company name)
 * 
 * Folder Structure:
 *   uploads/
 *     companies/
 *       {company_slug}/              - e.g., "smart-innovations-energy"
 *         templates/                 - Template files (Excel, Word)
 *         images/                    - Task/checklist images
 *         cm_letters/                - CM letter documents and reports
 *         inventory/                 - Inventory lists and related files
 *         profiles/                  - User profile images
 *         reports/                   - Generated reports (Excel, PDF)
 *         exports/                   - Exported data files
 *         logs/                      - Application logs and audit trails
 *         documents/                 - Other documents
 *         plant/                     - Plant map structure and related files
 *         logos/                     - Company logos
 */

const path = require('path');
const fs = require('fs');

/**
 * Sanitize organization slug for filesystem use
 * Removes invalid characters and ensures safe folder name
 * @param {string} slug - Organization slug
 * @returns {string} Sanitized slug safe for filesystem
 */
function sanitizeSlug(slug) {
  if (!slug) {
    throw new Error('Organization slug is required');
  }
  // Remove invalid filesystem characters, keep alphanumeric, hyphens, underscores
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Get the base uploads directory
 */
function getUploadsBaseDir() {
  return path.join(__dirname, '..', 'uploads');
}

/**
 * Get company-specific directory path using slug
 * @param {string} organizationSlug - Organization slug (e.g., 'smart-innovations-energy')
 * @returns {string} Path to company directory
 */
function getCompanyDir(organizationSlug) {
  if (!organizationSlug) {
    throw new Error('Organization slug is required');
  }
  const sanitizedSlug = sanitizeSlug(organizationSlug);
  return path.join(getUploadsBaseDir(), 'companies', sanitizedSlug);
}

/**
 * Get path for a specific company subdirectory
 * @param {string} organizationSlug - Organization slug
 * @param {string} subdirectory - Subdirectory name
 * @returns {string} Full path to subdirectory
 */
function getCompanySubDir(organizationSlug, subdirectory) {
  return path.join(getCompanyDir(organizationSlug), subdirectory);
}

/**
 * Ensure company directory structure exists
 * Creates: companies/{slug}/{templates,images,cm_letters,inventory,profiles,reports,exports,logs,documents,plant,logos}
 * @param {string} organizationSlug - Organization slug
 * @returns {Promise<void>}
 */
async function ensureCompanyDirs(organizationSlug) {
  if (!organizationSlug) {
    throw new Error('Organization slug is required');
  }

  const companyDir = getCompanyDir(organizationSlug);
  const subdirs = [
    'templates',      // Template files (Excel, Word)
    'images',         // Task/checklist images
    'cm_letters',     // CM letter documents and reports
    'inventory',      // Inventory lists and related files
    'profiles',       // User profile images
    'reports',        // Generated reports (Excel, PDF)
    'exports',        // Exported data files
    'logs',           // Application logs and audit trails
    'documents',      // Other documents
    'plant',          // Plant map structure and related files
    'logos'           // Company logos
  ];

  // Create company directory
  if (!fs.existsSync(companyDir)) {
    fs.mkdirSync(companyDir, { recursive: true });
  }

  // Create subdirectories
  for (const subdir of subdirs) {
    const subdirPath = getCompanySubDir(organizationSlug, subdir);
    if (!fs.existsSync(subdirPath)) {
      fs.mkdirSync(subdirPath, { recursive: true });
    }
  }
}

/**
 * Get organization slug from request context
 * First tries to get from tenant context, then fetches from database if needed
 * @param {Object} req - Express request object
 * @param {Object} pool - Database pool (optional, for fetching slug)
 * @returns {Promise<string|null>} Organization slug or null
 */
async function getOrganizationSlugFromRequest(req, pool = null) {
  // Check tenant context (set by tenantContext middleware)
  if (req.tenantContext && req.tenantContext.organizationSlug) {
    return req.tenantContext.organizationSlug;
  }

  // Check session (for system owners who entered a company)
  if (req.session && req.session.selectedOrganizationSlug) {
    return req.session.selectedOrganizationSlug;
  }

  // Get organization ID first
  let organizationId = null;
  
  if (req.tenantContext && req.tenantContext.organizationId) {
    organizationId = req.tenantContext.organizationId;
  } else if (req.session && req.session.selectedOrganizationId) {
    organizationId = req.session.selectedOrganizationId;
  } else if (req.user && req.user.organization_id) {
    organizationId = req.user.organization_id;
  }

  // If we have organization ID but no slug, fetch from database
  if (organizationId && pool) {
    try {
      const result = await pool.query(
        'SELECT slug FROM organizations WHERE id = $1',
        [organizationId]
      );
      if (result.rows.length > 0) {
        return result.rows[0].slug;
      }
    } catch (error) {
      console.error('Error fetching organization slug:', error);
    }
  }

  return null;
}

/**
 * Get organization slug from organization ID
 * @param {Object} pool - Database pool
 * @param {string} organizationId - Organization UUID
 * @returns {Promise<string|null>} Organization slug or null
 */
async function getOrganizationSlugById(pool, organizationId) {
  if (!organizationId || !pool) {
    return null;
  }

  try {
    const result = await pool.query(
      'SELECT slug FROM organizations WHERE id = $1',
      [organizationId]
    );
    return result.rows.length > 0 ? result.rows[0].slug : null;
  } catch (error) {
    console.error('Error fetching organization slug:', error);
    return null;
  }
}

/**
 * Get storage path for a file type within a company
 * @param {string} organizationSlug - Organization slug
 * @param {string} fileType - Type of file
 * @param {string} filename - Filename (optional, for full path)
 * @returns {string} Storage path
 */
function getStoragePath(organizationSlug, fileType, filename = null) {
  const validTypes = [
    'templates', 'images', 'cm_letters', 'inventory', 
    'profiles', 'reports', 'exports', 'logs', 'documents', 'logos', 'plant'
  ];
  
  if (!validTypes.includes(fileType)) {
    throw new Error(`Invalid file type: ${fileType}. Must be one of: ${validTypes.join(', ')}`);
  }

  const subdir = getCompanySubDir(organizationSlug, fileType);
  return filename ? path.join(subdir, filename) : subdir;
}

/**
 * Get relative URL path for serving files
 * Format: /uploads/companies/{slug}/{file_type}/{filename}
 * @param {string} organizationSlug - Organization slug
 * @param {string} fileType - Type of file
 * @param {string} filename - Filename
 * @returns {string} Relative URL path
 */
function getFileUrl(organizationSlug, fileType, filename) {
  const sanitizedSlug = sanitizeSlug(organizationSlug);
  return `/uploads/companies/${sanitizedSlug}/${fileType}/${filename}`;
}

/**
 * Parse organization slug and file type from a URL path
 * @param {string} urlPath - URL path like "/uploads/companies/{slug}/{file_type}/{filename}"
 * @returns {Object|null} {organizationSlug, fileType, filename} or null if invalid
 */
function parseFileUrl(urlPath) {
  const match = urlPath.match(/^\/uploads\/companies\/([^\/]+)\/([^\/]+)\/(.+)$/);
  if (!match) {
    return null;
  }

  return {
    organizationSlug: match[1],
    fileType: match[2],
    filename: match[3]
  };
}

/**
 * Migrate old file path to new company-scoped path
 * @param {string} oldPath - Old path like "/uploads/filename.jpg"
 * @param {string} organizationSlug - Organization slug
 * @param {string} fileType - Type of file
 * @returns {Object} {newPath, newUrl, oldPath, oldUrl, filename}
 */
function migrateFilePath(oldPath, organizationSlug, fileType) {
  const filename = path.basename(oldPath);
  const newPath = getStoragePath(organizationSlug, fileType, filename);
  const newUrl = getFileUrl(organizationSlug, fileType, filename);

  return {
    oldPath,
    oldUrl: oldPath.startsWith('/') ? oldPath : `/${oldPath}`,
    newPath,
    newUrl,
    filename
  };
}

/**
 * Check if a file path is within the company's directory (security check)
 * @param {string} filePath - Full file path
 * @param {string} organizationSlug - Organization slug
 * @returns {boolean} True if path is valid and within company directory
 */
function isPathWithinCompany(filePath, organizationSlug) {
  try {
    const resolvedPath = path.resolve(filePath);
    const companyDir = path.resolve(getCompanyDir(organizationSlug));
    return resolvedPath.startsWith(companyDir);
  } catch (error) {
    return false;
  }
}

// Legacy function names for backward compatibility (deprecated)
// These will be removed in future versions
async function ensureOrganizationDirs(organizationId, pool) {
  if (!organizationId) {
    throw new Error('Organization ID is required');
  }
  if (!pool) {
    // If no pool provided, try to get from request context (for backward compatibility)
    throw new Error('Database pool is required to fetch organization slug');
  }
  const slug = await getOrganizationSlugById(pool, organizationId);
  if (!slug) {
    throw new Error(`Organization not found: ${organizationId}`);
  }
  return ensureCompanyDirs(slug);
}

function getOrganizationDir(organizationId) {
  // For backward compatibility, return a path that won't work
  // Callers should migrate to using slugs
  console.warn('getOrganizationDir() is deprecated. Use getCompanyDir(organizationSlug) instead.');
  return path.join(getUploadsBaseDir(), 'organizations', organizationId || 'deprecated');
}

function getOrganizationSubDir(organizationId, subdirectory) {
  // For backward compatibility
  console.warn('getOrganizationSubDir() is deprecated. Use getCompanySubDir(organizationSlug, subdirectory) instead.');
  return path.join(getOrganizationDir(organizationId), subdirectory);
}

function getOrganizationIdFromRequest(req) {
  // Return organization ID for backward compatibility
  if (req.tenantContext && req.tenantContext.organizationId) {
    return req.tenantContext.organizationId;
  }
  if (req.session && req.session.selectedOrganizationId) {
    return req.session.selectedOrganizationId;
  }
  if (req.user && req.user.organization_id) {
    return req.user.organization_id;
  }
  return null;
}

module.exports = {
  // New functions (use company slug)
  sanitizeSlug,
  getUploadsBaseDir,
  getCompanyDir,
  getCompanySubDir,
  ensureCompanyDirs,
  getOrganizationSlugFromRequest,
  getOrganizationSlugById,
  getStoragePath,
  getFileUrl,
  parseFileUrl,
  migrateFilePath,
  isPathWithinCompany,
  
  // Legacy functions (deprecated, for backward compatibility)
  ensureOrganizationDirs,
  getOrganizationDir,
  getOrganizationSubDir,
  getOrganizationIdFromRequest
};
