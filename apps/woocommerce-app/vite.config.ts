import { fileURLToPath } from "node:url";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const prismaClientBrowserStub = fileURLToPath(
  new URL("./app/stubs/prisma-client.browser-stub.ts", import.meta.url),
);

function isPrismaClientModuleId(id: string): boolean {
  if (id === "@prisma/client" || id.startsWith("@prisma/client/")) return true;
  if (id.includes("/@prisma/client/") || id.includes("\\@prisma\\client\\")) return true;
  if (id.endsWith("/@prisma/client") || id.endsWith("\\@prisma\\client")) return true;
  return false;
}

const prismaClientBrowserStubPlugin = {
  name: "prisma-client-browser-stub",
  enforce: "pre" as const,
  resolveId(id: string, _importer?: string, options?: { ssr?: boolean }) {
    if (options?.ssr === true) return null;
    if (isPrismaClientModuleId(id)) return prismaClientBrowserStub;
    return null;
  },
};

const SERVER_EXTERNALS = ["@witylogix/db", "@witylogix/core", "@prisma/client"];
const serverExternalsPlugin = {
  name: "force-server-externals",
  enforce: "pre" as const,
  resolveId(id: string, importer?: string) {
    if (SERVER_EXTERNALS.includes(id)) return { id, external: true };
    if (id.includes("packages/db/")) return { id: "@witylogix/db", external: true };
    if (id.includes("packages/core/")) return { id: "@witylogix/core", external: true };
    if (importer && importer.includes("packages/db/")) return { id: "@witylogix/db", external: true };
    if (importer && importer.includes("packages/core/")) return { id: "@witylogix/core", external: true };
    return undefined;
  },
};

export default defineConfig({
  plugins: [
    prismaClientBrowserStubPlugin,
    serverExternalsPlugin,
    reactRouter(),
    tsconfigPaths({ ignoreConfigErrors: true }),
  ],
  server: {
    port: Number(process.env.PORT) || 3006,
    strictPort: true,
    hmr: { protocol: "ws" },
  },
  optimizeDeps: {
    exclude: ["@prisma/client", "@witylogix/db", "@witylogix/core"],
    esbuildOptions: {
      external: ["@prisma/client"],
    } as never,
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      external: (id: string) =>
        id === "@witylogix/db" ||
        id === "@witylogix/core" ||
        id === "set-cookie-parser" ||
        id.includes("/packages/db/") ||
        id.includes("/packages/core/"),
    },
  },
  ssr: {
    external: ["@witylogix/db", "@witylogix/core", "@prisma/client", "set-cookie-parser"],
    optimizeDeps: {
      exclude: ["@prisma/client", "@witylogix/db", "@witylogix/core"],
    },
  },
  resolve: {
    preserveSymlinks: true,
    alias: { "~": new URL("./app", import.meta.url).pathname },
  },
});
