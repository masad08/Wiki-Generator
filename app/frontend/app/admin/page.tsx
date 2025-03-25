'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

type Wiki = {
  name: string;
  createdAt: string;
};

export default function AdminPage() {
  const [wikis, setWikis] = useState<Wiki[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWikiName, setNewWikiName] = useState('');
  const [newWikiAuthor, setNewWikiAuthor] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  
  // Add error notification states
  const [errorNotification, setErrorNotification] = useState('');
  const [errorType, setErrorType] = useState<'create' | 'delete' | 'export' | ''>('');

  // Function to show error notification
  const showError = (message: string, type: 'create' | 'delete' | 'export') => {
    setErrorNotification(message);
    setErrorType(type);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setErrorNotification('');
      setErrorType('');
    }, 5000);
  };

  // Fetch wikis from the API
  const fetchWikis = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/wiki');
      const data = await response.json();
      setWikis(data);
    } catch (error) {
      console.error('Error fetching wikis:', error);
      showError('Failed to fetch wikis. Please refresh the page.', 'create');
    } finally {
      setLoading(false);
    }
  };

  // Create a new wiki
  const createWiki = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWikiName.trim()) return;

    try {
      setIsCreating(true);
      const response = await fetch('http://localhost:3001/api/wiki', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          wikiName: newWikiName,
          defaultAuthor: newWikiAuthor.trim() || undefined
        }),
      });

      if (response.ok) {
        setNewWikiName('');
        setNewWikiAuthor('');
        setShowCreateForm(false);
        fetchWikis();
      } else {
        const error = await response.json();
        showError(`Error: ${error.error}`, 'create');
      }
    } catch (error) {
      console.error('Error creating wiki:', error);
      showError('Failed to create wiki. Please try again.', 'create');
    } finally {
      setIsCreating(false);
    }
  };

  // Delete a wiki
  const deleteWiki = async (wikiName: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/wiki/${wikiName}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchWikis();
      } else {
        const error = await response.json();
        showError(`Error: ${error.error}`, 'delete');
      }
    } catch (error) {
      console.error('Error deleting wiki:', error);
      showError('Failed to delete wiki. Please try again.', 'delete');
    } finally {
      setDeleteConfirmation(null);
    }
  };

  // Export a wiki
  const exportWiki = async (wikiName: string, singleHtml: boolean = false) => {
    try {
      const endpoint = singleHtml 
        ? `http://localhost:3001/api/wiki/${wikiName}/export-single-html`
        : `http://localhost:3001/api/wiki/${wikiName}/export`;
      window.open(endpoint, '_blank');
    } catch (error) {
      console.error('Error exporting wiki:', error);
      showError('Failed to export wiki. Please try again.', 'export');
    }
  };

  // Load wikis on component mount
  useEffect(() => {
    fetchWikis();
  }, []);

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Error Notification */}
      {errorNotification && (
        <div className={`fixed z-50 top-4 right-4 p-4 rounded shadow-lg border-l-4 max-w-md transition-opacity duration-300 ${
          errorType === 'create' ? 'bg-red-100 border-red-500 text-red-700' :
          errorType === 'delete' ? 'bg-orange-100 border-orange-500 text-orange-700' :
          'bg-yellow-100 border-yellow-500 text-yellow-700'
        }`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{errorNotification}</span>
            </div>
            <button 
              onClick={() => {
                setErrorNotification('');
                setErrorType('');
              }} 
              className="text-red-600 hover:text-red-800 ml-4"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Wiki Admin Panel</h1>
          <div className="flex space-x-4">
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md shadow-sm font-medium"
            >
              Create Wiki
            </button>
            <Link href="/" 
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md shadow-sm font-medium"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Wiki List */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6 bg-gray-50">
            <h2 className="text-lg font-medium text-gray-900">Your Wikis</h2>
          </div>
          
          {loading ? (
            <div className="px-4 py-5 sm:p-6 text-center">Loading wikis...</div>
          ) : wikis.length === 0 ? (
            <div className="px-4 py-5 sm:p-6 text-center text-gray-500">
              No wikis found. Create your first wiki to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Wiki Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created At
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {wikis.map((wiki) => (
                    <tr key={wiki.name} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{wiki.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {formatDate(wiki.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="space-x-2">
                          <Link
                            href={`/editor/${encodeURIComponent(wiki.name)}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Edit
                          </Link>
                          <div className="relative inline-block">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const dropdown = e.currentTarget.nextElementSibling as HTMLElement;
                                if (dropdown) {
                                  dropdown.classList.toggle('hidden');
                                }
                              }}
                              className="text-green-600 hover:text-green-900"
                            >
                              Export ▼
                            </button>
                            <div className="absolute right-0 z-10 hidden bg-white border rounded shadow-lg mt-1 p-1 min-w-[150px]">
                              <button
                                onClick={() => exportWiki(wiki.name, false)}
                                className="block px-4 py-2 text-gray-700 hover:bg-gray-100 w-full text-left"
                              >
                                Standard Export
                              </button>
                              <button
                                onClick={() => exportWiki(wiki.name, true)}
                                className="block px-4 py-2 text-gray-700 hover:bg-gray-100 w-full text-left"
                              >
                                Single HTML Export
                              </button>
                            </div>
                          </div>
                          <button
                            onClick={() => setDeleteConfirmation(wiki.name)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Create Wiki Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Create New Wiki</h2>
            <form onSubmit={createWiki}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="wikiName" className="block text-sm font-medium text-gray-700">
                    Wiki Name
                  </label>
                  <input
                    type="text"
                    id="wikiName"
                    value={newWikiName}
                    onChange={(e) => setNewWikiName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter wiki name"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="wikiAuthor" className="block text-sm font-medium text-gray-700">
                    Default Author (optional)
                  </label>
                  <input
                    type="text"
                    id="wikiAuthor"
                    value={newWikiAuthor}
                    onChange={(e) => setNewWikiAuthor(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter default author name"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    This will be used as the author for new pages. If left empty, no author will be shown.
                  </p>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                  >
                    {isCreating ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Confirm Deletion</h2>
            <p className="mb-4">
              Are you sure you want to delete the wiki &quot;{deleteConfirmation}&quot;? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirmation(null)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteWiki(deleteConfirmation)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 