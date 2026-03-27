/**
 * Session-token bounce — required for embedded admin auth.
 *
 * `shopify app` / `authenticate.admin` redirects here when the document request
 * is missing `id_token` in the query string. The loader delegates to
 * `authenticate.admin`, which renders the App Bridge script that patches the
 * URL. Without this route, `/auth/session-token` is a hard 404 and the app
 * never loads in the admin iframe.
 *
 * @see Shopify shopify-app-template-react-router `auth.$.tsx`
 */

import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "~/lib/shopify.server";

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  return null;
}
