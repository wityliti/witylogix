/**
 * Root layout — App shell for the Shopify embedded admin app.
 *
 * Provides:
 *   - Polaris AppProvider (via Shopify CDN Web Components)
 *   - App Bridge initialization
 *   - Sidebar navigation (s-navigation)
 *   - Error boundary with Polaris Banner
 *   - Loading indicator
 */
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useNavigation, useRouteError, isRouteErrorResponse, useLocation, } from "react-router";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
export function links() {
    return [{ rel: "stylesheet", href: polarisStyles }];
}
export default function App() {
    const navigation = useNavigation();
    const location = useLocation();
    const isLoading = navigation.state === "loading";
    return (<html lang="en">
      <head>
        <meta charSet="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <Meta />
        <Links />
      </head>
      <body>
        <AppProvider>
          <Frame navigation={<AppNavigation currentPath={location.pathname}/>}>
            {isLoading && <LoadingBar />}
            <Outlet />
          </Frame>
        </AppProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>);
}
// ─── App Provider ──────────────────────────────────────────
function AppProvider({ children }) {
    return (<div data-polaris-provider>
      {children}
    </div>);
}
// ─── Frame ─────────────────────────────────────────────────
function Frame({ navigation, children, }) {
    return (<div style={{ display: "flex", minHeight: "100vh" }}>
      <aside style={{ width: 240, flexShrink: 0 }}>
        {navigation}
      </aside>
      <main style={{ flex: 1, padding: "0 20px 20px" }}>
        {children}
      </main>
    </div>);
}
const NAV_ITEMS = [
    {
        label: "Dashboard",
        url: "/",
        icon: "home",
        matchPaths: ["/"],
    },
    {
        label: "Orders",
        url: "/orders",
        icon: "orders",
        matchPaths: ["/orders"],
    },
    {
        label: "Drivers",
        url: "/drivers",
        icon: "customers",
        matchPaths: ["/drivers"],
    },
    {
        label: "Routes",
        url: "/routes",
        icon: "navigation",
        matchPaths: ["/routes"],
    },
    {
        label: "Zones",
        url: "/zones",
        icon: "globe",
        matchPaths: ["/zones"],
    },
    {
        label: "Time Slots",
        url: "/time-slots",
        icon: "clock",
        matchPaths: ["/time-slots"],
    },
    {
        label: "Users",
        url: "/users",
        icon: "customers",
        matchPaths: ["/users"],
    },
    {
        label: "Settings",
        url: "/settings",
        icon: "settings",
        matchPaths: ["/settings"],
    },
];
function AppNavigation({ currentPath }) {
    return (<nav style={{
            padding: "16px 0",
            borderRight: "1px solid var(--p-color-border-subdued, #e1e3e5)",
            height: "100%",
            backgroundColor: "var(--p-color-bg-surface, #f6f6f7)",
        }}>
      <div style={{ padding: "0 12px 16px", fontWeight: 600, fontSize: 15 }}>
        Witylogix
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {NAV_ITEMS.map((item) => {
            const isActive = item.url === "/"
                ? currentPath === "/"
                : item.matchPaths?.some((p) => currentPath.startsWith(p)) ?? false;
            return (<li key={item.url}>
              <a href={item.url} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 16px",
                    fontSize: 14,
                    textDecoration: "none",
                    color: isActive
                        ? "var(--p-color-text-primary, #005bd3)"
                        : "var(--p-color-text, #303030)",
                    backgroundColor: isActive
                        ? "var(--p-color-bg-surface-selected, #f0f5ff)"
                        : "transparent",
                    borderRadius: 8,
                    margin: "0 8px",
                    fontWeight: isActive ? 600 : 400,
                    transition: "background-color 0.15s ease",
                }}>
                {item.label}
              </a>
            </li>);
        })}
      </ul>
    </nav>);
}
// ─── Loading Bar ───────────────────────────────────────────
function LoadingBar() {
    return (<div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            backgroundColor: "var(--p-color-bg-fill-brand, #005bd3)",
            zIndex: 9999,
            animation: "loading-bar 1.5s ease-in-out infinite",
        }}/>);
}
// ─── Error Boundary ────────────────────────────────────────
export function ErrorBoundary() {
    const error = useRouteError();
    let title = "Something went wrong";
    let message = "An unexpected error occurred. Please try again.";
    if (isRouteErrorResponse(error)) {
        title = `${error.status} ${error.statusText}`;
        message =
            error.status === 404
                ? "The page you're looking for doesn't exist."
                : error.data?.message ?? message;
    }
    else if (error instanceof Error) {
        message = error.message;
    }
    return (<html lang="en">
      <head>
        <meta charSet="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>{title}</title>
        <Meta />
        <Links />
      </head>
      <body>
        <div style={{
            maxWidth: 600,
            margin: "80px auto",
            padding: 24,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}>
          <div style={{
            padding: 16,
            border: "1px solid #ffc453",
            borderRadius: 12,
            backgroundColor: "#fff5ea",
        }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 16, color: "#7a4c00" }}>
              {title}
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: "#4a2800" }}>
              {message}
            </p>
          </div>
          <div style={{ marginTop: 16 }}>
            <a href="/" style={{
            display: "inline-block",
            padding: "8px 16px",
            backgroundColor: "#005bd3",
            color: "white",
            borderRadius: 8,
            textDecoration: "none",
            fontSize: 14,
        }}>
              Go to Dashboard
            </a>
          </div>
        </div>
        <Scripts />
      </body>
    </html>);
}
//# sourceMappingURL=root.js.map