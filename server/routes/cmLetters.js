const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // Get all CM letters
  router.get('/', async (req, res) => {
    try {
      const { status, task_id } = req.query;
      let query = `
        SELECT cm.*, 
               t.task_code,
               a.asset_code, a.asset_name,
               pt.task_code as parent_task_code
        FROM cm_letters cm
        LEFT JOIN tasks t ON cm.task_id = t.id
        LEFT JOIN assets a ON cm.asset_id = a.id
        LEFT JOIN tasks pt ON cm.parent_pm_task_id = pt.id
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 1;

      if (status) {
        query += ` AND cm.status = $${paramCount++}`;
        params.push(status);
      }
      if (task_id) {
        query += ` AND cm.task_id = $${paramCount++}`;
        params.push(task_id);
      }

      query += ' ORDER BY cm.generated_at DESC';

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching CM letters:', error);
      res.status(500).json({ error: 'Failed to fetch CM letters' });
    }
  });

  // Get CM letter by ID
  router.get('/:id', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT cm.*, 
               t.task_code,
               a.asset_code, a.asset_name,
               pt.task_code as parent_task_code
        FROM cm_letters cm
        LEFT JOIN tasks t ON cm.task_id = t.id
        LEFT JOIN assets a ON cm.asset_id = a.id
        LEFT JOIN tasks pt ON cm.parent_pm_task_id = pt.id
        WHERE cm.id = $1
      `, [req.params.id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'CM letter not found' });
      }
      
      const cmLetter = result.rows[0];
      
      // If images field is empty or null, try to fetch from failed_item_images table
      let images = cmLetter.images;
      if (!images || (typeof images === 'string' && images.trim() === '') || 
          (Array.isArray(images) && images.length === 0)) {
        
        // Try to get images from the parent PM task
        if (cmLetter.parent_pm_task_id) {
          const imagesResult = await pool.query(
            `SELECT image_path, image_filename, item_id, section_id, comment 
             FROM failed_item_images 
             WHERE task_id = $1 
             ORDER BY uploaded_at ASC`,
            [cmLetter.parent_pm_task_id]
          );
          
          if (imagesResult.rows.length > 0) {
            images = imagesResult.rows.map(img => {
              // Extract actual filename from image_path if it contains the full path
              // image_path format: "/uploads/timestamp-uuid-filename.ext"
              // We need just the filename part: "timestamp-uuid-filename.ext"
              let imagePath = img.image_path;
              let filename = img.image_filename;
              
              // If image_path contains a path, extract just the filename
              if (imagePath && imagePath.includes('/')) {
                const extractedFilename = imagePath.split('/').pop();
                // Use the extracted filename (this is the actual file on disk)
                filename = extractedFilename;
                imagePath = extractedFilename; // Store just the filename, not the full path
              }
              
              // If we don't have a filename yet, try to get it from image_filename
              if (!filename && img.image_filename) {
                filename = img.image_filename;
              }
              
              console.log('CM Letter image mapping:', {
                original_image_path: img.image_path,
                original_image_filename: img.image_filename,
                extracted_filename: filename,
                final_imagePath: imagePath
              });
              
              return {
                path: imagePath || filename, // Use extracted filename
                image_path: imagePath || filename, // Also include as image_path for compatibility
                filename: filename, // The actual filename to use
                item_id: img.item_id,
                section_id: img.section_id,
                comment: img.comment || ''
              };
            });
            
            // Update the CM letter with the images (backfill)
            await pool.query(
              'UPDATE cm_letters SET images = $1::jsonb WHERE id = $2',
              [JSON.stringify(images), req.params.id]
            );
            
            cmLetter.images = images;
            console.log(`Backfilled ${images.length} images for CM letter ${req.params.id} from parent PM task ${cmLetter.parent_pm_task_id}`);
          }
        }
      }
      
      res.json(cmLetter);
    } catch (error) {
      console.error('Error fetching CM letter:', error);
      res.status(500).json({ error: 'Failed to fetch CM letter' });
    }
  });

  // Update CM letter status
  router.patch('/:id/status', async (req, res) => {
    try {
      const { status, resolved_at } = req.body;
      const updateFields = ['status = $1'];
      const params = [status];
      let paramCount = 2;

      if (resolved_at) {
        updateFields.push(`resolved_at = $${paramCount++}`);
        params.push(resolved_at);
      } else if (status === 'resolved' || status === 'closed') {
        updateFields.push('resolved_at = CURRENT_TIMESTAMP');
      }

      params.push(req.params.id);

      const result = await pool.query(
        `UPDATE cm_letters 
         SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${paramCount} 
         RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'CM letter not found' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating CM letter:', error);
      res.status(500).json({ error: 'Failed to update CM letter' });
    }
  });

  return router;
};

