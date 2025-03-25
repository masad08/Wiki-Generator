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

  // Fetch wikis from the API
  const fetchWikis = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/wiki');
      const data = await response.json();
      setWikis(data);
    } catch (error) {
      console.error('Error fetching wikis:', error);
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
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating wiki:', error);
      alert('Failed to create wiki. Please try again.');
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
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting wiki:', error);
      alert('Failed to delete wiki. Please try again.');
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
      alert('Failed to export wiki. Please try again.');
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