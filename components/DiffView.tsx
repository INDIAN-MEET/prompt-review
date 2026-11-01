'use client';

import React, { useState } from 'react';
import type { DiffRow, LineComment, WordDiffChunk } from '@/lib/types';
import { splitPlaceholders } from '@/lib/variables';
import { CommentBox } from './CommentBox';

interface DiffViewProps {
  rows: DiffRow[];
  commentsMap: Map<string, LineComment[]>;
  author: string;
  flashingRowId: string | null;
  onAddComment: (trimmedLine: string, text: string) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;
  hasContent: boolean;
}

/**
 * Renders a word chunk, highlighting variables as purple chips inside it.
 */
function renderWordChunk(chunk: WordDiffChunk, chunkIndex: number) {
  const segments = splitPlaceholders(chunk.value);

  const innerContent = segments.map((seg, sIdx) => {
    if (seg.isVariable) {
      return (
        <span key={`var-${sIdx}`} className="var-chip">
          {seg.text}
        </span>
      );
    }
    return <React.Fragment key={`lit-${sIdx}`}>{seg.text}</React.Fragment>;
  });

  let className = '';
  if (chunk.added) className = 'word-added';
  if (chunk.removed) className = 'word-removed';

  return (
    <span key={`chunk-${chunkIndex}`} className={className}>
      {innerContent}
    </span>
  );
}

/**
 * Renders line text with purple variable chips.
 */
function renderLineContent(content: string) {
  const segments = splitPlaceholders(content);
  return segments.map((seg, sIdx) => {
    if (seg.isVariable) {
      return (
        <span key={`var-${sIdx}`} className="var-chip">
          {seg.text}
        </span>
      );
    }
    return <React.Fragment key={`lit-${sIdx}`}>{seg.text}</React.Fragment>;
  });
}

export const DiffView: React.FC<DiffViewProps> = ({
  rows,
  commentsMap,
  author,
  flashingRowId,
  onAddComment,
  onDeleteComment,
  hasContent,
}) => {
  const [composingRowId, setComposingRowId] = useState<string | null>(null);

  if (!hasContent) {
    return (
      <div className="empty-diff-box">
        <p>No prompts entered yet. Type or paste prompts above to inspect changes.</p>
      </div>
    );
  }

  // Check if inputs are identical (rows only contain unchanged or empty)
  const isIdentical =
    rows.length > 0 && rows.every((r) => r.type === 'unchanged');

  if (isIdentical) {
    return (
      <div className="empty-diff-box">
        <h3>No differences.</h3>
        <p style={{ marginTop: '4px' }}>The previous and current prompts are identical.</p>
      </div>
    );
  }

  return (
    <div className="diff-column" tabIndex={0} aria-label="Diff viewer">
      <table className="diff-table">
        <tbody>
          {rows.map((row) => {
            if (row.type === 'separator') {
              return (
                <tr key={row.id} className="diff-row diff-row-separator">
                  <td colSpan={4} style={{ padding: '8px', fontStyle: 'italic' }}>
                    ⋯ Folded unchanged lines ⋯
                  </td>
                </tr>
              );
            }

            const isFlashing = flashingRowId === row.id;
            const rowClass = `diff-row diff-row-${row.type} ${isFlashing ? 'row-flash' : ''}`;
            const isRemoved = row.type === 'removed';
            const isNonEmpty = row.trimmedText.length > 0;
            const canComment = !isRemoved && isNonEmpty;

            const comments = commentsMap.get(row.trimmedText) || [];
            const isComposing = composingRowId === row.id;

            return (
              <React.Fragment key={row.id}>
                <tr id={row.id} className={rowClass}>
                  {/* Old line gutter */}
                  <td className="gutter-old" aria-label={row.oldLineNumber ? `Old line ${row.oldLineNumber}` : undefined}>
                    {row.oldLineNumber ?? ''}
                  </td>

                  {/* New line gutter */}
                  <td className="gutter-new" aria-label={row.newLineNumber ? `New line ${row.newLineNumber}` : undefined}>
                    {row.newLineNumber ?? ''}
                  </td>

                  {/* Git sign gutter */}
                  <td className="gutter-sign" aria-hidden="true">
                    {row.type === 'added' ? '+' : row.type === 'removed' ? '−' : ' '}
                  </td>

                  {/* Code line content */}
                  <td className="diff-code-cell">
                    {row.wordChunks && row.wordChunks.length > 0
                      ? row.wordChunks.map((chunk, cIdx) => renderWordChunk(chunk, cIdx))
                      : renderLineContent(row.content)}

                    {/* Developer comment action button */}
                    {canComment && (
                      <button
                        type="button"
                        className="comment-trigger-btn"
                        onClick={() =>
                          setComposingRowId((prev) => (prev === row.id ? null : row.id))
                        }
                        title="Add comment on this line"
                        aria-label="Add comment on this line"
                      >
                        💬 {comments.length > 0 ? comments.length : ''}
                      </button>
                    )}
                  </td>
                </tr>

                {/* Inline Comments Section */}
                {(isComposing || comments.length > 0) && (
                  <tr>
                    <td colSpan={4} style={{ padding: 0 }}>
                      <CommentBox
                        comments={comments}
                        author={author}
                        onAddComment={async (text) => {
                          await onAddComment(row.trimmedText, text);
                        }}
                        onDeleteComment={onDeleteComment}
                        onCloseComposer={() => setComposingRowId(null)}
                        isComposing={isComposing}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
