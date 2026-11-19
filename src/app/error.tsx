"use client";

import { ErrorView } from "@/components/error-view";

// Last safety net for pages outside the app layout (sign in, sign up).
export default function RootError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-4">
      <ErrorView {...props} />
    </main>
  );
}
