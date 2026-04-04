/**
 * Success screen shown after a WooCommerce store is connected successfully.
 *
 * Displays the connected store name and currency retrieved from
 * GET /wp-json/wc/v3/system_status during the onboarding action.
 */

import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Store Connected — Witylogix" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const storeName = url.searchParams.get("storeName") ?? "Your store";
  const currency = url.searchParams.get("currency") ?? "—";
  return { storeName, currency };
}

export default function ConnectedPage() {
  const { storeName, currency } = useLoaderData<typeof loader>();

  return (
    <div className="card" style={{ textAlign: "center" }}>
      <div className="logo" style={{ justifyContent: "center" }}>
        <div
          style={{
            width: 32,
            height: 32,
            background: "#6366f1",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="logo-text">Witylogix</span>
      </div>

      <div className="success-icon" role="img" aria-label="Connected">
        ✅
      </div>

      <h1 style={{ marginBottom: 8 }}>Store Connected!</h1>
      <p className="subtitle" style={{ marginBottom: 24 }}>
        Your WooCommerce store is now linked to Witylogix. Orders will begin
        syncing automatically.
      </p>

      <div className="divider" />

      <div style={{ textAlign: "left" }}>
        <div className="store-detail">
          Store name: <span>{storeName}</span>
        </div>
        <div className="store-detail">
          Currency: <span>{currency}</span>
        </div>
      </div>

      <div className="divider" />

      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 0 }}>
        You can close this window and return to the Witylogix dashboard to
        manage your connection settings.
      </p>
    </div>
  );
}
