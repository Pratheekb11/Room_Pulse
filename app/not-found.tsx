import { CenteredMessage } from "@/components/StatusScreens";

// Rendered per request: the page carries this request's CSP nonce (proxy.ts).
export const dynamic = "force-dynamic";

export default function NotFound() {
  return <CenteredMessage title="Page not found" body="This page doesn't exist. Check the link, or go back to the home page." />;
}
