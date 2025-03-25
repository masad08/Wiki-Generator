function ensureDataDirectory() {
  try {
    if (!fs.existsSync(TABLES_DIR)) {
      fs.mkdirSync(TABLES_DIR, { recursive: true });
    }
  } catch (error) {
    console.error(`Error creating tables directory: ${error.message}`);
  }
}

if (!fs.existsSync(dataPath) || !fs.existsSync(stylePath)) {
  // Essential error logging
  console.error(`Table data not found for ${decodedTableId}`);
  
  // Remove debug logging statements
  return `<div class="table-error">Table data not found</div>`;
} 