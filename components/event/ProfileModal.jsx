'use client';
import { useState, useEffect } from 'react';
import { X, Shield } from 'lucide-react';
import { FaFlag } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { getAvatarUrl } from '@/utils/supabase/avatarCache';

function useAvatarUrl(avatarPath) {
  const [url, setUrl] = useState('/avatar-placeholder.png');
  useEffect(() => {
    (async () => {
      if (!avatarPath) { setUrl('/avatar-placeholder.png'); return; }
      const signed = await getAvatarUrl(avatarPath);
      setUrl(signed);
    })();
  }, [avatarPath]);
  return url;
}

export default function ProfileModal({ profile, isOpen, onClose, onBlock, mutualVybes = [], pastEvents = [], avatarUrl: overrideAvatarUrl = null, hostStats = {} }) {
  const [isBlocking, setIsBlocking] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [blockDetails, setBlockDetails] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('spam');
  const [reportBusy, setReportBusy] = useState(false);
  const [blockChecked, setBlockChecked] = useState(false);

  // Always call the hook, even if profile is null
  const avatarUrl = overrideAvatarUrl || useAvatarUrl(profile?.avatar_url);

  if (!isOpen || !profile) return null;

  const reasonOptions = [
    { value: '', label: 'No reason' },
    { value: 'spam', label: 'Spam or scam' },
    { value: 'harassment', label: 'Harassment or bullying' },
    { value: 'inappropriate', label: 'Inappropriate content' },
    { value: 'other', label: 'Other (custom reason)' },
  ];

  function ReportModal({ open, onClose, reason, setReason, busy, onSubmit, reasons, blockChecked, setBlockChecked }) {
    const [details, setDetails] = useState('');
    useEffect(() => { if (!open) setDetails(''); }, [open]);
    if (!open) return null;
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 pointer-events-auto" onClick={onClose}>
        <div
          className="bg-white rounded-xl shadow-xl p-8 w-full max-w-lg relative"
          onClick={e => e.stopPropagation()}
        >
          <button
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
          <h2 className="text-xl font-bold mb-2">Something off? Let us know.</h2>
          <div className="mb-4 text-gray-700 text-sm leading-relaxed">
            <p>VybeLocal is built on trust and real-world respect.<br/>
            If this event or user feels unsafe, misleading, or out of alignment with our community values, please tell us.</p>
            <p className="mt-2">You’re not starting drama—you’re helping us protect the vibe.</p>
            <p className="mt-2">We review all reports with care, and your voice stays private.</p>
          </div>
          <form onSubmit={e => { e.preventDefault(); onSubmit(reason, details, blockChecked); }}>
            <label className="block mb-2 font-medium">What’s going on?</label>
            <select
              className="w-full mb-4 p-2 border rounded"
              value={reason}
              onChange={e => setReason(e.target.value)}
            >
              <option value="spam">Spam or scam</option>
              <option value="nsfw">NSFW or inappropriate content</option>
              <option value="unsafe">Unsafe or violent behavior</option>
              <option value="hate">Hate speech or discrimination</option>
              <option value="misleading">Misleading or false event</option>
              <option value="other">Other (please describe)</option>
            </select>
            <textarea
              className="w-full p-2 border rounded mb-4 placeholder-gray-400"
              rows={4}
              placeholder="Add any details that might help us understand the context (optional)"
              value={details}
              onChange={e => setDetails(e.target.value)}
            />
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="blockUserCheckbox"
                checked={blockChecked}
                onChange={e => setBlockChecked(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="blockUserCheckbox" className="text-sm select-none">
                Would you like to block this user? You won’t see them or their events ever again.
              </label>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2 rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 font-semibold text-base"
            >
              {busy ? 'Reporting…' : 'Submit Report'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  async function handleReportSubmit(reason, details, blockChecked) {
    if (reportBusy) return;
    setReportBusy(true);
    try {
      // Submit the flag
      const targetId = profile.uuid || profile.id;
      const res = await fetch('/api/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: 'user',
          target_id: targetId,
          user_id: targetId,
          reason_code: reason,
          details: details || null,
          source: 'user',
        }),
      });
      if (res.ok) {
        toast.success('Thank you for your report.');
        setReportOpen(false);
        setReportReason('spam');
        // If block is checked, also block the user
        if (blockChecked) {
          const blockRes = await fetch('/api/blocks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              target_type: 'user',
              target_id: targetId,
            }),
          });
          if (blockRes.ok || blockRes.status === 409) {
            toast.success('User blocked.');
          } else {
            console.error('Block failed');
          }
        }
        onClose(); // Always close the profile modal after reporting
      } else {
        const err = await res.json().catch(() => null);
        console.error('Flag API error', err);
        toast.error(err?.error || 'Failed to submit report.');
      }
    } catch (err) {
      toast.error('Failed to submit report.');
    }
    setReportBusy(false);
  }

  const handleBlock = async () => {
    if (isBlocking) return;
    setIsBlocking(true);
    try {
      const res = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: 'user',
          target_id: profile.uuid,
          reason_code: blockReason,
          details: blockReason === 'other' ? blockDetails : undefined,
        })
      });
      if (res.ok) {
        onBlock?.(profile.uuid);
        // Show confirmation message
        if (blockReason && blockReason !== 'other') {
          setConfirmMsg('Thanks for letting us know.\nWe take every report seriously at VybeLocal and may follow up if we need more info. Our goal is to keep the vibe safe, real, and welcoming for everyone.');
        } else {
          setConfirmMsg("You won't see this user or event again.");
        }
        setShowConfirm(true);
        setTimeout(() => {
          setShowConfirm(false);
          setConfirmMsg('');
          onClose(); // Close the profile modal after blocking
        }, 3000);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to block user');
      }
    } finally {
      setIsBlocking(false);
    }
  };

  const formatLastActive = (lastActive) => {
    if (!lastActive) return 'Never';
    const date = new Date(lastActive);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Profile</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors ml-2">
            <span className="sr-only">Close</span>×
          </button>
        </div>
        {/* Profile Content */}
        <div className="p-6 space-y-4">
          {/* Avatar, Name, Flag */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img
                src={avatarUrl}
                alt={profile.name}
                className="w-16 h-16 rounded-full object-cover"
              />
              <div>
                <h3 className="text-lg font-semibold">{profile.name}</h3>
                {profile.pronouns && <p className="text-sm text-gray-600">{profile.pronouns}</p>}
                {hostStats.completed !== undefined && (
                  <div className="text-xs text-gray-500">
                    {(() => {
                      const comp = Number(hostStats?.completed ?? 0);
                      const canc = Number(hostStats?.cancels ?? 0);
                      return `${comp} completed event${comp===1?'':'s'} · ${canc} cancellation${canc===1?'':'s'} (last 6 mo)`;
                    })()}
                  </div>
                )}
                {profile.is_trusted && (
                  <div className="mt-1">
                    <div className="flex items-center gap-1 text-sm text-green-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Verified Host
                    </div>
                    {profile.trusted_since && (
                      <div className="text-xs text-gray-500 mt-1">
                        Verified since {new Date(profile.trusted_since).toLocaleDateString('en-US', { 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button
              className="text-gray-400 hover:text-red-500 p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-red-300"
              style={{ fontSize: 20 }}
              title="Report user"
              onClick={() => setReportOpen(true)}
            >
              <FaFlag />
            </button>
          </div>
          {/* Bio */}
          {profile.bio && <div><p className="text-gray-700">{profile.bio}</p></div>}
          {/* Last Active */}
          <div className="text-sm text-gray-500">Last active: {formatLastActive(profile.last_active_at)}</div>
          {/* Mutual Vybes */}
          {mutualVybes.length > 0 && (
            <div>
              <div className="font-medium mb-1">Mutual Vybes</div>
              <ul className="list-disc pl-5 text-sm text-gray-700">
                {mutualVybes.map((v) => <li key={v.id}>{v.title}</li>)}
              </ul>
            </div>
          )}
          {/* Past Events restored */}
          {pastEvents.length > 0 && (
            <div>
              <div className="font-medium mb-1">Past Events</div>
              <ul className="list-disc pl-5 text-sm text-gray-700">
                {pastEvents.map((e) => <li key={e.id}>{e.title}</li>)}
              </ul>
            </div>
          )}
          {/* Block Reason Dropdown */}
          <div className="pt-4 border-t">
            <label className="block mb-2 font-medium">Reason for blocking (optional):</label>
            <select
              className="w-full p-2 border rounded mb-2"
              value={blockReason}
              onChange={e => setBlockReason(e.target.value)}
              disabled={isBlocking}
            >
              {reasonOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {blockReason === 'other' && (
              <textarea
                className="w-full p-2 border rounded mb-2"
                placeholder="Add more details (optional)"
                value={blockDetails}
                onChange={e => setBlockDetails(e.target.value)}
                disabled={isBlocking}
                rows={3}
              />
            )}
            <button
              onClick={handleBlock}
              disabled={isBlocking}
              className="flex items-center gap-2 py-2 px-4 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 w-full justify-center"
            >
              <Shield className="h-4 w-4" />
              {isBlocking ? 'Blocking...' : 'Block User'}
            </button>
            {showConfirm && (
              <div className="mt-4 p-3 bg-green-50 text-green-700 rounded text-center whitespace-pre-line">
                {confirmMsg}
              </div>
            )}
          </div>
        </div>
        {/* Report Modal */}
        <ReportModal
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          reason={reportReason}
          setReason={setReportReason}
          busy={reportBusy}
          onSubmit={handleReportSubmit}
          reasons={[]}
          blockChecked={blockChecked}
          setBlockChecked={setBlockChecked}
        />
      </div>
    </div>
  );
} 