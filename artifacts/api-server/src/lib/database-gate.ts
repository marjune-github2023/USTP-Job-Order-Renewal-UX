import { maintenancePool } from "@workspace/db";
import type { RequestHandler, Response } from "express";
import { HttpError } from "./http";

// Shared by all portal instances connected to this database.
export const databaseGate: RequestHandler = async (req, res, next) => {
  const client = await maintenancePool.connect();
  let released = false;
  const release = async () => {
    if (released) return;
    released = true;
    try {
      await client.query("ROLLBACK");
      client.release();
    } catch {
      client.release(true);
    }
  };
  try {
    await client.query("BEGIN");
    const exclusive =
      req.method === "POST" &&
      /^\/admin\/database\/restore\/?$/i.test(req.path);
    const result = await client.query(
      exclusive
        ? "SELECT pg_try_advisory_xact_lock(726381, 1) AS locked"
        : "SELECT pg_try_advisory_xact_lock_shared(726381, 1) AS locked",
    );
    if (!result.rows[0].locked) {
      await release();
      return next(
        new HttpError(
          503,
          "The database is busy. Wait for current activity to finish, then try again.",
        ),
      );
    }
    // Use end rather than socket close: a disconnected browser must not release
    // the lock while its handler is still changing records.
    const end = res.end;
    res.end = function (this: Response, ...args: Parameters<typeof end>) {
      try {
        return end.apply(this, args);
      } finally {
        void release();
      }
    } as typeof end;
    next();
  } catch (error) {
    await release();
    next(error);
  }
};
