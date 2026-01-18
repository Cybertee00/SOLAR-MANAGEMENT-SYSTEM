const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { validateUploadedFile } = require('../utils/fileValidator');
const logger = require('../utils/logger');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-uuid-originalname
    const uniqueName = `${Date.now()}-${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
  }
});

module.exports = (pool) => {
  const router = express.Router();

  // Upload image for failed checklist item
  router.post('/failed-item', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }

      // Validate file using magic number detection (prevents MIME type spoofing)
      try {
        await validateUploadedFile(req.file);
        logger.debug('File type validation passed', { filename: req.file.originalname });
      } catch (validationError) {
        // Delete uploaded file if validation fails
        if (req.file && req.file.path) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (unlinkError) {
            logger.error('Error deleting invalid file', { error: unlinkError.message });
          }
        }
        logger.warn('File upload rejected - validation failed', {
          filename: req.file.originalname,
          error: validationError.message
        });
        return res.status(400).json({ 
          error: 'Invalid file type',
          message: validationError.message
        });
      }

      const { task_id, checklist_response_id, item_id, section_id, comment } = req.body;

      if (!task_id || !item_id || !section_id) {
        // Delete uploaded file if validation fails
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'task_id, item_id, and section_id are required' });
      }

      // Save image record to database
      const result = await pool.query(
        `INSERT INTO failed_item_images (
          task_id, checklist_response_id, item_id, section_id,
          image_path, image_filename, comment, uploaded_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          task_id,
          checklist_response_id || null,
          item_id,
          section_id,
          `/uploads/${req.file.filename}`, // Relative path for serving
          req.file.originalname,
          comment || null,
          req.body.uploaded_by || null
        ]
      );

      res.status(201).json({
        id: result.rows[0].id,
        image_path: result.rows[0].image_path,
        image_filename: result.rows[0].image_filename,
        message: 'Image uploaded successfully'
      });
    } catch (error) {
      logger.error('Error uploading image', { error: error.message, stack: error.stack });
      // Delete uploaded file if database insert fails
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          logger.error('Error deleting uploaded file', { error: unlinkError.message });
        }
      }
      res.status(500).json({ error: 'Failed to upload image', details: error.message });
    }
  });

  // Get images for a task
  router.get('/task/:taskId', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM failed_item_images WHERE task_id = $1 ORDER BY uploaded_at DESC',
        [req.params.taskId]
      );
      res.json(result.rows);
    } catch (error) {
      logger.error('Error fetching images', { error: error.message, taskId: req.params.taskId });
      res.status(500).json({ error: 'Failed to fetch images' });
    }
  });

  // Serve uploaded images
  // This route is at /api/upload/:filename
  // But static files are also served at /uploads/:filename (in index.js)
  // This route provides an alternative API endpoint for images
  router.get('/:filename', (req, res) => {
    // Extract just the filename (in case full path is passed)
    let filename = req.params.filename;
    if (filename.includes('/')) {
      filename = filename.split('/').pop();
    }
    
    const filePath = path.join(__dirname, '../uploads', filename);
    
    // Security: Check if file exists and is within uploads directory
    if (!fs.existsSync(filePath)) {
      logger.warn('Image not found', { filename, filePath, params: req.params });
      return res.status(404).json({ error: 'Image not found', filename: filename });
    }

    // Check if path is within uploads directory (prevent directory traversal)
    const uploadsDir = path.join(__dirname, '../uploads');
    const resolvedPath = path.resolve(filePath);
    const resolvedDir = path.resolve(uploadsDir);
    
    if (!resolvedPath.startsWith(resolvedDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Set proper content type for images
    const ext = path.extname(filename).toLowerCase();
    const contentTypeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    const contentType = contentTypeMap[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    res.sendFile(filePath);
  });

  return router;
};

