import type { LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  return Response.json({
    status: "ok",
    service: "witylogix-shopify-app",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
  });
}
