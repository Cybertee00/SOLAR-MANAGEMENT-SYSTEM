/**
 * File Validation Utility
 * 
 * Validates uploaded files using magic number detection (file-type library)
 * to prevent MIME type spoofing attacks.
 * 
 * MIME types can be easily spoofed by renaming files (e.g., .exe to .jpg),
 * but magic numbers (file signatures) cannot be faked.
 */

const FileType = require('file-type');
const logger = require('./logger');

/**
 * Allowed image MIME types
 */
const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp'
];

/**
 * Allowed image file extensions
 */
const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

/**
 * Validates a file buffer using magic number detection
 * 
 * @param {Buffer} fileBuffer - The file buffer to validate
 * @param {string[]} allowedMimeTypes - Array of allowed MIME types (default: images)
 * @param {string[]} allowedExtensions - Array of allowed extensions (default: image extensions)
 * @returns {Promise<Object>} - { mime: string, ext: string } if valid
 * @throws {Error} - If file type is invalid or cannot be detected
 */
async function validateFileType(fileBuffer, allowedMimeTypes = ALLOWED_IMAGE_MIME_TYPES, allowedExtensions = ALLOWED_IMAGE_EXTENSIONS) {
  if (!Buffer.isBuffer(fileBuffer)) {
    throw new Error('File buffer is required for validation');
  }

  if (fileBuffer.length === 0) {
    throw new Error('File buffer is empty');
  }

  // Read magic numbers from buffer (first bytes)
  const fileType = await FileType.fromBuffer(fileBuffer);

  if (!fileType) {
    logger.warn('File type detection failed - unable to read magic numbers', {
      bufferSize: fileBuffer.length
    });
    throw new Error('Unable to detect file type. File may be corrupted or invalid.');
  }

  // Verify magic number matches expected MIME type
  if (!allowedMimeTypes.includes(fileType.mime)) {
    logger.warn('File type validation failed - MIME type not allowed', {
      detectedMime: fileType.mime,
      detectedExt: fileType.ext,
      allowedMimeTypes
    });
    throw new Error(`File type ${fileType.mime} is not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`);
  }

  // Verify extension matches detected type
  if (!allowedExtensions.includes(fileType.ext)) {
    logger.warn('File type validation failed - extension not allowed', {
      detectedMime: fileType.mime,
      detectedExt: fileType.ext,
      allowedExtensions
    });
    throw new Error(`File extension .${fileType.ext} is not allowed. Allowed extensions: ${allowedExtensions.join(', ')}`);
  }

  logger.debug('File type validation passed', {
    mime: fileType.mime,
    ext: fileType.ext
  });

  return {
    mime: fileType.mime,
    ext: fileType.ext
  };
}

/**
 * Validates an uploaded file from multer
 * 
 * @param {Object} file - Multer file object (req.file)
 * @param {string[]} allowedMimeTypes - Array of allowed MIME types
 * @param {string[]} allowedExtensions - Array of allowed extensions
 * @returns {Promise<Object>} - { mime: string, ext: string } if valid
 * @throws {Error} - If file type is invalid
 */
async function validateUploadedFile(file, allowedMimeTypes = ALLOWED_IMAGE_MIME_TYPES, allowedExtensions = ALLOWED_IMAGE_EXTENSIONS) {
  if (!file) {
    throw new Error('File is required');
  }

  if (!file.path) {
    throw new Error('File path is required');
  }

  const fs = require('fs');
  
  // Read file buffer for magic number detection
  const fileBuffer = fs.readFileSync(file.path);
  
  // Validate using magic numbers
  return await validateFileType(fileBuffer, allowedMimeTypes, allowedExtensions);
}

module.exports = {
  validateFileType,
  validateUploadedFile,
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_IMAGE_EXTENSIONS
};
