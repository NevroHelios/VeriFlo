"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("VeriFlo route error", error);
  }, [error]);

  return (
    <main className="page-shell">
      <section className="crash-card">
        <span className="eyebrow">Runtime recovery</span>
        <h1>VeriFlo hit a route error</h1>
        <p>{error.message}</p>
        <button type="button" className="button button-primary" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
