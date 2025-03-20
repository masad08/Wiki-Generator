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
  author: string;
  order: number;
}

interface Wiki {
  name: string;
  pages: { [key: string]: WikiPage };
  tags: Set<string>;
  createdAt: string;
  modifiedAt: string;
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
    margin-left: 180px;
    padding: 2rem 4rem;
    max-width: 900px;
    background-color: var(--bg-primary);
    min-height: 100vh;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.05);
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
    color: var(--text-primary);
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

.wiki-page {
    margin-bottom: 3rem;
}

/* Hide all wiki pages by default */
.wiki-page {
    display: none;
}
`;

// Create a new wiki
export const createWiki = async (req: Request, res: Response) => {
  try {
    const { wikiName } = req.body;
    
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
    
    // Create empty wiki structure with no hardcoded pages
    const wiki: Wiki = {
      name: wikiName,
      pages: {}, // Empty pages object
      tags: new Set<string>(), // Empty tags set
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString()
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
                | Author: ${page.author}
              </div>
            </div>
          </div>
          <div class="page-content">
            <p>${page.content}</p>
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${wikiName}</title>
    <style>${defaultCss}</style>
    <script>window.wikiData = ${JSON.stringify(serializableWiki)};</script>
</head>
<body>
    <div class="sidebar">
        <div class="sidebar-title">${wikiName}</div>
        <ul class="sidebar-nav">
            ${generateSidebarNav(wiki.pages)}
        </ul>
        ${generateTagsSection(wiki.tags)}
    </div>
    <div class="main-content">
        ${generatePageContent(wiki.pages)}
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
    const wikiDataPath = path.join(wikiDir, 'wiki-data.json');
    
    if (!await fs.pathExists(wikiHtmlPath)) {
      return res.status(404).json({ error: 'Wiki not found' });
    }
    
    const content = await fs.readFile(wikiHtmlPath, 'utf-8');
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
    const { content, cssTheme, wikiData } = req.body;
    
    const wikiDir = path.join(wikisDir, wikiName);
    const wikiDataPath = path.join(wikiDir, 'wiki-data.json');
    
    // Check if wiki exists
    if (!await fs.pathExists(wikiDir)) {
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
    
    // Create a zip archive
    const zipPath = path.join(wikisDir, `${wikiName}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    // Pipe archive to output file
    archive.pipe(output);
    
    // Add all wiki files to the archive
    archive.directory(wikiDir, wikiName);
    
    // Finalize archive
    await archive.finalize();
    
    // Wait for the output stream to finish
    output.on('close', () => {
      // Set headers for file download
      res.download(zipPath, `${wikiName}.zip`, (err) => {
        if (err) {
          console.error('Error downloading zip:', err);
          return res.status(500).json({ error: 'Failed to download wiki export' });
        }
        
        // Clean up the zip file after download
        fs.remove(zipPath).catch(err => console.error('Error deleting zip file:', err));
      });
    });
  } catch (error) {
    console.error('Error exporting wiki:', error);
    res.status(500).json({ error: 'Failed to export wiki' });
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