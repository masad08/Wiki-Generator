import { Request, Response } from 'express';
import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';

// Path to wikis directory
const wikisDir = path.join(__dirname, '../../../..', 'created_wikis');

// Add these interfaces at the top of the file
interface WikiPage {
  id: string;
  title: string;
  content: string;
  parentId: string | null;
  children: string[];
  tags: string[];
  createdAt: string;
  modifiedAt: string;
  author?: string;
  order: number;
}

interface Wiki {
  name: string;
  pages: { [key: string]: WikiPage };
  tags: Set<string>;
  createdAt: string;
  modifiedAt: string;
  defaultAuthor?: string;
}

// Interface for table data
interface TableInfo {
  data: any;
  style: any;
}

// Default CSS template
const defaultCss = `
:root {
    --primary-color: #2563eb;
    --primary-hover: #1d4ed8;
    --sidebar-bg: #1f2937;
    --sidebar-hover: #374151;
    --text-primary: #111827;
    --text-secondary: #4b5563;
    --bg-primary: #ffffff;
    --bg-secondary: #f9fafb;
}

body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    margin: 0;
    padding: 0;
    line-height: 1.5;
    font-size: 14px;
}

.sidebar {
    width: 180px;
    background-color: var(--sidebar-bg);
    color: #fff;
    padding: 1.25rem;
    position: fixed;
    height: 100vh;
    overflow-y: auto;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
}

.sidebar-title {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 1.5rem;
    text-align: center;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-nav {
    list-style: none;
    padding: 0;
    margin: 0;
}

.sidebar-nav li {
    margin-bottom: 0.5rem;
}

.sidebar-nav a {
    color: rgba(255, 255, 255, 0.9);
    text-decoration: none;
    display: block;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    transition: all 0.2s ease;
    font-size: 0.875rem;
}

.sidebar-nav a:hover {
    background-color: var(--sidebar-hover);
    color: #fff;
    transform: translateX(4px);
}

.sidebar-nav a.active {
    background-color: var(--primary-color);
    color: white;
    transform: translateX(4px);
    font-weight: 500;
}

.main-content {
    margin-left: 230px; /* Adjusted to account for sidebar width + padding */
    padding: 2rem 4rem;
    max-width: 900px;
    background-color: var(--bg-primary);
    min-height: 100vh;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.05);
    display: flex;          /* Enable flex layout */
    flex-direction: column; /* Stack children vertically */
    overflow: hidden;       /* Prevent overall overflow */
}

/* Content wrapper for scrollable content */
.content-wrapper {
    flex: 1;               /* Take all available space */
    overflow-y: auto;      /* Add vertical scrollbar when needed */
    padding-bottom: 1rem;  /* Space before footer */
}

h1, h2, h3, h4, h5, h6 {
    color: var(--text-primary);
    font-weight: 600;
    line-height: 1.3;
    margin: 1.5rem 0 1rem;
}

h1 {
    font-size: 2rem;
    margin-top: 0;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid var(--bg-secondary);
}

h2 {
    font-size: 1.5rem;
}

h3 {
    font-size: 1.25rem;
}

p {
    margin: 1rem 0;
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.6;
}

a {
    color: var(--primary-color);
    text-decoration: none;
    transition: color 0.2s ease;
}

a:hover {
    color: var(--primary-hover);
    text-decoration: underline;
}

table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin: 2rem 0;
    border-radius: 0.5rem;
    overflow: hidden;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}

th, td {
    padding: 1rem;
    text-align: left;
    border-bottom: 1px solid var(--bg-secondary);
}

th {
    background-color: var(--bg-secondary);
    font-weight: 600;
    color: var(--text-secondary);
}

tr:last-child td {
    border-bottom: none;
}

tr:hover {
    background-color: var(--bg-secondary);
}

code {
    background-color: var(--bg-secondary);
    padding: 0.2rem 0.4rem;
    border-radius: 0.25rem;
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 0.9em;
}

pre {
    background-color: var(--bg-secondary);
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin: 1.5rem 0;
}

blockquote {
    margin: 1.5rem 0;
    padding: 1rem 1.5rem;
    border-left: 4px solid var(--primary-color);
    background-color: var(--bg-secondary);
    border-radius: 0 0.5rem 0.5rem 0;
}

ul, ol {
    padding-left: 1.5rem;
    margin: 1rem 0;
    color: var(--text-secondary);
}

li {
    margin: 0.5rem 0;
}

hr {
    border: none;
    border-top: 2px solid var(--bg-secondary);
    margin: 2rem 0;
}

img {
    max-width: 100%;
    height: auto;
    border-radius: 0.5rem;
    margin: 1.5rem 0;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
    :root {
        --primary-color: #3b82f6;
        --primary-hover: #60a5fa;
        --sidebar-bg: #111827;
        --sidebar-hover: #1f2937;
        --text-primary: #f9fafb;
        --text-secondary: #d1d5db;
        --bg-primary: #1f2937;
        --bg-secondary: #111827;
    }

    .main-content {
        box-shadow: 0 0 20px rgba(0, 0, 0, 0.2);
    }

    table {
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
    }

    code {
        background-color: rgba(0, 0, 0, 0.2);
    }
}

/* Print styles */
@media print {
    .sidebar {
        display: none;
    }

    .main-content {
        margin-left: 0;
        box-shadow: none;
    }

    a {
        color: var(--text-primary);
        text-decoration: underline;
    }
}

.sidebar-controls {
    padding: 1rem 0;
    text-align: center;
}

.add-page-btn {
    background: var(--primary-color);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.875rem;
    transition: background-color 0.2s;
}

.add-page-btn:hover {
    background: var(--primary-hover);
}

.nested-nav {
    list-style: none;
    padding-left: 1rem;
    margin: 0.25rem 0;
}

.page-link {
    position: relative;
}

.page-link::before {
    content: '';
    position: absolute;
    left: -1rem;
    top: 0;
    bottom: 0;
    width: 2px;
    background: rgba(255, 255, 255, 0.1);
}

.wiki-tags {
    margin-top: 2rem;
    padding: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.tags-cloud {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.tag {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
}

/* Add styles for sidebar tags specifically */
.sidebar .tag {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
}

/* Page tags should use theme colors */
.page-tags .tag {
    background: var(--bg-secondary);
    color: var(--text-secondary);
}

.page-header {
    margin-bottom: 2rem;
}

.page-metadata {
    margin-top: 1rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
}

.page-tags {
    margin-bottom: 0.5rem;
}

.page-info {
    font-style: italic;
}

/* Hide all wiki pages by default */
.wiki-page {
    display: none;
}

.wiki-page {
    display: none;         /* Hidden by default, shown via JS */
    max-width: 100%;       /* Prevent horizontal overflow */
}

/* Improved image handling to prevent overflow */
.wiki-page img {
    max-width: 100%;
    height: auto;
}

/* Handle tables to prevent overflow */
.wiki-page table {
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    display: block;
}

.wiki-footer {
    margin-top: auto;      /* Push to bottom of flex container */
    padding-top: 1rem;
    padding-bottom: 1rem;
    border-top: 1px solid var(--bg-secondary);
    color: var(--text-secondary); /* Same as logging text */
    font-size: 0.875rem;
    text-align: center;
    flex-shrink: 0;        /* Prevent footer from shrinking */
}

.wiki-wrapper {
  display: flex;
  max-width: 1200px; /* adjust this width as needed */
  margin-left: auto;
  margin-right: auto;
  width: 100%;
}

.wiki-tags h3 {
  color: #fff;
  font-size: 1rem;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}
`;

