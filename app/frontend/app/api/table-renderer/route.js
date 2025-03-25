import { NextResponse } from 'next/server';

export async function GET(request) {
  // Get the table ID from the URL search params
  const { searchParams } = new URL(request.url);
  const tableId = searchParams.get('tableId');
  
  if (!tableId) {
    return NextResponse.json({ error: 'Table ID is required' }, { status: 400 });
  }
  
  try {
    // Fetch table data from storage
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || `${protocol}://${host}`;
    
    const response = await fetch(`${baseUrl}/api/tables/${tableId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch table data: ${response.status}`);
    }
    
    const { data, style } = await response.json();
    
    // Generate HTML
    const html = generateTableHTML(data, style);
    
    // Send HTML response
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error rendering table:', error);
    return NextResponse.json({ error: 'Failed to render table' }, { status: 500 });
  }
}

function generateTableHTML(data, style) {
  // Helper to convert style object to string
  const styleToString = (styleObj) => {
    return Object.entries(styleObj || {})
      .map(([key, value]) => {
        // Convert camelCase to kebab-case
        const kebabKey = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
        return `${kebabKey}: ${value}`;
      })
      .join('; ');
  };
  
  // Generate table rows HTML
  const generateTableRows = () => {
    let rowsHtml = '';
    
    // Generate header if needed
    if (data.hasHeader) {
      rowsHtml += '<thead><tr>';
      for (let col = 0; col < data.columns; col++) {
        const cell = data.cells.find(c => c.row === 0 && c.col === col);
        rowsHtml += `<th style="${styleToString(style.headerStyles)}">${cell?.content || ''}</th>`;
      }
      rowsHtml += '</tr></thead>';
    }
    
    // Generate body rows
    rowsHtml += '<tbody>';
    const startRow = data.hasHeader ? 1 : 0;
    for (let row = startRow; row < data.rows; row++) {
      rowsHtml += '<tr>';
      for (let col = 0; col < data.columns; col++) {
        const cell = data.cells.find(c => c.row === row && c.col === col);
        rowsHtml += `<td style="${styleToString(style.cellStyles)}">${cell?.content || ''}</td>`;
      }
      rowsHtml += '</tr>';
    }
    rowsHtml += '</tbody>';
    
    return rowsHtml;
  };
  
  // Generate complete HTML page for iframe
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .table-wrapper { padding: 4px; }
      </style>
    </head>
    <body>
      <div class="table-wrapper">
        <table style="${styleToString(style.tableStyles)}">
          ${generateTableRows()}
        </table>
      </div>
      <script>
        // Script to resize iframe height based on content
        function resizeIframe() {
          const height = document.body.scrollHeight;
          window.parent.postMessage({ type: 'resize', height, tableId: '${data.id}' }, '*');
        }
        
        window.onload = resizeIframe;
        window.onresize = resizeIframe;
      </script>
    </body>
    </html>
  `;
} 