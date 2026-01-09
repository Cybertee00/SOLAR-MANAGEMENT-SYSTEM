/**
 * Analyze Word Template Structure
 * Reads the Word template and identifies where placeholders should be added
 */

const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

function analyzeTemplate(templatePath) {
  try {
    if (!fs.existsSync(templatePath)) {
      console.error('Template not found:', templatePath);
      return null;
    }

    console.log('Analyzing template:', templatePath);
    console.log('='.repeat(80));

    // Read the Word document
    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    
    // Read the main document XML
    const doc = zip.files['word/document.xml'];
    if (!doc) {
      throw new Error('Could not find word/document.xml in template');
    }

    const xmlContent = doc.asText();
    
    // Extract text content (simplified - remove XML tags)
    let textContent = xmlContent
      .replace(/<w:t[^>]*>/g, '')  // Remove opening text tags
      .replace(/<\/w:t>/g, '')     // Remove closing text tags
      .replace(/<[^>]+>/g, ' ')    // Remove all other XML tags
      .replace(/\s+/g, ' ')        // Normalize whitespace
      .trim();

    // Find existing placeholders
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    const existingPlaceholders = [];
    let match;
    while ((match = placeholderRegex.exec(xmlContent)) !== null) {
      const placeholder = match[1].trim();
      if (placeholder && !existingPlaceholders.includes(placeholder)) {
        existingPlaceholders.push(placeholder);
      }
    }

    // Find potential placeholder locations (blanks, underscores, etc.)
    const blankPatterns = [
      /_{3,}/g,           // Multiple underscores
      /\[blank\]/gi,       // [blank] text
      /\[.*?\]/g,         // Any [text] pattern
      /\(.*?\)/g,         // Parentheses (might indicate placeholders)
      /___/g              // Triple underscores
    ];

    const analysis = {
      templatePath: templatePath,
      existingPlaceholders: existingPlaceholders,
      textPreview: textContent.substring(0, 2000), // First 2000 chars
      recommendations: []
    };

    // Analyze structure
    const lines = textContent.split('\n').filter(line => line.trim().length > 0);
    
    // Look for common patterns that indicate where placeholders should go
    const headerKeywords = ['PLANT', 'PROCEDURE', 'TASK', 'ASSET', 'LOCATION', 'DATE'];
    const footerKeywords = ['INSPECTED', 'APPROVED', 'MAINTENANCE', 'TEAM', 'SUBMITTED'];
    const itemKeywords = ['CHECK', 'VERIFY', 'INSPECT', 'STATUS', 'OBSERVATION'];

    let foundSections = [];
    let foundItems = [];
    let foundHeaders = [];
    let foundFooters = [];

    lines.forEach((line, index) => {
      const upperLine = line.toUpperCase();
      
      // Check for header fields
      headerKeywords.forEach(keyword => {
        if (upperLine.includes(keyword) && (upperLine.includes('_') || upperLine.includes('['))) {
          foundHeaders.push({ line: index + 1, text: line.trim(), keyword });
        }
      });

      // Check for footer fields
      footerKeywords.forEach(keyword => {
        if (upperLine.includes(keyword) && (upperLine.includes('_') || upperLine.includes('['))) {
          foundFooters.push({ line: index + 1, text: line.trim(), keyword });
        }
      });

      // Check for checklist items
      if (itemKeywords.some(kw => upperLine.includes(kw)) && 
          (upperLine.match(/^\d+\.\d+/) || upperLine.match(/^\d+\./))) {
        foundItems.push({ line: index + 1, text: line.trim() });
      }

      // Check for section headers
      if (upperLine.includes('INSPECTION') || upperLine.includes('SECTION') || 
          upperLine.includes('PYRANOMETER') || upperLine.includes('CELL') ||
          upperLine.includes('GENERAL') || upperLine.includes('OBSERVATION')) {
        if (upperLine.length < 100) { // Likely a section header
          foundSections.push({ line: index + 1, text: line.trim() });
        }
      }
    });

    analysis.foundHeaders = foundHeaders;
    analysis.foundFooters = foundFooters;
    analysis.foundSections = foundSections;
    analysis.foundItems = foundItems.slice(0, 20); // First 20 items

    return analysis;
  } catch (error) {
    console.error('Error analyzing template:', error);
    return null;
  }
}

