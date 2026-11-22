"use client";

// Only used when the root layout itself fails. It cannot use translations or the theme,
// so it is a plain, readable page.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, display: "grid", minHeight: "100vh", placeItems: "center", textAlign: "center", padding: 16 }}>
        <div role="alert">
          <h1 style={{ fontSize: 24 }}>Something went wrong</h1>
          <p style={{ color: "#555" }}>Please try again in a moment.</p>
          <button
            onClick={reset}
            style={{ padding: "12px 20px", borderRadius: 12, border: 0, background: "#12b981", color: "#04261d", fontWeight: 700, fontSize: 16, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
