import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from "node:fs";
import path from "node:path";

function kuromojiDictRaw() {
  return {
    name: "kuromoji-dict-raw",
    enforce: "pre" as const,
    configureServer(server: any) {
      server.middlewares.use("/_kuromoji_dict", (req: any, res: any) => {
        const raw = decodeURIComponent(req.url ?? "/");
        const rel = raw.replace(/^\/+/, "");
        const root = path.join(process.cwd(), "public", "kuromoji-dict");
        const filePath = path.join(root, rel);

        fs.readFile(filePath, (err, data) => {
          if (err) {
            res.statusCode = 404;
            res.setHeader("Content-Type", "text/plain");
            res.end(`missing: ${rel}`);
            return;
          }
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/gzip");
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          res.end(data);
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), kuromojiDictRaw()],
})
