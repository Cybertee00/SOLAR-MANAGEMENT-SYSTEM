/**
 * Database Backup Script
 * 
 * Creates a PostgreSQL database backup
 * Run daily via cron job or systemd timer
 * 
 * Usage:
 *   node server/scripts/backup-db.js
 * 
 * Environment variables:
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD (required)
 *   BACKUP_DIR (optional, defaults to server/backups)
 *   BACKUP_RETENTION_DAYS (optional, defaults to 30)
 */

require('dotenv').config();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const logger = require('../utils/logger');

const execAsync = promisify(exec);

// Configuration
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 5432;
const DB_NAME = process.env.DB_NAME || 'solar_om_db';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD;

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../backups');
const BACKUP_RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);

// Create backup directory if it doesn't exist
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  logger.info('Created backup directory', { path: BACKUP_DIR });
}

async function createBackup() {
  try {
    if (!DB_PASSWORD) {
      throw new Error('DB_PASSWORD environment variable is required');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupFilename = `backup-${DB_NAME}-${timestamp}.sql`;
    const backupPath = path.join(BACKUP_DIR, backupFilename);

    logger.info('Starting database backup', { 
      database: DB_NAME, 
      host: DB_HOST,
      backupPath 
    });

    // Set PGPASSWORD environment variable for pg_dump
    const env = {
      ...process.env,
      PGPASSWORD: DB_PASSWORD
    };

    // Build pg_dump command
    const command = `pg_dump -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -F p -f "${backupPath}"`;

    await execAsync(command, { env });

    // Check if backup file was created
    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file was not created');
    }

    const stats = fs.statSync(backupPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    logger.info('Database backup completed successfully', { 
      backupPath,
      fileSize: `${fileSizeMB} MB`
    });

    // Cleanup old backups
    await cleanupOldBackups();

    return backupPath;
  } catch (error) {
    logger.error('Database backup failed', { 
      error: error.message, 
      stack: error.stack 
    });
    throw error;
  }
}

async function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const now = Date.now();
    const retentionMs = BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const file of files) {
      if (!file.startsWith('backup-') || !file.endsWith('.sql')) {
        continue;
      }

      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      const fileAge = now - stats.mtimeMs;

      if (fileAge > retentionMs) {
        fs.unlinkSync(filePath);
        deletedCount++;
        logger.debug('Deleted old backup', { file, age: Math.floor(fileAge / (24 * 60 * 60 * 1000)) + ' days' });
      }
    }

    if (deletedCount > 0) {
      logger.info('Cleaned up old backups', { deletedCount, retentionDays: BACKUP_RETENTION_DAYS });
    }
  } catch (error) {
    logger.error('Error cleaning up old backups', { error: error.message });
    // Don't throw - cleanup failure shouldn't fail the backup
  }
}

// Run backup if script is executed directly
if (require.main === module) {
  createBackup()
    .then(backupPath => {
      logger.info('Backup script completed', { backupPath });
      process.exit(0);
    })
    .catch(error => {
      logger.error('Backup script failed', { error: error.message });
      process.exit(1);
    });
}

module.exports = { createBackup, cleanupOldBackups };
