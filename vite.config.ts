import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    // Vite rifiuta di serie ogni `Host` che non sia localhost, contro il
    // DNS rebinding — e per lo stesso motivo blocca anche il tunnel
    // Cloudflare, che in sviluppo passa da qui.
    allowedHosts: ["try.fabulabz.com"],
  },
});
