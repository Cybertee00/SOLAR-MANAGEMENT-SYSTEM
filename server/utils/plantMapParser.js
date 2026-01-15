/**
 * Parse the plant map Excel file and extract map data
 */

const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const PLANT_MAP_FILE = path.resolve(__dirname, '../plant/grasscutting.xlsx');

/**
 * Parse the Excel file and extract map cell data
 * @returns {Promise<Object>} Map data with cells, dimensions, and metadata
 */
async function parsePlantMap() {
  try {
    if (!fs.existsSync(PLANT_MAP_FILE)) {
      throw new Error(`Plant map file not found: ${PLANT_MAP_FILE}`);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(PLANT_MAP_FILE);
    
    // Get first worksheet
    if (!workbook.worksheets || workbook.worksheets.length === 0) {
      throw new Error('No worksheets found in plant map file');
    }
    
    // Get first worksheet
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('Could not access first worksheet in plant map file');
    }
    
    console.log(`[PLANT MAP] Parsing worksheet: ${worksheet.name}, Rows: ${worksheet.actualRowCount || worksheet.rowCount}, Cols: ${worksheet.columnCount}`);

    const cells = [];
    const maxRow = worksheet.actualRowCount || worksheet.rowCount || 100;
    const maxCol = worksheet.columnCount || 50;
    
    console.log(`[PLANT MAP] Processing ${maxRow} rows x ${maxCol} columns`);

    // Parse all cells - include cells with formatting even if empty
    for (let row = 1; row <= maxRow; row++) {
      for (let col = 1; col <= maxCol; col++) {
        const cell = worksheet.getCell(row, col);
        const value = cell.value;
        
        // Check if cell has any formatting (fill, border, etc.)
        const hasFill = cell.fill && cell.fill.type === 'pattern' && cell.fill.fgColor;
        const hasBorder = cell.border && (
          cell.border.top?.style || 
          cell.border.bottom?.style || 
          cell.border.left?.style || 
          cell.border.right?.style
        );
        const hasValue = value !== null && value !== undefined && 
                        (typeof value !== 'string' || value.trim() !== '');
        
        // Include cell if it has value, fill, or border
        if (!hasValue && !hasFill && !hasBorder) {
          continue;
        }

        // Get cell styling
        const fill = cell.fill;
        let backgroundColor = null;
        if (fill && fill.type === 'pattern' && fill.fgColor) {
          const color = fill.fgColor;
          if (color.argb) {
            // Convert ARGB to hex
            backgroundColor = color.argb.substring(2); // Remove 'FF' prefix
          } else if (color.rgb) {
            backgroundColor = color.rgb;
          }
        }

        // Get text color
        let textColor = null;
        if (cell.font && cell.font.color) {
          const color = cell.font.color;
          if (color.argb) {
            textColor = color.argb.substring(2);
          } else if (color.rgb) {
            textColor = color.rgb;
          }
        }

        // Get cell value as string
        let cellValue = '';
        if (value !== null && value !== undefined) {
          if (typeof value === 'object' && value.richText) {
            // Rich text - extract text
            cellValue = value.richText.map(rt => rt.text).join('');
          } else if (typeof value === 'object' && value.text) {
            cellValue = value.text;
          } else if (typeof value === 'object' && value.formula) {
            // Formula - get the result if available
            cellValue = String(value.result || '');
          } else {
            cellValue = String(value);
          }
        }
        
        // Trim whitespace but keep empty string if cell has formatting
        if (cellValue.trim() === '' && !hasFill && !hasBorder) {
          cellValue = '';
        } else {
          cellValue = cellValue.trim();
        }

        // Get merged cell info
        let isMerged = false;
        let mergeRange = null;
        let mergedWidth = 1;
        let mergedHeight = 1;
        
        // Check if cell is part of a merged range
        // ExcelJS stores merged cells - check if this cell is merged
        if (cell.isMerged && cell.master) {
          // This is a merged cell - get info from master
          const master = cell.master;
          isMerged = true;
          // Try to get merge dimensions from the cell or worksheet
          try {
            // Check worksheet for merge info
            const model = worksheet.model;
            if (model && model.merges) {
              for (const merge of model.merges) {
                if (merge.top === master.row && merge.left === master.column) {
                  mergedWidth = merge.right - merge.left + 1;
                  mergedHeight = merge.bottom - merge.top + 1;
                  mergeRange = {
                    startRow: merge.top,
                    startCol: merge.left,
                    endRow: merge.bottom,
                    endCol: merge.right
                  };
                  break;
                }
              }
            }
          } catch (err) {
            // Fallback: assume single cell if we can't determine merge size
            console.warn('[PLANT MAP] Could not determine merge size for cell:', row, col);
          }
          
          // Only process master cell, skip merged sub-cells
          if (row !== master.row || col !== master.column) {
            continue; // Skip this cell - it's part of a merge but not the master
          }
        }

        // Get borders with color info
        const borders = {
          top: cell.border?.top?.style ? {
            style: cell.border.top.style,
            color: cell.border.top.color?.argb || cell.border.top.color?.rgb || '#000000'
          } : null,
          bottom: cell.border?.bottom?.style ? {
            style: cell.border.bottom.style,
            color: cell.border.bottom.color?.argb || cell.border.bottom.color?.rgb || '#000000'
          } : null,
          left: cell.border?.left?.style ? {
            style: cell.border.left.style,
            color: cell.border.left.color?.argb || cell.border.left.color?.rgb || '#000000'
          } : null,
          right: cell.border?.right?.style ? {
            style: cell.border.right.style,
            color: cell.border.right.color?.argb || cell.border.right.color?.rgb || '#000000'
          } : null
        };
        
        // Default to black border if any border exists but no color specified
        const hasAnyBorder = borders.top || borders.bottom || borders.left || borders.right;
        const defaultBorder = hasAnyBorder ? '1px solid #000000' : '1px solid #ccc';

        // Get alignment
        const alignment = {
          horizontal: cell.alignment?.horizontal || 'left',
          vertical: cell.alignment?.vertical || 'top'
        };

        // Only add cell if it's not a non-master merged cell
        if (!isMerged || (mergeRange && row === mergeRange.startRow && col === mergeRange.startCol)) {
          cells.push({
            row,
            col,
            value: cellValue,
            backgroundColor,
            textColor,
            isMerged,
            mergeRange,
            mergedWidth,
            mergedHeight,
            borders,
            defaultBorder,
            alignment,
            fontSize: cell.font?.size || 10,
            fontWeight: cell.font?.bold ? 'bold' : 'normal',
            fontStyle: cell.font?.italic ? 'italic' : 'normal'
          });
        }
      }
    }

    return {
      cells,
      dimensions: {
        maxRow,
        maxCol,
        rowCount: maxRow,
        colCount: maxCol
      },
      metadata: {
        worksheetName: worksheet.name,
        parsedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('[PLANT MAP] Error parsing plant map:', error);
    throw error;
  }
}

module.exports = {
  parsePlantMap
};
