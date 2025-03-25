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
    
    // Ensure data directory exists
    ensureDataDirectory();
    
    // Decode the table ID from URL encoding
    const decodedTableId = decodeURIComponent(tableId);
    
    // Check if table data exists
    const dataPath = path.join(TABLES_DIR, `${decodedTableId}.json`);
    const stylePath = path.join(TABLES_DIR, `${decodedTableId}_style.json`);
    
    if (!fs.existsSync(dataPath) || !fs.existsSync(stylePath)) {
      console.error(`Table data not found for ${decodedTableId}`);
      
      return `<div class="table-error">Table data not found</div>`;
    }
    
    // Read table data
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const style = JSON.parse(fs.readFileSync(stylePath, 'utf8'));
        
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
    
    return tableHtml;
  } catch (error) {
    console.error(`Error converting table to HTML:`, error);
    return `<div class="table-error">Error loading table</div>`;
  }
}

// Replace all table iframes in HTML content with actual tables
export async function POST(request) {
  try {   
    // Ensure data directory exists
    ensureDataDirectory();
    
    const { html } = await request.json();
    
    if (!html) {
      console.error("No HTML content provided");
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
        
    // Replace each table iframe with HTML
    for (const tableId of tableIds) {
      // Convert the table to HTML
      const tableHtml = await tableJsonToHtml(tableId);
      
      if (tableHtml.includes("Table data not found")) {
        console.error(`Could not generate HTML for table ${tableId}`);
      }
      
      // Create a regex pattern that matches the entire container with this table ID
      const pattern = `<div[^>]*class="table-container"[^>]*>[\\s\\S]*?<iframe[^>]*data-table-id="${tableId}"[^>]*>[\\s\\S]*?<\\/iframe>[\\s\\S]*?<\\/div>`;
      const regex = new RegExp(pattern, 'g');
      
      // Replace the iframe container with the table HTML
      const beforeLength = htmlContent.length;
      htmlContent = htmlContent.replace(regex, tableHtml);
      const afterLength = htmlContent.length;
      
      if (beforeLength === afterLength) {
        console.error(`Failed to replace iframe for table ${tableId}`);
      }
    }
    
    return NextResponse.json({ html: htmlContent });
  } catch (error) {
    console.error('Error exporting tables:', error);
    return NextResponse.json({ error: 'Failed to process tables' }, { status: 500 });
  }
} 