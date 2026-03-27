/**
 * Root layout — App shell for the Shopify embedded admin app.
 *
 * Provides:
 *   - App Bridge (`@shopify/shopify-app-react-router/react` AppProvider) so React
 *     Router data requests include `Authorization: Bearer <session token>` on
 *     client navigations. Without this, loaders see no token / no shop+host in the
 *     URL and auth fails (often surfaced as 404 in the error boundary).
 *   - Polaris AppProvider with i18n translations + linkComponent (client-side nav)
 *   - Polaris Frame with Navigation sidebar
 *   - Polaris Loading bar during route transitions
 *   - Error boundary (Shopify HTML responses + Polaris fallback)
 *
 * Embedded apps must not use full document navigations for in-app links: Polaris
 * Navigation defaults to <a href>. That drops ?embedded=…&host=… and breaks auth.
 * linkComponent wires Navigation (and other Polaris links) to React Router <Link>.
 */

import { forwardRef, type ComponentPropsWithoutRef } from "react";
import {
  Links,
  Link,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useNavigation,
  useRouteError,
  isRouteErrorResponse,
  useLocation,
  useLoaderData,
} from "react-router";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { AppProvider as ShopifyAppBridgeProvider } from "@shopify/shopify-app-react-router/react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  AppProvider,
  Frame,
  Navigation,
  Loading,
  Banner,
  Page,
} from "@shopify/polaris";
import {
  HomeIcon,
  OrderIcon,
  DeliveryIcon,
  PersonIcon,
  LocationIcon,
  SettingsIcon,
  NotificationIcon,
  ListBulletedIcon,
  AppsIcon,
  GlobeIcon,
  ClockIcon,
  ProfileIcon,
} from "@shopify/polaris-icons";
import enTranslations from "@shopify/polaris/locales/en.json";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

export function links() {
  return [{ rel: "stylesheet", href: polarisStyles }];
}

/** OAuth + webhooks/proxy/health handle their own auth; do not run admin auth in root. */
function skipRootShopifyAdminAuth(pathname: string): boolean {
  if (pathname.startsWith("/auth")) return true;
  if (pathname.startsWith("/api/")) return true;
  if (pathname === "/health") return true;
  return false;
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Dynamic imports keep `shopify.server` (Prisma session storage) out of the client dep scan;
  // static imports from root would pull `@prisma/client` into Vite client pre-bundle and fail.
  if (!skipRootShopifyAdminAuth(new URL(request.url).pathname)) {
    const { authenticate } = await import("~/lib/shopify.server");
    await authenticate.admin(request);
  }
  const { getApiBaseUrl } = await import("~/lib/api.server");
  return {
    apiKey: process.env.SHOPIFY_API_KEY ?? "",
    /** Same origin loaders use for `createApiClient` — exposed for Socket.io on the client. */
    publicApiBaseUrl: getApiBaseUrl(),
  };
}

export const headers: HeadersFunction = (args) => boundary.headers(args);

/** Polaris `linkComponent`: maps `url` → React Router `to` for in-app navigation. */
type PolarisRouterLinkProps = Omit<
  ComponentPropsWithoutRef<typeof Link>,
  "to"
> & {
  url: string;
  external?: boolean;
};

const PolarisRouterLink = forwardRef<HTMLAnchorElement, PolarisRouterLinkProps>(
  function PolarisRouterLink(
    { url, external, children, ...rest },
    ref,
  ) {
    if (external) {
      return (
        <a href={url} ref={ref} {...rest}>
          {children}
        </a>
      );
    }
    return (
      <Link to={url} ref={ref} {...rest}>
        {children}
      </Link>
    );
  },
);

// ─── Helpers ──────────────────────────────────────────────

function isSelected(currentPath: string, url: string): boolean {
  if (url === "/") {
    return currentPath === "/";
  }
  return currentPath.startsWith(url);
}

// ─── Navigation ────────────────────────────────────────────