// Create a new wiki
export const createWiki = async (req: Request, res: Response) => {
  try {
    const { wikiName, defaultAuthor } = req.body;
    
    if (!wikiName) {
      return res.status(400).json({ error: 'Wiki name is required' });
    }
    
    // Create wiki directory
    const wikiDir = path.join(wikisDir, wikiName);
    
    // Check if wiki already exists
    if (await fs.pathExists(wikiDir)) {
      return res.status(400).json({ error: 'Wiki with this name already exists' });
    }
    
    // Create directory structure
    await fs.ensureDir(wikiDir);
    await fs.ensureDir(path.join(wikiDir, 'images'));
    
    // Create initial page
    const initialPage: WikiPage = {
      id: 'introduction',
      title: 'Introduction',
      content: 'Welcome to your new wiki! Edit this content to get started.',
      parentId: null,
      children: [],
      tags: [],
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      author: defaultAuthor || undefined, // Use defaultAuthor if provided, otherwise undefined
      order: 0
    };
    
    // Create wiki structure with initial page
    const wiki: Wiki = {
      name: wikiName,
      pages: { 'introduction': initialPage },
      tags: new Set([]),
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      defaultAuthor
    };
    
    // Save wiki structure to a JSON file
    await fs.writeFile(
      path.join(wikiDir, 'wiki-data.json'), 
      JSON.stringify({
        ...wiki,
        tags: Array.from(wiki.tags)
      }, null, 2)
    );
    
    // Create the HTML file with embedded wiki data
    const htmlContent = generateWikiTemplate(wiki);
    await fs.writeFile(path.join(wikiDir, 'index.html'), htmlContent);
    
    // Create CSS file
    await fs.writeFile(path.join(wikiDir, 'styles.css'), defaultCss);
    
    // Return success
    res.status(201).json({
      message: 'Wiki created successfully',
      wiki: {
        name: wikiName,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error creating wiki:', error);
    res.status(500).json({ error: 'Failed to create wiki' });
  }
};

// HTML template for a new wiki that uses the Wiki data structure
const generateWikiTemplate = (wiki: Wiki): string => {
  const wikiName = wiki.name;
  
  // Helper to convert style object to CSS string
  const styleToString = (styleObj: any): string => {
    return Object.entries(styleObj || {})
      .map(([key, value]) => {
        // Convert camelCase to kebab-case
        const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `${kebabKey}: ${value}`;
      })
      .join('; ');
  };

  // Helper to replace table placeholders with actual tables
  const processTablePlaceholders = (content: string, wikiName: string): string => {
    // Find all table placeholders with regex
    const tableRegex = /<div class="table-error">Table data not found<\/div>/g;
    const tableIdRegex = /data-table-id="([^"]+)"/g;
    
    // Replace each placeholder with actual table HTML if data exists
    return content.replace(tableRegex, (match) => {
      // Try to extract table ID from nearby context (within 200 characters before the placeholder)
      const contextBefore = content.substring(
        Math.max(0, content.indexOf(match) - 200),
        content.indexOf(match)
      );
      
      const idMatch = tableIdRegex.exec(contextBefore);
      if (!idMatch) return match; // Keep original if no ID found
      
      const tableId = idMatch[1];
      const tablesDir = path.join(wikisDir, wikiName, 'tables');
      const dataPath = path.join(tablesDir, `${tableId}.json`);
      const stylePath = path.join(tablesDir, `${tableId}_style.json`);
      
      // Check if table data exists
      if (!fs.existsSync(dataPath) || !fs.existsSync(stylePath)) {
        return match; // Keep original if files don't exist
      }
      
      try {
        // Read table data
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        const style = JSON.parse(fs.readFileSync(stylePath, 'utf8'));
        
        // Generate HTML table
        let tableHtml = `<table class="wiki-table" data-table-id="${tableId}" style="${styleToString(style.tableStyles)}">`;
        
        // Add header if present
        if (data.hasHeader) {
          tableHtml += '<thead><tr>';
          for (let col = 0; col < data.columns; col++) {
            const cell = data.cells.find((c: any) => c.row === 0 && c.col === col);
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
            const cell = data.cells.find((c: any) => c.row === row && c.col === col);
            tableHtml += `<td style="${styleToString(style.cellStyles)}">${cell?.content || ''}</td>`;
          }
          tableHtml += '</tr>';
        }
        tableHtml += '</tbody></table>';
        
        return tableHtml;
      } catch (error) {
        console.error(`Error generating table HTML for ${tableId}:`, error);
        return match; // Keep original on error
      }
    });
  };

  const generateSidebarNav = (pages: { [key: string]: WikiPage }): string => {
    const rootPages = Object.values(pages).filter(page => !page.parentId);
    
    const generatePageLink = (page: WikiPage): string => {
      const childrenHtml = page.children.length > 0
        ? `<ul class="nested-nav">
            ${page.children
              .map(childId => pages[childId])
              .sort((a, b) => a.order - b.order)
              .map(child => `<li>${generatePageLink(child)}</li>`)
              .join('')}
           </ul>`
        : '';

      return `
        <div class="page-link">
          <a href="#${page.id}" data-page-id="${page.id}">
            ${page.title}
          </a>
          ${childrenHtml}
        </div>`;
    };

    return rootPages
      .sort((a, b) => a.order - b.order)
      .map(page => `<li>${generatePageLink(page)}</li>`)
      .join('');
  };

  const generateTagsSection = (tags: Set<string>): string => {
    return `
      <div class="wiki-tags">
        <h3>Tags</h3>
        <div class="tags-cloud">
          ${Array.from(tags)
            .map(tag => `<span class="tag">${tag}</span>`)
            .join('')}
        </div>
      </div>`;
  };

  const generatePageContent = (pages: { [key: string]: WikiPage }): string => {
    return Object.values(pages)
      .map(page => `
        <div id="${page.id}" class="wiki-page">
          <div class="page-header">
            <h1>${page.title}</h1>
            <div class="page-metadata">
              <div class="page-tags">
                ${page.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
              </div>
              <div class="page-info">
                Created: ${new Date(page.createdAt).toLocaleDateString()}
                | Last modified: ${new Date(page.modifiedAt).toLocaleDateString()}
                ${page.author ? `| Author: ${page.author}` : ''}
              </div>
            </div>
          </div>
          <div class="page-content">
            ${processTablePlaceholders(page.content, wikiName)}
          </div>
        </div>
      `)
      .join('\n');
  };

  // Prepare the wiki data for serialization
  const serializableWiki = {
    ...wiki,
    tags: Array.from(wiki.tags)
  };

  // Create properly formatted JSON for the script tag
  const wikiDataJson = JSON.stringify(serializableWiki);

return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${wikiName}</title>
    <style>
      ${defaultCss}
      body {
        background-color: white;
        margin: 0;
        padding: 0;
        display: flex;
        justify-content: center;
      }
      
      .sidebar {
        position: static;
        width: 250px;
        height: 100vh;
        overflow-y: auto;
        flex-shrink: 0;
        background-color: var(--sidebar-bg);
        color: #fff;
      }
      
      .sidebar-title {
        font-size: 1.1rem;
        font-weight: 600;
        margin-bottom: 1rem;
        text-align: center;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        color: #fff;
      }
      
      .sidebar-nav a {
        color: rgba(255, 255, 255, 0.9);
      }
      
      .sidebar-nav a:hover {
        background-color: var(--sidebar-hover);
        color: #fff;
      }
      
      .sidebar-nav a.active {
        background-color: var(--primary-color);
        color: white;
      }
      
      .main-content {
        width: 950px;
        margin-left: 0 !important; /* Override the default margin */
        flex-grow: 1;
        background-color: var(--bg-primary);
        color: var(--text-primary);
      }
      
      .wiki-wrapper {
        display: flex;
        max-width: 1200px;
        margin-left: auto;
        margin-right: auto;
        width: 100%;
      }
    </style>
    <script>
      window.wikiData = ${wikiDataJson};
    </script>
</head>
<body>
<div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -1000; background-color: white;"></div>
<div class="wiki-wrapper">    
<div class="sidebar">
        <div class="sidebar-title">${wikiName}</div>
        <ul class="sidebar-nav">
            ${generateSidebarNav(wiki.pages)}
        </ul>
        ${generateTagsSection(wiki.tags)}
    </div>
    <div class="main-content">
        <div class="content-wrapper">
            ${generatePageContent(wiki.pages)}
        </div>
        <footer class="wiki-footer">
            ${wiki.name} © ${new Date().getFullYear()}
        </footer>
    </div>
</div>
    <script>
      // Page navigation functionality
      document.addEventListener('DOMContentLoaded', function() {
        // Get all page elements
        const pages = document.querySelectorAll('.wiki-page');
        // Get all nav links
        const navLinks = document.querySelectorAll('.sidebar-nav a');
        
        // Function to show a specific page
        function showPage(pageId) {
          // Hide all pages
          pages.forEach(page => {
            page.style.display = 'none';
          });
          
          // Show the selected page
          const selectedPage = document.getElementById(pageId);
          if (selectedPage) {
            selectedPage.style.display = 'block';
          }
          
          // Update active state in sidebar
          navLinks.forEach(link => {
            if (link.getAttribute('href') === '#' + pageId) {
              link.classList.add('active');
            } else {
              link.classList.remove('active');
            }
          });
          
          // Store current page in session storage
          sessionStorage.setItem('currentPage', pageId);
        }
        
        // Add click handlers to all nav links
        navLinks.forEach(link => {
          link.addEventListener('click', function(e) {
            const pageId = this.getAttribute('href').substring(1);
            showPage(pageId);
          });
        });
        
        // Show the page from URL hash, stored page, or first page
        const hash = window.location.hash.substring(1);
        const storedPage = sessionStorage.getItem('currentPage');
        
        if (hash && document.getElementById(hash)) {
          showPage(hash);
        } else if (storedPage && document.getElementById(storedPage)) {
          showPage(storedPage);
        } else if (pages.length > 0) {
          // Show first page by default
          const firstPageId = pages[0].id;
          showPage(firstPageId);
        }
      });
    </script>
</body>
</html>`;
};

// Get all wikis
export const getWikis = async (req: Request, res: Response) => {
  try {
    // Read all directories in the wikis folder
    const directories = await fs.readdir(wikisDir);
    
    // Get stats for each directory
    const wikis = await Promise.all(
      directories.map(async (dir) => {
        const stats = await fs.stat(path.join(wikisDir, dir));
        return {
          name: dir,
          createdAt: stats.birthtime.toISOString()
        };
      })
    );
    
    // Sort by creation date (newest first)
    wikis.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    res.json(wikis);
  } catch (error) {
    console.error('Error fetching wikis:', error);
    res.status(500).json({ error: 'Failed to fetch wikis' });
  }
};

// Get a specific wiki
export const getWiki = async (req: Request, res: Response) => {
  try {
    const wikiName = decodeURIComponent(req.params.wikiName);
    const wikiDir = path.join(wikisDir, wikiName);
    const wikiHtmlPath = path.join(wikiDir, 'index.html');
        
    // Check if wiki exists
    if (!await fs.pathExists(wikiDir)) {
      console.error(`Wiki directory not found: ${wikiDir}`);
      return res.status(404).json({ error: 'Wiki not found' });
    }
    
    // Check if HTML file exists
    if (!await fs.pathExists(wikiHtmlPath)) {
      console.error(`Wiki HTML file not found: ${wikiHtmlPath}`);
      return res.status(404).json({ error: 'Wiki HTML not found' });
    }
    
    // Read the HTML content
    let content = await fs.readFile(wikiHtmlPath, 'utf-8');
    
    // Process table placeholders in the HTML
    if (content.includes('Table data not found')) {
      
      // Check if tables directory exists
      const tablesDir = path.join(wikiDir, 'tables');
      if (await fs.pathExists(tablesDir)) {
        // List all files in the tables directory
        try {
          await fs.readdir(tablesDir);
        } catch (err) {
          console.error(`Error reading tables directory:`, err);
        }
        
        // Find all table IDs in content
        const tableIdRegex = /data-table-id="([^"]+)"/g;
        const tableIds: string[] = [];
        let match;
        while ((match = tableIdRegex.exec(content)) !== null) {
          const tableId = match[1];
          tableIds.push(tableId);
        }
        
        // Find all table placeholders
        const tablePlaceholders = content.match(/<div class="table-error">Table data not found<\/div>/g);
      
        // Process each table
        for (const tableId of tableIds) {
          // Decode the table ID from URL encoding
          const decodedTableId = decodeURIComponent(tableId);
          
          const dataPath = path.join(tablesDir, `${decodedTableId}.json`);
          const stylePath = path.join(tablesDir, `${decodedTableId}_style.json`);
          
          
          if (await fs.pathExists(dataPath) && await fs.pathExists(stylePath)) {
            try {
              // Read table data
              const data = JSON.parse(await fs.readFile(dataPath, 'utf8'));
              const style = JSON.parse(await fs.readFile(stylePath, 'utf8'));
              
              // Create a regex pattern that looks for both the table container and the error message
              const tableErrorPattern = new RegExp(`<div[^>]*data-table-id="${decodedTableId}"[^>]*>[\\s\\S]*?<div class="table-error">Table data not found<\\/div>[\\s\\S]*?<\\/div>|<div class="table-error">Table data not found<\\/div>`, 'g');
                            
              // Helper to convert style object to CSS string
              const styleToString = (styleObj: any): string => {
                return Object.entries(styleObj || {})
                  .map(([key, value]) => {
                    // Convert camelCase to kebab-case
                    const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
                    return `${kebabKey}: ${value}`;
                  })
                  .join('; ');
              };
              
              // Generate HTML table
              let tableHtml = `<table class="wiki-table" data-table-id="${decodedTableId}" style="${styleToString(style.tableStyles)}">`;
              
              // Add header if present
              if (data.hasHeader) {
                tableHtml += '<thead><tr>';
                for (let col = 0; col < data.columns; col++) {
                  const cell = data.cells.find((c: any) => c.row === 0 && c.col === col);
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
                  const cell = data.cells.find((c: any) => c.row === row && c.col === col);
                  tableHtml += `<td style="${styleToString(style.cellStyles)}">${cell?.content || ''}</td>`;
                }
                tableHtml += '</tr>';
              }
              tableHtml += '</tbody></table>';
              
              // Make a copy of the content to check if replacement occurs
              const contentBefore = content;
              content = content.replace(tableErrorPattern, tableHtml);
              
              if (contentBefore === content) {
                console.error(`Failed to replace placeholder for table ${decodedTableId}`);
              }
            } catch (error) {
              console.error(`Error processing table ${decodedTableId}:`, error);
            }
          } else {
            console.error(`Table data or style file not found for ${decodedTableId}`);
          }
        }
      } else {
        console.error(`Tables directory not found: ${tablesDir}`);
      }
    }
    
    res.send(content);
  } catch (error) {
    console.error('Error fetching wiki:', error);
    res.status(500).json({ error: 'Failed to fetch wiki' });
  }
};

// Update wiki content
export const updateWiki = async (req: Request, res: Response) => {
  try {
    const wikiName = decodeURIComponent(req.params.wikiName);
    const { content, cssTheme, wikiData, tableData } = req.body;
    
    const wikiDir = path.join(wikisDir, wikiName);
    const wikiDataPath = path.join(wikiDir, 'wiki-data.json');
    
    // Check if wiki exists
    if (!await fs.pathExists(wikiDir)) {
      console.error(`Wiki directory not found: ${wikiDir}`);
      return res.status(404).json({ error: 'Wiki not found' });
    }
    
    // Update HTML content
    if (content) {
      await fs.writeFile(path.join(wikiDir, 'index.html'), content);
    }
    
    // Update wiki data if provided
    if (wikiData) {
      await fs.writeFile(wikiDataPath, JSON.stringify(wikiData, null, 2));
    }
    
    // Update CSS if provided
    if (cssTheme) {
      await fs.writeFile(path.join(wikiDir, 'styles.css'), cssTheme);
    }
    
    // Save table data if provided
    if (tableData && Object.keys(tableData).length > 0) {
      // Create tables directory if it doesn't exist
      const tablesDir = path.join(wikiDir, 'tables');
      await fs.ensureDir(tablesDir);
      
      // Save each table's data and style
      for (const [tableId, tableInfo] of Object.entries(tableData as Record<string, TableInfo>)) {
        const { data, style } = tableInfo;
        
        if (data && style) {
          // Decode the table ID from URL encoding
          const decodedTableId = decodeURIComponent(tableId);
          
          const dataPath = path.join(tablesDir, `${decodedTableId}.json`);
          const stylePath = path.join(tablesDir, `${decodedTableId}_style.json`);
          
          // Save data and style files
          await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
          await fs.writeFile(stylePath, JSON.stringify(style, null, 2));
        } else {
          console.error(`Missing data or style for table ${tableId}`);
        }
      }
      
      // Verify all tables were saved
      try {
        await fs.readdir(tablesDir);
      } catch (err) {
        console.error(`Error reading tables directory after save:`, err);
      }
    }
    
    res.json({ message: 'Wiki updated successfully' });
  } catch (error) {
    console.error('Error updating wiki:', error);
    res.status(500).json({ error: 'Failed to update wiki' });
  }
};

// Delete a wiki
export const deleteWiki = async (req: Request, res: Response) => {
  try {
    const wikiName = decodeURIComponent(req.params.wikiName);
    const wikiDir = path.join(wikisDir, wikiName);
    
    // Check if wiki exists
    if (!await fs.pathExists(wikiDir)) {
      return res.status(404).json({ error: 'Wiki not found' });
    }
    
    // Delete wiki directory and all contents
    await fs.remove(wikiDir);
    
    res.json({ message: 'Wiki deleted successfully' });
  } catch (error) {
    console.error('Error deleting wiki:', error);
    res.status(500).json({ error: 'Failed to delete wiki' });
  }
};

// Export wiki as a ZIP file
export const exportWiki = async (req: Request, res: Response) => {
  try {
    const wikiName = decodeURIComponent(req.params.wikiName);
    const wikiDir = path.join(wikisDir, wikiName);
    
    // Check if wiki exists
    if (!await fs.pathExists(wikiDir)) {
      return res.status(404).json({ error: 'Wiki not found' });
    }
    
    // Create a temporary directory
    const tempDir = path.join(wikisDir, `${wikiName}_temp_export_${Date.now()}`);
    await fs.ensureDir(tempDir);
    
    try {
      // Copy all wiki files to temp directory
      await fs.copy(wikiDir, tempDir);
      
      // Modify only the HTML file in the temp directory to fix image paths
      const tempHtmlPath = path.join(tempDir, 'index.html');
      if (await fs.pathExists(tempHtmlPath)) {
        let htmlContent = await fs.readFile(tempHtmlPath, 'utf8');
        
        // Fix image paths to be relative
        htmlContent = htmlContent.replace(
          /src=["'](https?:\/\/[^\/]+)?\/api\/wiki\/[^\/]+\/images\/([^"']+)["']/g,
          'src="images/$2"'
        );
        
        await fs.writeFile(tempHtmlPath, htmlContent, 'utf8');
      }
      
      // Create zip from the temp directory
      const zipPath = path.join(wikisDir, `${wikiName}.zip`);
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      archive.pipe(output);
      archive.directory(tempDir, wikiName);
      await archive.finalize();
      
      // When zip is done
      output.on('close', async () => {
        // Clean up temp directory
        await fs.remove(tempDir);
        
        // Download the zip
        res.download(zipPath, `${wikiName}.zip`, (err) => {
          if (err) {
            console.error('Error downloading zip:', err);
            return res.status(500).json({ error: 'Failed to download wiki export' });
          }
          
          // Clean up zip after download
          fs.remove(zipPath).catch(err => console.error('Error deleting zip file:', err));
        });
      });
    } catch (error) {
      // Clean up temp directory on error
      await fs.remove(tempDir);
      throw error;
    }
  } catch (error) {
    console.error('Error exporting wiki:', error);
    res.status(500).json({ error: 'Failed to export wiki' });
  }
};

// Export wiki as a single HTML file
export const exportWikiSingleHtml = async (req: Request, res: Response) => {
  try {
    const wikiName = decodeURIComponent(req.params.wikiName);
    const wikiDir = path.join(wikisDir, wikiName);
    
    // Check if wiki exists
    if (!await fs.pathExists(wikiDir)) {
      return res.status(404).json({ error: 'Wiki not found' });
    }
    
    // Read the required wiki files
    const htmlPath = path.join(wikiDir, 'index.html');
    const cssPath = path.join(wikiDir, 'styles.css');
    const jsonPath = path.join(wikiDir, 'wiki-data.json');
    const imagesDir = path.join(wikiDir, 'images');
    
    if (!(await fs.pathExists(htmlPath)) || 
        !(await fs.pathExists(cssPath)) || 
        !(await fs.pathExists(jsonPath))) {
      return res.status(404).json({ error: 'Required wiki files not found' });
    }
    
    // Read the file contents
    const htmlContent = await fs.readFile(htmlPath, 'utf8');
    const cssContent = await fs.readFile(cssPath, 'utf8');
    const jsonContent = await fs.readFile(jsonPath, 'utf8');
    
    // Parse wiki data
    const wikiData = JSON.parse(jsonContent);
    
    // Create a single HTML with embedded CSS and JS
    const singleHtmlContent = generateSingleHtmlExport(htmlContent, cssContent, wikiData);
    
    // Create temporary file for the single HTML
    const singleHtmlPath = path.join(wikisDir, `${wikiName}_single.html`);
    await fs.writeFile(singleHtmlPath, singleHtmlContent, 'utf8');
    
    // Create a zip archive for the single HTML and images
    const zipPath = path.join(wikisDir, `${wikiName}_single.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    // Pipe archive to output file
    archive.pipe(output);
    
    // Add the single HTML file to the archive
    archive.file(singleHtmlPath, { name: `${wikiName}.html` });
    
    // Add images directory if it exists
    if (await fs.pathExists(imagesDir)) {
      archive.directory(imagesDir, 'images');
    }
    
    // Finalize archive
    await archive.finalize();
    
    // Wait for the output stream to finish
    output.on('close', () => {
      // Set headers for file download
      res.download(zipPath, `${wikiName}_single_html.zip`, (err) => {
        if (err) {
          console.error('Error downloading single HTML zip:', err);
          return res.status(500).json({ error: 'Failed to download single HTML export' });
        }
        // Clean up the zip and single HTML files after download
        fs.remove(zipPath).catch(err => console.error('Error deleting zip file:', err));
        fs.remove(singleHtmlPath).catch(err => console.error('Error deleting single HTML file:', err));
      });
    });
  } catch (error) {
    console.error('Error exporting wiki as single HTML:', error);
    res.status(500).json({ error: 'Failed to export wiki as single HTML' });
  }
};

