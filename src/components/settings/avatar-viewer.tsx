"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * Wraps the profile picture: a tap opens the photo big in the middle of the screen (like in Telegram);
 * a tap anywhere, the close button or Esc closes it again.
 */
export function AvatarViewer({ label, version, children }: { label: string; version: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        className="shrink-0 cursor-zoom-in rounded-full transition-transform hover:scale-[1.03] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95"
      >
        {children}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          onClick={() => setOpen(false)}
          className="w-auto max-w-none cursor-zoom-out justify-items-center gap-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-none"
        >
          <DialogTitle className="sr-only">{label}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element -- a private picture served by our own API */}
          <img
            src={`/api/avatar?v=${version}`}
            alt=""
            className="size-[min(86vw,70vh,440px)] rounded-full border-4 border-white/20 object-cover shadow-2xl"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
