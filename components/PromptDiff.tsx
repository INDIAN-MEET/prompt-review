'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { buildDiffRows, filterChangesOnly } from '@/lib/diff';
import {
  compareVariables,
  findBrokenPlaceholders,
  findMatchingDiffRowIndices,
} from '@/lib/variables';
import {
  getStoredAuthor,
  saveStoredAuthor,
  getStoredComments,
  addComment,
  deleteStoredComment,
  getSavedVersions,
  saveVersion,
  deleteSavedVersion,
  buildCommentsMap,
} from '@/lib/storage';
import { decodeShareHash, createShareUrl } from '@/lib/share';
import { InputsPanel } from './InputsPanel';
import { DiffView } from './DiffView';
import { VariablePanel } from './VariablePanel';
import type { LineComment, VersionSnapshot, VariableStatus } from '@/lib/types';

export const PromptDiff: React.FC = () => {
  const [previous, setPrevious] = useState<string>('');
  const [current, setCurrent] = useState<string>('');
  const [author, setAuthor] = useState<string>('Anonymous');
  const [changesOnly, setChangesOnly] = useState<boolean>(false);
  const [inputsExpanded, setInputsExpanded] = useState<boolean>(true);

  // Storage State
  const [comments, setComments] = useState<LineComment[]>([]);
  const [versions, setVersions] = useState<VersionSnapshot[]>([]);

  // Flash & Jump State
  const [flashingRowId, setFlashingRowId] = useState<string | null>(null);
  const [varJumpIndices, setVarJumpIndices] = useState<Record<string, number>>({});

  // Toast State
  const [toast, setToast] = useState<{
    message: string;
    type: 'info' | 'warn' | 'success';
  } | null>(null);

  const showToast = useCallback((message: string, type: 'info' | 'warn' | 'success' = 'info') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  // Initial client hydration from storage and URL hash
  useEffect(() => {
    // 1. Author
    getStoredAuthor().then(setAuthor);

    // 2. Comments
    getStoredComments().then(setComments);

    // 3. Saved Versions
    getSavedVersions().then(setVersions);

    // 4. URL Hash decode
    const checkHash = () => {
      if (typeof window !== 'undefined' && window.location.hash) {
        const decoded = decodeShareHash(window.location.hash);
        if (decoded) {
          setPrevious(decoded.previous);
          setCurrent(decoded.current);
          showToast('Loaded prompts from share link.', 'success');
        }
      }
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, [showToast]);

  // Author persistence
  const handleAuthorChange = (newAuthor: string) => {
    setAuthor(newAuthor);
    saveStoredAuthor(newAuthor);
  };

  // Diff calculation (memoized for 2,000+ line performance)
  const allRows = useMemo(() => {
    return buildDiffRows(previous, current);
  }, [previous, current]);

  const displayedRows = useMemo(() => {
    if (!changesOnly) return allRows;
    return filterChangesOnly(allRows, 2);
  }, [allRows, changesOnly]);

  // Variable comparison (memoized)
  const variables = useMemo(() => {
    return compareVariables(previous, current);
  }, [previous, current]);

  // Broken placeholders (memoized)
  const brokenPlaceholders = useMemo(() => {
    return findBrokenPlaceholders(current);
  }, [current]);

  // Fast comments map (keyed by trimmed text)
  const commentsMap = useMemo(() => {
    return buildCommentsMap(comments);
  }, [comments]);

  // Summary counts for toolbar pills
  const summaryCounts = useMemo(() => {
    let addedLines = 0;
    let removedLines = 0;
    for (const r of allRows) {
      if (r.type === 'added') addedLines++;
      if (r.type === 'removed') removedLines++;
    }

    const newVars = variables.filter((v) => v.status === 'new').length;
    const removedVars = variables.filter((v) => v.status === 'removed').length;

    return { addedLines, removedLines, newVars, removedVars };
  }, [allRows, variables]);

  // Swap prompts handler
  const handleSwap = () => {
    const prev = previous;
    setPrevious(current);
    setCurrent(prev);
    showToast('Swapped Previous and Current prompts.', 'info');
  };

  // Copy Summary handler
  const handleCopySummary = async () => {
    const lines: string[] = [];
    lines.push(`Prompt changes: +${summaryCounts.addedLines} / -${summaryCounts.removedLines} lines`);

    const newVarNames = variables.filter((v) => v.status === 'new').map((v) => `\${${v.name}}`);
    if (newVarNames.length > 0) {
      lines.push(`New variables: ${newVarNames.join(', ')}`);
    }

    const removedVarNames = variables
      .filter((v) => v.status === 'removed')
      .map((v) => `\${${v.name}}`);
    if (removedVarNames.length > 0) {
      lines.push(`Removed variables: ${removedVarNames.join(', ')}`);
    }

    const changedVarNames = variables
      .filter((v) => v.status === 'changed')
      .map((v) => `\${${v.name}} (${v.beforeCount}x -> ${v.afterCount}x)`);
    if (changedVarNames.length > 0) {
      lines.push(`Changed variable usage: ${changedVarNames.join(', ')}`);
    }

    if (brokenPlaceholders.length > 0) {
      lines.push('Warnings:');
      brokenPlaceholders.forEach((b) => {
        lines.push(`- Broken placeholder at line ${b.line}: ${b.snippet} (${b.message})`);
      });
    }

    const textToCopy = lines.join('\n');
    try {
      await navigator.clipboard.writeText(textToCopy);
      showToast('Summary copied to clipboard!', 'success');
    } catch {
      showToast('Failed to copy summary to clipboard.', 'warn');
    }
  };

  // Copy Share Link handler
  const handleCopyShareLink = async () => {
    if (typeof window === 'undefined') return;

    const { url, isTooLong, length } = createShareUrl(
      window.location.origin,
      window.location.pathname,
      { previous, current }
    );

    // Update address bar hash without full reload
    window.history.replaceState(null, '', url);

    try {
      await navigator.clipboard.writeText(url);
      if (isTooLong) {
        showToast(
          `Share link copied! Warning: Link length is ${length} chars (> 8,000) and may exceed some browser URL limits.`,
          'warn'
        );
      } else {
        showToast('Share link copied to clipboard!', 'success');
      }
    } catch {
      showToast('Failed to copy share link.', 'warn');
    }
  };

  // Click-to-Jump implementation
  const handleJumpToVariable = (varName: string, status: VariableStatus) => {
    // 1. Find matching row indices across the diff
    const matchingIndices = findMatchingDiffRowIndices(allRows, varName, status);
    if (matchingIndices.length === 0) {
      showToast(`No diff rows found for \${${varName}}.`, 'info');
      return;
    }

    // 2. Cycle to next occurrence
    const currentOccurrenceIdx = varJumpIndices[varName] ?? 0;
    const nextOccurrenceIdx = (currentOccurrenceIdx + 1) % matchingIndices.length;
    setVarJumpIndices((prev) => ({
      ...prev,
      [varName]: nextOccurrenceIdx,
    }));

    const targetRowIndex = matchingIndices[currentOccurrenceIdx % matchingIndices.length];
    const targetRow = allRows[targetRowIndex];

    // 3. Auto-disable "Changes only" if the target row is hidden
    const isTargetHidden =
      changesOnly && !displayedRows.some((r) => r.id === targetRow.id);

    if (isTargetHidden) {
      setChangesOnly(false);
    }

    // 4. Scroll into view and flash row
    setTimeout(
      () => {
        const el = document.getElementById(targetRow.id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setFlashingRowId(targetRow.id);
          setTimeout(() => {
            setFlashingRowId(null);
          }, 1800);
        }
      },
      isTargetHidden ? 50 : 0
    );
  };

  // Comments handlers
  const handleAddComment = async (trimmedLine: string, text: string) => {
    const created = await addComment(trimmedLine, author, text);
    setComments((prev) => [...prev, created]);
    showToast('Comment added.', 'success');
  };

  const handleDeleteComment = async (id: string) => {
    await deleteStoredComment(id);
    setComments((prev) => prev.filter((c) => c.id !== id));
    showToast('Comment deleted.', 'info');
  };

  // Version handlers
  const handleSaveVersion = async (note: string, text: string) => {
    const created = await saveVersion(note, text);
    setVersions((prev) => [created, ...prev]);
    showToast(`Snapshot "${created.note}" saved.`, 'success');
  };

  const handleDeleteVersion = async (id: string) => {
    await deleteSavedVersion(id);
    setVersions((prev) => prev.filter((v) => v.id !== id));
    showToast('Snapshot deleted.', 'info');
  };

  const hasAnyContent = previous.trim().length > 0 || current.trim().length > 0;

  return (
    <div className="app-container">
      {/* App Header */}
      <header className="app-header">
        <div className="brand">
          <h1 className="brand-title">prompt-diff</h1>
          <span className="brand-badge">git-style prompt reviewer</span>
        </div>
      </header>

      {/* Inputs Panel (Collapsible) */}
      <InputsPanel
        previous={previous}
        current={current}
        onPreviousChange={setPrevious}
        onCurrentChange={setCurrent}
        isExpanded={inputsExpanded}
        onToggleExpanded={() => setInputsExpanded((prev) => !prev)}
        versions={versions}
        onSaveVersion={handleSaveVersion}
        onDeleteVersion={handleDeleteVersion}
        onNotify={showToast}
      />

      {/* Toolbar */}
      <div className="toolbar" role="toolbar" aria-label="Diff actions and filters">
        {/* Summary Pills */}
        <div className="toolbar-pills">
          <span className="pill pill-add" title="Added lines">
            +{summaryCounts.addedLines} added
          </span>
          <span className="pill pill-remove" title="Removed lines">
            −{summaryCounts.removedLines} removed
          </span>
          {summaryCounts.newVars > 0 && (
            <span className="pill pill-var-new" title="New variables">
              +{summaryCounts.newVars} new vars
            </span>
          )}
          {summaryCounts.removedVars > 0 && (
            <span className="pill pill-var-removed" title="Removed variables">
              −{summaryCounts.removedVars} removed vars
            </span>
          )}
        </div>

        {/* Toolbar Controls */}
        <div className="toolbar-controls">
          <div className="author-input-wrapper">
            <label htmlFor="author-input">Author:</label>
            <input
              id="author-input"
              type="text"
              className="author-input"
              value={author}
              onChange={(e) => handleAuthorChange(e.target.value)}
              placeholder="Anonymous"
              title="Author name for comments"
            />
          </div>

          <label className="toggle-label">
            <input
              type="checkbox"
              checked={changesOnly}
              onChange={(e) => setChangesOnly(e.target.checked)}
            />
            <span>Changes only</span>
          </label>

          <button
            type="button"
            onClick={handleSwap}
            title="Swap Previous and Current prompts"
            disabled={!hasAnyContent}
          >
            ⇄ Swap
          </button>

          <button
            type="button"
            onClick={handleCopySummary}
            title="Copy changes and variable warnings as plain text"
            disabled={!hasAnyContent}
          >
            📋 Copy summary
          </button>

          <button
            type="button"
            onClick={handleCopyShareLink}
            title="Copy URL with encoded prompts in hash"
            disabled={!hasAnyContent}
          >
            🔗 Copy share link
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <main className="main-layout">
        <DiffView
          rows={displayedRows}
          commentsMap={commentsMap}
          author={author}
          flashingRowId={flashingRowId}
          onAddComment={handleAddComment}
          onDeleteComment={handleDeleteComment}
          hasContent={hasAnyContent}
        />

        <VariablePanel
          variables={variables}
          brokenPlaceholders={brokenPlaceholders}
          onJumpToVariable={handleJumpToVariable}
        />
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className="toast-container" role="status" aria-live="polite">
          <div className={`toast toast-${toast.type}`}>{toast.message}</div>
        </div>
      )}
    </div>
  );
};
