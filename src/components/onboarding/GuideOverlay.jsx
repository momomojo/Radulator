/**
 * GuideOverlay — Full-screen scrollable tutorial overlay.
 * Activated by GuideButton or WelcomeCard. ESC / backdrop click to close.
 * Includes a focus trap and scroll lock while open.
 */
import { useEffect, useRef, useCallback } from "react";
import { guideContent } from "./guideContent";
import { trackOnboarding } from "@/lib/analytics";

export function GuideOverlay({ isOpen, onClose }) {
  const panelRef = useRef(null);

  // Lock body scroll and handle ESC
  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Focus trap: cycle Tab within the panel
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll(
          'button, [href], [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    // Focus the close button on open
    requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector('[data-testid="guide-close-button"]')
        ?.focus();
    });

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  const scrollToSection = useCallback((id) => {
    trackOnboarding("section_viewed", id);
    document.getElementById(`guide-section-${id}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      data-testid="guide-backdrop"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Radulator User Guide"
        data-testid="guide-panel"
        className="bg-card text-card-foreground rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
      >
        {/* Sticky header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold text-foreground">
            Radulator User Guide
          </h2>
          <button
            onClick={onClose}
            data-testid="guide-close-button"
            className="p-2 -mr-2 rounded-md hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            aria-label="Close user guide"
          >
            <svg
              className="w-5 h-5 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div
          className="overflow-y-auto px-6 py-4 space-y-8"
          data-testid="guide-overlay"
        >
          {/* Table of contents */}
          <nav aria-label="Guide table of contents">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Contents
            </h3>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              {guideContent.map((section) => (
                <li key={section.id}>
                  <button
                    onClick={() => scrollToSection(section.id)}
                    className="text-primary hover:underline transition-colors"
                  >
                    {section.title}
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <hr className="border-border" />

          {/* Sections */}
          {guideContent.map((section) => (
            <section
              key={section.id}
              id={`guide-section-${section.id}`}
              className="scroll-mt-4"
            >
              <h3
                className="text-base font-semibold text-foreground mb-2"
                data-testid={`guide-section-title-${section.id}`}
              >
                {section.title}
              </h3>
              {section.body.map((paragraph, i) => (
                <p
                  key={i}
                  className="text-sm text-muted-foreground leading-relaxed mb-2 last:mb-0"
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
