// Intrarea în AWS / LocalStack: Lambda Function URL → serverless-http → aplicația Express.
// Rutele sunt aceleași ca local; doar pornirea diferă (vezi server.ts).
import type { IncomingMessage } from "node:http";
import serverless from "serverless-http";
import { app } from "./app";

export const handler = serverless(app, {
  // serverless-http pune corpul cererii în req.body ca Buffer, iar express.json() din Express 5
  // îl consideră deja citit și nu îl mai parsează. Îl parsăm aici.
  request(req: IncomingMessage & { body?: unknown }) {
    if (Buffer.isBuffer(req.body) && req.headers["content-type"]?.startsWith("application/json")) {
      try {
        req.body = req.body.length ? JSON.parse(req.body.toString("utf8")) : {};
      } catch {
        req.body = {};
      }
    }
  },
});
