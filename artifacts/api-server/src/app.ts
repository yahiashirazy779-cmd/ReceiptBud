import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
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

// Clerk proxy must come before body parsers (streams raw bytes)
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// Build an explicit CORS allowlist from the Replit-provided domain(s) and
// any localhost ports used in development. Reflecting arbitrary request
// origins (origin: true) combined with credentials: true would allow any
// website to make credentialed cross-origin requests to this API.
const ALLOWED_ORIGINS = new Set<string>(
  (process.env.REPLIT_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => `https://${d}`)
);

// Permit localhost variants used by the Vite dev server so local development
// continues to work without disabling CORS entirely.
if (process.env.NODE_ENV !== "production") {
  [3000, 3001, 5173, 5174].forEach((port) => {
    ALLOWED_ORIGINS.add(`http://localhost:${port}`);
    ALLOWED_ORIGINS.add(`http://127.0.0.1:${port}`);
  });
}

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      // Same-origin requests (e.g. server-to-server) have no Origin header.
      if (!origin || ALLOWED_ORIGINS.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

// CORS error handler — must be an Express error-handling middleware (4 args).
// When the cors middleware rejects an origin it calls next(err); without this
// handler Express would swallow the error and return a blank 500 with no CORS
// headers, which browsers surface as an opaque network failure or "403".
app.use(
  (
    err: Error & { status?: number },
    _req: import("express").Request,
    res: import("express").Response,
    next: import("express").NextFunction,
  ) => {
    if (err.message === "Not allowed by CORS") {
      res.status(403).json({ error: "Forbidden: origin not allowed" });
      return;
    }
    next(err);
  },
);

export default app;
