import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

// Table data directory - use absolute path
const TABLES_DIR = path.resolve(process.cwd(), 'data', 'tables');

// Make sure the data directory exists
function ensureDataDirectory() {
  try {
    if (!fs.existsSync(TABLES_DIR)) {
      fs.mkdirSync(TABLES_DIR, { recursive: true });
      console.log(`Created directory: ${TABLES_DIR}`);
    }
  } catch (error) {
    console.error(`Error creating tables directory: ${error.message}`);
  }
}

// Function to convert style object to CSS string
function styleToString(styleObj) {
  return Object.entries(styleObj || {})
    .map(([key, value]) => {
      // Convert camelCase to kebab-case
      const kebabKey = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
      return `${kebabKey}: ${value}`;
    })
    .join('; ');
}

// Convert table JSON to HTML
async function tableJsonToHtml(tableId) {
  try {
    console.log(`🔍 EXPORT-TABLES: Processing table ${tableId}`);
    
    // Ensure data directory exists
    ensureDataDirectory();
    
    // Decode the table ID from URL encoding
    const decodedTableId = decodeURIComponent(tableId);
    console.log(`🔍 EXPORT-TABLES: Decoded table ID from ${tableId} to ${decodedTableId}`);
    
    // Check if table data exists
    const dataPath = path.join(TABLES_DIR, `${decodedTableId}.json`);
    const stylePath = path.join(TABLES_DIR, `${decodedTableId}_style.json`);
    
    console.log(`🔍 EXPORT-TABLES: Looking for table data at: ${dataPath}`);
    console.log(`🔍 EXPORT-TABLES: Looking for table style at: ${stylePath}`);
    console.log(`🔍 EXPORT-TABLES: Tables directory absolute path: ${TABLES_DIR}`);
    
    if (!fs.existsSync(dataPath) || !fs.existsSync(stylePath)) {
      console.error(`🔍 EXPORT-TABLES: Table data not found for ${decodedTableId}`);
      console.error(`🔍 EXPORT-TABLES: Data file exists: ${fs.existsSync(dataPath)}`);
      console.error(`🔍 EXPORT-TABLES: Style file exists: ${fs.existsSync(stylePath)}`);
      
      // List all files in the tables directory
      try {
        const files = fs.readdirSync(TABLES_DIR);
        console.log(`🔍 EXPORT-TABLES: Files in tables directory: ${files.join(', ')}`);
      } catch (dirError) {
        console.error(`🔍 EXPORT-TABLES: Error reading tables directory: ${dirError.message}`);
      }
      
      return `<div class="table-error">Table data not found</div>`;
    }
    
    // Read table data
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const style = JSON.parse(fs.readFileSync(stylePath, 'utf8'));
    
    console.log(`🔍 EXPORT-TABLES: Successfully read table data for ${decodedTableId}`);
    
    // Generate HTML table
    let tableHtml = `<table class="wiki-table" data-table-id="${decodedTableId}" style="${styleToString(style.tableStyles)}">`;
    
    // Add header if present
    if (data.hasHeader) {
      tableHtml += '<thead><tr>';
      for (let col = 0; col < data.columns; col++) {
        const cell = data.cells.find(c => c.row === 0 && c.col === col);
        tableHtml += `<th style="${styleToString(style.headerStyles)}">${cell?.content || ''}</th>`;
      }
      tableHtml += '</tr></thead>';
    }
    
    // Add body rows
    tableHtml += '<tbody>';
    const startRow = data.hasHeader ? 1 : 0;
    for (let row = startRow; row < data.rows; row++) {
      tableHtml += '<tr>';
      for (let col = 0; col < data.columns; col++) {
        const cell = data.cells.find(c => c.row === row && c.col === col);
        tableHtml += `<td style="${styleToString(style.cellStyles)}">${cell?.content || ''}</td>`;
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table>';
    
    console.log(`🔍 EXPORT-TABLES: Generated HTML table for ${decodedTableId}`);
    return tableHtml;
  } catch (error) {
    console.error(`🔍 EXPORT-TABLES: Error converting table ${decodedTableId} to HTML:`, error);
    return `<div class="table-error">Error loading table</div>`;
  }
}

// Replace all table iframes in HTML content with actual tables
export async function POST(request) {
  try {
    console.log("🔍 EXPORT-TABLES: Starting export process");
    
    // Ensure data directory exists
    ensureDataDirectory();
    
    const { html } = await request.json();
    
    if (!html) {
      console.error("🔍 EXPORT-TABLES: No HTML content provided");
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
    }
    
    // Extract all table IDs using regex
    const tableIdRegex = /<iframe[^>]*data-table-id="([^"]+)"[^>]*>/g;
    let htmlContent = html;
    let match;
    const tableIds = [];
    
    // Find all table IDs
    while ((match = tableIdRegex.exec(html)) !== null) {
      tableIds.push(match[1]);
    }
    
    console.log(`🔍 EXPORT-TABLES: Found ${tableIds.length} tables to process in HTML:`, tableIds);
    
    // Replace each table iframe with HTML
    for (const tableId of tableIds) {
      // Convert the table to HTML
      console.log(`🔍 EXPORT-TABLES: Converting table ${tableId} to HTML`);
      const tableHtml = await tableJsonToHtml(tableId);
      
      if (tableHtml.includes("Table data not found")) {
        console.error(`🔍 EXPORT-TABLES: Could not generate HTML for table ${tableId}`);
      } else {
        console.log(`🔍 EXPORT-TABLES: Successfully generated HTML for table ${tableId}`);
      }
      
      // Create a regex pattern that matches the entire container with this table ID
      const pattern = `<div[^>]*class="table-container"[^>]*>[\\s\\S]*?<iframe[^>]*data-table-id="${tableId}"[^>]*>[\\s\\S]*?<\\/iframe>[\\s\\S]*?<\\/div>`;
      const regex = new RegExp(pattern, 'g');
      
      // Replace the iframe container with the table HTML
      const beforeLength = htmlContent.length;
      htmlContent = htmlContent.replace(regex, tableHtml);
      const afterLength = htmlContent.length;
      
      if (beforeLength === afterLength) {
        console.error(`🔍 EXPORT-TABLES: Failed to replace iframe for table ${tableId}`);
      } else {
        console.log(`🔍 EXPORT-TABLES: Successfully replaced iframe for table ${tableId}`);
      }
    }
    
    console.log("🔍 EXPORT-TABLES: Completed export process");
    return NextResponse.json({ html: htmlContent });
  } catch (error) {
    console.error('🔍 EXPORT-TABLES: Error exporting tables:', error);
    return NextResponse.json({ error: 'Failed to process tables' }, { status: 500 });
  }
} 