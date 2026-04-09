import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <style>{globalStyles}</style>
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

const globalStyles = `
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #f4f5f7;
    color: #1a1a2e;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .card {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 2px 16px rgba(0,0,0,0.10);
    padding: 40px;
    width: 100%;
    max-width: 480px;
  }
  .logo { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
  .logo img { width: 32px; height: 32px; }
  .logo-text { font-size: 18px; font-weight: 700; color: #1a1a2e; }
  h1 { font-size: 22px; font-weight: 700; margin: 0 0 6px; }
  .subtitle { font-size: 14px; color: #6b7280; margin: 0 0 28px; }
  label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #374151; }
  input[type="text"], input[type="url"], input[type="password"] {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s;
  }
  input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
  .field { margin-bottom: 18px; }
  .hint { font-size: 12px; color: #9ca3af; margin-top: 4px; }
  .error-banner {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #b91c1c;
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 13px;
    margin-bottom: 20px;
  }
  .btn {
    width: 100%;
    padding: 12px;
    background: #6366f1;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn:hover { background: #4f46e5; }
  .btn:disabled { background: #a5b4fc; cursor: not-allowed; }
  .success-icon { font-size: 48px; text-align: center; margin-bottom: 16px; }
  .store-detail { font-size: 14px; color: #374151; margin-bottom: 8px; }
  .store-detail span { font-weight: 600; }
  .divider { height: 1px; background: #e5e7eb; margin: 24px 0; }
  .back-link { display: block; text-align: center; font-size: 13px; color: #6366f1; text-decoration: none; margin-top: 16px; }
  .back-link:hover { text-decoration: underline; }
`;
