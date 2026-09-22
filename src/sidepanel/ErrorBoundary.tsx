import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last line of defense against a completely blank side panel. React
 * doesn't catch errors thrown during effects/render anywhere else in the
 * tree without one of these, and this app has already hit that exact
 * failure mode twice for two unrelated reasons (a missing "storage"
 * manifest permission crashing useOnboardingFlags's effect; a missing
 * .env.local crashing the Supabase client at import time, which this
 * boundary can't catch since it happens before React even mounts — see
 * that fix in src/lib/supabase/client.ts). Whatever the next one turns
 * out to be, showing the actual error message beats a silent blank
 * screen every time.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Corner] uncaught error in side panel", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-background p-4 text-foreground">
        <p className="text-sm font-semibold">Corner hit an unexpected error.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Try closing and reopening the side panel. If this keeps happening, reloading the extension from
          chrome://extensions usually fixes it.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md border border-white/10 bg-white/[0.03] p-2 text-[11px] text-destructive">
          {this.state.error.message}
        </pre>
      </div>
    );
  }
}
