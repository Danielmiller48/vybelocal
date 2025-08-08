"use client";

import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/utils/supabase/client';
import { Plus, UserMinus, Calendar, MapPin, Clock } from 'lucide-react';
import Link from 'next/link';

export default function TrackedHostsClient({ initialHosts = [] }) {
  const [trackedHosts, setTrackedHosts] = useState(initialHosts);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const supabase = createSupabaseBrowser();

  // Search for hosts to track
  const searchHosts = async (term) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      // Search for hosts by their profile name or events they've created
      const { data: hosts } = await supabase
        .from('profiles')
        .select(`
          id,
          display_name,
          avatar_url,
          events(id, title, starts_at)
        `)
        .ilike('display_name', `%${term}%`)
        .limit(10);

      // Filter out hosts that have actually created events
      const activeHosts = hosts?.filter(host => host.events?.length > 0) || [];
      setSearchResults(activeHosts);
    } catch (error) {
      console.error('Error searching hosts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Add host to tracking (placeholder - would need to implement follows table)
  const trackHost = async (host) => {
    // TODO: Implement actual tracking via database
    setTrackedHosts(prev => [...prev, { ...host, tracked_at: new Date() }]);
    setShowAddModal(false);
    setSearchTerm('');
    setSearchResults([]);
  };

  // Remove host from tracking
  const untrackHost = async (hostId) => {
    // TODO: Implement actual untracking via database
    setTrackedHosts(prev => prev.filter(host => host.id !== hostId));
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchHosts(searchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  return (
    <div className="space-y-6">
      {/* Add Host Button */}
      <div className="flex justify-between items-center">
        <p className="text-gray-600">
          Track your favorite hosts to get notified when they create new events
        </p>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Track Host
        </button>
      </div>

      {/* Tracked Hosts List */}
      {trackedHosts.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No tracked hosts yet</h3>
          <p className="text-gray-600 mb-4">
            Start tracking hosts to see their upcoming events and get notifications
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
          >
            Track Your First Host
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {trackedHosts.map((host) => (
            <div key={host.id} className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
                    {host.avatar_url && (
                      <img 
                        src={host.avatar_url} 
                        alt={host.display_name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{host.display_name}</h3>
                    <p className="text-sm text-gray-600">
                      {host.events?.length || 0} events created
                    </p>
                    {host.tracked_at && (
                      <p className="text-xs text-gray-500">
                        Tracked {new Date(host.tracked_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => untrackHost(host.id)}
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                  title="Untrack host"
                >
                  <UserMinus className="h-4 w-4" />
                </button>
              </div>

              {/* Recent Events */}
              {host.events && host.events.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Events</h4>
                  <div className="space-y-2">
                    {host.events.slice(0, 3).map((event) => (
                      <Link
                        key={event.id}
                        href={`/vybes/${event.id}`}
                        className="block text-sm text-gray-600 hover:text-violet-600 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          <span>{event.title}</span>
                          <span className="text-xs">
                            {new Date(event.starts_at).toLocaleDateString()}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Host Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Track a Host</h3>
            
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search for hosts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                autoFocus
              />
            </div>

            {/* Search Results */}
            <div className="max-h-60 overflow-y-auto mb-4">
              {loading ? (
                <div className="text-center py-4 text-gray-600">Searching...</div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((host) => (
                    <button
                      key={host.id}
                      onClick={() => trackHost(host)}
                      className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
                          {host.avatar_url && (
                            <img 
                              src={host.avatar_url} 
                              alt={host.display_name}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{host.display_name}</div>
                          <div className="text-sm text-gray-600">
                            {host.events?.length || 0} events
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : searchTerm && !loading ? (
                <div className="text-center py-4 text-gray-600">No hosts found</div>
              ) : null}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSearchTerm('');
                  setSearchResults([]);
                }}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}