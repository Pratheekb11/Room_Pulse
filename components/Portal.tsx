"use client";

import { createPortal } from "react-dom";

/**
 * Renders a full-screen layer straight into <body>. A parent with a transform, filter or backdrop blur
 * (the home page's rise animation, the voter's sticky bar) would otherwise trap a `fixed` layer inside itself.
 * On the server (no document) it renders in place.
 */
export function ToBody({ children }: { children: React.ReactNode }) {
  return typeof document === "undefined" ? <>{children}</> : createPortal(children, document.body);
}
