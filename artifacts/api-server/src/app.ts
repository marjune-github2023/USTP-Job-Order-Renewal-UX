import path from "node:path";
import express, { type Express } from "express";
import portal from "./routes/portal";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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
