// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

// On Vercel (VERCEL=1 in their CI) build with the Vercel preset.
// Inside Lovable the preset stays pinned by the platform.
const isVercel = !!process.env["VERCEL"];

// In Vercel builds, rewrite /__l5e/ asset URLs to /assets/{original_filename}
// so files served from public/assets/ are found correctly.
// enforce:'pre' runs before builtin:vite-json so we transform raw JSON first.
function assetJsonPlugin(): Plugin {
  return {
    name: "lovable-asset-json-vercel",
    enforce: "pre",
    transform(code, id) {
      if (!isVercel || !id.endsWith(".asset.json")) return;
      const json = JSON.parse(code);
      json.url = `/assets/${json.original_filename}`;
      return JSON.stringify(json);
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  ...(isVercel ? { nitro: { preset: "vercel" } } : {}),
  vite: {
    plugins: [assetJsonPlugin()],
  },
});
