import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      // tsx runs this module from server/_core, while a bundled dist/index.js
      // runs it from dist/.  Resolve both layouts so a preview process cannot
      // accidentally look for package/client/index.html (which does not exist
      // in the standalone package).
      const clientTemplateCandidates = [
        path.resolve(import.meta.dirname, "../..", "client", "index.html"),
        path.resolve(import.meta.dirname, "..", "client", "index.html"),
        path.resolve(process.cwd(), "client", "index.html"),
      ];
      const clientTemplate = clientTemplateCandidates.find((candidate) => fs.existsSync(candidate));
      if (!clientTemplate) throw new Error(`Client template not found. Checked: ${clientTemplateCandidates.join(", ")}`);

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const candidates = process.env.NODE_ENV === "development"
    ? [path.resolve(import.meta.dirname, "../..", "dist", "public"), path.resolve(process.cwd(), "dist", "public")]
    : [path.resolve(import.meta.dirname, "public"), path.resolve(process.cwd(), "dist", "public")];
  const distPath = candidates.find((candidate) => fs.existsSync(path.join(candidate, "index.html"))) ?? candidates[0];
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
