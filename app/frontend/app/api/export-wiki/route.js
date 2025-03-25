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
      // Log critical error but remove excessive debug logs
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

// Convert iframe table to HTML
async function processHtmlTables(html) {
  try {
    // Use regex to find all table containers and their tableIds
    const tableContainerRegex = /<div[^>]*class="table-container"[^>]*>[\s\S]*?<iframe[^>]*data-table-id="([^"]+)"[^>]*>[\s\S]*?<\/iframe>[\s\S]*?<\/div>/g;
    let match;
    let processedHtml = html;
    
    while ((match = tableContainerRegex.exec(html)) !== null) {
      const fullMatch = match[0]; // The entire table container
      const tableId = match[1];   // The table ID
      
      if (!tableId) continue;
      
      // Convert table to HTML
      const tableHtml = await tableJsonToHtml(tableId);
      
      // Replace the container with the table HTML
      processedHtml = processedHtml.replace(fullMatch, tableHtml);
    }
    
    return processedHtml;
  } catch (error) {
    console.error('Error processing HTML tables:', error);
    return html; // Return original HTML if processing fails
  }
}

export async function POST(request) {
  try {
    // Ensure data directory exists
    ensureDataDirectory();
    
    const { html } = await request.json();
    
    if (!html) {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
    }
    
    // Process all tables in the HTML
    const processedHtml = await processHtmlTables(html);
    
    return NextResponse.json({ html: processedHtml });
  } catch (error) {
    console.error('Error exporting wiki:', error);
    return NextResponse.json({ error: 'Failed to process wiki HTML' }, { status: 500 });
  }
} 