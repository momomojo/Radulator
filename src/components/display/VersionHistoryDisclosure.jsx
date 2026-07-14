import React, { useId, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

const badgeClasses =
  "inline-flex items-center px-2.5 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-800";

function VersionHistoryDisclosure({
  calculatorId,
  calculatorName,
  guidelineVersion,
  history = [],
  onCitationClick,
  externalLinks = "clickable",
}) {
  const [expanded, setExpanded] = useState(false);
  const reactId = useId();
  const panelId = `version-history-${reactId}`;
  const hasHistory = Array.isArray(history) && history.length > 0;
  const latestEntry = hasHistory ? history[history.length - 1] : null;
  const shortVersion =
    latestEntry?.shortVersion || latestEntry?.version || "this version";

  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={badgeClasses} data-testid="guideline-badge">
          {guidelineVersion}
        </span>
        {hasHistory && (
          <button
            type="button"
            className="inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 hover:text-primary/90"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>Why {shortVersion}? · version history</span>
          </button>
        )}
      </div>

      {hasHistory && (
        <section
          id={panelId}
          hidden={!expanded}
          aria-label={`${calculatorName} version history`}
          className="mt-3 max-w-3xl rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground"
          data-testid="version-history-panel"
        >
          <h3 className="sr-only">{calculatorName} version history</h3>
          <div className="space-y-3">
            {history.map((entry) => (
              <article
                key={`${entry.version}-${entry.year}`}
                className="space-y-2"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="font-semibold text-foreground">
                    {entry.version}
                    {entry.year ? ` (${entry.year})` : ""}
                  </p>
                  {entry.replaces && (
                    <span className="text-muted-foreground">
                      Replaces {entry.replaces}
                    </span>
                  )}
                </div>
                {entry.status && <p>{entry.status}</p>}
                {entry.summary && (
                  <p>
                    <span className="font-medium text-foreground">
                      What changed:
                    </span>{" "}
                    {entry.summary}
                  </p>
                )}
                {entry.whySuperseded && (
                  <p>
                    <span className="font-medium text-foreground">
                      Why newer criteria:
                    </span>{" "}
                    {entry.whySuperseded}
                  </p>
                )}
                {entry.citations?.length > 0 && (
                  <ul className="space-y-1">
                    {entry.citations.map((citation, index) => (
                      <li key={citation.u || `${citation.t}-${index}`}>
                        {citation.u && externalLinks !== "text-only" ? (
                          <a
                            href={citation.u}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:text-primary/80 hover:underline"
                            onClick={() =>
                              onCitationClick?.(
                                citation.u,
                                "version_history",
                                calculatorId,
                              )
                            }
                          >
                            {citation.t}
                            <ExternalLink
                              className="h-3 w-3"
                              aria-hidden="true"
                            />
                          </a>
                        ) : (
                          <span>
                            {citation.t}
                            {citation.u && externalLinks === "text-only"
                              ? ` (${citation.u})`
                              : ""}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default VersionHistoryDisclosure;
