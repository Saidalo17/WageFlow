"use client";

import { Printer } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Opens the browser's print window, where "Save as PDF" is one of the destinations. */
export function PrintButton({ label, auto }: { label: string; auto: boolean }) {
  // Opened from "Export PDF": the print window comes up by itself once the report is on screen.
  useEffect(() => {
    if (!auto) return;
    const id = setTimeout(() => window.print(), 700);
    return () => clearTimeout(id);
  }, [auto]);

  return (
    <Button onClick={() => window.print()} className="gap-1.5">
      <Printer className="size-4" />
      {label}
    </Button>
  );
}
