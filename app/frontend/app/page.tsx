'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [showReadme, setShowReadme] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-4xl w-full">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-900">Wiki Generator</h1>
        
        <div className="flex flex-col items-center space-y-6">
          <Link 
            href="/admin"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md text-lg font-medium transition duration-200 shadow-sm"
          >
            Go to Admin Panel
          </Link>

          <button
            onClick={() => setShowReadme(!showReadme)}
            className="text-blue-600 hover:text-blue-800 underline mt-4"
          >
            {showReadme ? 'Hide Documentation' : 'Show Documentation'}
          </button>
        </div>

        {showReadme && (
          <div className="mt-8 p-6 bg-gray-50 rounded-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">About Wiki Generator</h2>
            <p className="mb-4 text-gray-700">
              The Wiki Generator is a self-contained application designed to create and manage single-page HTML wikis.
            </p>
            
            <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-800">Features:</h3>
            <ul className="list-disc pl-5 space-y-2 text-gray-700">
              <li>Create and manage wikis through an intuitive admin panel</li>
              <li>Rich-text editor with formatting options</li>
              <li>Live preview of your wiki during editing</li>
              <li>Customizable themes and styling</li>
              <li>Export wikis as ZIP files for offline use</li>
              <li>No external dependencies - works entirely offline</li>
            </ul>
            
            <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-800">Getting Started:</h3>
            <ol className="list-decimal pl-5 space-y-2 text-gray-700">
              <li>Click on &quot;Go to Admin Panel&quot; to view and manage your wikis</li>
              <li>Create a new wiki by clicking the &quot;Create Wiki&quot; button</li>
              <li>Use the editor to add and format content</li>
              <li>All changes are saved automatically</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
} 