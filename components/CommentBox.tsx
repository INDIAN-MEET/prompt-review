'use client';

import React, { useState } from 'react';
import type { LineComment } from '@/lib/types';

interface CommentBoxProps {
  comments: LineComment[];
  author: string;
  onAddComment: (text: string) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;
  onCloseComposer: () => void;
  isComposing: boolean;
}

export const CommentBox: React.FC<CommentBoxProps> = ({
  comments,
  author,
  onAddComment,
  onDeleteComment,
  onCloseComposer,
  isComposing,
}) => {
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || submitting) return;

    setSubmitting(true);
    try {
      await onAddComment(commentText);
      setCommentText('');
      onCloseComposer();
    } finally {
      setSubmitting(false);
    }
  };

  if (!isComposing && comments.length === 0) {
    return null;
  }

  return (
    <div className="comments-row-container" role="region" aria-label="Line comments">
      {/* Existing comments */}
      {comments.map((comment) => (
        <div key={comment.id} className="comment-card">
          <div className="comment-header">
            <span className="comment-author">💬 {comment.author}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="comment-date">
                {new Date(comment.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <button
                type="button"
                className="version-btn"
                onClick={() => onDeleteComment(comment.id)}
                title="Delete comment"
                aria-label={`Delete comment by ${comment.author}`}
              >
                ✕
              </button>
            </div>
          </div>
          <div className="comment-body">{comment.text}</div>
        </div>
      ))}

      {/* Composer */}
      {isComposing && (
        <form onSubmit={handleSubmit} className="comment-composer">
          <textarea
            className="comment-textarea"
            placeholder={`Add a comment as ${author || 'Anonymous'}...`}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={2}
            autoFocus
            aria-label="Add a comment"
          />
          <div className="composer-actions">
            <button
              type="button"
              className="version-btn"
              onClick={onCloseComposer}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="version-btn"
              style={{
                backgroundColor: 'var(--accent)',
                color: '#fff',
                borderColor: 'var(--accent)',
              }}
              disabled={!commentText.trim() || submitting}
            >
              Comment
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

