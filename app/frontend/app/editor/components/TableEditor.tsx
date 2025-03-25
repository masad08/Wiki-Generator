import React, { useState, useEffect, useRef } from 'react';

interface TableEditorProps {
  onClose: () => void;
  editorRef: React.RefObject<HTMLElement>;
  onContentChange: (newContent: string) => void;
}

/**
 * TableEditor component for editing tables directly in the contentEditable area
 * This component provides a floating UI to manipulate tables that are already in the editor
 */
const TableEditor: React.FC<TableEditorProps> = ({ onClose, editorRef, onContentChange }) => {
  const [selectedTable, setSelectedTable] = useState<HTMLTableElement | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#f2f2f2');
  const [selectedCells, setSelectedCells] = useState<HTMLElement[]>([]);
  const [activeTab, setActiveTab] = useState<'rows' | 'cols' | 'style'>('rows');
  const panelRef = useRef<HTMLDivElement>(null);

  // Initialize the editor with the first table in the editor
  useEffect(() => {    
    // Find the first table in the editor content
    if (editorRef.current) {
      const tables = editorRef.current.querySelectorAll('table');
      if (tables.length > 0) {
        const firstTable = tables[0] as HTMLTableElement;
        setSelectedTable(firstTable);
        
        // Position the editor panel near the table
        const tableRect = firstTable.getBoundingClientRect();
        const editorRect = editorRef.current.getBoundingClientRect();
        
        // Calculate the position of the panel
        let top = tableRect.top - editorRect.top;
        let left = tableRect.right - editorRect.left + 10; // Position to the right of the table
        
        // Check if panel would go off-screen to the right
        const viewportWidth = window.innerWidth;
        if (left + 220 > viewportWidth) { // 220px is the panel width
          // Position to the left of the table instead
          left = tableRect.left - editorRect.left - 230;
          
          // If that would be off-screen to the left, position at the left edge with some margin
          if (left < 0) {
            left = 10;
          }
        }
        
        // Ensure the top position is visible within the viewport
        const viewportHeight = window.innerHeight;
        if (top + 300 > viewportHeight) { // 300px is an approximate panel height
          top = Math.max(10, viewportHeight - 310);
        }
        
        setPosition({
          top,
          left
        });
      }
    }
    
    // Add a listener to close the editor when clicking outside
    const handleOutsideClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) && 
          (!selectedTable || !selectedTable.contains(e.target as Node))) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleOutsideClick);
    
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [editorRef, onClose]);

  // Update editor content after making changes
  const updateContent = () => {
    if (editorRef.current) {
      onContentChange(editorRef.current.innerHTML);
    }
  };

  // Add a row above the current row
  const addRowAbove = () => {
    if (!selectedTable || selectedCells.length === 0) return;
    
    const cell = selectedCells[0];
    const row = cell.closest('tr');
    if (!row) return;
    
    const newRow = document.createElement('tr');
    const cellsCount = row.cells.length;
    
    // Create the same number of cells as the current row
    for (let i = 0; i < cellsCount; i++) {
      const newCell = document.createElement(cell.tagName === 'TH' ? 'th' : 'td');
      newCell.style.cssText = cell.style.cssText;
      newCell.innerHTML = '&nbsp;';
      newRow.appendChild(newCell);
    }
    
    row.parentNode?.insertBefore(newRow, row);
    updateContent();
  };

  // Add a row below the current row
  const addRowBelow = () => {
    if (!selectedTable || selectedCells.length === 0) return;
    
    const cell = selectedCells[0];
    const row = cell.closest('tr');
    if (!row) return;
    
    const newRow = document.createElement('tr');
    const cellsCount = row.cells.length;
    
    // Create the same number of cells as the current row
    for (let i = 0; i < cellsCount; i++) {
      const newCell = document.createElement('td');
      newCell.style.cssText = cell.style.cssText;
      newCell.innerHTML = '&nbsp;';
      newRow.appendChild(newCell);
    }
    
    if (row.nextSibling) {
      row.parentNode?.insertBefore(newRow, row.nextSibling);
    } else {
      row.parentNode?.appendChild(newRow);
    }
    updateContent();
  };

  // Delete the current row
  const deleteRow = () => {
    if (!selectedTable || selectedCells.length === 0) return;
    
    const cell = selectedCells[0];
    const row = cell.closest('tr');
    if (!row) return;
    
    // Don't delete if it's the only row
    const tbody = row.closest('tbody');
    if (tbody && tbody.rows.length <= 1) return;
    
    row.parentNode?.removeChild(row);
    setSelectedCells([]);
    updateContent();
  };

  // Add a column to the left of the current column
  const addColumnLeft = () => {
    if (!selectedTable || selectedCells.length === 0) return;
    
    const cell = selectedCells[0];
    const cellIndex = Array.from(cell.parentNode?.children || []).indexOf(cell);
    
    // Add a cell to each row at the same index
    const rows = selectedTable.rows;
    for (let i = 0; i < rows.length; i++) {
      const newCell = document.createElement(rows[i].cells[0].tagName);
      newCell.style.cssText = cell.style.cssText;
      newCell.innerHTML = '&nbsp;';
      rows[i].insertBefore(newCell, rows[i].cells[cellIndex]);
    }
    updateContent();
  };

  // Add a column to the right of the current column
  const addColumnRight = () => {
    if (!selectedTable || selectedCells.length === 0) return;
    
    const cell = selectedCells[0];
    const cellIndex = Array.from(cell.parentNode?.children || []).indexOf(cell);
    
    // Add a cell to each row after the current index
    const rows = selectedTable.rows;
    for (let i = 0; i < rows.length; i++) {
      const newCell = document.createElement(rows[i].cells[0].tagName);
      newCell.style.cssText = cell.style.cssText;
      newCell.innerHTML = '&nbsp;';
      
      if (cellIndex + 1 < rows[i].cells.length) {
        rows[i].insertBefore(newCell, rows[i].cells[cellIndex + 1]);
      } else {
        rows[i].appendChild(newCell);
      }
    }
    updateContent();
  };

  // Delete the current column
  const deleteColumn = () => {
    if (!selectedTable || selectedCells.length === 0) return;
    
    const cell = selectedCells[0];
    const cellIndex = Array.from(cell.parentNode?.children || []).indexOf(cell);
    
    // Make sure we're not removing the only column
    if (selectedTable.rows[0].cells.length <= 1) return;
    
    // Remove the cell at the same index from each row
    const rows = selectedTable.rows;
    for (let i = 0; i < rows.length; i++) {
      if (cellIndex < rows[i].cells.length) {
        rows[i].deleteCell(cellIndex);
      }
    }
    setSelectedCells([]);
    updateContent();
  };

  // Convert the selected cells to header cells
  const convertToHeader = () => {
    if (selectedCells.length === 0) return;
    
    selectedCells.forEach(cell => {
      if (cell.tagName === 'TD') {
        const row = cell.closest('tr');
        const headerCell = document.createElement('th');
        
        headerCell.innerHTML = cell.innerHTML;
        headerCell.style.cssText = 'background-color: #f2f2f2; font-weight: bold; text-align: left;';
        
        row?.replaceChild(headerCell, cell);
      }
    });
    updateContent();
  };

  // Convert the selected cells to standard cells
  const convertToCell = () => {
    if (selectedCells.length === 0) return;
    
    selectedCells.forEach(cell => {
      if (cell.tagName === 'TH') {
        const row = cell.closest('tr');
        const standardCell = document.createElement('td');
        
        standardCell.innerHTML = cell.innerHTML;
        standardCell.style.cssText = 'background-color: transparent; font-weight: normal; text-align: left;';
        
        row?.replaceChild(standardCell, cell);
      }
    });
    updateContent();
  };

  // Apply color to selected cells
  const applyColor = (color: string) => {
    if (selectedCells.length === 0) return;
    
    selectedCells.forEach(cell => {
      cell.style.backgroundColor = color;
    });
    
    setSelectedColor(color);
    setShowColorPicker(false);
    updateContent();
  };

  // Apply styling to the entire table
  const applyTableStyles = (style: 'default' | 'striped' | 'bordered' | 'clean') => {
    if (!selectedTable) return;
    
    // Apply the selected style to the table
    switch (style) {
      case 'default':
        selectedTable.style.cssText = 'width: 100%; border-collapse: collapse; margin: 1em 0;';
        for (let i = 0; i < selectedTable.rows.length; i++) {
          const isHeader = i === 0 && selectedTable.tHead;
          
          for (let j = 0; j < selectedTable.rows[i].cells.length; j++) {
            const cell = selectedTable.rows[i].cells[j];
            
            if (isHeader || cell.tagName === 'TH') {
              cell.style.cssText = 'border: 1px solid #ccc; padding: 8px; background-color: #f2f2f2; font-weight: bold; text-align: left;';
            } else {
              cell.style.cssText = 'border: 1px solid #ccc; padding: 8px; text-align: left;';
            }
          }
        }
        break;
        
      case 'striped':
        selectedTable.style.cssText = 'width: 100%; border-collapse: collapse; margin: 1em 0;';
        for (let i = 0; i < selectedTable.rows.length; i++) {
          const isHeader = i === 0 && selectedTable.tHead;
          const isEven = i % 2 === 0;
          
          for (let j = 0; j < selectedTable.rows[i].cells.length; j++) {
            const cell = selectedTable.rows[i].cells[j];
            
            if (isHeader || cell.tagName === 'TH') {
              cell.style.cssText = 'border-bottom: 2px solid #ddd; padding: 12px 8px; background-color: #f2f2f2; font-weight: bold; text-align: left;';
            } else if (isEven) {
              cell.style.cssText = 'border-bottom: 1px solid #ddd; padding: 8px; background-color: #f9f9f9; text-align: left;';
            } else {
              cell.style.cssText = 'border-bottom: 1px solid #ddd; padding: 8px; text-align: left;';
            }
          }
        }
        break;
        
      case 'bordered':
        selectedTable.style.cssText = 'width: 100%; border-collapse: collapse; margin: 1em 0; border: 2px solid #ddd;';
        for (let i = 0; i < selectedTable.rows.length; i++) {
          const isHeader = i === 0 && selectedTable.tHead;
          
          for (let j = 0; j < selectedTable.rows[i].cells.length; j++) {
            const cell = selectedTable.rows[i].cells[j];
            
            if (isHeader || cell.tagName === 'TH') {
              cell.style.cssText = 'border: 2px solid #ddd; padding: 10px; background-color: #f2f2f2; font-weight: bold; text-align: left;';
            } else {
              cell.style.cssText = 'border: 2px solid #ddd; padding: 10px; text-align: left;';
            }
          }
        }
        break;
        
      case 'clean':
        selectedTable.style.cssText = 'width: 100%; border-collapse: collapse; margin: 1em 0;';
        for (let i = 0; i < selectedTable.rows.length; i++) {
          const isHeader = i === 0 && selectedTable.tHead;
          
          for (let j = 0; j < selectedTable.rows[i].cells.length; j++) {
            const cell = selectedTable.rows[i].cells[j];
            
            if (isHeader || cell.tagName === 'TH') {
              cell.style.cssText = 'border-bottom: 1px solid #ddd; padding: 12px 8px; font-weight: bold; text-align: left;';
            } else {
              cell.style.cssText = 'border-bottom: 1px solid #ddd; padding: 12px 8px; text-align: left;';
            }
          }
        }
        break;
    }
    
    updateContent();
  };

  // If no table is selected, don't render the editor
  if (!selectedTable) {
    return null;
  }

  return (
    <div 
      ref={panelRef}
      className="fixed bg-white rounded-lg shadow-lg border border-gray-300 p-2 z-50"
      style={{ 
        top: `${position.top}px`, 
        left: `${position.left}px`,
        width: '220px',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
        maxHeight: '80vh',
        overflowY: 'auto',
        zIndex: 9999,
        borderColor: '#3b82f6',
        borderWidth: '2px'
      }}
    >
      <div className="flex justify-between items-center mb-2 pb-1 border-b">
        <h3 className="font-medium text-sm">Table Editor</h3>
        <button 
          className="text-gray-400 hover:text-gray-600"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      {/* Tabs for organizing controls */}
      <div className="flex border-b mb-2">
        <button
          className={`px-2 py-1 text-xs ${activeTab === 'rows' ? 'bg-blue-100 text-blue-600 rounded-t' : 'text-gray-600'}`}
          onClick={() => setActiveTab('rows')}
        >
          Rows
        </button>
        <button
          className={`px-2 py-1 text-xs ${activeTab === 'cols' ? 'bg-blue-100 text-blue-600 rounded-t' : 'text-gray-600'}`}
          onClick={() => setActiveTab('cols')}
        >
          Columns
        </button>
        <button
          className={`px-2 py-1 text-xs ${activeTab === 'style' ? 'bg-blue-100 text-blue-600 rounded-t' : 'text-gray-600'}`}
          onClick={() => setActiveTab('style')}
        >
          Style
        </button>
      </div>

      {/* Controls for selected tab */}
      <div className="mb-2">
        {activeTab === 'rows' && (
          <div className="grid grid-cols-2 gap-1">
            <button
              className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              onClick={addRowAbove}
            >
              ➕ Row Above
            </button>
            <button
              className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              onClick={addRowBelow}
            >
              ➕ Row Below
            </button>
            <button
              className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded col-span-2"
              onClick={deleteRow}
            >
              🗑️ Delete Row
            </button>
          </div>
        )}

        {activeTab === 'cols' && (
          <div className="grid grid-cols-2 gap-1">
            <button
              className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              onClick={addColumnLeft}
            >
              ➕ Column Left
            </button>
            <button
              className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              onClick={addColumnRight}
            >
              ➕ Column Right
            </button>
            <button
              className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded col-span-2"
              onClick={deleteColumn}
            >
              🗑️ Delete Column
            </button>
          </div>
        )}

        {activeTab === 'style' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1">
              <button
                className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 rounded"
                onClick={convertToHeader}
              >
                Make Header
              </button>
              <button
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                onClick={convertToCell}
              >
                Make Cell
              </button>

              <div className="relative col-span-2 mt-1">
                <button
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded w-full flex items-center"
                  onClick={() => setShowColorPicker(!showColorPicker)}
                >
                  <span className="mr-1">Cell Color</span>
                  <span 
                    className="w-4 h-4 inline-block border border-gray-300"
                    style={{ backgroundColor: selectedColor }}
                  ></span>
                </button>
                
                {showColorPicker && (
                  <div className="absolute left-0 top-full mt-1 bg-white border border-gray-300 rounded shadow-lg z-10 grid grid-cols-4 gap-1 p-1">
                    {['transparent', '#f2f2f2', '#e6f3ff', '#e6ffe6', '#ffe6e6', '#ffffcc', '#f0e6ff', '#e6f9ff'].map(color => (
                      <button
                        key={color}
                        className="w-8 h-8 border border-gray-300 rounded"
                        style={{ backgroundColor: color }}
                        onClick={() => applyColor(color)}
                        title={color === 'transparent' ? 'None' : color}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200">
              <p className="text-xs font-medium mb-1">Table Styles</p>
              <div className="grid grid-cols-2 gap-1">
                <button
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                  onClick={() => applyTableStyles('default')}
                >
                  Default
                </button>
                <button
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                  onClick={() => applyTableStyles('striped')}
                >
                  Striped
                </button>
                <button
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                  onClick={() => applyTableStyles('bordered')}
                >
                  Bordered
                </button>
                <button
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                  onClick={() => applyTableStyles('clean')}
                >
                  Clean
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TableEditor; 