import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createHmac, timingSafeEqual } from "crypto";
import WarpAPI from 'warp-agent-sdk';

const app = new Hono({ strict: false });

const client = new WarpAPI({
  apiKey: process.env['WARP_API_KEY'], // This is the default and can be omitted
  baseURL: process.env['BASE_URL'], // Not needed; this video is being recorded against our staging server :)
});

const SENTRY_CLIENT_SECRET = process.env.SENTRY_CLIENT_SECRET;
const PORT = parseInt(process.env.PORT || "3000", 10);

const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 60_000;

async function pollForSessionLink(taskId: string): Promise<string | null> {
  const startTime = Date.now();
  let task = await client.agent.tasks.retrieve(taskId);

  while (!task.session_link && Date.now() - startTime < POLL_TIMEOUT_MS) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    task = await client.agent.tasks.retrieve(taskId);
  }

  if (task.state === 'FAILED') {
    console.log(`Error: ${task.status_message?.message || 'Task failed with no message'}`);
    return null;
  }

  return task.session_link || null;
}

function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = createHmac("sha256", secret);
  hmac.update(payload, "utf8");
  const digest = hmac.digest("hex");

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch {
    return false;
  }
}

app.post("/sentry/webhook", async (c) => {
  const resource = c.req.header("Sentry-Hook-Resource");
  const signature = c.req.header("Sentry-Hook-Signature");

  if (!SENTRY_CLIENT_SECRET) {
    console.error("SENTRY_CLIENT_SECRET not configured");
    return c.json({ error: "Server misconfigured" }, 500);
  }

  const rawBody = await c.req.text();

  if (!signature || !verifySignature(rawBody, signature, SENTRY_CLIENT_SECRET)) {
    console.warn("Invalid signature");
    return c.json({ error: "Invalid signature" }, 401);
  }

  // Only process event_alert resources
  if (resource !== "event_alert") {
    console.log(`Ignoring resource type: ${resource}`);
    return c.json({ status: "ignored" }, 200);
  }

  const payload = JSON.parse(rawBody);
  const event = payload.data?.event || {};
  const message = event.message || event.title || "";
  const webUrl = event.web_url;

  // Grab stacktrace from modern or legacy shapes
  const exceptionValues = event.exception?.values || event["sentry.interfaces.Exception"]?.values || [];
  const entryExceptionValues = Array.isArray(event.entries)
    ? (event.entries.find((e: any) => e?.type === "exception")?.data?.values ?? [])
    : [];
  const firstException = exceptionValues[0] || entryExceptionValues[0] || null;
  const frames = firstException?.stacktrace?.frames
    || event.stacktrace?.frames
    || event["sentry.interfaces.Stacktrace"]?.frames
    || [];
  const stacktrace = frames.length > 0
    ? JSON.stringify({ frames }, null, 2)
    : JSON.stringify(firstException?.stacktrace || event.stacktrace || event["sentry.interfaces.Stacktrace"] || {}, null, 2);

  // Matched! Log and handle the nil pointer dereference
  console.log("=== nil pointer reference detected ===");
  console.log("Event ID:", event?.event_id);
  console.log("Message:", message);
  console.log("URL:", webUrl);

  const response = await client.agent.run({
    prompt: `
    You are a helpful assistant that can fix bugs in code.
    A nil pointer dereference occurred.

    Message:
    ${message}

    Stacktrace:
    ${stacktrace}

    Please analyze the stacktrace and make a fix. Then, create a "draft" pull request following the repo's pull_request_template.md file, if present.`,
    config: {
      environment_id: 'IbSjYlAGaBhR3dbsutY8Rj',
    }
  });

  console.log(`Agent started. Task ID: ${response.task_id}`);

  const sessionLink = await pollForSessionLink(response.task_id);
  if (sessionLink) {
    console.log(`View agent session: ${sessionLink}`);
  }

  return c.json({ status: "processed" }, 200);
});

app.get("/health", (c) => c.json({ status: "ok" }));

console.log(`Starting server on http://localhost:${PORT}`);
serve({ fetch: app.fetch, port: PORT });
