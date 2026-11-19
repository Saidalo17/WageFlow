"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False on the server and during the first render, true once React has taken over the page.
 * Used to keep submit buttons disabled until then: before hydration a form has no JavaScript
 * handler, so the browser would submit it as a plain GET and put the password in the URL.
 */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
