import { Component } from "react";

/**
 * Catches render/compute errors so one calculator failing never white-screens
 * the whole app (web-dev review 2026-07-06). Shows a localized recovery panel
 * instead of unmounting the tree; a reset lets the clinician try another tool.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error("ErrorBoundary caught:", error, info);
    }
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="m-4 rounded-lg border border-border bg-card p-6 text-center"
        >
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            This calculator hit an unexpected error
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            The rest of Radulator is unaffected — pick another calculator from
            the menu, or reload to try again.
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
