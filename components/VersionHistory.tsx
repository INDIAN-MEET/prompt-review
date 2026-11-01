'use client';

import React, { useState } from 'react';
import type { VersionSnapshot } from '@/lib/types';

interface VersionHistoryProps {
  versions: VersionSnapshot[];
  currentText: string;
  onSaveVersion: (note: string, text: string) => Promise<void>;
  onRestoreToPrevious: (text: string) => void;
  onRestoreToCurrent: (text: string) => void;
  onDeleteVersion: (id: string) => Promise<void>;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  versions,
  currentText,
  onSaveVersion,
  onRestoreToPrevious,
  onRestoreToCurrent,
  onDeleteVersion,
}) => {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentText.trim() || saving) return;

    setSaving(true);
    try {
      await onSaveVersion(note.trim() || 'Snapshot', currentText);
      setNote('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="version-history-box" aria-label="Version history section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Version History</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {versions.length} saved
        </span>
      </div>

      {/* Save snapshot input */}
      <form onSubmit={handleSave} className="version-save-row">
        <label htmlFor="version-note-input" className="sr-only" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}>
          Version Note
        </label>
        <input
          id="version-note-input"
          type="text"
          className="version-save-input"
          placeholder="Note for current prompt (e.g. v2.1 with temperature)..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          type="submit"
          className="version-btn"
          disabled={!currentText.trim() || saving}
          style={{ whiteSpace: 'nowrap' }}
        >
          {saving ? 'Saving...' : 'Save Current'}
        </button>
      </form>

      {/* Saved versions list */}
      {versions.length > 0 && (
        <div className="versions-list" role="list">
          {versions.map((v) => (
            <div key={v.id} className="version-chip-card" role="listitem">
              <span className="version-note">{v.note}</span>
              <span className="version-date">
                {new Date(v.createdAt).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>

              <div className="version-actions">
                <button
                  type="button"
                  className="version-btn"
                  onClick={() => onRestoreToPrevious(v.text)}
                  title="Load into Previous prompt"
                  aria-label={`Load snapshot ${v.note} into Previous prompt`}
                >
                  → Previous
                </button>
                <button
                  type="button"
                  className="version-btn"
                  onClick={() => onRestoreToCurrent(v.text)}
                  title="Load into Current prompt"
                  aria-label={`Load snapshot ${v.note} into Current prompt`}
                >
                  → Current
                </button>
                <button
                  type="button"
                  className="version-btn"
                  onClick={() => onDeleteVersion(v.id)}
                  title="Delete snapshot"
                  aria-label={`Delete snapshot ${v.note}`}
                  style={{ color: 'var(--diff-remove-text)' }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

