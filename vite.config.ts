import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    watch: {
      // Desktop builds write bin/, dist/ and temporary packages here. Watching
      // them reloads the web app for no reason.
      ignored: ["**/desktop/**"],
    },
  },
});
