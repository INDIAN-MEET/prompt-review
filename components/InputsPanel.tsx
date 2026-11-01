'use client';

import React, { useState } from 'react';
import { loadGitHubFileCommits } from '@/lib/github';
import { VersionHistory } from './VersionHistory';
import type { VersionSnapshot } from '@/lib/types';

interface InputsPanelProps {
  previous: string;
  current: string;
  onPreviousChange: (val: string) => void;
  onCurrentChange: (val: string) => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  versions: VersionSnapshot[];
  onSaveVersion: (note: string, text: string) => Promise<void>;
  onDeleteVersion: (id: string) => Promise<void>;
  onNotify: (msg: string, type: 'info' | 'warn' | 'success') => void;
}

export const InputsPanel: React.FC<InputsPanelProps> = ({
  previous,
  current,
  onPreviousChange,
  onCurrentChange,
  isExpanded,
  onToggleExpanded,
  versions,
  onSaveVersion,
  onDeleteVersion,
  onNotify,
}) => {
  const [githubUrl, setGithubUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [loadingGithub, setLoadingGithub] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void,
    sideName: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so same file can be uploaded again if needed
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        setter(text);
        onNotify(`Loaded ${file.name} into ${sideName}`, 'success');
      } else {
        onNotify(`Failed to read ${file.name}`, 'warn');
      }
    };
    reader.onerror = () => {
      onNotify(`Error reading file: ${reader.error?.message || 'Unknown error'}`, 'warn');
    };
    reader.readAsText(file);
  };

  const handleLoadGitHub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl.trim() || loadingGithub) return;

    setLoadingGithub(true);
    setGithubError(null);

    try {
      const res = await loadGitHubFileCommits(githubUrl, githubToken);
      onPreviousChange(res.previousText);
      onCurrentChange(res.currentText);

      if (!res.previousSha) {
        onNotify(
          `Loaded ${res.path} (single commit found, Previous is empty).`,
          'info'
        );
      } else {
        onNotify(
          `Loaded last 2 commits of ${res.path} (${res.previousSha.slice(0, 7)} → ${res.currentSha?.slice(0, 7)}).`,
          'success'
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch from GitHub';
      setGithubError(message);
    } finally {
      setLoadingGithub(false);
    }
  };

  return (
    <section className="inputs-panel" aria-label="Prompt Inputs">
      <div
        className="inputs-header"
        onClick={onToggleExpanded}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpanded();
          }
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
          {isExpanded ? '▼ Collapse Inputs' : '▶ Expand Inputs (Edit Prompts)'}
        </span>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {isExpanded ? 'Hide editing controls' : 'Edit previous/current prompts or load file'}
        </span>
      </div>

      {isExpanded && (
        <div className="inputs-body">
          {/* Dual Textareas */}
          <div className="textareas-grid">
            {/* Previous prompt column */}
            <div className="prompt-input-col">
              <div className="prompt-input-header">
                <label htmlFor="previous-prompt-textarea">Previous Prompt</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label
                    htmlFor="previous-file-upload"
                    className="version-btn"
                    style={{ cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    📂 Upload (.txt, .md)
                  </label>
                  <input
                    id="previous-file-upload"
                    type="file"
                    accept=".txt,.md,text/plain,text/markdown"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileUpload(e, onPreviousChange, 'Previous prompt')}
                  />
                  {previous && (
                    <button
                      type="button"
                      className="version-btn"
                      style={{ fontSize: '0.75rem' }}
                      onClick={() => onPreviousChange('')}
                      title="Clear Previous prompt"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <textarea
                id="previous-prompt-textarea"
                className="prompt-textarea"
                placeholder="Paste older / baseline prompt here..."
                value={previous}
                onChange={(e) => onPreviousChange(e.target.value)}
                aria-label="Previous prompt content"
              />
            </div>

            {/* Current prompt column */}
            <div className="prompt-input-col">
              <div className="prompt-input-header">
                <label htmlFor="current-prompt-textarea">Current Prompt</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label
                    htmlFor="current-file-upload"
                    className="version-btn"
                    style={{ cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    📂 Upload (.txt, .md)
                  </label>
                  <input
                    id="current-file-upload"
                    type="file"
                    accept=".txt,.md,text/plain,text/markdown"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileUpload(e, onCurrentChange, 'Current prompt')}
                  />
                  {current && (
                    <button
                      type="button"
                      className="version-btn"
                      style={{ fontSize: '0.75rem' }}
                      onClick={() => onCurrentChange('')}
                      title="Clear Current prompt"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <textarea
                id="current-prompt-textarea"
                className="prompt-textarea"
                placeholder="Paste updated / new prompt here..."
                value={current}
                onChange={(e) => onCurrentChange(e.target.value)}
                aria-label="Current prompt content"
              />
            </div>
          </div>

          {/* GitHub Loader */}
          <div className="github-loader-box">
            <span className="github-loader-title">
              <span>🐙 Load from GitHub</span>
              <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                (Fetches last two commits of the file)
              </span>
            </span>

            <form onSubmit={handleLoadGitHub} className="github-inputs-row">
              <label htmlFor="github-url-input" className="sr-only" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}>
                GitHub File URL
              </label>
              <input
                id="github-url-input"
                type="url"
                className="github-url-input"
                placeholder="https://github.com/owner/repo/blob/main/prompts/v1.txt"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
              />

              <label htmlFor="github-token-input" className="sr-only" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}>
                GitHub Token (Optional)
              </label>
              <input
                id="github-token-input"
                type="password"
                className="github-token-input"
                placeholder="Token (optional, private repos)"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                autoComplete="off"
              />

              <button
                type="submit"
                disabled={!githubUrl.trim() || loadingGithub}
                style={{ whiteSpace: 'nowrap' }}
              >
                {loadingGithub ? 'Loading...' : 'Load Commits'}
              </button>
            </form>

            {githubError && (
              <div className="alert-message alert-error" role="alert">
                {githubError}
              </div>
            )}
          </div>

          {/* Version History Subpanel */}
          <VersionHistory
            versions={versions}
            currentText={current}
            onSaveVersion={onSaveVersion}
            onRestoreToPrevious={onPreviousChange}
            onRestoreToCurrent={onCurrentChange}
            onDeleteVersion={onDeleteVersion}
          />
        </div>
      )}
    </section>
  );
};
