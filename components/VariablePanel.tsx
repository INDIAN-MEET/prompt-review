'use client';

import React from 'react';
import type { BrokenPlaceholder, VariableComparison, VariableStatus } from '@/lib/types';

interface VariablePanelProps {
  variables: VariableComparison[];
  brokenPlaceholders: BrokenPlaceholder[];
  onJumpToVariable: (name: string, status: VariableStatus) => void;
}

export const VariablePanel: React.FC<VariablePanelProps> = ({
  variables,
  brokenPlaceholders,
  onJumpToVariable,
}) => {
  const hasRemoved = variables.some((v) => v.status === 'removed');
  const hasNew = variables.some((v) => v.status === 'new');
  const hasChanged = variables.some((v) => v.status === 'changed');
  const hasBothRemovedAndNew = hasRemoved && hasNew;

  return (
    <aside className="variable-column" aria-label="Variable check panel">
      <div className="var-panel-container">
        <h2 className="var-panel-title">
          <span>Variable Check</span>
          <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>
            {variables.length} total
          </span>
        </h2>

        {/* Warnings Section */}
        {(hasRemoved || hasNew || hasChanged) && (
          <div className="warning-box" role="alert" aria-label="Variable warnings">
            {hasBothRemovedAndNew && (
              <div className="warning-item">
                <span>⚠️</span>
                <span>Possible rename, check if it is the same variable.</span>
              </div>
            )}
            {hasRemoved && (
              <div className="warning-item">
                <span>⚠️</span>
                <span>Removed variables: Make sure the code no longer expects it.</span>
              </div>
            )}
            {hasNew && (
              <div className="warning-item">
                <span>⚠️</span>
                <span>New variables: Make sure the code passes it.</span>
              </div>
            )}
            {hasChanged && (
              <div className="warning-item">
                <span>⚠️</span>
                <span>Usage count changed.</span>
              </div>
            )}
          </div>
        )}

        {/* Broken Placeholders Check */}
        {brokenPlaceholders.length > 0 && (
          <div className="broken-box" role="alert" aria-label="Broken placeholders warning">
            <div className="broken-title">⚠️ Broken Placeholder Detected</div>
            {brokenPlaceholders.map((broken, idx) => (
              <div key={`broken-${idx}`} className="broken-item">
                <div>
                  <strong>Line {broken.line}:</strong> {broken.message}
                </div>
                <div className="broken-code-snippet">{broken.snippet}</div>
              </div>
            ))}
          </div>
        )}

        {/* Variables List */}
        {variables.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', padding: '16px 0' }}>
            No variables found in either prompt.
          </div>
        ) : (
          <div className="var-cards-list" role="list" aria-label="Variables list">
            {variables.map((v) => {
              const beforeText =
                v.beforeCount > 0
                  ? `Before: ${v.beforeCount}× (L${v.beforeLines.join(', L')})`
                  : 'Before: —';
              const afterText =
                v.afterCount > 0
                  ? `After: ${v.afterCount}× (L${v.afterLines.join(', L')})`
                  : 'After: —';

              return (
                <button
                  type="button"
                  key={v.name}
                  className="var-card"
                  onClick={() => onJumpToVariable(v.name, v.status)}
                  title={`Click to jump to \${${v.name}} in diff`}
                  aria-label={`Variable \${${v.name}}, status ${v.status}. Click to cycle occurrences in diff.`}
                >
                  <div className="var-card-header">
                    <span className="var-chip">${`{${v.name}}`}</span>
                    <span className={`var-badge badge-${v.status}`}>{v.status}</span>
                  </div>

                  <div className="var-counts">
                    <div>{beforeText}</div>
                    <div>{afterText}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};

