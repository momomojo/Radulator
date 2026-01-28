import React, { useState } from "react";

/**
 * Collapsible References Component
 * Displays academic references with expand/collapse functionality
 */
function CollapsibleReferences({ refs, calculatorId, onLinkClick }) {
  const [expanded, setExpanded] = useState(false);
  const VISIBLE_COUNT = 3;
  const hasMore = refs.length > VISIBLE_COUNT;
  const visibleRefs = expanded ? refs : refs.slice(0, VISIBLE_COUNT);
  const hiddenCount = refs.length - VISIBLE_COUNT;

  return (
    <section className="pt-4 border-t border-border references-section rounded-lg p-4 mt-4 bg-muted/30 dark:bg-muted/50">
      <h3 className="font-medium mb-2 text-foreground">References</h3>
      <ul className="list-disc pl-5 space-y-1 text-sm">
        {visibleRefs.map((r) => (
          <li key={r.u} className="text-muted-foreground">
            <a
              href={r.u}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 hover:underline transition-colors reference-link"
              onClick={() => onLinkClick?.(r.u, "reference", calculatorId)}
            >
              {r.t}
            </a>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
        >
          {expanded ? (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 15l7-7 7 7"
                />
              </svg>
              Show fewer references
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
              Show {hiddenCount} more reference{hiddenCount > 1 ? "s" : ""}
            </>
          )}
        </button>
      )}
    </section>
  );
}

export default CollapsibleReferences;
