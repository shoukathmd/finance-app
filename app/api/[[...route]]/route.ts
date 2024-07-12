import transactions from "./transactions";
import accounts from "./accounts";
import categories from "./categories";
import summary from "./summary";
import plaid from "./plaid";

import { Hono } from "hono";
import { handle } from "hono/vercel";
import subscriptions from "./subscriptions";

export const runtime = "nodejs";
const app = new Hono().basePath("/api");

const routes = app
  .route("/plaid", plaid)
  .route("/summary", summary)
  .route("/accounts", accounts)
  .route("/categories", categories)
  .route("/transactions", transactions)
  .route("/subscriptions", subscriptions);

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);

export type AppType = typeof routes;
