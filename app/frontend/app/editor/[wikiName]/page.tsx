'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// Editor components need to be imported
// For a real implementation, we would use a rich text editor like TipTap, Slate, or QuillJS

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

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const encodedWikiName = params.wikiName as string;
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
  const [activeTab, setActiveTab] = useState('editor'); // 'editor', 'pages', 'settings', 'preview'
  const [sidebarColor, setSidebarColor] = useState('#222222');
  const [mainColor, setMainColor] = useState('#ffffff');
  const [footerText, setFooterText] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [currentContent, setCurrentContent] = useState('');
  const contentEditableRef = useRef<HTMLDivElement>(null);

  // Add state for hyperlink modal
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [isInternalLink, setIsInternalLink] = useState(false);
  const [selectedInternalPage, setSelectedInternalPage] = useState('');
  const [selectedRange, setSelectedRange] = useState<Range | null>(null);

  // Add state for image upload
  const [savedSelection, setSavedSelection] = useState<Range | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add state for table modal
  const [showTableModal, setShowTableModal] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableColumns, setTableColumns] = useState(3);
  const [tableHeaderRow, setTableHeaderRow] = useState(true);

  // Fetch wiki content
  useEffect(() => {
    const fetchWiki = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/wiki/${encodedWikiName}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch wiki');
        }
        
        const html = await response.text();
        setHtmlContent(html);
        
        // Parse wiki data from HTML
        const wikiDataMatch = html.match(/window\.wikiData = ([\s\S]*?);<\/script>/);
        if (wikiDataMatch && wikiDataMatch[1]) {
          const parsedData = JSON.parse(wikiDataMatch[1]);
          
          // Fix the data structure - ensure tags is a Set object
          const wikiData = {
            ...parsedData,
            tags: new Set(parsedData.tags || [])
          };
          
          setWiki(wikiData);
          setAvailableTags(new Set(wikiData.tags));
          console.log("Wiki data loaded:", wikiData);
        } else {
          console.error("Could not find window.wikiData in HTML");
          
          // Initialize minimal wiki structure instead of showing error
          const defaultWiki = {
            name: wikiName,
            pages: {},
            tags: new Set<string>(),
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString()
          };
          
          setWiki(defaultWiki);
          console.log("Created default wiki structure:", defaultWiki);
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
    
    fetchWiki();
  }, [encodedWikiName, router]);

  // Save wiki content
  const saveWiki = async () => {
    try {
      setIsSaving(true);
      
      // Prepare the wiki data for saving
      const wikiDataToSave = wiki ? {
        ...wiki,
        tags: Array.from(wiki.tags)
      } : null;
      
      const response = await fetch(`http://localhost:3001/api/wiki/${encodedWikiName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: htmlContent,
          cssTheme: cssContent,
          wikiData: wikiDataToSave
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save wiki');
      }
      
      // Update preview iframe
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.srcdoc = htmlContent;
      }
    } catch (error) {
      console.error('Error saving wiki:', error);
      alert('Failed to save wiki. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Update CSS with new settings
  const updateCss = () => {
    // This is a simplified version - a real implementation would parse and update the CSS properly
    const updatedCss = cssContent
      .replace(/\.sidebar\s*{[^}]*background-color:[^;]+;/g, match => 
        match.replace(/background-color:[^;]+;/, `background-color: ${sidebarColor};`))
      .replace(/\.main-content\s*{[^}]*background-color:[^;]+;/g, match => 
        match.replace(/background-color:[^;]+;/, `background-color: ${mainColor};`));
    
    setCssContent(updatedCss);
    
    // Update the HTML with the new CSS
    const updatedHtml = htmlContent.replace(/<style>([\s\S]*?)<\/style>/, `<style>${updatedCss}</style>`);
    setHtmlContent(updatedHtml);
    
    // Save the changes
    saveWiki();
  };

  // Generate HTML for the wiki
  const generateWikiHtml = (wikiData: Wiki): string => {
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
                  | Author: ${page.author}
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

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${wikiData.name}</title>
    <style>${cssContent}</style>
    <script>window.wikiData = ${JSON.stringify({
      ...wikiData,
      tags: Array.from(wikiData.tags)
    })};</script>
</head>
<body>
    <div class="sidebar">
        <div class="sidebar-title">${wikiData.name}</div>
        <ul class="sidebar-nav">
            ${generateSidebarNav(wikiData.pages)}
        </ul>
        ${generateTagsSection(wikiData.tags)}
    </div>
    <div class="main-content">
        ${generatePageContent(wikiData.pages)}
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
  const addNewPage = () => {
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
      tags: newPageTags,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      author: 'User',
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
    
    // Update HTML content
    const updatedHtml = generateWikiHtml(updatedWiki);
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
    
    saveWiki();
    
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

  // Add function to handle content image uploads
  const handleContentImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !savedSelection) return;
    
    const formData = new FormData();
    formData.append('image', file);
    
    // Show loading indication in the editor
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(savedSelection);
      document.execCommand('insertHTML', false, '<span class="image-loading">Uploading image...</span>');
    }
    
    // Upload the image to the server
    fetch(`http://localhost:3001/api/wiki/${encodedWikiName}/upload`, {
      method: 'POST',
      body: formData,
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to upload image');
        }
        return response.json();
      })
      .then(data => {
        // Get the image URL
        const imageUrl = `http://localhost:3001${data.url}`;
        
        // Find and remove the loading indicator
        const loadingElement = contentEditableRef.current?.querySelector('.image-loading');
        if (loadingElement && loadingElement.parentNode) {
          loadingElement.parentNode.removeChild(loadingElement);
        }
        
        // Restore selection and insert the image
        const selection = window.getSelection();
        if (selection && savedSelection) {
          selection.removeAllRanges();
          selection.addRange(savedSelection);
          
          // Insert the image HTML
          const imageHtml = `<img src="${imageUrl}" alt="Content image" style="max-width: 100%; height: auto;">`;
          document.execCommand('insertHTML', false, imageHtml);
          
          // Update content state
          if (contentEditableRef.current) {
            setCurrentContent(contentEditableRef.current.innerHTML);
          }
        }
      })
      .catch(error => {
        console.error('Error uploading image:', error);
        alert('Failed to upload image. Please try again.');
        
        // Remove loading indicator on error
        const loadingElement = contentEditableRef.current?.querySelector('.image-loading');
        if (loadingElement && loadingElement.parentNode) {
          loadingElement.parentNode.removeChild(loadingElement);
        }
      });
  };
  
  // Add function to trigger file input click and save selection
  const triggerImageUpload = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Save current selection
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      setSavedSelection(selection.getRangeAt(0).cloneRange());
      
      // Trigger file input click
      fileInputRef.current?.click();
    } else {
      alert('Please position your cursor where you want to insert the image.');
    }
  };

  // Update footer text
  const updateFooter = () => {
    // Check if footer already exists
    if (htmlContent.includes('<footer')) {
      const updatedHtml = htmlContent.replace(
        /<footer[^>]*>([\s\S]*?)<\/footer>/,
        `<footer class="mt-12 py-5 text-center border-t border-gray-200 text-gray-500">${footerText}</footer>`
      );
      setHtmlContent(updatedHtml);
    } else {
      // Add footer before closing body tag
      const updatedHtml = htmlContent.replace(
        /<\/body>/,
        `<footer class="mt-12 py-5 text-center border-t border-gray-200 text-gray-500">${footerText}</footer>\n</body>`
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
  const savePageContent = (content: string) => {
    if (!editingPageId || !wiki) return;
    
    const updatedWiki = { ...wiki };
    updatedWiki.pages[editingPageId] = {
      ...updatedWiki.pages[editingPageId],
      content: content,
      modifiedAt: new Date().toISOString()
    };
    
    setWiki(updatedWiki);
    
    // Update HTML
    const updatedHtml = generateWikiHtml(updatedWiki);
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
    // Get current selection
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    // Save the current selection range
    setSelectedRange(selection.getRangeAt(0).cloneRange());
    
    // Get selected text for the link text
    const selectedText = selection.toString();
    setLinkText(selectedText);
    
    // Show the link modal
    setShowLinkModal(true);
  };


  // Function to insert the link
  const insertLink = () => {
    if (!selectedRange || (!linkUrl && !isInternalLink && !selectedInternalPage)) {
      setShowLinkModal(false);
      return;
    }
    
    // Restore the previously saved selection
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(selectedRange);
    }
    
    // Determine the href and target attributes
    let href = '';
    let target = '';
    
    if (isInternalLink && selectedInternalPage) {
      // For internal wiki page links
      href = `#${selectedInternalPage}`;
    } else if (linkUrl) {
      // For external links, ensure URL has http:// or https:// prefix
      href = linkUrl.startsWith('http://') || linkUrl.startsWith('https://') 
        ? linkUrl 
        : `https://${linkUrl}`;
      target = '_blank'; // Open external links in new tab
    }
    
    if (href) {
      // If selection is empty, use the linkText value
      if (selection?.toString() === '') {
        // Remove the current selection
        document.execCommand('delete');
        
        // Create the link with specified text
        const linkHTML = `<a href="${href}"${target ? ` target="${target}"` : ''}>${linkText || href}</a>`;
        document.execCommand('insertHTML', false, linkHTML);
      } else {
        // Create link from the current selection
        document.execCommand('createLink', false, href);
        
        // Set target attribute for external links
        if (target) {
          // Find all links in the current selection and add target attribute
          const links = contentEditableRef.current?.querySelectorAll('a[href="' + href + '"]');
          links?.forEach(link => {
            link.setAttribute('target', target);
          });
        }
      }
      
      // Update the content
      if (contentEditableRef.current) {
        setCurrentContent(contentEditableRef.current.innerHTML);
      }
    }
    
    // Close the modal and reset state
    setShowLinkModal(false);
    setLinkUrl('');
    setLinkText('');
    setIsInternalLink(false);
    setSelectedInternalPage('');
    setSelectedRange(null);
  };

  // Function to insert a table
  const insertTable = () => {
    if (tableRows <= 0 || tableColumns <= 0) {
      return;
    }

    // Create table HTML
    let tableHTML = '<table style="width:100%; border-collapse:collapse; margin:1em 0;">\n';
    
    // Add header row if enabled
    if (tableHeaderRow) {
      tableHTML += '  <thead>\n    <tr>\n';
      
      // Add header cells
      for (let col = 0; col < tableColumns; col++) {
        tableHTML += '      <th style="border:1px solid #ccc; padding:8px; background-color:#f2f2f2; text-align:left; font-weight:bold;">Header ' + (col + 1) + '</th>\n';
      }
      
      tableHTML += '    </tr>\n  </thead>\n';
    }
    
    // Add table body
    tableHTML += '  <tbody>\n';
    
    // Calculate row count (subtract header if it exists)
    const bodyRows = tableHeaderRow ? tableRows - 1 : tableRows;
    
    // Add data rows
    for (let row = 0; row < bodyRows; row++) {
      tableHTML += '    <tr>\n';
      
      // Add cells
      for (let col = 0; col < tableColumns; col++) {
        tableHTML += '      <td style="border:1px solid #ccc; padding:8px; text-align:left;">Cell ' + (row + 1) + ',' + (col + 1) + '</td>\n';
      }
      
      tableHTML += '    </tr>\n';
    }
    
    tableHTML += '  </tbody>\n</table>';
    
    // Insert the table at cursor position
    document.execCommand('insertHTML', false, tableHTML);
    
    // Update content
    if (contentEditableRef.current) {
      setCurrentContent(contentEditableRef.current.innerHTML);
    }
    
    // Close modal and reset values
    setShowTableModal(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
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
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'editor'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Editor
            </button>
            <button
              onClick={() => setActiveTab('pages')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'pages'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pages
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'settings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Settings
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'preview'
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
                    
                    {/* Add Image Upload Button */}
                    <button 
                      onMouseDown={triggerImageUpload}
                      className="p-2 rounded hover:bg-gray-200"
                      title="Insert Image"
                      type="button"
                    >
                      <span style={{ fontSize: '18px' }}>🖼️</span>
                    </button>
                    
                    {/* Hidden file input for image uploads */}
                    <input 
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleContentImageUpload}
                      style={{ display: 'none' }}
                    />
                    
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
                      <div className="absolute z-10 hidden bg-white border rounded shadow-lg mt-1 p-1 flex flex-col min-w-[120px]">
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
                      <div className="absolute z-10 hidden bg-white border rounded shadow-lg mt-1 p-1 flex flex-col min-w-[150px]">
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
                      <div className="absolute z-10 hidden bg-white border rounded shadow-lg mt-1 p-1 flex flex-col">
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
                      <div className="absolute z-10 hidden bg-white border rounded shadow-lg mt-1 p-1 flex flex-col">
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

                    {/* Add Link button to the toolbar */}
                    <button 
                      onMouseDown={(e) => {
                        e.preventDefault();
                        createLink();
                      }}
                      className="p-2 rounded hover:bg-gray-200"
                      title="Add Link"
                      type="button"
                    >
                      <span style={{ fontSize: '18px' }}>🔗</span>
                    </button>

                    {/* Add Table button to the toolbar */}
                    <button 
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setShowTableModal(true);
                      }}
                      className="p-2 rounded hover:bg-gray-200"
                      title="Insert Table"
                      type="button"
                    >
                      <span style={{ fontSize: '18px' }}>⊞</span>
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
              <div className="p-4">
                {editingPageId ? (
                  <div
                    ref={contentEditableRef}
                    className="w-full h-[calc(90vh-200px)] p-4 border rounded-md overflow-y-auto"
                    contentEditable
                    dangerouslySetInnerHTML={{ __html: currentContent }}
                    onBlur={(e) => savePageContent(e.currentTarget.innerHTML)}
                    spellCheck="false"
                    data-ms-editor="true"
                  />
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
                              onClick={() => {
                                // Move page up in order
                                if (index > 0) {
                                  const updatedWiki = { ...wiki };
                                  const currentPage = { ...page };
                                  const prevPage = { ...array[index - 1] };
                                  
                                  // Swap orders
                                  const tempOrder = currentPage.order;
                                  currentPage.order = prevPage.order;
                                  prevPage.order = tempOrder;
                                  
                                  // Update pages in wiki
                                  updatedWiki.pages[currentPage.id] = currentPage;
                                  updatedWiki.pages[prevPage.id] = prevPage;
                                  
                                  setWiki(updatedWiki);
                                  
                                  // Generate updated HTML
                                  const updatedHtml = generateWikiHtml(updatedWiki);
                                  setHtmlContent(updatedHtml);
                                  
                                  // Save changes
                                  saveWiki();
                                }
                              }}
                              disabled={index === 0}
                              className={`p-2 rounded ${
                                index === 0 ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-100'
                              }`}
                              title="Move Up"
                            >
                              ↑
                            </button>
                            <button 
                              onClick={() => {
                                // Move page down in order
                                if (index < array.length - 1) {
                                  const updatedWiki = { ...wiki };
                                  const currentPage = { ...page };
                                  const nextPage = { ...array[index + 1] };
                                  
                                  // Swap orders
                                  const tempOrder = currentPage.order;
                                  currentPage.order = nextPage.order;
                                  nextPage.order = tempOrder;
                                  
                                  // Update pages in wiki
                                  updatedWiki.pages[currentPage.id] = currentPage;
                                  updatedWiki.pages[nextPage.id] = nextPage;
                                  
                                  setWiki(updatedWiki);
                                  
                                  // Generate updated HTML
                                  const updatedHtml = generateWikiHtml(updatedWiki);
                                  setHtmlContent(updatedHtml);
                                  
                                  // Save changes
                                  saveWiki();
                                }
                              }}
                              disabled={index === array.length - 1}
                              className={`p-2 rounded ${
                                index === array.length - 1 ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-100'
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
                              onClick={() => {
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
                                  const updatedHtml = generateWikiHtml(updatedWiki);
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
                    
                    <button
                      onClick={updateCss}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-sm font-medium"
                    >
                      Apply Theme Colors
                    </button>
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
                            <img src={logoUrl} alt="Logo" className="max-w-full max-h-full" />
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
                  </div>
                </div>
              </div>
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

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Insert Link</h2>
            
            <div className="space-y-4">
              <div className="flex space-x-4">
                <button
                  onClick={() => setIsInternalLink(false)}
                  className={`flex-1 p-2 rounded-md ${
                    !isInternalLink 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  External Link
                </button>
                <button
                  onClick={() => setIsInternalLink(true)}
                  className={`flex-1 p-2 rounded-md ${
                    isInternalLink 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  Wiki Page Link
                </button>
              </div>

              {!isInternalLink ? (
                <div>
                  <label htmlFor="linkUrl" className="block text-gray-700 mb-2">
                    URL
                  </label>
                  <input
                    type="text"
                    id="linkUrl"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                    placeholder="https://example.com"
                  />
                </div>
              ) : (
                <div>
                  <label htmlFor="internalPage" className="block text-gray-700 mb-2">
                    Wiki Page
                  </label>
                  <select
                    id="internalPage"
                    value={selectedInternalPage}
                    onChange={(e) => setSelectedInternalPage(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                  >
                    <option value="">Select a page</option>
                    {wiki && Object.values(wiki.pages).map(page => (
                      <option key={page.id} value={page.id}>
                        {page.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Link text field (only shown if no text is selected) */}
              {!selectedRange?.toString() && (
                <div>
                  <label htmlFor="linkText" className="block text-gray-700 mb-2">
                    Link Text
                  </label>
                  <input
                    type="text"
                    id="linkText"
                    value={linkText}
                    onChange={(e) => setLinkText(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                    placeholder="Link text to display"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowLinkModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={insertLink}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Insert Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Modal */}
      {showTableModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Insert Table</h2>
            
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
                onClick={insertTable}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Insert Table
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 