function AppNavigation({ currentPath }: { currentPath: string }) {
  return (
    <Navigation location={currentPath}>
      <Navigation.Section
        items={[
          {
            url: "/",
            label: "Dashboard",
            icon: HomeIcon,
            selected: isSelected(currentPath, "/"),
          },
        ]}
      />
      <Navigation.Section
        title="Operations"
        items={[
          {
            url: "/orders",
            label: "Orders",
            icon: OrderIcon,
            selected: isSelected(currentPath, "/orders"),
          },
          {
            url: "/shipments",
            label: "Shipments",
            icon: DeliveryIcon,
            selected: isSelected(currentPath, "/shipments"),
          },
          {
            url: "/drivers",
            label: "Drivers",
            icon: PersonIcon,
            selected: isSelected(currentPath, "/drivers"),
          },
          {
            url: "/routes",
            label: "Routes",
            icon: LocationIcon,
            selected: isSelected(currentPath, "/routes"),
          },
        ]}
      />
      <Navigation.Section
        title="Configuration"
        items={[
          {
            url: "/locations",
            label: "Locations",
            icon: LocationIcon,
            selected: isSelected(currentPath, "/locations"),
          },
          {
            url: "/shipping-profiles",
            label: "Shipping Profiles",
            icon: ProfileIcon,
            selected: isSelected(currentPath, "/shipping-profiles"),
          },
          {
            url: "/zones",
            label: "Zones",
            icon: GlobeIcon,
            selected: isSelected(currentPath, "/zones"),
          },
          {
            url: "/time-slots",
            label: "Time Slots",
            icon: ClockIcon,
            selected: isSelected(currentPath, "/time-slots"),
          },
        ]}
      />
      <Navigation.Section
        title="Communication"
        items={[
          {
            url: "/notifications",
            label: "Notifications",
            icon: NotificationIcon,
            selected: isSelected(currentPath, "/notifications"),
          },
        ]}
      />
      <Navigation.Section
        title="Admin"
        items={[
          {
            url: "/activity",
            label: "Activity Log",
            icon: ListBulletedIcon,
            selected: isSelected(currentPath, "/activity"),
          },
          {
            url: "/users",
            label: "Users",
            icon: PersonIcon,
            selected: isSelected(currentPath, "/users"),
          },
          {
            url: "/integrations",
            label: "Integrations",
            icon: AppsIcon,
            selected: isSelected(currentPath, "/integrations"),
          },
          {
            url: "/settings",
            label: "Settings",
            icon: SettingsIcon,
            selected: isSelected(currentPath, "/settings"),
          },
        ]}
      />
    </Navigation>
  );
}

// ─── App Root ──────────────────────────────────────────────

export default function App() {
  const navigation = useNavigation();
  const location = useLocation();
  const { apiKey, publicApiBaseUrl } = useLoaderData<typeof loader>();
  const isLoading = navigation.state === "loading";

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <script
          // Runs before client bundles so useSocket reads the correct API origin.
          dangerouslySetInnerHTML={{
            __html: `window.__SOCKET_URL=${JSON.stringify(publicApiBaseUrl)};`,
          }}
        />
        <ShopifyAppBridgeProvider embedded apiKey={apiKey}>
          <AppProvider i18n={enTranslations} linkComponent={PolarisRouterLink}>
            <Frame navigation={<AppNavigation currentPath={location.pathname} />}>
              {isLoading && <Loading />}
              <Outlet />
            </Frame>
          </AppProvider>
        </ShopifyAppBridgeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// ─── Error Boundary ────────────────────────────────────────

function isShopifyThrownResponse(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { constructor?: { name?: string } }).constructor?.name;
  return name === "ErrorResponse" || name === "ErrorResponseImpl";
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isShopifyThrownResponse(error)) {
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Shopify</title>
          <Meta />
          <Links />
        </head>
        <body>
          {boundary.error(error)}
          <Scripts />
        </body>
      </html>
    );
  }

  let title = "Something went wrong";
  let message = "An unexpected error occurred. Please try again.";

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    message =
      error.status === 404
        ? "The page you're looking for doesn't exist."
        : error.data?.message ?? message;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <Meta />
        <Links />
      </head>
      <body>
        <AppProvider i18n={enTranslations} linkComponent={PolarisRouterLink}>
          <Page title={title}>
            <Banner tone="warning">
              <p>{message}</p>
            </Banner>
            <div style={{ marginTop: 16 }}>
              <Link
                to="/"
                style={{
                  display: "inline-block",
                  padding: "8px 16px",
                  backgroundColor: "#005bd3",
                  color: "white",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontSize: 14,
                }}
              >
                Go to Dashboard
              </Link>
            </div>
          </Page>
        </AppProvider>
        <Scripts />
      </body>
    </html>
  );
}
