/**
 * Template Inspector
 * Helps identify what placeholders exist in Word templates
 * Useful for debugging template mapping issues
 */

const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const fs = require('fs');

/**
 * Inspect a Word template to find all placeholders
 * @param {String} templatePath - Path to Word template
 * @returns {Array} - Array of placeholder names found
 */
function inspectWordTemplate(templatePath) {
  try {
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    
    // Read the main document XML
    const doc = zip.files['word/document.xml'];
    if (!doc) {
      throw new Error('Could not find word/document.xml in template');
    }

    const xmlContent = doc.asText();
    
    // Find all {{placeholder}} patterns
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    const placeholders = [];
    let match;
    
    while ((match = placeholderRegex.exec(xmlContent)) !== null) {
      const placeholder = match[1].trim();
      if (placeholder && !placeholders.includes(placeholder)) {
        placeholders.push(placeholder);
      }
    }

    return placeholders;
  } catch (error) {
    console.error('Error inspecting template:', error);
    return [];
  }
}

module.exports = {
  inspectWordTemplate
};

