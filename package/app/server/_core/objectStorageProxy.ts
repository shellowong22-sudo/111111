import type { Express } from "express";
import { storageGetSignedUrl } from "../storage";

export function registerObjectStorageProxy(app: Express) {
  app.get("/storage/*", async (req, res) => {
    try {
      const key = String((req.params as Record<string, string>)["0"] ?? "");
      if (!key) return res.status(400).json({ error: "storage key is required" });
      const url = await storageGetSignedUrl(key);
      return res.redirect(302, url);
    } catch (error) {
      return res.status(502).json({ error: error instanceof Error ? error.message : "storage unavailable" });
    }
  });
}
