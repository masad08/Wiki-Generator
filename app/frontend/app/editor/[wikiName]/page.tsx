'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

// Add these interfaces at the top
interface WikiPage {
  id: string;
  title: string;
  content: string;
  parentId: string | null;
  children: string[];
  tags: string[];
  createdAt: string;
  modifiedAt: string;
  author?: string; // Make author optional
  order: number;
}

interface Wiki {
  name: string;
  pages: { [key: string]: WikiPage };
  tags: Set<string>;
  createdAt: string;
  modifiedAt: string;
  defaultAuthor?: string; // Optional default author
}

// Add interfaces for table data
interface TableCell {
  row: number;
  col: number;
  content: string;
  isHeader: boolean;
}

interface TableData {
  id: string;
  rows: number;
  columns: number;
  hasHeader: boolean;
  cells: TableCell[];
}

interface TableStyle {
  id: string;
  tableStyles: Record<string, string>;
  headerStyles: Record<string, string>;
  cellStyles: Record<string, string>;
  type: 'default' | 'striped' | 'bordered' | 'clean';
}

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const encodedWikiName = params?.wikiName as string || '';
  const wikiName = decodeURIComponent(encodedWikiName);
  const [wiki, setWiki] = useState<Wiki | null>(null);
  const [newPageName, setNewPageName] = useState('');
  const [newPageParentId, setNewPageParentId] = useState<string | null>(null);
  const [newPageTags, setNewPageTags] = useState<string[]>([]);
  const [showAddPageModal, setShowAddPageModal] = useState(false);
  const [availableTags, setAvailableTags] = useState<Set<string>>(new Set());
  const [newTagInput, setNewTagInput] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [cssContent, setCssContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'pages' | 'settings' | 'preview'>('editor'); // Typed tabs
  const [sidebarColor, setSidebarColor] = useState('#222222');
  const [mainColor, setMainColor] = useState('#ffffff');
  const [footerText, setFooterText] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [currentContent, setCurrentContent] = useState('');
  const contentEditableRef = useRef<HTMLDivElement>(null);

  // Add state for hyperlink toolbar
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [isInternalLink, setIsInternalLink] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState('');

  // Add state for table modal
  const [showTableModal, setShowTableModal] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableColumns, setTableColumns] = useState(3);
  const [tableHeaderRow, setTableHeaderRow] = useState(true);
  const [tableHTML, setTableHTML] = useState('');
  const [showTableInsert, setShowTableInsert] = useState(false);

  // Add state for image insertion
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [imageHTML, setImageHTML] = useState('');
  const [imageWidth, setImageWidth] = useState(300);
  const [imageAlignment, setImageAlignment] = useState<'left' | 'center' | 'right'>('center');
  const [showImageInsert, setShowImageInsert] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  // State for table editor modal
  const [showTableEditorModal, setShowTableEditorModal] = useState(false);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [editingTableData, setEditingTableData] = useState<TableData | null>(null);
  const [editingTableStyle, setEditingTableStyle] = useState<TableStyle | null>(null);
  const openTableEditorModalRef = useRef<((tableId: string) => Promise<void>) | null>(null);

  const [textDefaultColor, setTextDefaultColor] = useState('#333333');
  const [textPrimaryColor, setTextPrimaryColor] = useState('#111827');
  const [textSecondaryColor, setTextSecondaryColor] = useState('#4b5563');

  const [defaultAuthor, setDefaultAuthor] = useState(''); // Add this line

  const convertHtmlTablesToIframes = async (html: string): Promise<string> => {
    // Find all wiki-table elements
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const tables = tempDiv.querySelectorAll('table.wiki-table');

    for (const table of tables) {
      // Get the table ID
      const tableId = table.getAttribute('data-table-id');
      if (!tableId) continue;

      try {
        // Create a table data structure from the HTML
        const tableData: TableData = {
          id: tableId,
          rows: 0,
          columns: 0,
          hasHeader: false,
          cells: []
        };

        // Extract table structure
        const headerRows = table.querySelectorAll('thead tr');
        const bodyRows = table.querySelectorAll('tbody tr');

        // Set hasHeader based on presence of thead
        tableData.hasHeader = headerRows.length > 0;

        // Calculate rows and columns
        tableData.rows = tableData.hasHeader ? headerRows.length + bodyRows.length : bodyRows.length;

        // Determine number of columns from the first row
        const firstRow = tableData.hasHeader && headerRows.length > 0 ?
          headerRows[0] : (bodyRows.length > 0 ? bodyRows[0] : null);

        if (firstRow) {
          const cells = firstRow.querySelectorAll('th, td');
          tableData.columns = cells.length;
        }

        // Extract cell data from header
        if (tableData.hasHeader) {
          Array.from(headerRows).forEach((row, rowIndex) => {
            const cells = row.querySelectorAll('th');
            Array.from(cells).forEach((cell, colIndex) => {
              tableData.cells.push({
                row: rowIndex,
                col: colIndex,
                content: cell.textContent || '',
                isHeader: true
              });
            });
          });
        }

        // Extract cell data from body
        Array.from(bodyRows).forEach((row, rowIndex) => {
          const actualRowIndex = tableData.hasHeader ? rowIndex + headerRows.length : rowIndex;
          const cells = row.querySelectorAll('td');
          Array.from(cells).forEach((cell, colIndex) => {
            tableData.cells.push({
              row: actualRowIndex,
              col: colIndex,
              content: cell.textContent || '',
              isHeader: false
            });
          });
        });

        // Extract styles
        const tableStyle: TableStyle = {
          id: tableId,
          type: 'default' as const,
          tableStyles: {},
          headerStyles: {},
          cellStyles: {}
        };

        // Get inline styles from table
        if (table.getAttribute('style')) {
          const styleAttr = table.getAttribute('style') || '';
          const styles = styleAttr.split(';').filter(s => s.trim());

          for (const style of styles) {
            const [prop, value] = style.split(':').map(s => s.trim());
            if (prop && value) {
              // Convert kebab-case to camelCase
              const camelProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
              tableStyle.tableStyles[camelProp] = value;
            }
          }
        }

        // Get styles from th elements
        if (headerRows.length > 0) {
          const headerCell = headerRows[0].querySelector('th');
          if (headerCell && headerCell.getAttribute('style')) {
            const styleAttr = headerCell.getAttribute('style') || '';
            const styles = styleAttr.split(';').filter(s => s.trim());

            for (const style of styles) {
              const [prop, value] = style.split(':').map(s => s.trim());
              if (prop && value) {
                // Convert kebab-case to camelCase
                const camelProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
                tableStyle.headerStyles[camelProp] = value;
              }
            }
          }
        }

        // Get styles from td elements
        if (bodyRows.length > 0) {
          const bodyCell = bodyRows[0].querySelector('td');
          if (bodyCell && bodyCell.getAttribute('style')) {
            const styleAttr = bodyCell.getAttribute('style') || '';
            const styles = styleAttr.split(';').filter(s => s.trim());

            for (const style of styles) {
              const [prop, value] = style.split(':').map(s => s.trim());
              if (prop && value) {
                // Convert kebab-case to camelCase
                const camelProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
                tableStyle.cellStyles[camelProp] = value;
              }
            }
          }
        }

        // Determine table style type based on styles
        if (tableStyle.tableStyles['border'] && tableStyle.cellStyles['border']) {
          tableStyle.type = 'bordered';
        } else if (!tableStyle.headerStyles['backgroundColor'] && tableStyle.headerStyles['borderBottom']) {
          tableStyle.type = 'clean';
        } else if (tableStyle.cellStyles['borderBottom'] && !tableStyle.cellStyles['border']) {
          tableStyle.type = 'striped';
        }

        // Save the table data
        await saveTableData(tableId, tableData, tableStyle);

        // Replace table HTML with iframe
        const iframeHtml = `
          <div class="table-container" style="position: relative; margin: 1em 0; min-height: 50px;">
            <button 
              class="table-edit-button" 
              data-table-id="${tableId}" 
              style="position: absolute; top: 0; right: 0; background: #3b82f6; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer; z-index: 10;"
              onmousedown="event.preventDefault(); event.stopPropagation(); window.editTable('${tableId}', event); return false;"
            >
              Edit Table
            </button>
            <iframe 
              src="/api/table-renderer?tableId=${tableId}" 
              class="wiki-table-frame" 
              data-table-id="${tableId}" 
              style="width: 100%; border: none; overflow: hidden;"
              title="Embedded table"
            ></iframe>
          </div>
        `;

        // Create a container for the iframe
        const container = document.createElement('div');
        container.innerHTML = iframeHtml;

        // Replace the table with the iframe container
        table.parentNode?.replaceChild(container.firstElementChild!, table);
      } catch (error) {
        console.error(`Error converting table ${tableId} to iframe:`, error);
      }
    }

    return tempDiv.innerHTML;
  };

  // Fetch wiki content
  useEffect(() => {
    const fetchWiki = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/wiki/${encodedWikiName}`);

        if (!response.ok) {
          throw new Error('Failed to fetch wiki');
        }

        const html = await response.text();

        // Try multiple patterns to extract wiki data
        const wikiDataMatch = html.match(/window\.wikiData\s*=\s*([\s\S]*?);<\/script>/) ||
          html.match(/<script>[\s\S]*?window\.wikiData\s*=\s*([\s\S]*?);<\/script>/) ||
          html.match(/<script[\s\S]*?>[\s\S]*?window\.wikiData\s*=\s*([\s\S]*?);<\/script>/);

        if (wikiDataMatch && wikiDataMatch[1]) {
          try {
            const parsedData = JSON.parse(wikiDataMatch[1]);

            // Fix the data structure - ensure tags is a Set object
            const wikiData = {
              ...parsedData,
              tags: new Set(parsedData.tags || [])
            };

            setWiki(wikiData);
            setAvailableTags(new Set(wikiData.tags));

            // Check if there's a default author in the wiki data
            if (wikiData.defaultAuthor) {
              setDefaultAuthor(wikiData.defaultAuthor);
            }

            console.log("Wiki data loaded:", wikiData);

            // After loading wiki data, convert any HTML tables back to iframes for editing
            const processedHtml = await convertHtmlTablesToIframes(html);
            setHtmlContent(processedHtml);
          } catch (jsonError) {
            console.error("Error parsing wiki data JSON:", jsonError);
            initializeDefaultWiki(html);
          }
        } else {
          console.error("Could not find window.wikiData in HTML");
          initializeDefaultWiki(html);
        }

        // Extract CSS from the HTML
        const cssMatch = html.match(/<style>([\s\S]*?)<\/style>/);
        if (cssMatch && cssMatch[1]) {
          setCssContent(cssMatch[1]);

          // Extract sidebar color
          const sidebarColorMatch = cssMatch[1].match(/\.sidebar\s*{[^}]*background-color:\s*([^;]+)/);
          if (sidebarColorMatch && sidebarColorMatch[1]) {
            setSidebarColor(sidebarColorMatch[1].trim());
          }

          // Extract main content color
          const mainColorMatch = cssMatch[1].match(/\.main-content\s*{[^}]*background-color:\s*([^;]+)/);
          if (mainColorMatch && mainColorMatch[1]) {
            setMainColor(mainColorMatch[1].trim());
          }

          // Extract text default color
          const textDefaultColorMatch = cssMatch[1].match(/--text-default:\s*([^;]+)/);
          if (textDefaultColorMatch && textDefaultColorMatch[1]) {
            setTextDefaultColor(textDefaultColorMatch[1].trim());
          }

          // Extract text primary color
          const textPrimaryColorMatch = cssMatch[1].match(/--text-primary:\s*([^;]+)/);
          if (textPrimaryColorMatch && textPrimaryColorMatch[1]) {
            setTextPrimaryColor(textPrimaryColorMatch[1].trim());
          }

          // Extract text secondary color
          const textSecondaryColorMatch = cssMatch[1].match(/--text-secondary:\s*([^;]+)/);
          if (textSecondaryColorMatch && textSecondaryColorMatch[1]) {
            setTextSecondaryColor(textSecondaryColorMatch[1].trim());
          }

          // Alternative approach if the CSS variables aren't found - extract from specific selectors
          if (!textDefaultColorMatch) {
            const pageContentColorMatch = cssMatch[1].match(/\.page-content\s*{[^}]*color:\s*([^;]+)/);
            if (pageContentColorMatch && pageContentColorMatch[1]) {
              setTextDefaultColor(pageContentColorMatch[1].trim());
            } else {
              // Default fallback
              setTextDefaultColor('#333333');
            }
          }

          if (!textPrimaryColorMatch) {
            const headingColorMatch = cssMatch[1].match(/\.page-header h1\s*{[^}]*color:\s*([^;]+)/);
            if (headingColorMatch && headingColorMatch[1]) {
              setTextPrimaryColor(headingColorMatch[1].trim());
            } else {
              // Default fallback
              setTextPrimaryColor('#111827');
            }
          }

          if (!textSecondaryColorMatch) {
            const metadataColorMatch = cssMatch[1].match(/\.page-info\s*{[^}]*color:\s*([^;]+)/);
            if (metadataColorMatch && metadataColorMatch[1]) {
              setTextSecondaryColor(metadataColorMatch[1].trim());
            } else {
              // Default fallback
              setTextSecondaryColor('#4b5563');
            }
          }
        }

        // Extract footer text
        const footerMatch = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/);
        if (footerMatch && footerMatch[1]) {
          setFooterText(footerMatch[1].trim());
        }

        // Extract logo URL
        const logoMatch = html.match(/<img[^>]*src="([^"]+)"[^>]*class="logo"/);
        if (logoMatch && logoMatch[1]) {
          setLogoUrl(logoMatch[1]);
        }
      } catch (error) {
        console.error('Error fetching wiki:', error);
        alert('Failed to load wiki. Redirecting to admin panel.');
        router.push('/admin');
      }
    };

    // Helper function to initialize a default wiki when data can't be parsed from HTML
    const initializeDefaultWiki = (html: string) => {
      // Try to extract wiki name from title or h1 tag if available
      let extractedWikiName = wikiName;
      const titleMatch = html.match(/<title>(.*?)<\/title>/);
      if (titleMatch && titleMatch[1]) {
        extractedWikiName = titleMatch[1];
      }

      // Create minimal wiki structure
      const defaultWiki = {
        name: extractedWikiName,
        pages: {},
        tags: new Set<string>(),
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString()
      };

      // Try to extract any content from the HTML
      const contentMatch = html.match(/<div[^>]*class="page-content"[^>]*>([\s\S]*?)<\/div>/);
      if (contentMatch && contentMatch[1]) {
        // Create an initial page using extracted content
        defaultWiki.pages = {
          introduction: {
            id: 'introduction',
            title: 'Introduction',
            content: contentMatch[1] || 'Welcome to your wiki. Edit this content to get started.',
            parentId: null,
            children: [],
            tags: [],
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            order: 0
          }
        };
      } else {
        // Create a blank initial page
        defaultWiki.pages = {
          introduction: {
            id: 'introduction',
            title: 'Introduction',
            content: 'Welcome to your wiki. Edit this content to get started.',
            parentId: null,
            children: [],
            tags: [],
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            order: 0
          }
        };
      }

      setWiki(defaultWiki);
      setHtmlContent(html);
      console.log("Created default wiki structure:", defaultWiki);
    };

    fetchWiki();
  }, [encodedWikiName, router, wikiName]);

  // Save wiki content
  const saveWiki = async () => {
    try {
      console.log("🔍 SAVING PAGE: Starting save process");
      setIsSaving(true);

      // Prepare the wiki data for saving
      if (!wiki) {
        console.error("🔍 SAVING PAGE: Cannot save - wiki data is null");
        return;
      }

      const wikiDataToSave = {
        ...wiki,
        tags: Array.from(wiki.tags),
        logoUrl: logoUrl,
        defaultAuthor: defaultAuthor // Save the default author
      };

      console.log("🔍 SAVING PAGE: Wiki data prepared for saving");

      // Helper function to generate sidebar nav
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

      // Helper function to generate tags section
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

      // Helper function to generate page content
      const generatePageContent = (pages: { [key: string]: WikiPage }): string => {
        if (Object.keys(pages).length === 0) {
          return ''; // Return empty content if no pages
        }

        return Object.values(pages)
          .sort((a, b) => a.order - b.order)
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
                ${page.content}
              </div>
            </div>
          `)
          .join('\n');
      };

      // First extract all table IDs from the wiki content
      const tableIdRegex = /data-table-id="([^"]+)"/g;
      const allContent = Object.values(wiki.pages).map(page => page.content).join('');
      const tableIds: string[] = [];
      let match;

      while ((match = tableIdRegex.exec(allContent)) !== null) {
        tableIds.push(match[1]);
      }

      console.log(`🔍 SAVING PAGE: Found ${tableIds.length} tables in wiki content to save:`, tableIds);

      // First generate the HTML with iframe tables (for preview)
      const previewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${wiki.name}</title>
    <style>${cssContent}</style>
    <script>window.wikiData = ${JSON.stringify(wikiDataToSave)};</script>
