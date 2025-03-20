"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.serveImage = exports.uploadImage = exports.exportWiki = exports.deleteWiki = exports.updateWiki = exports.getWiki = exports.getWikis = exports.createWiki = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const archiver_1 = __importDefault(require("archiver"));
// Path to wikis directory
const wikisDir = path_1.default.join(__dirname, '../../../..', 'created_wikis');
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
`;
// Create a new wiki
const createWiki = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { wikiName } = req.body;
        if (!wikiName) {
            return res.status(400).json({ error: 'Wiki name is required' });
        }
        // Create wiki directory
        const wikiDir = path_1.default.join(wikisDir, wikiName);
        // Check if wiki already exists
        if (yield fs_extra_1.default.pathExists(wikiDir)) {
            return res.status(400).json({ error: 'Wiki with this name already exists' });
        }
        // Create directory structure
        yield fs_extra_1.default.ensureDir(wikiDir);
        yield fs_extra_1.default.ensureDir(path_1.default.join(wikiDir, 'images'));
        // Create initial wiki structure
        const initialPage = {
            id: 'introduction',
            title: 'Introduction',
            content: 'Welcome to your new wiki! Edit this content to get started.',
            parentId: null,
            children: [],
            tags: ['getting-started'],
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            author: 'System',
            order: 0
        };
        const wiki = {
            name: wikiName,
            pages: {
                'introduction': initialPage
            },
            tags: new Set(['getting-started']),
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString()
        };
        // Save wiki structure to a JSON file
        yield fs_extra_1.default.writeFile(path_1.default.join(wikiDir, 'wiki-data.json'), JSON.stringify(Object.assign(Object.assign({}, wiki), { tags: Array.from(wiki.tags) }), null, 2));
        // Create the HTML file with embedded wiki data
        const htmlContent = generateWikiTemplate(wiki);
        yield fs_extra_1.default.writeFile(path_1.default.join(wikiDir, 'index.html'), htmlContent);
        // Create CSS file
        yield fs_extra_1.default.writeFile(path_1.default.join(wikiDir, 'styles.css'), defaultCss);
        // Return success
        res.status(201).json({
            message: 'Wiki created successfully',
            wiki: {
                name: wikiName,
                createdAt: new Date().toISOString()
            }
        });
    }
    catch (error) {
        console.error('Error creating wiki:', error);
        res.status(500).json({ error: 'Failed to create wiki' });
    }
});
exports.createWiki = createWiki;
// HTML template for a new wiki that uses the Wiki data structure
const generateWikiTemplate = (wiki) => {
    const wikiName = wiki.name;
    const generateSidebarNav = (pages) => {
        const rootPages = Object.values(pages).filter(page => !page.parentId);
        const generatePageLink = (page) => {
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
    const generateTagsSection = (tags) => {
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
    const generatePageContent = (pages) => {
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
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${wikiName}</title>
    <style>${defaultCss}</style>
    <script>
      window.wikiData = ${JSON.stringify(Object.assign(Object.assign({}, wiki), { tags: Array.from(wiki.tags) }))};
    </script>
</head>
<body>
    <div class="sidebar">
        <div class="sidebar-title">${wikiName}</div>
        <div class="sidebar-controls">
            <button class="add-page-btn" id="addPageButton">Add Page</button>
        </div>
        <ul class="sidebar-nav">
            ${generateSidebarNav(wiki.pages)}
        </ul>
        ${generateTagsSection(wiki.tags)}
    </div>
    <div class="main-content">
        ${generatePageContent(wiki.pages)}
    </div>
    <script>
      document.getElementById('addPageButton').addEventListener('click', function() {
        window.parent.postMessage({ type: 'openAddPageModal' }, '*');
      });
    </script>
</body>
</html>`;
};
// Get all wikis
const getWikis = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Read all directories in the wikis folder
        const directories = yield fs_extra_1.default.readdir(wikisDir);
        // Get stats for each directory
        const wikis = yield Promise.all(directories.map((dir) => __awaiter(void 0, void 0, void 0, function* () {
            const stats = yield fs_extra_1.default.stat(path_1.default.join(wikisDir, dir));
            return {
                name: dir,
                createdAt: stats.birthtime.toISOString()
            };
        })));
        // Sort by creation date (newest first)
        wikis.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        res.json(wikis);
    }
    catch (error) {
        console.error('Error fetching wikis:', error);
        res.status(500).json({ error: 'Failed to fetch wikis' });
    }
});
exports.getWikis = getWikis;
// Get a specific wiki
const getWiki = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { wikiName } = req.params;
        const wikiPath = path_1.default.join(wikisDir, wikiName, 'index.html');
        const wikiDataPath = path_1.default.join(wikisDir, wikiName, 'wiki-data.json');
        if (!(yield fs_extra_1.default.pathExists(wikiPath))) {
            return res.status(404).json({ error: 'Wiki not found' });
        }
        const content = yield fs_extra_1.default.readFile(wikiPath, 'utf-8');
        res.send(content);
    }
    catch (error) {
        console.error('Error fetching wiki:', error);
        res.status(500).json({ error: 'Failed to fetch wiki' });
    }
});
exports.getWiki = getWiki;
// Update wiki content
const updateWiki = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { wikiName } = req.params;
        const { content, cssTheme, wikiData } = req.body;
        const wikiDir = path_1.default.join(wikisDir, wikiName);
        const wikiDataPath = path_1.default.join(wikiDir, 'wiki-data.json');
        // Check if wiki exists
        if (!(yield fs_extra_1.default.pathExists(wikiDir))) {
            return res.status(404).json({ error: 'Wiki not found' });
        }
        // Update HTML content
        if (content) {
            yield fs_extra_1.default.writeFile(path_1.default.join(wikiDir, 'index.html'), content);
        }
        // Update wiki data if provided
        if (wikiData) {
            yield fs_extra_1.default.writeFile(wikiDataPath, JSON.stringify(wikiData, null, 2));
        }
        // Update CSS if provided
        if (cssTheme) {
            yield fs_extra_1.default.writeFile(path_1.default.join(wikiDir, 'styles.css'), cssTheme);
        }
        res.json({ message: 'Wiki updated successfully' });
    }
    catch (error) {
        console.error('Error updating wiki:', error);
        res.status(500).json({ error: 'Failed to update wiki' });
    }
});
exports.updateWiki = updateWiki;
// Delete a wiki
const deleteWiki = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { wikiName } = req.params;
        const wikiDir = path_1.default.join(wikisDir, wikiName);
        // Check if wiki exists
        if (!(yield fs_extra_1.default.pathExists(wikiDir))) {
            return res.status(404).json({ error: 'Wiki not found' });
        }
        // Delete wiki directory and all contents
        yield fs_extra_1.default.remove(wikiDir);
        res.json({ message: 'Wiki deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting wiki:', error);
        res.status(500).json({ error: 'Failed to delete wiki' });
    }
});
exports.deleteWiki = deleteWiki;
// Export wiki as a ZIP file
const exportWiki = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { wikiName } = req.params;
        const wikiDir = path_1.default.join(wikisDir, wikiName);
        // Check if wiki exists
        if (!(yield fs_extra_1.default.pathExists(wikiDir))) {
            return res.status(404).json({ error: 'Wiki not found' });
        }
        // Create a zip archive
        const zipPath = path_1.default.join(wikisDir, `${wikiName}.zip`);
        const output = fs_extra_1.default.createWriteStream(zipPath);
        const archive = (0, archiver_1.default)('zip', { zlib: { level: 9 } });
        // Pipe archive to output file
        archive.pipe(output);
        // Add all wiki files to the archive
        archive.directory(wikiDir, wikiName);
        // Finalize archive
        yield archive.finalize();
        // Wait for the output stream to finish
        output.on('close', () => {
            // Set headers for file download
            res.download(zipPath, `${wikiName}.zip`, (err) => {
                if (err) {
                    console.error('Error downloading zip:', err);
                    return res.status(500).json({ error: 'Failed to download wiki export' });
                }
                // Clean up the zip file after download
                fs_extra_1.default.remove(zipPath).catch(err => console.error('Error deleting zip file:', err));
            });
        });
    }
    catch (error) {
        console.error('Error exporting wiki:', error);
        res.status(500).json({ error: 'Failed to export wiki' });
    }
});
exports.exportWiki = exportWiki;
// Upload an image for the wiki
const uploadImage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { wikiName } = req.params;
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }
        const wikiDir = path_1.default.join(wikisDir, wikiName);
        const imagesDir = path_1.default.join(wikiDir, 'images');
        // Ensure images directory exists
        yield fs_extra_1.default.ensureDir(imagesDir);
        // Move uploaded file to images directory
        const filename = `${Date.now()}-${req.file.originalname}`;
        yield fs_extra_1.default.move(req.file.path, path_1.default.join(imagesDir, filename));
        // Return the URL for the uploaded image
        const imageUrl = `/api/wiki/${wikiName}/images/${filename}`;
        res.json({ url: imageUrl });
    }
    catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});
exports.uploadImage = uploadImage;
// Serve wiki images
const serveImage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { wikiName, filename } = req.params;
        const imagePath = path_1.default.join(wikisDir, wikiName, 'images', filename);
        if (!(yield fs_extra_1.default.pathExists(imagePath))) {
            return res.status(404).json({ error: 'Image not found' });
        }
        res.sendFile(imagePath);
    }
    catch (error) {
        console.error('Error serving image:', error);
        res.status(500).json({ error: 'Failed to serve image' });
    }
});
exports.serveImage = serveImage;
