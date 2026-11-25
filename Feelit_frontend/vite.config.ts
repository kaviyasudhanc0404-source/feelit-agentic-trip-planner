import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  // A deployed build without the real API address would silently call localhost from users' browsers.
  // On Vercel (VERCEL=1) that stops the build; local builds only warn.
  if (command === "build" && mode === "production" && !env.VITE_API_URL?.startsWith("https://")) {
    const message = "VITE_API_URL must be your backend's https:// address + /api (Vercel → Settings → Environment Variables).";
    if (process.env.VERCEL) throw new Error(message);
    console.warn(`
⚠ ${message}
`);
  }
  return {
    server: { host: "::", port: 8080 },
    plugins: [react()],
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  };
});
