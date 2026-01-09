const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // Get all assets
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM assets ORDER BY asset_code');
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching assets:', error);
      res.status(500).json({ error: 'Failed to fetch assets' });
    }
  });

  // Get asset by ID
  router.get('/:id', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM assets WHERE id = $1', [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Asset not found' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching asset:', error);
      res.status(500).json({ error: 'Failed to fetch asset' });
    }
  });

  // Get assets by type
  router.get('/type/:type', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM assets WHERE asset_type = $1 ORDER BY asset_code', [req.params.type]);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching assets by type:', error);
      res.status(500).json({ error: 'Failed to fetch assets' });
    }
  });

  // Create asset
  router.post('/', async (req, res) => {
    try {
      const { asset_code, asset_name, asset_type, location, installation_date, status } = req.body;
      const result = await pool.query(
        'INSERT INTO assets (asset_code, asset_name, asset_type, location, installation_date, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [asset_code, asset_name, asset_type, location, installation_date || null, status || 'active']
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating asset:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Asset code already exists' });
      }
      res.status(500).json({ error: 'Failed to create asset' });
    }
  });

  return router;
};

