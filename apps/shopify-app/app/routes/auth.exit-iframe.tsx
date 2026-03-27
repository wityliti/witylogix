/**
 * Exit-iframe helper — App Bridge page for breaking out of the admin iframe
 * when required (e.g. certain redirects). Handled inside `authenticate.admin`.
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
