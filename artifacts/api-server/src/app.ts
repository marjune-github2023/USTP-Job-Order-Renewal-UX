import path from "node:path";
import express, { type Express } from "express";
import portal from "./routes/portal";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
// Enable only when the API is reachable through one trusted reverse proxy.
// The HTTPS Compose overlay keeps the direct app port bound to loopback.
if (process.env.TRUST_PROXY_HOPS === "1") app.set("trust proxy", 1);
else if (process.env.TRUST_PROXY_HOPS && process.env.TRUST_PROXY_HOPS !== "0")
  throw new Error("TRUST_PROXY_HOPS must be 0 or 1.");

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.disable("x-powered-by");
app.use("/api", router);
app.use("/api", portal);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found." });
});
if (process.env.PORTAL_DIST_DIR) {
  const directory = path.resolve(process.env.PORTAL_DIST_DIR);
  app.use(express.static(directory));
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(directory, "index.html"));
  });
}

export default app;
