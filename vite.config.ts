import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const targetUrl = env.VITE_BACKEND_URL || "https://api.onyxhealthplus.com";

  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        '^/(api|create|get|view|update|delete|list|add|validate|onboard|report|sessions|session-items)': {
          target: targetUrl,
          changeOrigin: true,
          secure: false,
          cookieDomainRewrite: "localhost",
        }
      }
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    esbuild: {
      drop: mode === "production" ? ["console", "debugger"] : [],
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
