// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Dev server host/port — override via env vars (e.g. `PORT=3000 HOST=0.0.0.0 npm run dev`)
// or just edit the fallbacks below. In Lovable's sandbox these are auto-detected and these
// values are ignored.
const HOST = process.env.HOST ?? "localhost";
const PORT = Number(process.env.PORT ?? 8080);

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: {
      host: HOST,
      port: PORT,
      hmr: { overlay: false },
    },
    preview: { host: HOST, port: PORT },
  },
});