function generatePlaceholderGuide(analysis) {
  if (!analysis) {
    return 'Could not analyze template.';
  }

  let guide = '# Template Analysis and Placeholder Guide\n\n';
  guide += `**Template:** ${path.basename(analysis.templatePath)}\n\n`;
  
  guide += '## Existing Placeholders Found\n\n';
  if (analysis.existingPlaceholders.length > 0) {
    guide += analysis.existingPlaceholders.map(p => `- \`{{${p}}}\``).join('\n') + '\n\n';
  } else {
    guide += '**No placeholders found. You need to add them.**\n\n';
  }

  guide += '## Template Structure Analysis\n\n';
  guide += `**Text Preview (first 500 chars):**\n\`\`\`\n${analysis.textPreview.substring(0, 500)}...\n\`\`\`\n\n`;

  guide += '## Where to Add Placeholders\n\n';

  // Header section
  if (analysis.foundHeaders.length > 0) {
    guide += '### HEADER SECTION (Top of Document)\n\n';
    guide += 'Look for these lines and replace blanks/underscores with placeholders:\n\n';
    analysis.foundHeaders.forEach(h => {
      guide += `- **Line ${h.line}:** "${h.text}"\n`;
      guide += `  → Replace with: \`{{${h.keyword.toLowerCase()}}}\` or appropriate placeholder\n\n`;
    });
  }

  // Sections
  if (analysis.foundSections.length > 0) {
    guide += '### SECTIONS FOUND\n\n';
    analysis.foundSections.forEach(s => {
      guide += `- **Line ${s.line}:** "${s.text}"\n`;
    });
    guide += '\n**For sections, you can use:**\n';
    guide += '```\n{#sections}\n{number}. {title}\n{#items}...{/items}\n{/sections}\n```\n\n';
  }

  // Items
  if (analysis.foundItems.length > 0) {
    guide += '### CHECKLIST ITEMS FOUND\n\n';
    guide += `Found ${analysis.foundItems.length}+ items. Examples:\n\n`;
    analysis.foundItems.slice(0, 5).forEach(item => {
      guide += `- **Line ${item.line}:** "${item.text.substring(0, 80)}..."\n`;
    });
    guide += '\n**For each item, add placeholders for:**\n';
    guide += '- Status: `{status}`\n';
    guide += '- Observations: `{observations}`\n';
    guide += '- Measurements: `{measurements}`\n\n';
  }

  // Footer section
  if (analysis.foundFooters.length > 0) {
    guide += '### FOOTER SECTION (Bottom of Document)\n\n';
    guide += 'Look for these lines and replace blanks/underscores with placeholders:\n\n';
    analysis.foundFooters.forEach(f => {
      guide += `- **Line ${f.line}:** "${f.text}"\n`;
      guide += `  → Replace with: \`{{${f.keyword.toLowerCase()}}}\` or appropriate placeholder\n\n`;
    });
  }

  guide += '## Recommended Placeholders\n\n';
  guide += '### Header Placeholders:\n';
  guide += '```\n{{plant_name}}\n{{procedure}}\n{{task_code}}\n{{task_type}}\n{{asset_name}}\n{{asset_code}}\n{{location}}\n{{scheduled_date}}\n{{completed_date}}\n```\n\n';

  guide += '### Footer Placeholders:\n';
  guide += '```\n{{maintenance_team}}\n{{inspected_by}}\n{{approved_by}}\n{{submitted_by}}\n{{submitted_at}}\n{{overall_status}}\n```\n\n';

  guide += '### Item Placeholders (inside loops):\n';
  guide += '```\n{number}\n{label}\n{status}\n{observations}\n{measurements}\n```\n\n';

  return guide;
}

// Main execution
const templatePath = process.argv[2] || path.join(__dirname, '../../Checksheets/word/WEATHER STATION.docx');

if (!fs.existsSync(templatePath)) {
  console.error('Template not found. Trying alternative locations...');
  const altPaths = [
    path.join(__dirname, '../../Checksheets/WEATHER STATION.docx'),
    path.join(__dirname, '../templates/word/WEATHER STATION.docx')
  ];
  
  let found = false;
  for (const altPath of altPaths) {
    if (fs.existsSync(altPath)) {
      console.log('Found template at:', altPath);
      const analysis = analyzeTemplate(altPath);
      if (analysis) {
        const guide = generatePlaceholderGuide(analysis);
        const outputPath = path.join(__dirname, '../TEMPLATE_ANALYSIS.md');
        fs.writeFileSync(outputPath, guide, 'utf8');
        console.log('\n' + '='.repeat(80));
        console.log('Analysis complete!');
        console.log('Guide saved to:', outputPath);
        console.log('='.repeat(80));
        console.log('\n' + guide);
      }
      found = true;
      break;
    }
  }
  
  if (!found) {
    console.error('Could not find template. Please provide the path:');
    console.error('node analyze-template.js "path/to/WEATHER STATION.docx"');
    process.exit(1);
  }
} else {
  const analysis = analyzeTemplate(templatePath);
  if (analysis) {
    const guide = generatePlaceholderGuide(analysis);
    const outputPath = path.join(__dirname, '../TEMPLATE_ANALYSIS.md');
    fs.writeFileSync(outputPath, guide, 'utf8');
    console.log('\n' + '='.repeat(80));
    console.log('Analysis complete!');
    console.log('Guide saved to:', outputPath);
    console.log('='.repeat(80));
    console.log('\n' + guide);
  }
}