// Helper function to generate a single HTML file with embedded CSS and JS
const generateSingleHtmlExport = (html: string, css: string, wikiData: any): string => {
  try {
    // Process the HTML to embed CSS and JS
    let singleHtml = html;
    
    // Replace external CSS link with embedded CSS
    singleHtml = singleHtml.replace(
      /<link[^>]*href=["'][^"']*\.css["'][^>]*>/i,
      `<style>\n${css}\n</style>`
    );
    
    // Replace external script with embedded script
    singleHtml = singleHtml.replace(
      /<script[^>]*src=["'][^"']*\.js["'][^>]*><\/script>/i,
      ''
    );
    
    // Ensure the wiki data is embedded
    if (!singleHtml.includes('window.wikiData')) {
      // Add wiki data script before closing body tag
      const wikiDataScript = `<script>window.wikiData = ${JSON.stringify(wikiData)};</script>`;
      singleHtml = singleHtml.replace('</body>', `${wikiDataScript}\n</body>`);
    }
    
    // Fix image paths for local usage - the key fix we need
    singleHtml = singleHtml.replace(
      /src=["'](https?:\/\/[^\/]+)?\/api\/wiki\/[^\/]+\/images\/([^"']+)["']/g,
      'src="images/$2"'
    );
    
    // Add additional meta information
    const exportInfoComment = `<!--
  This wiki was exported as a single HTML file on ${new Date().toISOString()}
  Original wiki name: ${wikiData.name}
  Created with Wiki Generator
-->`;
    
    singleHtml = singleHtml.replace('<!DOCTYPE html>', `<!DOCTYPE html>\n${exportInfoComment}`);
    
    return singleHtml;
  }
  catch (error) {
    console.error('Error generating single HTML export:', error);
    throw error;
  }
};

// Upload an image for the wiki
export const uploadImage = async (req: Request, res: Response) => {
  try {
    const wikiName = decodeURIComponent(req.params.wikiName);
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const wikiDir = path.join(wikisDir, wikiName);
    const imagesDir = path.join(wikiDir, 'images');

    // Ensure images directory exists
    await fs.ensureDir(imagesDir);

    // Move uploaded file to images directory
    const filename = `${Date.now()}-${req.file.originalname}`;
    await fs.move(req.file.path, path.join(imagesDir, filename));

    // Return the URL for the uploaded image
    const imageUrl = `/api/wiki/${wikiName}/images/${filename}`;
    res.json({ url: imageUrl });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
};

// Serve wiki images
export const serveImage = async (req: Request, res: Response) => {
  try {
    const wikiName = decodeURIComponent(req.params.wikiName);
    const filename = req.params.filename;
    const imagePath = path.join(wikisDir, wikiName, 'images', filename);

    if (!await fs.pathExists(imagePath)) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.sendFile(imagePath);
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({ error: 'Failed to serve image' });
  }
}; 