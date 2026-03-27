/**
 * Shopify and some proxies request `/auth/login`; our OAuth entry is `/auth`.
 * Preserve query string (e.g. `shop`, `host`) for the redirect.
 */

import { redirect, type LoaderFunctionArgs } from "react-router";

export function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const target = new URL("/auth", url.origin);
  url.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });
  return redirect(target.pathname + target.search);
}

export default function AuthLoginRedirect() {
  return null;
}
