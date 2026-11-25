import { Component, type ErrorInfo, type ReactNode } from "react";
import { readText, writeText } from "@/lib/storage";

const RELOADED_KEY = "feelit_reloaded_for_update";

/** A lazy page failed to download: almost always because a new version was deployed while this tab was open. */
const isStaleBuild = (error: Error) => /dynamically imported module|Importing a module script failed|Failed to fetch|ChunkLoadError/i.test(error.message);

/**
 * Last line of defence: if a page crashes, show a friendly screen instead of a blank one.
 * After a new deploy, an open tab can ask for files that no longer exist; that case reloads
 * once, by itself, to pick up the new version.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidMount() {
    // The app has been running fine for a while: allow one automatic reload again after a future deploy.
    window.setTimeout(() => writeText(RELOADED_KEY, null, "session"), 10_000);
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isStaleBuild(error) && !readText(RELOADED_KEY, "session")) {
      writeText(RELOADED_KEY, "1", "session");
      window.location.reload();
      return;
    }
    console.error("Feel It crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-[100svh] flex-col items-center justify-center gap-4 p-6 text-center">
        <img src="/logo.svg" alt="" className="h-14 w-14" />
        <h1 className="text-3xl">Something went off-route</h1>
        <p className="max-w-sm text-mist">Feel It hit an unexpected problem. Reloading usually fixes it; your saved trips are safe.</p>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
          <a className="btn btn-ghost" href="/">Go home</a>
        </div>
      </div>
    );
  }
}
