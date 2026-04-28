"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("VeriFlo UI crashed", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="page-shell">
        <section className="crash-card">
          <span className="eyebrow">Runtime recovery</span>
          <h1>VeriFlo recovered from a UI error</h1>
          <p>{this.state.error.message}</p>
          <button
            type="button"
            className="button button-primary"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </section>
      </main>
    );
  }
}