</head>
<body>
    <div class="sidebar">
        ${logoUrl ? `<div class="sidebar-logo"><img src="${logoUrl}" alt="Wiki Logo" class="logo" style="max-width: 100%; height: auto;"/></div>` : ''}

        <div class="sidebar-title">${wiki.name}</div>
        <ul class="sidebar-nav">
            ${generateSidebarNav(wiki.pages)}
        </ul>
        ${generateTagsSection(wiki.tags)}
    </div>
    <div class="main-content">
        <div class="content-wrapper">
            ${generatePageContent(wiki.pages)}
        </div>
        ${footerText ? `<footer class="wiki-footer">${footerText}</footer>` : ''}
    </div>
    <script>
      // Page navigation functionality for editor preview
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

      // Update preview iframe with the preview HTML
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.srcdoc = previewHtml;
      }

      // Prepare additional data to be sent to the server
      const tableData: Record<string, { data: TableData; style: TableStyle }> = {};

      // Fetch table data for all tables in the wiki
      if (tableIds.length > 0) {
        console.log("🔍 SAVING PAGE: Fetching table data from frontend API");
        for (const tableId of tableIds) {
          try {
            console.log(`🔍 SAVING PAGE: Fetching data for table ${tableId}`);
            const response = await fetch(`/api/tables/${tableId}`);
            if (response.ok) {
              const data = await response.json();
              tableData[tableId] = { data, style: data.style };
              console.log(`🔍 SAVING PAGE: Successfully fetched data for table ${tableId}`, data);
            } else {
              console.warn(`🔍 SAVING PAGE: Could not fetch data for table ${tableId}: ${response.status} - ${response.statusText}`);
            }
          } catch (error) {
            console.error(`🔍 SAVING PAGE: Error fetching table data for ${tableId}:`, error);
          }
        }
      }

      console.log(`🔍 SAVING PAGE: Total tables with data: ${Object.keys(tableData).length}`);

      // Now convert tables to static HTML using the export-tables API
      console.log("🔍 SAVING PAGE: Converting tables to static HTML");
      const exportResponse = await fetch('/api/export-tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          html: previewHtml
        }),
      });

      if (!exportResponse.ok) {
        console.error('🔍 SAVING PAGE: Failed to convert tables:', await exportResponse.text());
        throw new Error('Failed to convert tables');
      }

      const { html: exportedHtml } = await exportResponse.json();
      console.log("🔍 SAVING PAGE: Tables converted to static HTML");

      // Send the exported HTML with real tables to the server
      console.log("🔍 SAVING PAGE: Sending data to backend server", {
        htmlLength: exportedHtml.length,
        cssLength: cssContent.length,
        tableDataLength: Object.keys(tableData).length
      });

      const saveResponse = await fetch(`http://localhost:3001/api/wiki/${encodedWikiName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: exportedHtml,
          cssTheme: cssContent,
          wikiData: wikiDataToSave,
          tableData: tableData // Include the table data with the save request
        }),
      });

      if (!saveResponse.ok) {
        const errorText = await saveResponse.text();
        console.error('🔍 SAVING PAGE: Failed to save wiki:', errorText);
        throw new Error(`Failed to save wiki: ${errorText}`);
      }

      console.log("🔍 SAVING PAGE: Wiki saved successfully with static HTML tables");
    } catch (error) {
      console.error('🔍 SAVING PAGE: Error saving wiki:', error);
      alert('Failed to save wiki. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Update CSS with new settings
  const updateCss = async () => {
    // Add logo styles to the CSS
    const logoStyles = `
    .sidebar-logo {
      padding: 1rem;
      text-align: center;
      margin-bottom: 1rem;
    }
    .sidebar-logo img {
      max-width: 80%;
      height: auto;
      border-radius: 4px;
    }`;

    // Add explicit text styling for wiki content
    const textStyles = `
    /* Main content default text */
    .page-content {
      color: ${textPrimaryColor};
    }
    
    /* Main content headers - primary color */
    .page-header h1,
    .page-content h1, 
    .page-content h2, 
    .page-content h3, 
    .page-content h4, 
    .page-content h5, 
    .page-content h6 {
      color: ${textPrimaryColor};
    }
    
    /* All sidebar text including title and tags section - default color */
    .sidebar-title,
    .sidebar-nav a,
    .sidebar-nav li,
    .wiki-tags h3,
    .sidebar .wiki-tags {
      color: ${textDefaultColor};
    }
    
    /* Secondary color for metadata, logs, tags and footer */

    .page-info,
    .page-metadata,
    .page-content .metadata,
    .page-content .description,
    .page-content small,
    .tag,
    .wiki-footer,
    .page-info { /* This targets the author/logging line */
      color: ${textSecondaryColor} !important;
    }
    `;

    // Check if CSS variables exist, and add them if they don't
    let updatedCss = cssContent;




    if (updatedCss.includes(':root {')) {
      // If root exists, check for each variable and add or update them
      if (updatedCss.includes('--text-primary:')) {
        updatedCss = updatedCss.replace(/--text-primary:[^;]+;/, `--text-primary: ${textPrimaryColor};`);
      } else {
        updatedCss = updatedCss.replace(/:root {/, `:root {\n  --text-primary: ${textPrimaryColor};`);
      }

      if (updatedCss.includes('--text-secondary:')) {
        updatedCss = updatedCss.replace(/--text-secondary:[^;]+;/, `--text-secondary: ${textSecondaryColor};`);
      } else {
        updatedCss = updatedCss.replace(/:root {/, `:root {\n  --text-secondary: ${textSecondaryColor};`);
      }

      if (updatedCss.includes('--text-default:')) {
        updatedCss = updatedCss.replace(/--text-default:[^;]+;/, `--text-default: ${textDefaultColor};`);
      } else {
        updatedCss = updatedCss.replace(/:root {/, `:root {\n  --text-default: ${textDefaultColor};`);
      }
    } else {
      // If no root exists, create one with all variables
      updatedCss = `:root {\n  --text-primary: ${textPrimaryColor};\n  --text-secondary: ${textSecondaryColor};\n  --text-default: ${textDefaultColor};\n}\n` + updatedCss;
    }

    // Continue with existing background color replacements
// Continue with existing background color replacements
    updatedCss = updatedCss
      .replace(/\.sidebar\s*{[^}]*background-color:[^;]+;/g, match =>
        match.replace(/background-color:[^;]+;/, `background-color: ${sidebarColor};`))
      .replace(/\.main-content\s*{[^}]*background-color:[^;]+;/g, match =>
        match.replace(/background-color:[^;]+;/, `background-color: ${mainColor};`))
      .replace(/--bg-primary:[^;]+;/, `--bg-primary: ${mainColor};`)
      // Add the new replacements right here
      .replace(/\.wiki-footer\s*{[^}]*color:[^;]+;/g, match =>
        match.replace(/color:[^;]+;/, `color: ${textSecondaryColor};`))
      .replace(/\.page-info\s*{[^}]*color:[^;]+;/g, match =>
        match.replace(/color:[^;]+;/, `color: ${textSecondaryColor};`))
      + logoStyles
      + textStyles;

    setCssContent(updatedCss);

    // Update the HTML with the new CSS
    if (wiki) {
      try {
        const htmlWithCss = await generateWikiHtml(wiki);
        setHtmlContent(htmlWithCss);
      } catch (error) {
        console.error("Error generating wiki HTML:", error);
      }
    }

    // Save the changes
    await saveWiki();
  };

  // Modified generateWikiHtml to handle tables correctly
  const generateWikiHtml = async (wikiData: Wiki): Promise<string> => {
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
      if (Object.keys(pages).length === 0) {
        return ''; // Return empty content if no pages
      }

      return Object.values(pages)
        .sort((a, b) => a.order - b.order)
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
              ${page.content}
            </div>
          </div>
        `)
        .join('\n');
    };

    // Main HTML template
    // Modified HTML template in the generateWikiHtml function
    const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${wikiData.name}</title>
    <style>
      ${cssContent}
      body {
        background-color: white;
        margin: 0;
        padding: 0;
      }
.wiki-wrapper {
  display: flex;
  max-width: 1200px; /* you can adjust this width */
  margin-left: auto;
  margin-right: auto;
  justify-content: center;
  width: fit-content;
}
    </style>
    <script>window.wikiData = ${JSON.stringify({
      ...wikiData,
      tags: Array.from(wikiData.tags)
    })};</script>
</head>
<body>
<div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -1000; background-color: white;"></div>
    <div class="wiki-wrapper">
        <div class="sidebar">
            ${logoUrl ? `<div class="sidebar-logo"><img src="${logoUrl}" alt="Wiki Logo" style="max-width: 100%; height: auto;"/></div>` : ''}
            <div class="sidebar-title">${wikiData.name}</div>
            <ul class="sidebar-nav">
                ${generateSidebarNav(wikiData.pages)}
            </ul>
            ${generateTagsSection(wikiData.tags)}
        </div>
        <div class="main-content">
            <div class="content-wrapper">
                ${generatePageContent(wikiData.pages)}
            </div>
            ${footerText ? `<footer class="wiki-footer">${footerText}</footer>` : ''}
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
        
        // Add click handlers to all internal links (including those in content)
        document.querySelectorAll('a[href^="#"]').forEach(link => {
          link.addEventListener('click', function(e) {
            // Prevent default hash navigation
            e.preventDefault();
            
            // Get the target page ID from the href attribute
            const pageId = this.getAttribute('href').substring(1);
            
            // Show the target page
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
        
        // Also listen for hash changes in the URL
        window.addEventListener('hashchange', function() {
          const newHash = window.location.hash.substring(1);
          if (newHash && document.getElementById(newHash)) {
            showPage(newHash);
          }
        });
      });
    </script>
</body>
</html>`;

    return htmlTemplate;
  };

  // Listen for messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'openAddPageModal') {
        setShowAddPageModal(true);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Add a new page to the wiki
  const addNewPage = async () => {
    console.log("Add Page clicked, wiki state:", wiki);
    console.log("newPageName:", newPageName);

    if (!wiki || !newPageName.trim()) {
      console.log("Early return condition met:", !wiki ? "wiki is null/undefined" : "newPageName is empty");
      return;
    }

    // Create ID-friendly anchor
    const pageId = newPageName.toLowerCase().replace(/\s+/g, '-');

    // Create new page
    const newPage: WikiPage = {
      id: pageId,
      title: newPageName,
      content: 'Edit this section to add content.',
      parentId: newPageParentId,
      children: [],
      tags: [],
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      author: defaultAuthor || undefined, // Only set author if there's a default author
      order: Object.keys(wiki.pages).length
    };

    // Update parent's children if this is a child page
    if (newPageParentId && wiki.pages[newPageParentId]) {
      wiki.pages[newPageParentId].children.push(pageId);
    }

    // Add new page to wiki
    const updatedWiki = {
      ...wiki,
      pages: {
        ...wiki.pages,
        [pageId]: newPage
      },
      tags: new Set([...Array.from(wiki.tags), ...newPageTags])
    };

    setWiki(updatedWiki);

    // Update HTML content - this is now async
    const updatedHtml = await generateWikiHtml(updatedWiki);
    setHtmlContent(updatedHtml);

    // Update preview iframe
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.srcdoc = updatedHtml;
    }

    // Set this as the current editing page
    setEditingPageId(pageId);

    // Switch to editor tab if on a different tab
    if (activeTab !== 'editor') {
      setActiveTab('editor');
    }

    // Save the updated wiki
    await saveWiki();

    // Reset form
    setNewPageName('');
    setNewPageParentId(null);
    setNewPageTags([]);
    setShowAddPageModal(false);
  };

  // Add tag to new page
  const addTag = () => {
    if (!newTagInput.trim()) return;

    const newTag = newTagInput.trim();
    if (!newPageTags.includes(newTag)) {
      setNewPageTags([...newPageTags, newTag]);
      setAvailableTags(new Set([...Array.from(availableTags), newTag]));
    }
    setNewTagInput('');
  };

  // Remove tag from new page
  const removeTag = (tagToRemove: string) => {
    setNewPageTags(newPageTags.filter(tag => tag !== tagToRemove));
  };

  // Upload a logo image
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch(`http://localhost:3001/api/wiki/${encodedWikiName}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      const fullImageUrl = `http://localhost:3001${data.url}`;
      setLogoUrl(fullImageUrl);

      // Update HTML with logo
      const updatedHtml = htmlContent.replace(
        /<div class="sidebar-title">([\s\S]*?)<\/div>/,
        `<div class="sidebar-title"><img src="${fullImageUrl}" alt="Logo" className="logo max-w-full h-auto mb-3" style="max-height: 100px;"><br/>${wikiName}</div>`
      );

      setHtmlContent(updatedHtml);
      saveWiki();
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Failed to upload logo. Please try again.');
    }
  };

  // Update footer text
  const updateFooter = () => {
    // Check if footer already exists
    if (htmlContent.includes('<footer')) {
      const updatedHtml = htmlContent.replace(
        /<footer[^>]*>([\s\S]*?)<\/footer>/,
        `<footer class="wiki-footer">${footerText}</footer>`
      );
      setHtmlContent(updatedHtml);
    } else {
      // Add footer before closing main-content div
      const updatedHtml = htmlContent.replace(
        /<\/div>\s*<\/body>/,
        `  <footer class="wiki-footer">${footerText}</footer>\n  </div>\n</body>`
      );
      setHtmlContent(updatedHtml);
    }
    saveWiki();
  };

  // Update currentContent when editingPageId changes
  useEffect(() => {
    if (editingPageId) {
      setCurrentContent(extractPageContent(editingPageId));
    } else {
      setCurrentContent('');
    }
  }, [editingPageId, wiki]);

  // Simple rich text formatting function
  const applyFormatting = (e: React.MouseEvent, format: string) => {
    e.preventDefault(); // Prevent the button from taking focus

    // Make sure the editor has focus
    if (contentEditableRef.current) {
      contentEditableRef.current.focus();
    }

    // Get current selection
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    // Apply formatting based on the format type
    if (format === 'h1' || format === 'h2' || format === 'h3') {
      // For headings, we'll use inline styling to make it apply only to selected text
      const range = selection.getRangeAt(0);
      const selectedText = range.toString();
      if (!selectedText) return;

      // Set font size based on heading level - adjusted to be more subtle
      let fontSize = '1.5em';  // h1 (reduced from 2em)
      if (format === 'h2') fontSize = '1.3em'; // reduced from 1.5em
      if (format === 'h3') fontSize = '1.15em'; // slightly reduced from 1.17em

      // Create span with heading styles
      const html = `<span style="font-size:${fontSize}; font-weight:bold;">${selectedText}</span>`;

      // Delete the selected text
      document.execCommand('delete');

      // Insert the styled span
      document.execCommand('insertHTML', false, html);
    } else {
      // For all other formatting, use standard execCommand
      let command = '';
      let commandValue = '';

      switch (format) {
        case 'bold':
          command = 'bold';
          break;
        case 'italic':
          command = 'italic';
          break;
        case 'underline':
          command = 'underline';
          break;
        case 'normal':
          command = 'removeFormat';
          break;
        case 'p':
          // For justified paragraph, we need to wrap the text in a styled span
          const range = selection.getRangeAt(0);
          const selectedText = range.toString();
          if (!selectedText) return;

          // Create justified paragraph
          const html = `<div style="text-align: justify;">${selectedText}</div>`;

          // Delete the selected text
          document.execCommand('delete');

          // Insert the justified content
          document.execCommand('insertHTML', false, html);
          return; // Early return as we've handled this case
        case 'line':
          // Insert a line break that allows text to continue after it
          const lineHtml = '<br><hr style="width: 75%; margin: 0.5em auto; height: 1px; border: none; background-color: #ccc; display: block; overflow: visible;" /><br>';
          document.execCommand('insertHTML', false, lineHtml);
          return; // Early return as we've handled this case
        // List formatting cases
        case 'bullet-disc':
          document.execCommand('insertUnorderedList');
          applyListStyle('disc');
          return;
        case 'bullet-circle':
          document.execCommand('insertUnorderedList');
          applyListStyle('circle');
          return;
        case 'bullet-square':
          document.execCommand('insertUnorderedList');
          applyListStyle('square');
          return;
        case 'number-decimal':
          document.execCommand('insertOrderedList');
          applyListStyle('decimal');
          return;
        case 'number-alpha-lower':
          document.execCommand('insertOrderedList');
          applyListStyle('lower-alpha');
          return;
        case 'number-alpha-upper':
          document.execCommand('insertOrderedList');
          applyListStyle('upper-alpha');
          return;
        case 'number-roman-lower':
          document.execCommand('insertOrderedList');
          applyListStyle('lower-roman');
          return;
        case 'number-roman-upper':
          document.execCommand('insertOrderedList');
          applyListStyle('upper-roman');
          return;
        case 'indent':
          document.execCommand('indent');
          setTimeout(() => {
            if (contentEditableRef.current) {
              setCurrentContent(contentEditableRef.current.innerHTML);
            }
          }, 10);
          return;
        case 'outdent':
          document.execCommand('outdent');
          setTimeout(() => {
            if (contentEditableRef.current) {
              setCurrentContent(contentEditableRef.current.innerHTML);
            }
          }, 10);
          return;
        // Text color cases
        case 'color-default':
          command = 'foreColor';
          commandValue = '#000000'; // Black
          break;
        case 'color-red':
          command = 'foreColor';
          commandValue = '#CC0000';
          break;
        case 'color-blue':
          command = 'foreColor';
          commandValue = '#0066CC';
          break;
        case 'color-green':
          command = 'foreColor';
          commandValue = '#008800';
          break;
        case 'color-purple':
          command = 'foreColor';
          commandValue = '#660099';
          break;
        // Background color cases
        case 'bg-default':
          command = 'backColor';
          commandValue = 'transparent';
          break;
        case 'bg-yellow':
          command = 'backColor';
          commandValue = '#FFFFCC'; // Light yellow highlight
          break;
        case 'bg-blue':
          command = 'backColor';
          commandValue = '#E6F3FF'; // Light blue
          break;
        case 'bg-green':
          command = 'backColor';
          commandValue = '#E6FFE6'; // Light green
          break;
        case 'bg-pink':
          command = 'backColor';
          commandValue = '#FFE6E6'; // Light pink/red
          break;
        default:
          return;
      }

      // Execute command
      document.execCommand(command, false, commandValue);
    }

    // Update content state with the new HTML after formatting
    if (contentEditableRef.current) {
      setCurrentContent(contentEditableRef.current.innerHTML);
    }
  };

  // Modified function to extract a specific page's content
  const extractPageContent = (pageId: string | null) => {
    if (!pageId || !wiki || !wiki.pages[pageId]) {
      return ''; // Return empty if no page selected
    }
    return wiki.pages[pageId].content || '';
  };

  // Save current page content
  const savePageContent = async (content: string) => {
    if (!editingPageId || !wiki) return;

    const updatedWiki = { ...wiki };
    updatedWiki.pages[editingPageId] = {
      ...updatedWiki.pages[editingPageId],
      content: content,
      modifiedAt: new Date().toISOString(),
      author: defaultAuthor || undefined // Update author to current default author
    };

    setWiki(updatedWiki);

    // Update HTML
    const updatedHtml = await generateWikiHtml(updatedWiki);
    setHtmlContent(updatedHtml);

    saveWiki();
  };

  // Add a helper function to apply custom list style after creating a list
  const applyListStyle = (style: string) => {
    if (!contentEditableRef.current) return;

    // Find the newly created list
    setTimeout(() => {
      // Use setTimeout to ensure the list is created first
      const selection = window.getSelection();
      if (!selection) return;

      const range = selection.getRangeAt(0);
      let listElement: HTMLElement | null = null;

      // Find the parent list element (ul or ol)
      let node: Node | null = range.commonAncestorContainer;
      while (node && !listElement) {
        if (node.nodeName === 'UL' || node.nodeName === 'OL') {
          listElement = node as HTMLElement;
        }
        node = node.parentNode;
      }

      // Apply style to the list if found
      if (listElement) {
        // Apply style to the current list
        listElement.style.listStyleType = style;

        // Apply standard indentation CSS
        // Add a style element to ensure nested lists are properly indented
        const styleId = 'wiki-list-styles';
        if (!document.getElementById(styleId) && contentEditableRef.current) {
          const styleElement = document.createElement('style');
          styleElement.id = styleId;
          styleElement.textContent = `
            ul, ol {
              padding-left: 2em !important;
              list-style-position: outside !important;
            }
            li {
              margin-left: 1em !important;
            }
            li > ul, li > ol {
              margin-top: 0.5em !important;
              margin-bottom: 0.5em !important;
            }
            /* Fix for deeply nested lists to ensure bullets remain visible */
            li li li {
              margin-left: 0 !important;
              display: list-item !important;
            }
          `;
          document.head.appendChild(styleElement);
        }

        // Update currentContent to save the styling
        if (contentEditableRef.current) {
          setCurrentContent(contentEditableRef.current.innerHTML);
        }
      }
    }, 10);
  };

  // Add a function to handle creating links
  const createLink = () => {
    // Toggle the link input visibility
    setShowLinkInput(!showLinkInput);
    // Reset link URL and internal link state if closing
    if (showLinkInput) {
      setLinkUrl('');
      setIsInternalLink(false);
      setSelectedPageId('');
    }
  };

  // Update this function to handle link URL changes
  const handleLinkUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLinkUrl(e.target.value);
  };

  // Handle internal link checkbox change
  const handleInternalLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsInternalLink(e.target.checked);
    // Reset the URL or page selection when switching modes
    if (e.target.checked) {
      setLinkUrl('');
    } else {
      setSelectedPageId('');
    }
  };

  // Handle internal page selection
  const handlePageSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPageId(e.target.value);
  };

  // Function to insert the link
  const insertLink = () => {
    // Make sure the editor has focus
    if (contentEditableRef.current) {
      contentEditableRef.current.focus();
    }

    // Get current selection
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const selectedText = selection.toString();
    if (!selectedText) {
      return;
    }

    // Determine the href and target attributes based on whether it's an internal or external link
    let href;
    let target = '';

    if (isInternalLink) {
      // For internal links, use the page ID
      if (!selectedPageId) return;
      href = `#${selectedPageId}`;
      target = '_blank'; // Make internal links open in new window
    } else {
      // For external links, ensure the URL has http:// or https:// prefix
      if (!linkUrl) return;
      href = linkUrl.startsWith('http://') || linkUrl.startsWith('https://')
        ? linkUrl
        : `https://${linkUrl}`;
      target = '_blank'; // Open external links in new tab
    }

    // Create link from the current selection
    document.execCommand('createLink', false, href);

    // Set target attribute for external links and add click handler for internal links
    const links = contentEditableRef.current?.querySelectorAll('a[href="' + href + '"]');
    links?.forEach(link => {
      if (target) {
        link.setAttribute('target', target);
      }

      // For internal links, add click behavior
      if (isInternalLink) {
        // Add a custom attribute to mark it as internal
        link.setAttribute('data-internal-link', 'true');
        link.setAttribute('data-page-id', selectedPageId);

        // Also store the page title for better UX
        const pageTitle = wiki?.pages[selectedPageId]?.title || '';
        if (pageTitle) {
          link.setAttribute('title', `Navigate to: ${pageTitle}`);
        }
      }
    });

    // Update the content
    if (contentEditableRef.current) {
      setCurrentContent(contentEditableRef.current.innerHTML);
    }

    // Reset state and hide the link input
    setLinkUrl('');
    setIsInternalLink(false);
    setSelectedPageId('');
    setShowLinkInput(false);
  };

  // Handle clicks on internal links in the editor
  const handleEditorClick = (e: React.MouseEvent) => {
    const clickedElement = e.target as HTMLElement;

    // Handle link clicks
    if (clickedElement.tagName === 'A') {
      e.preventDefault();
      const href = clickedElement.getAttribute('href');
      if (href && href.startsWith('#')) {
        const pageId = href.substring(1);
        // Set the editing page to the clicked page
        setEditingPageId(pageId);

        // Focus the editor after changing page
        setTimeout(() => {
          if (contentEditableRef.current) {
            contentEditableRef.current.focus();
          }
        }, 100);
      } else if (href) {
        window.open(href, '_blank');
      }
    }
  };

  // Function to create a table 
  const createTable = () => {
    if (tableRows <= 0 || tableColumns <= 0) {
      return;
    }

    // Generate unique ID for this table
    // For the App Router (Next.js 13+)
    const wikiName = params?.wikiName as string || '';
    const safeWikiName = wikiName.toLowerCase().replace(/\s+/g, '-');
    const timestamp = Date.now();
    const tableId = `${safeWikiName}_${timestamp}`;

    // Create table structure JSON
    const tableData: TableData = {
      id: tableId,
      rows: tableRows,
      columns: tableColumns,
      hasHeader: tableHeaderRow,
      cells: []
    };

    // Initialize cells with default content
    for (let row = 0; row < tableRows; row++) {
      for (let col = 0; col < tableColumns; col++) {
        const isHeader = tableHeaderRow && row === 0;
        tableData.cells.push({
          row,
          col,
          content: isHeader ? `Header ${col + 1}` : `Cell ${row + 1},${col + 1}`,
          isHeader
        });
      }
    }

    // Create default table style
    const tableStyle: TableStyle = {
      id: tableId,
      type: 'default' as const,
      tableStyles: {
        width: "100%",
        borderCollapse: "collapse",
        margin: "1em 0"
      },
      headerStyles: {
        border: "1px solid #ccc",
        padding: "8px",
        backgroundColor: "#f2f2f2",
        fontWeight: "bold",
        textAlign: "left"
      },
      cellStyles: {
        border: "1px solid #ccc",
        padding: "8px",
        textAlign: "left"
      }
    };

    // Save the table data
    saveTableData(tableId, tableData, tableStyle)
      .then(() => {
        // Create table iframe HTML with a dedicated edit button
        setTableHTML(`
          <div class="table-container" style="position: relative; margin: 1em 0; min-height: 50px;">
            <button 
              class="table-edit-button" 
              data-table-id="${tableId}" 
              style="position: absolute; top: 0; right: 0; background: #3b82f6; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer; z-index: 10;"
              onmousedown="event.preventDefault(); event.stopPropagation(); window.editTable('${tableId}', event); return false;"
            >
              Edit Table
            </button>
            <iframe 
              src="/api/table-renderer?tableId=${tableId}" 
              class="wiki-table-frame" 
              data-table-id="${tableId}" 
              style="width: 100%; border: none; overflow: hidden;"
              title="Embedded table"
            ></iframe>
          </div>
        `);

        // Show modal to insert table
        setShowTableInsert(true);
      })
      .catch(error => {
        console.error('Error creating table:', error);
        alert('Failed to create table. Please try again.');
      });

    // Close the table creation modal
    setShowTableModal(false);
  };

  // Helper function to save table data
  const saveTableData = async (tableId: string, tableData: TableData, tableStyle: TableStyle) => {
    try {
      console.log(`Saving table data for table ID: ${tableId}`);

      // Save table data
      const response = await fetch(`/api/tables/${tableId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: tableData,
          style: tableStyle
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save table data: ${response.status} - ${errorText}`);
      }

      console.log('Table data saved successfully for ID:', tableId);

      // Verify the table data was saved by attempting to fetch it back
      try {
        const verifyResponse = await fetch(`/api/tables/${tableId}`);
        if (verifyResponse.ok) {
          console.log('Successfully verified table data was saved');
        } else {
          console.warn(`Table saved but verification failed: ${verifyResponse.status}`);
        }
      } catch (verifyError) {
        console.warn('Table saved but verification threw an error:', verifyError);
      }
    } catch (error) {
      console.error('Error saving table data:', error);
      throw error; // Rethrow to allow handling in the calling function
    }
  };

  // Function to insert the created table
  const insertTable = () => {
    // Make sure the editor has focus
    if (contentEditableRef.current) {
      contentEditableRef.current.focus();
    }

    // Insert iframe HTML at cursor position
    document.execCommand('insertHTML', false, tableHTML);

    // Update content
    if (contentEditableRef.current) {
      setCurrentContent(contentEditableRef.current.innerHTML);
    }

    // Reset state
    setTableHTML('');
    setShowTableInsert(false);
  };

  // Function to open table editor modal


  // Update the openTableEditorModal function (keep it separate from useEffect)
  const openTableEditorModal = useCallback(async (tableId: string) => {
    try {
      // Fetch table data
      const response = await fetch(`/api/tables/${tableId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch table data: ${response.status}`);
      }

      const { data, style } = await response.json();

      // Set table data in state
      setEditingTableId(tableId);
      setEditingTableData(data);
      setEditingTableStyle(style);

      // Show modal
      setShowTableEditorModal(true);
    } catch (error) {
      console.error('Error fetching table data:', error);
      alert('Error loading table editor. Please try again.');
    }
  }, []); // Empty dependencies array since we don't use any external values

  // Function to refresh table iframes after editing
  const refreshTableIframes = () => {
    if (contentEditableRef.current) {
      const iframes = contentEditableRef.current.querySelectorAll('.wiki-table-frame') as NodeListOf<HTMLIFrameElement>;
      iframes.forEach((iframe) => {
        // Add timestamp parameter to force refresh
        const src = iframe.src.split('?')[0];
        iframe.src = `${src}?t=${Date.now()}`;
      });
    }
  };

  // Add this new useEffect to update the ref whenever openTableEditorModal changes
  useEffect(() => {
    openTableEditorModalRef.current = openTableEditorModal;
  }, []);  // Empty dependency array since we always want to reference the latest function

  // Update the useEffect that defines the global editTable function
  useEffect(() => {
    // TypeScript declare global for window
    interface CustomWindow extends Window {
      editTable?: (tableId: string, e?: MouseEvent) => boolean;
    }

    // Add the global function to edit tables
    const editTableFunction = (tableId: string, e?: MouseEvent) => {
      console.log('Edit button clicked for table', tableId);

      // Prevent default behavior and stop propagation
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      // Use the ref to call the latest version of the function
      if (openTableEditorModalRef.current) {
        openTableEditorModalRef.current(tableId);
      } else {
        console.error('openTableEditorModal reference is not available');
      }
      return false;
    };

    // Assign to window safely
    (window as unknown as CustomWindow).editTable = editTableFunction;

    // Add edit buttons to any existing tables
    const addEditButtonsToTables = () => {
      if (!contentEditableRef.current) return;

      const tables = contentEditableRef.current.querySelectorAll('.table-container');
      tables.forEach((table) => {
        // Skip if it already has an edit button
        if (table.querySelector('.table-edit-button')) return;

        // Find the iframe
        const iframe = table.querySelector('.wiki-table-frame') as HTMLIFrameElement;
        if (!iframe) return;

        // Get the table ID
        const tableId = iframe.getAttribute('data-table-id');
        if (!tableId) return;

        // Create edit button
        const editButton = document.createElement('button');
        editButton.className = 'table-edit-button';
        editButton.setAttribute('data-table-id', tableId);
        editButton.innerHTML = 'Edit Table';
        editButton.style.cssText = 'position: absolute; top: 0; right: 0; background: #3b82f6; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer; z-index: 10;';
        editButton.onmousedown = function (e) {
          e.preventDefault();
          e.stopPropagation();
          const customWindow = (window as unknown as CustomWindow);
          if (customWindow.editTable) {
            customWindow.editTable(tableId, e);
          }
          return false;
        };

        // Make sure table container has relative positioning
        if (table instanceof HTMLElement) {
          table.style.position = 'relative';
          table.style.minHeight = '50px';
        }

        // Add button to table container
        table.insertBefore(editButton, table.firstChild);
      });
    };

    // Add edit buttons when the page loads
    addEditButtonsToTables();

    // Also re-add them whenever the content changes
    const contentObserver = new MutationObserver(addEditButtonsToTables);
    if (contentEditableRef.current) {
      contentObserver.observe(contentEditableRef.current, {
        childList: true,
        subtree: true
      });
    }

    return () => {
      // Clean up
      delete (window as unknown as CustomWindow).editTable;
      contentObserver.disconnect();
    };
  }, [openTableEditorModal]);

  // Upload and insert image
  const uploadImage = async (file: File): Promise<string> => {
    if (!file) return '';

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch(`http://localhost:3001/api/wiki/${encodedWikiName}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      const fullImageUrl = `http://localhost:3001${data.url}`;
      setUploadedImageUrl(fullImageUrl);
      return fullImageUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
      return '';
    }
  };

  // Create image insert modal
  const createImageInsert = () => {
    // Toggle the image upload visibility
    setShowImageUpload(!showImageUpload);

    // Reset state if closing
    if (showImageUpload) {
      setImageWidth(300);
      setImageAlignment('center');
      setUploadedImageUrl('');
      setShowImageInsert(false);
      setImageHTML('');
    }
  };

  // Handle file selection
  const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const imageUrl = await uploadImage(file);
    if (imageUrl) {
      // Prepare HTML for the image with configurable width and alignment
      createImageHTMLFromURL(imageUrl);
      // Show insert button
      setShowImageInsert(true);
    }
  };

  // Create image HTML based on current settings
  const createImageHTMLFromURL = (imageUrl: string) => {
    let alignStyle = '';
    const containerStyle = '';

    switch (imageAlignment) {
      case 'left':
        alignStyle = 'float: left; margin-right: 15px; margin-bottom: 10px;';
        break;
      case 'center':
        alignStyle = 'display: block; margin-left: auto; margin-right: auto; margin-bottom: 10px;';
        break;
      case 'right':
        alignStyle = 'float: right; margin-left: 15px; margin-bottom: 10px;';
        break;
    }

    // Create image HTML with explicit width in pixels
    const html = `
      <div class="wiki-image-container" style="${containerStyle}">
        <img src="${imageUrl}" alt="Wiki Image" style="width: ${imageWidth}px; ${alignStyle}" class="wiki-image" />
      </div>
    `;

    setImageHTML(html);
  };

  // Insert the image at cursor position
  const insertImage = () => {
    // Make sure the editor has focus and get the contentEditable div
    const editor = contentEditableRef.current;
    if (!editor) return;

    editor.focus();

    // Get current selection
    const selection = window.getSelection();
    if (!selection) return;

    // Create a new range if there isn't one
    let range = selection.getRangeAt(0);
    if (!range) {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false); // Collapse to end
      selection.removeAllRanges();
      selection.addRange(range);
    }

    // Create a temporary container for the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = imageHTML.trim();
    const imageNode = tempDiv.firstElementChild;

    if (!imageNode) return;

    // Insert the image at the current range
    range.deleteContents();
    range.insertNode(imageNode);

    // Move the cursor after the inserted image
    range.setStartAfter(imageNode);
    range.setEndAfter(imageNode);
    selection.removeAllRanges();
    selection.addRange(range);

    // Update content state
    setCurrentContent(editor.innerHTML);

    // Reset state
    setShowImageInsert(false);
    setShowImageUpload(false);
  };

  // Re-upload image when clicked on "Image" button again when already has an image
  const retryImageUpload = () => {
    // Trigger the file input click
    if (imageFileInputRef.current) {
      imageFileInputRef.current.click();
    }
  };

  // update image width
  const handleImageWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const width = parseInt(e.target.value);
    if (!isNaN(width) && width > 0) {
      // Set the new width value in state
      setImageWidth(width);
      // Then regenerate the image HTML with this new width
      if (uploadedImageUrl) {
        setTimeout(() => {
          createImageHTMLFromURL(uploadedImageUrl);
        }, 0);
      }
    }
  };

  // update image alignment
  const setImageAlignmentAndUpdateHTML = (alignment: 'left' | 'center' | 'right') => {
    setImageAlignment(alignment);
    if (uploadedImageUrl) {
      createImageHTMLFromURL(uploadedImageUrl);
    }
  };

  // Add this useEffect
  // Combined useEffect for background and text colors
  // Modify the existing useEffect that handles editor background and text colors
  useEffect(() => {
    // Store a reference to the current editor element
    const editorElement = contentEditableRef.current;

    // Function to reapply background color after events
    const handleEditorEvents = () => {
      setTimeout(() => {
        if (editorElement) {
          editorElement.style.setProperty('background-color', mainColor, 'important');
          editorElement.style.setProperty('color', textPrimaryColor, 'important'); // Add this line
        }
      }, 10);
    };

    if (editorElement && editingPageId) {
      // Apply main component background color directly with !important
      editorElement.style.setProperty('background-color', mainColor, 'important');

      // Apply default text color
      editorElement.style.setProperty('color', textPrimaryColor, 'important');

      // Create or update style tag for more specific text styling
      const styleId = 'editor-color-styles';
      let styleTag = document.getElementById(styleId);

      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
      }

      // Add specific rule for the editor to ensure it uses main color
      styleTag.innerHTML = `
      /* Force editor background to use main color */
      .editor-content, 
      [contenteditable="true"],
      [data-ms-editor="true"] {
        background-color: ${mainColor} !important;
      }
      
      /* Apply primary text color to headings that don't have inline styles */
      .editor-content h1:not([style*="color"]),
      .editor-content h2:not([style*="color"]),
      .editor-content h3:not([style*="color"]),
      .editor-content h4:not([style*="color"]),
      .editor-content h5:not([style*="color"]),
      .editor-content h6:not([style*="color"]) {
        color: ${textPrimaryColor} !important;
      }
      
      /* Apply secondary text color to metadata elements */
      .editor-content .metadata:not([style*="color"]),
      .editor-content .description:not([style*="color"]),
      .editor-content small:not([style*="color"]) {
        color: ${textSecondaryColor} !important;
      }
    `;

      // Add event listeners to ensure styling persists
      editorElement.addEventListener('focus', handleEditorEvents);
      editorElement.addEventListener('blur', handleEditorEvents);
      editorElement.addEventListener('input', handleEditorEvents);
      editorElement.addEventListener('keyup', handleEditorEvents);
      editorElement.addEventListener('mouseup', handleEditorEvents);
    }

    // Cleanup function
    return () => {
      if (editorElement) {
        // Remove event listeners
        editorElement.removeEventListener('focus', handleEditorEvents);
        editorElement.removeEventListener('blur', handleEditorEvents);
        editorElement.removeEventListener('input', handleEditorEvents);
        editorElement.removeEventListener('keyup', handleEditorEvents);
        editorElement.removeEventListener('mouseup', handleEditorEvents);
      }

      // Remove style tag
      const styleTag = document.getElementById('editor-color-styles');
      if (styleTag) {
        styleTag.remove();
      }
    };
  }, [mainColor, textDefaultColor, textPrimaryColor, textSecondaryColor, editingPageId]);

  // Add function to update default author
  const updateDefaultAuthor = () => {
    if (!wiki) return;
    saveWiki();
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Add global styles for the editor */}
      <style jsx global>{`
        .editor-content a {
          color: #0066CC;
          text-decoration: underline;
        }
      `}</style>

      {/* Header */}
      <header className="bg-white shadow-sm py-4 px-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">{wikiName} - Editor</h1>
          <div className="flex space-x-4">
            <button
              onClick={saveWiki}
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md shadow-sm font-medium disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <Link
              href="/admin"
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md shadow-sm font-medium"
            >
              Back to Admin
            </Link>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto">
          <div className="flex space-x-6 px-6">
            <button
              onClick={() => setActiveTab('editor')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'editor'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Editor
            </button>
            <button
              onClick={() => setActiveTab('pages')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'pages'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Pages
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'settings'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Settings
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'preview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Preview
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow p-6">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'editor' && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-4 border-b bg-gray-50">
                <div className="flex justify-between items-center">
                  <div className="flex space-x-2">
                    <button
                      onMouseDown={(e) => applyFormatting(e, 'bold')}
                      className="p-2 rounded hover:bg-gray-200"
                      title="Bold"
                      type="button"
                    >
                      <span className="font-bold">B</span>
                    </button>
                    <button
                      onMouseDown={(e) => applyFormatting(e, 'italic')}
                      className="p-2 rounded hover:bg-gray-200"
                      title="Italic"
                      type="button"
                    >
                      <span className="italic">I</span>
                    </button>
                    <button
                      onMouseDown={(e) => applyFormatting(e, 'underline')}
                      className="p-2 rounded hover:bg-gray-200"
                      title="Underline"
                      type="button"
                    >
                      <span className="underline">U</span>
                    </button>
                    <button
                      onMouseDown={(e) => applyFormatting(e, 'normal')}
                      className="p-2 rounded hover:bg-gray-200"
                      title="Remove Formatting"
                      type="button"
                    >
                      N
                    </button>
                    <div className="border-r mx-2"></div>
                    <button
                      onMouseDown={(e) => applyFormatting(e, 'h1')}
                      className="p-2 rounded hover:bg-gray-200"
                      title="Heading 1"
                      type="button"
                    >
                      H1
                    </button>
                    <button
                      onMouseDown={(e) => applyFormatting(e, 'h2')}
                      className="p-2 rounded hover:bg-gray-200"
                      title="Heading 2"
                      type="button"
                    >
                      H2
                    </button>
                    <button
                      onMouseDown={(e) => applyFormatting(e, 'h3')}
                      className="p-2 rounded hover:bg-gray-200"
                      title="Heading 3"
                      type="button"
                    >
                      H3
                    </button>
                    <button
                      onMouseDown={(e) => applyFormatting(e, 'p')}
                      className="p-2 rounded hover:bg-gray-200"
                      title="Justify Text"
                      type="button"
                    >
                      <span style={{ fontSize: '18px' }}>⧏⧐</span>
                    </button>
                    <button
                      onMouseDown={(e) => applyFormatting(e, 'line')}
                      className="p-2 rounded hover:bg-gray-200"
                      title="Insert Line"
                      type="button"
                    >
                      <span style={{ fontSize: '18px' }}>―</span>
                    </button>
                    <div className="border-r mx-2"></div>

                    {/* Bullet List dropdown */}
                    <div className="relative inline-block">
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const dropdown = e.currentTarget.nextElementSibling;
                          if (dropdown) {
                            dropdown.classList.toggle('hidden');
                          }
                        }}
                        className="p-2 rounded hover:bg-gray-200 flex items-center"
                        title="Bullet List"
                        type="button"
                      >
                        <span style={{ fontSize: '18px' }}>•</span>
                      </button>
                      <div className="absolute z-10 hidden bg-white border rounded shadow-lg mt-1 p-1 flex-col min-w-[120px]">
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applyFormatting(e, 'bullet-disc');
                            e.currentTarget.parentElement?.classList.add('hidden');
                          }}
                          className="p-1 rounded hover:bg-gray-200 flex items-center"
                          title="Disc Bullets"
                          type="button"
                        >
                          <span style={{ marginRight: '4px' }}>•</span> Disc
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applyFormatting(e, 'bullet-circle');
                            e.currentTarget.parentElement?.classList.add('hidden');
                          }}
                          className="p-1 rounded hover:bg-gray-200 flex items-center"
                          title="Circle Bullets"
                          type="button"
                        >
                          <span style={{ marginRight: '4px' }}>○</span> Circle
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applyFormatting(e, 'bullet-square');
                            e.currentTarget.parentElement?.classList.add('hidden');
                          }}
                          className="p-1 rounded hover:bg-gray-200 flex items-center"
                          title="Square Bullets"
                          type="button"
                        >
                          <span style={{ marginRight: '4px' }}>■</span> Square
                        </button>
                      </div>
                    </div>

                    {/* Numbered List dropdown */}
                    <div className="relative inline-block">
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const dropdown = e.currentTarget.nextElementSibling;
                          if (dropdown) {
                            dropdown.classList.toggle('hidden');
                          }
                        }}
                        className="p-2 rounded hover:bg-gray-200 flex items-center"
                        title="Numbered List"
                        type="button"
                      >
                        <span style={{ fontSize: '18px' }}>1.</span>
                      </button>
                      <div className="absolute z-10 hidden bg-white border rounded shadow-lg mt-1 p-1 flex-col min-w-[150px]">
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applyFormatting(e, 'number-decimal');
                            e.currentTarget.parentElement?.classList.add('hidden');
                          }}
                          className="p-1 rounded hover:bg-gray-200 flex items-center"
                          title="Decimal Numbers"
                          type="button"
                        >
                          <span style={{ marginRight: '4px' }}>1.</span> Numbers
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applyFormatting(e, 'number-alpha-lower');
                            e.currentTarget.parentElement?.classList.add('hidden');
                          }}
                          className="p-1 rounded hover:bg-gray-200 flex items-center"
                          title="Lowercase Letters"
                          type="button"
                        >
                          <span style={{ marginRight: '4px' }}>a.</span> Lowercase
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applyFormatting(e, 'number-alpha-upper');
                            e.currentTarget.parentElement?.classList.add('hidden');
                          }}
                          className="p-1 rounded hover:bg-gray-200 flex items-center"
                          title="Uppercase Letters"
                          type="button"
                        >
                          <span style={{ marginRight: '4px' }}>A.</span> Uppercase
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applyFormatting(e, 'number-roman-lower');
                            e.currentTarget.parentElement?.classList.add('hidden');
                          }}
                          className="p-1 rounded hover:bg-gray-200 flex items-center"
                          title="Lowercase Roman"
                          type="button"
                        >
                          <span style={{ marginRight: '4px' }}>i.</span> Roman (i, ii)
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applyFormatting(e, 'number-roman-upper');
                            e.currentTarget.parentElement?.classList.add('hidden');
                          }}
                          className="p-1 rounded hover:bg-gray-200 flex items-center"
                          title="Uppercase Roman"
                          type="button"
                        >
                          <span style={{ marginRight: '4px' }}>I.</span> Roman (I, II)
                        </button>
                      </div>
                    </div>

                    {/* Indent/Outdent buttons */}
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyFormatting(e, 'indent');
                      }}
                      className="p-2 rounded hover:bg-gray-200"
                      title="Increase Indent"
                      type="button"
                    >
                      <span style={{ fontSize: '18px' }}>→</span>
                    </button>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyFormatting(e, 'outdent');
                      }}
                      className="p-2 rounded hover:bg-gray-200"
                      title="Decrease Indent"
                      type="button"
                    >
                      <span style={{ fontSize: '18px' }}>←</span>
                    </button>

                    <div className="border-r mx-2"></div>

                    {/* Text Color dropdown */}
                    <div className="relative inline-block">
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const dropdown = e.currentTarget.nextElementSibling;
                          if (dropdown) {
                            dropdown.classList.toggle('hidden');
                          }
                        }}
                        className="p-2 rounded hover:bg-gray-200 flex items-center"
                        title="Text Color"
                        type="button"
                      >
                        <span style={{ fontSize: '18px' }}>A</span>
                        <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: 'black', marginLeft: '2px' }}></span>
                      </button>
                      <div className="absolute z-10 hidden bg-white border rounded shadow-lg mt-1 p-1 flex-col">
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applyFormatting(e, 'color-default');
                            e.currentTarget.parentElement?.classList.add('hidden');
                          }}
                          className="p-1 rounded hover:bg-gray-200 flex items-center"
                          title="Default"
                          type="button"
                        >
                          <span style={{ display: 'inline-block', width: '16px', height: '16px', backgroundColor: 'black', marginRight: '4px' }}></span>
                          Default
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applyFormatting(e, 'color-red');
                            e.currentTarget.parentElement?.classList.add('hidden');
                          }}
                          className="p-1 rounded hover:bg-gray-200 flex items-center"
                          title="Red"
                          type="button"
                        >
                          <span style={{ display: 'inline-block', width: '16px', height: '16px', backgroundColor: '#CC0000', marginRight: '4px' }}></span>
                          Red
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applyFormatting(e, 'color-blue');
                            e.currentTarget.parentElement?.classList.add('hidden');
                          }}
                          className="p-1 rounded hover:bg-gray-200 flex items-center"
                          title="Blue"
                          type="button"
                        >
                          <span style={{ display: 'inline-block', width: '16px', height: '16px', backgroundColor: '#0066CC', marginRight: '4px' }}></span>
                          Blue
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applyFormatting(e, 'color-green');
                            e.currentTarget.parentElement?.classList.add('hidden');
                          }}
                          className="p-1 rounded hover:bg-gray-200 flex items-center"
                          title="Green"
                          type="button"
                        >
                          <span style={{ display: 'inline-block', width: '16px', height: '16px', backgroundColor: '#008800', marginRight: '4px' }}></span>
                          Green
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applyFormatting(e, 'color-purple');
                            e.currentTarget.parentElement?.classList.add('hidden');
                          }}
                          className="p-1 rounded hover:bg-gray-200 flex items-center"
                          title="Purple"
                          type="button"
                        >
                          <span style={{ display: 'inline-block', width: '16px', height: '16px', backgroundColor: '#660099', marginRight: '4px' }}></span>
                          Purple
                        </button>
                      </div>
                    </div>

                    {/* Background Color dropdown */}
                    <div className="relative inline-block">
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const dropdown = e.currentTarget.nextElementSibling;
                          if (dropdown) {
                            dropdown.classList.toggle('hidden');
                          }
                        }}
                        className="p-2 rounded hover:bg-gray-200 flex items-center"
                        title="Highlight Color"
                        type="button"
                      >
                        <span style={{ fontSize: '18px', backgroundColor: 'yellow', padding: '0 2px' }}>A</span>
                      </button>
                      <div className="absolute z-10 hidden bg-white border rounded shadow-lg mt-1 p-1 flex-col">
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applyFormatting(e, 'bg-default');
                            e.currentTarget.parentElement?.classList.add('hidden');
                          }}
                          className="p-1 rounded hover:bg-gray-200 flex items-center"
                          title="No Highlight"
                          type="button"
                        >
                          <span style={{ display: 'inline-block', width: '16px', height: '16px', backgroundColor: 'transparent', border: '1px solid #ccc', marginRight: '4px' }}></span>
                          None
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applyFormatting(e, 'bg-yellow');
                            e.currentTarget.parentElement?.classList.add('hidden');
                          }}
                          className="p-1 rounded hover:bg-gray-200 flex items-center"
                          title="Yellow Highlight"
                          type="button"
                        >
                          <span style={{ display: 'inline-block', width: '16px', height: '16px', backgroundColor: '#FFFFCC', marginRight: '4px' }}></span>
                          Yellow
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applyFormatting(e, 'bg-blue');
                            e.currentTarget.parentElement?.classList.add('hidden');
                          }}
                          className="p-1 rounded hover:bg-gray-200 flex items-center"
                          title="Blue Highlight"
                          type="button"
                        >
                          <span style={{ display: 'inline-block', width: '16px', height: '16px', backgroundColor: '#E6F3FF', marginRight: '4px' }}></span>
                          Blue
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applyFormatting(e, 'bg-green');
                            e.currentTarget.parentElement?.classList.add('hidden');
                          }}
                          className="p-1 rounded hover:bg-gray-200 flex items-center"
                          title="Green Highlight"
                          type="button"
                        >
                          <span style={{ display: 'inline-block', width: '16px', height: '16px', backgroundColor: '#E6FFE6', marginRight: '4px' }}></span>
                          Green
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applyFormatting(e, 'bg-pink');
                            e.currentTarget.parentElement?.classList.add('hidden');
                          }}
                          className="p-1 rounded hover:bg-gray-200 flex items-center"
                          title="Pink Highlight"
                          type="button"
                        >
                          <span style={{ display: 'inline-block', width: '16px', height: '16px', backgroundColor: '#FFE6E6', marginRight: '4px' }}></span>
                          Pink
                        </button>
                      </div>
                    </div>

                    <div className="border-r mx-2"></div>
                    <button
                      onClick={() => setShowAddPageModal(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      title="Add Page"
                      type="button"
                    >
                      Add Page
                    </button>
                  </div>

                  {/* Page selector */}
                  <div className="ml-4">
                    <select
                      value={editingPageId || ''}
                      onChange={(e) => setEditingPageId(e.target.value || null)}
                      className="p-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Select a page to edit</option>
                      {wiki && Object.values(wiki.pages).map(page => (
                        <option key={page.id} value={page.id}>
                          {page.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* New completely separate toolbar for insertions */}
              <div className="p-4 border-b bg-gray-100">
                <div className="flex space-x-4">
                  <div className="flex items-center">
                    <span className="mr-2 font-medium text-gray-700">Insert:</span>

                    {/* Hyperlink section */}
                    <div className="flex items-center">
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          createLink();
                        }}
                        className={`p-2 rounded hover:bg-gray-200 flex items-center space-x-2 ${showLinkInput ? 'bg-gray-200' : ''}`}
                        title="Add Link"
                        type="button"
                      >
                        <span style={{ fontSize: '18px' }}>🔗</span>
                        <span>Link</span>
                      </button>

                      {showLinkInput && (
                        <div className="flex items-start ml-2">
                          <div className="flex flex-col space-y-2">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id="internalLink"
                                checked={isInternalLink}
                                onChange={handleInternalLinkChange}
                                className="mr-1"
                              />
                              <label htmlFor="internalLink" className="text-sm text-gray-700 mr-2">
                                Internal Page Link
                              </label>
                            </div>

                            <div className="flex items-center">
                              {isInternalLink ? (
                                <select
                                  value={selectedPageId}
                                  onChange={handlePageSelection}
                                  className="p-1 border border-gray-300 rounded w-64"
                                >
                                  <option value="">Select page...</option>
                                  {wiki && Object.values(wiki.pages).map(page => (
                                    <option key={page.id} value={page.id}>
                                      {page.title}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={linkUrl}
                                  onChange={handleLinkUrlChange}
                                  placeholder="Paste URL here..."
                                  className="p-1 border border-gray-300 rounded w-64"
                                  autoFocus
                                />
                              )}

                              <button
                                onMouseDown={(e) => {
                                  e.preventDefault(); // Prevent focus loss
                                  insertLink();
                                }}
                                disabled={isInternalLink ? !selectedPageId : !linkUrl}
                                className={`ml-2 px-3 py-1 rounded ${(isInternalLink && selectedPageId) || (!isInternalLink && linkUrl)
                                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                  }`}
                              >
                                Insert
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Add Table button and Insert interface */}
                    <div className="flex items-center">
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (!showTableInsert) {
                            setShowTableModal(true);
                          }
                        }}
                        className={`p-2 rounded hover:bg-gray-200 flex items-center space-x-2 ml-2 ${showTableInsert ? 'bg-gray-200' : ''}`}
                        title="Add Table"
                        type="button"
                      >
                        <span style={{ fontSize: '18px' }}>⊞</span>
                        <span>Table</span>
                      </button>

                      {showTableInsert && (
                        <div className="flex items-center ml-2">
                          <button
                            className="p-1 border border-gray-300 rounded text-gray-700 bg-gray-100 hover:bg-gray-200 flex items-center space-x-1"
                            onClick={() => setShowTableModal(true)}
                          >
                            <span className="text-sm">Table Created</span>
                            <span className="text-xs ml-1">✎</span>
                          </button>
                          <button
                            onMouseDown={(e) => {
                              e.preventDefault(); // Prevent focus loss
                              insertTable();
                            }}
                            className="ml-2 px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                          >
                            Insert
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Image insertion section */}
                    <div className="flex items-center">
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          createImageInsert();
                        }}
                        className={`p-2 rounded hover:bg-gray-200 flex items-center space-x-2 ml-2 ${showImageUpload ? 'bg-gray-200' : ''}`}
                        title="Insert Image"
                        type="button"
                      >
                        <span style={{ fontSize: '18px' }}>🖼️</span>
                        <span>Image</span>
                      </button>

                      {showImageUpload && (
                        <div className="flex items-start ml-2">
                          <div className="flex flex-col space-y-2">
                            {uploadedImageUrl ? (
                              <div className="flex flex-col">
                                <div className="flex items-center mb-2">
                                  <Image
                                    src={uploadedImageUrl}
                                    alt="Selected"
                                    width={64}
                                    height={64}
                                    className="border border-gray-300 mr-2 object-contain"
                                  />
                                  <button
                                    onClick={retryImageUpload}
                                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                                  >
                                    Change
                                  </button>
                                </div>
                                <div className="flex flex-col space-y-2 p-2 border border-gray-200 rounded bg-gray-50">
                                  <div className="flex items-center">
                                    <label className="text-sm text-gray-700 w-20">Width (px):</label>
                                    <input
                                      type="number"
                                      value={imageWidth}
                                      onChange={handleImageWidthChange}
                                      className="w-16 p-1 border border-gray-300 rounded"
                                      min="50"
                                      max="1000"
                                    />
                                  </div>
                                  <div className="flex items-center">
                                    <label className="text-sm text-gray-700 w-20">Alignment:</label>
                                    <div className="flex space-x-2">
                                      <button
                                        onClick={() => setImageAlignmentAndUpdateHTML('left')}
                                        className={`p-1 border rounded ${imageAlignment === 'left' ? 'bg-blue-100 border-blue-400' : 'border-gray-300'}`}
                                      >
                                        <span role="img" aria-label="Align Left">⬅️</span>
                                      </button>
                                      <button
                                        onClick={() => setImageAlignmentAndUpdateHTML('center')}
                                        className={`p-1 border rounded ${imageAlignment === 'center' ? 'bg-blue-100 border-blue-400' : 'border-gray-300'}`}
                                      >
                                        <span role="img" aria-label="Align Center">⬛</span>
                                      </button>
                                      <button
                                        onClick={() => setImageAlignmentAndUpdateHTML('right')}
                                        className={`p-1 border rounded ${imageAlignment === 'right' ? 'bg-blue-100 border-blue-400' : 'border-gray-300'}`}
                                      >
                                        <span role="img" aria-label="Align Right">➡️</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center">
                                <input
                                  ref={imageFileInputRef}
                                  type="file"
                                  accept="image/*"
                                  onChange={handleImageFileChange}
                                  className="hidden"
                                />
                                <button
                                  onClick={() => imageFileInputRef.current?.click()}
                                  className="px-3 py-1 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50"
                                >
                                  Select Image
                                </button>
                              </div>
                            )}

                            {showImageInsert && (
                              <div className="flex justify-end">
                                <button
                                  onMouseDown={(e) => {
                                    e.preventDefault(); // Prevent focus loss
                                    insertImage();
                                  }}
                                  className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                                >
                                  Insert
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4">
                {editingPageId ? (
                  <>
                    <div
                      ref={contentEditableRef}
                      className="w-full h-[calc(90vh-200px)] p-4 border rounded-md overflow-y-auto editor-content"
                      contentEditable
                      dangerouslySetInnerHTML={{ __html: currentContent }}
                      onBlur={(e) => savePageContent(e.currentTarget.innerHTML)}
                      spellCheck="false"
                      data-ms-editor="true"
                      onClick={handleEditorClick}
                    />
                  </>
                ) : (
                  <div className="w-full h-[calc(90vh-200px)] flex items-center justify-center border rounded-md bg-gray-50 text-gray-500">
                    Select a page to edit or create a new page
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'pages' && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                <h2 className="font-medium">Manage Pages</h2>
                <button
                  onClick={() => setShowAddPageModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Add Page
                </button>

              </div>
              <div className="p-4">
                {wiki && wiki.pages && Object.keys(wiki.pages).length > 0 ? (
                  <div className="divide-y">
                    {Object.values(wiki.pages)
                      .sort((a, b) => a.order - b.order)
                      .map((page, index, array) => (
                        <div key={page.id} className="py-4 flex justify-between items-center">
                          <div className="flex-1">
                            <h3 className="font-medium">{page.title}</h3>
                            <div className="text-sm text-gray-500">
                              {page.parentId ? (
                                <span>Child of: {wiki.pages[page.parentId]?.title || 'Unknown'}</span>
                              ) : (
                                <span>Root page</span>
                              )}
                              {page.tags.length > 0 && (
                                <span className="ml-4">
                                  Tags: {page.tags.join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={async () => {
                                // Move page up in order, but only among siblings at the same level
                                if (index > 0) {
                                  const updatedWiki = { ...wiki };
                                  const currentPage = { ...page };

                                  // Find the previous sibling (same parent or both at root)
                                  let prevSiblingIndex = -1;
                                  for (let i = index - 1; i >= 0; i--) {
                                    if ((currentPage.parentId === null && array[i].parentId === null) ||
                                      (currentPage.parentId !== null && array[i].parentId === currentPage.parentId)) {
                                      prevSiblingIndex = i;
                                      break;
                                    }
                                  }

                                  // If a valid previous sibling was found
                                  if (prevSiblingIndex >= 0) {
                                    const prevSibling = { ...array[prevSiblingIndex] };

                                    // Swap orders
                                    const tempOrder = currentPage.order;
                                    currentPage.order = prevSibling.order;
                                    prevSibling.order = tempOrder;

                                    // Update pages in wiki
                                    updatedWiki.pages[currentPage.id] = currentPage;
                                    updatedWiki.pages[prevSibling.id] = prevSibling;

                                    setWiki(updatedWiki);

                                    // Generate updated HTML
                                    const updatedHtml = await generateWikiHtml(updatedWiki);
                                    setHtmlContent(updatedHtml);

                                    // Save changes
                                    saveWiki();
                                  }
                                }
                              }}
                              disabled={index === 0 || !array.slice(0, index).some(p =>
                                (page.parentId === null && p.parentId === null) ||
                                (page.parentId !== null && p.parentId === page.parentId)
                              )}
                              className={`p-2 rounded ${index === 0 || !array.slice(0, index).some(p =>
                                (page.parentId === null && p.parentId === null) ||
                                (page.parentId !== null && p.parentId === page.parentId)
                              )
                                ? 'text-gray-400 cursor-not-allowed'
                                : 'text-blue-600 hover:bg-blue-100'
                                }`}
                              title="Move Up"
                            >
                              ↑
                            </button>
                            <button
                              onClick={async () => {
                                // Move page down in order, but only among siblings at the same level
                                if (index < array.length - 1) {
                                  const updatedWiki = { ...wiki };
                                  const currentPage = { ...page };

                                  // Find the next sibling (same parent or both at root)
                                  let nextSiblingIndex = -1;
                                  for (let i = index + 1; i < array.length; i++) {
                                    if ((currentPage.parentId === null && array[i].parentId === null) ||
                                      (currentPage.parentId !== null && array[i].parentId === currentPage.parentId)) {
                                      nextSiblingIndex = i;
                                      break;
                                    }
                                  }

                                  // If a valid next sibling was found
                                  if (nextSiblingIndex >= 0) {
                                    const nextSibling = { ...array[nextSiblingIndex] };

                                    // Swap orders
                                    const tempOrder = currentPage.order;
                                    currentPage.order = nextSibling.order;
                                    nextSibling.order = tempOrder;

                                    // Update pages in wiki
                                    updatedWiki.pages[currentPage.id] = currentPage;
                                    updatedWiki.pages[nextSibling.id] = nextSibling;

                                    setWiki(updatedWiki);

                                    // Generate updated HTML
                                    const updatedHtml = await generateWikiHtml(updatedWiki);
                                    setHtmlContent(updatedHtml);

                                    // Save changes
                                    saveWiki();
                                  }
                                }
                              }}
                              disabled={index === array.length - 1 || !array.slice(index + 1).some(p =>
                                (page.parentId === null && p.parentId === null) ||
                                (page.parentId !== null && p.parentId === page.parentId)
                              )}
                              className={`p-2 rounded ${index === array.length - 1 || !array.slice(index + 1).some(p =>
                                (page.parentId === null && p.parentId === null) ||
                                (page.parentId !== null && p.parentId === page.parentId)
                              )
                                ? 'text-gray-400 cursor-not-allowed'
                                : 'text-blue-600 hover:bg-blue-100'
                                }`}
                              title="Move Down"
                            >
                              ↓
                            </button>
                            <button
                              onClick={() => {
                                // Edit page function
                                // Open modal with page details for editing
                                // For now, we'll just focus on adding this UI component
                                alert('Edit page functionality coming soon');
                              }}
                              className="p-2 text-green-600 hover:bg-green-100 rounded"
                              title="Edit Page"
                            >
                              ✎
                            </button>
                            <button
                              onClick={async () => {
                                // Delete page confirmation
                                if (confirm(`Are you sure you want to delete the page "${page.title}"?`)) {
                                  // Create updated wiki without this page
                                  const updatedWiki = { ...wiki };

                                  // Remove this page from its parent's children array if applicable
                                  if (page.parentId && updatedWiki.pages[page.parentId]) {
                                    updatedWiki.pages[page.parentId].children =
                                      updatedWiki.pages[page.parentId].children.filter(id => id !== page.id);
                                  }

                                  // Remove the page itself
                                  delete updatedWiki.pages[page.id];

                                  // Update wiki state
                                  setWiki(updatedWiki);

                                  // Generate updated HTML
                                  const updatedHtml = await generateWikiHtml(updatedWiki);
                                  setHtmlContent(updatedHtml);

                                  // Save changes
                                  saveWiki();
                                }
                              }}
                              className="p-2 text-red-600 hover:bg-red-100 rounded"
                              title="Delete Page"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No pages found. Click &ldquo;Add Page&rdquo; to create your first page.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Wiki Settings</h2>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium mb-3">Theme Colors</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sidebar Color
                      </label>
                      <div className="flex items-center">
                        <input
                          type="color"
                          value={sidebarColor}
                          onChange={(e) => setSidebarColor(e.target.value)}
                          className="h-10 w-20 border rounded"
                        />
                        <input
                          type="text"
                          value={sidebarColor}
                          onChange={(e) => setSidebarColor(e.target.value)}
                          className="ml-3 p-2 border rounded"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Main Content Color
                      </label>
                      <div className="flex items-center">
                        <input
                          type="color"
                          value={mainColor}
                          onChange={(e) => setMainColor(e.target.value)}
                          className="h-10 w-20 border rounded"
                        />
                        <input
                          type="text"
                          value={mainColor}
                          onChange={(e) => setMainColor(e.target.value)}
                          className="ml-3 p-2 border rounded"
                        />
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium mb-3">Text Colors</h3>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Default Text Color
                          </label>
                          <div className="flex items-center">
                            <input
                              type="color"
                              value={textDefaultColor}
                              onChange={(e) => setTextDefaultColor(e.target.value)}
                              className="h-10 w-20 border rounded"
                            />
                            <input
                              type="text"
                              value={textDefaultColor}
                              onChange={(e) => setTextDefaultColor(e.target.value)}
                              className="ml-3 p-2 border rounded"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Primary Text Color
                          </label>
                          <div className="flex items-center">
                            <input
                              type="color"
                              value={textPrimaryColor}
                              onChange={(e) => setTextPrimaryColor(e.target.value)}
                              className="h-10 w-20 border rounded"
                            />
                            <input
                              type="text"
                              value={textPrimaryColor}
                              onChange={(e) => setTextPrimaryColor(e.target.value)}
                              className="ml-3 p-2 border rounded"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Secondary Text Color
                          </label>
                          <div className="flex items-center">
                            <input
                              type="color"
                              value={textSecondaryColor}
                              onChange={(e) => setTextSecondaryColor(e.target.value)}
                              className="h-10 w-20 border rounded"
                            />
                            <input
                              type="text"
                              value={textSecondaryColor}
                              onChange={(e) => setTextSecondaryColor(e.target.value)}
                              className="ml-3 p-2 border rounded"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-6">
                        <h4 className="text-md font-medium mb-2">Color Contrast Examples</h4>
                        <div className="color-contrast-examples">
                          <div className="color-example example-default">
                            This is default text (body text)
                          </div>
                          <div className="color-example example-primary">
                            This is primary text (headings)
                          </div>
                          <div className="color-example example-secondary">
                            This is secondary text (metadata, descriptions)
                          </div>
                          <div className="color-example example-on-sidebar">
                            This is text on sidebar background
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-3">Logo & Footer</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Wiki Logo
                      </label>
                      <div className="flex flex-col space-y-3">
                        {logoUrl && (
                          <div className="border p-2 rounded w-40 h-40 flex items-center justify-center">
                            <Image
                              src={logoUrl}
                              alt="Logo"
                              width={160}
                              height={160}
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="border p-1 rounded"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Footer Text
                      </label>
                      <textarea
                        value={footerText}
                        onChange={(e) => setFooterText(e.target.value)}
                        className="w-full p-2 border rounded"
                        rows={3}
                      />
                      <button
                        onClick={updateFooter}
                        className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-sm font-medium"
                      >
                        Update Footer
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Default Author
                      </label>
                      <div className="flex">
                        <input
                          type="text"
                          value={defaultAuthor}
                          onChange={(e) => setDefaultAuthor(e.target.value)}
                          placeholder="Enter default author name"
                          className="w-full p-2 border rounded-l"
                        />
                        <button
                          onClick={updateDefaultAuthor}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-r-md shadow-sm font-medium"
                        >
                          Save
                        </button>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        This author name will be used for new pages. If empty, &quot;User&quot; will be used.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={updateCss}
                className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-sm font-medium"
              >
                Apply Theme Colors
              </button>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-4 border-b bg-gray-50">
                <h2 className="font-medium">Preview</h2>
              </div>
              <div className="p-4">
                <iframe
                  ref={iframeRef}
                  srcDoc={htmlContent}
                  className="w-full h-[800px] border rounded"
                  title="Wiki Preview"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Page Modal */}
      {showAddPageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Add New Page</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="pageName" className="block text-gray-700 mb-2">
                  Page Name
                </label>
                <input
                  type="text"
                  id="pageName"
                  value={newPageName}
                  onChange={(e) => setNewPageName(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                  placeholder="Enter page name"
                />
              </div>

              <div>
                <label htmlFor="parentPage" className="block text-gray-700 mb-2">
                  Parent Page (optional)
                </label>
                <select
                  id="parentPage"
                  value={newPageParentId || ''}
                  onChange={(e) => setNewPageParentId(e.target.value || null)}
                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                >
                  <option value="">No parent (root page)</option>
                  {wiki && Object.values(wiki.pages).map(page => (
                    <option key={page.id} value={page.id}>
                      {page.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-700 mb-2">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {newPageTags.map(tag => (
                    <span
                      key={tag}
                      className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    className="flex-1 p-2 border border-gray-300 rounded-md shadow-sm"
                    placeholder="Enter a tag"
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                  />
                  <button
                    onClick={addTag}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
                {availableTags.size > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-600 mb-1">Available tags:</p>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(availableTags).map(tag => (
                        <button
                          key={tag}
                          onClick={() => !newPageTags.includes(tag) && setNewPageTags([...newPageTags, tag])}
                          className="text-sm text-gray-600 hover:text-blue-600"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddPageModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={addNewPage}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add Page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Modal */}
      {showTableModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Create Table</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="tableRows" className="block text-gray-700 mb-2">
                  Number of Rows
                </label>
                <input
                  type="number"
                  id="tableRows"
                  value={tableRows}
                  onChange={(e) => setTableRows(Math.max(1, parseInt(e.target.value) || 0))}
                  min="1"
                  max="20"
                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                />
              </div>

              <div>
                <label htmlFor="tableColumns" className="block text-gray-700 mb-2">
                  Number of Columns
                </label>
                <input
                  type="number"
                  id="tableColumns"
                  value={tableColumns}
                  onChange={(e) => setTableColumns(Math.max(1, parseInt(e.target.value) || 0))}
                  min="1"
                  max="10"
                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="tableHeader"
                  checked={tableHeaderRow}
                  onChange={(e) => setTableHeaderRow(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="tableHeader" className="text-gray-700">
                  Include header row
                </label>
              </div>

              {/* Table preview */}
              <div className="border p-2 rounded-md">
                <p className="text-sm text-gray-500 mb-2">Preview:</p>
                <div className="overflow-auto max-h-40">
                  <table className="w-full border-collapse border border-gray-300">
                    {tableHeaderRow && (
                      <thead>
                        <tr>
                          {Array.from({ length: tableColumns }).map((_, i) => (
                            <th key={i} className="border border-gray-300 p-1 bg-gray-200 text-xs">
                              Header {i + 1}
                            </th>
                          ))}
                        </tr>
                      </thead>
                    )}
                    <tbody>
                      {Array.from({ length: tableHeaderRow ? tableRows - 1 : tableRows }).map((_, rowIndex) => (
                        <tr key={rowIndex}>
                          {Array.from({ length: tableColumns }).map((_, colIndex) => (
                            <td key={colIndex} className="border border-gray-300 p-1 text-xs">
                              Cell {rowIndex + 1},{colIndex + 1}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowTableModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createTable}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create Table
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Editor Modal */}
      {showTableEditorModal && editingTableId && editingTableData && editingTableStyle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6">
            <h2 className="text-xl font-bold mb-4">Edit Table</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="tableRows" className="block text-gray-700 mb-2">
                    Number of Rows
                  </label>
                  <input
                    type="number"
                    id="tableRows"
                    value={editingTableData.rows}
                    onChange={(e) => {
                      const newRows = Math.max(1, parseInt(e.target.value) || 0);
                      setEditingTableData({ ...editingTableData, rows: newRows });
                    }}
                    min="1"
                    max="20"
                    className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                  />
                </div>

                <div>
                  <label htmlFor="tableColumns" className="block text-gray-700 mb-2">
                    Number of Columns
                  </label>
                  <input
                    type="number"
                    id="tableColumns"
                    value={editingTableData.columns}
                    onChange={(e) => {
                      const newColumns = Math.max(1, parseInt(e.target.value) || 0);
                      setEditingTableData({ ...editingTableData, columns: newColumns });
                    }}
                    min="1"
                    max="10"
                    className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                  />
                </div>

                <div className="flex items-center mt-8">
                  <input
                    type="checkbox"
                    id="tableHeader"
                    checked={editingTableData.hasHeader}
                    onChange={(e) => {
                      const newHeader = e.target.checked;
                      setEditingTableData({ ...editingTableData, hasHeader: newHeader });
                    }}
                    className="mr-2"
                  />
                  <label htmlFor="tableHeader" className="text-gray-700">
                    Include header row
                  </label>
                </div>
              </div>

              {/* Table cell editor */}
              <div className="border p-2 rounded-md">
                <h3 className="text-md font-medium mb-2">Edit Cell Content:</h3>
                <div className="overflow-auto max-h-60">
                  <table className="w-full border-collapse border border-gray-300">
                    {editingTableData.hasHeader && (
                      <thead>
                        <tr>
                          {Array.from({ length: editingTableData.columns }).map((_, colIndex) => (
                            <th key={colIndex} className="border border-gray-300 p-2 bg-gray-200">
                              <input
                                type="text"
                                value={editingTableData.cells.find(c => c.row === 0 && c.col === colIndex)?.content || ''}
                                onChange={(e) => {
                                  const updatedCells = [...editingTableData.cells];
                                  const cellIndex = updatedCells.findIndex(c => c.row === 0 && c.col === colIndex);

                                  if (cellIndex >= 0) {
                                    updatedCells[cellIndex] = {
                                      ...updatedCells[cellIndex],
                                      content: e.target.value
                                    };
                                  } else {
                                    updatedCells.push({
                                      row: 0,
                                      col: colIndex,
                                      content: e.target.value,
                                      isHeader: true
                                    });
                                  }

                                  setEditingTableData({
                                    ...editingTableData,
                                    cells: updatedCells
                                  });
                                }}
                                className="w-full p-1 border-0 bg-transparent"
                                placeholder={`Header ${colIndex + 1}`}
                              />
                            </th>
                          ))}
                        </tr>
                      </thead>
                    )}
                    <tbody>
                      {Array.from({ length: editingTableData.hasHeader ? editingTableData.rows - 1 : editingTableData.rows }).map((_, rowIndex) => {
                        const actualRowIndex = editingTableData.hasHeader ? rowIndex + 1 : rowIndex;
                        return (
                          <tr key={actualRowIndex}>
                            {Array.from({ length: editingTableData.columns }).map((_, colIndex) => (
                              <td key={colIndex} className="border border-gray-300 p-2">
                                <input
                                  type="text"
                                  value={editingTableData.cells.find(c => c.row === actualRowIndex && c.col === colIndex)?.content || ''}
                                  onChange={(e) => {
                                    const updatedCells = [...editingTableData.cells];
                                    const cellIndex = updatedCells.findIndex(c => c.row === actualRowIndex && c.col === colIndex);

                                    if (cellIndex >= 0) {
                                      updatedCells[cellIndex] = {
                                        ...updatedCells[cellIndex],
                                        content: e.target.value
                                      };
                                    } else {
                                      updatedCells.push({
                                        row: actualRowIndex,
                                        col: colIndex,
                                        content: e.target.value,
                                        isHeader: false
                                      });
                                    }

                                    setEditingTableData({
                                      ...editingTableData,
                                      cells: updatedCells
                                    });
                                  }}
                                  className="w-full p-1 border-0 bg-transparent"
                                  placeholder={`Cell ${actualRowIndex + 1},${colIndex + 1}`}
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table style options */}
              <div className="mt-4 border-t pt-4">
                <h3 className="text-md font-medium mb-2">Table Style:</h3>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => setEditingTableStyle({ ...editingTableStyle, type: 'default' })}
                    className={`p-2 border rounded ${editingTableStyle.type === 'default' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                  >
                    Default
                  </button>
                  <button
                    onClick={() => setEditingTableStyle({ ...editingTableStyle, type: 'striped' })}
                    className={`p-2 border rounded ${editingTableStyle.type === 'striped' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                  >
                    Striped
                  </button>
                  <button
                    onClick={() => setEditingTableStyle({ ...editingTableStyle, type: 'bordered' })}
                    className={`p-2 border rounded ${editingTableStyle.type === 'bordered' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                  >
                    Bordered
                  </button>
                  <button
                    onClick={() => setEditingTableStyle({ ...editingTableStyle, type: 'clean' })}
                    className={`p-2 border rounded ${editingTableStyle.type === 'clean' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                  >
                    Clean
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowTableEditorModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Save changes
                  if (editingTableId && editingTableData && editingTableStyle) {
                    // Update the styles based on the selected type
                    const updatedStyle = { ...editingTableStyle };

                    // Apply style presets
                    switch (updatedStyle.type) {
                      case 'striped':
                        updatedStyle.tableStyles = {
                          width: "100%",
                          borderCollapse: "collapse",
                          margin: "1em 0"
                        };
                        updatedStyle.headerStyles = {
                          borderBottom: "2px solid #ddd",
                          padding: "12px 8px",
                          backgroundColor: "#f2f2f2",
                          fontWeight: "bold",
                          textAlign: "left"
                        };
                        updatedStyle.cellStyles = {
                          borderBottom: "1px solid #ddd",
                          padding: "8px",
                          textAlign: "left"
                        };
                        break;
                      case 'bordered':
                        updatedStyle.tableStyles = {
                          width: "100%",
                          borderCollapse: "collapse",
                          margin: "1em 0",
                          border: "2px solid #ddd"
                        };
                        updatedStyle.headerStyles = {
                          border: "2px solid #ddd",
                          padding: "10px",
                          backgroundColor: "#f2f2f2",
                          fontWeight: "bold",
                          textAlign: "left"
                        };
                        updatedStyle.cellStyles = {
                          border: "2px solid #ddd",
                          padding: "10px",
                          textAlign: "left"
                        };
                        break;
                      case 'clean':
                        updatedStyle.tableStyles = {
                          width: "100%",
                          borderCollapse: "collapse",
                          margin: "1em 0"
                        };
                        updatedStyle.headerStyles = {
                          borderBottom: "1px solid #ddd",
                          padding: "12px 8px",
                          fontWeight: "bold",
                          textAlign: "left"
                        };
                        updatedStyle.cellStyles = {
                          borderBottom: "1px solid #ddd",
                          padding: "12px 8px",
                          textAlign: "left"
                        };
                        break;
                      default: // default style
                        updatedStyle.tableStyles = {
                          width: "100%",
                          borderCollapse: "collapse",
                          margin: "1em 0"
                        };
                        updatedStyle.headerStyles = {
                          border: "1px solid #ccc",
                          padding: "8px",
                          backgroundColor: "#f2f2f2",
                          fontWeight: "bold",
                          textAlign: "left"
                        };
                        updatedStyle.cellStyles = {
                          border: "1px solid #ccc",
                          padding: "8px",
                          textAlign: "left"
                        };
                    }

                    saveTableData(editingTableId, editingTableData, updatedStyle);
                    refreshTableIframes();
                    setShowTableEditorModal(false);
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 