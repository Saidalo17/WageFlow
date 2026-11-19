"use client";

import { ErrorView } from "@/components/error-view";

// Shown inside the app layout, so the top menu stays available when one page fails.
export default function AppError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView {...props} />;
}
