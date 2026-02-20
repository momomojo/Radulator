/**
 * WelcomeCard — One-time dismissible banner shown on first visit.
 * Appears below the medical disclaimer. Slate tones to differentiate from the blue disclaimer.
 */
import { trackOnboarding } from "@/lib/analytics";

export function WelcomeCard({ onDismiss, onOpenGuide }) {
  const handleOpenGuide = () => {
    trackOnboarding("guide_opened", "welcome_card");
    onOpenGuide();
  };

  const handleDismiss = () => {
    trackOnboarding("welcome_dismissed", "welcome_card");
    onDismiss();
  };

  return (
    <div
      role="status"
      data-testid="welcome-card"
      className="bg-slate-50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-700 px-4 py-2 text-xs md:text-sm text-slate-700 dark:text-slate-300 flex items-center justify-between gap-3"
    >
      <p>
        <strong>Welcome to Radulator.</strong> 38 evidence-based medical
        calculators across 11 specialties.{" "}
        <button
          onClick={handleOpenGuide}
          className="underline font-medium text-slate-900 dark:text-slate-100 hover:text-primary transition-colors"
          data-testid="welcome-open-guide"
        >
          Open the Guide
        </button>{" "}
        or use the <strong>?</strong> button in the header anytime.
      </p>
      <button
        onClick={handleDismiss}
        className="ml-2 shrink-0 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium text-sm transition-colors"
        aria-label="Dismiss welcome message"
        data-testid="welcome-dismiss"
      >
        Dismiss
      </button>
    </div>
  );
}
