import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

// Table data directory - use absolute path
const DATA_DIR = path.resolve(process.cwd(), 'data', 'tables');

// Make sure the data directory exists
function ensureDataDirectory() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (error) {
    console.error(`Error creating tables directory: ${error.message}`);
  }
}

// GET handler for retrieving table data
export async function GET(request, { params }) {
  const tableId = params.tableId;
  
  // Ensure data directory exists
  ensureDataDirectory();
  
  try {
    // Decode the table ID from URL encoding
    const decodedTableId = decodeURIComponent(tableId);
    
    const dataPath = path.join(DATA_DIR, `${decodedTableId}.json`);
    const stylePath = path.join(DATA_DIR, `${decodedTableId}_style.json`);
    
    
    if (!fs.existsSync(dataPath) || !fs.existsSync(stylePath)) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }
    
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const style = JSON.parse(fs.readFileSync(stylePath, 'utf8'));
    
    return NextResponse.json({ data, style });
  } catch (error) {
    console.error('Error retrieving table data:', error);
    return NextResponse.json({ error: 'Failed to retrieve table data' }, { status: 500 });
  }
}

// POST handler for saving table data
export async function POST(request, { params }) {
  const tableId = params.tableId;
  
  // Ensure data directory exists
  ensureDataDirectory();
  
  try {
    // Decode the table ID from URL encoding
    const decodedTableId = decodeURIComponent(tableId);
    
    const { data, style } = await request.json();
    
    // Validate input
    if (!data || !style) {
      return NextResponse.json({ error: 'Both data and style are required' }, { status: 400 });
    }
    
    // Write data to files
    const dataPath = path.join(DATA_DIR, `${decodedTableId}.json`);
    const stylePath = path.join(DATA_DIR, `${decodedTableId}_style.json`);
    
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    fs.writeFileSync(stylePath, JSON.stringify(style, null, 2));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving table data:', error);
    return NextResponse.json({ error: 'Failed to save table data' }, { status: 500 });
  }
} 