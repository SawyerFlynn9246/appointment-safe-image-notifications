import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import OpenAI from "openai";
import { ZodError } from "zod";
import { createAppointmentImageStore } from "./appointment_image_store.ts";
import { appointmentRequestSchema, decideNotification } from "./notification_policy.ts";

const imageDirectory = join(process.cwd(), "generated-images");

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 32_768) throw new RequestError(413, "Request body is too large.");
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RequestError(400, "Request body must be valid JSON.");
  }
}

class RequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method === "POST" && request.url === "/appointments/notifications") {
    const appointment = appointmentRequestSchema.parse(await readJson(request));
    const decision = decideNotification(appointment);
    if (decision.state === "manual_review") {
      sendJson(response, 202, { appointmentId: appointment.appointmentId, ...decision });
      return;
    }
    const stored = await createAppointmentImageStore().generate(appointment.appointmentId, decision.imagePrompt);
    sendJson(response, 201, {
      appointmentId: appointment.appointmentId,
      state: "ready",
      notification: { channel: appointment.channel, message: decision.message, imageUrl: stored.publicPath }
    });
    return;
  }

  const imageMatch = request.method === "GET" && request.url?.match(/^\/images\/([A-Za-z0-9_-]{3,64})$/);
  if (imageMatch) {
    const imagePath = join(imageDirectory, `${imageMatch[1]}.png`);
    await access(imagePath).catch(() => { throw new RequestError(404, "Image not found."); });
    response.writeHead(200, { "content-type": "image/png", "cache-control": "public, max-age=3600" });
    createReadStream(imagePath).pipe(response);
    return;
  }
  throw new RequestError(404, "Route not found.");
}

export function startAppointmentService(port = Number(process.env.PORT ?? 3000)) {
  const server = createServer((request, response) => {
    handle(request, response).catch((error: unknown) => {
      if (error instanceof ZodError) return sendJson(response, 400, { error: "Invalid appointment request", details: error.flatten() });
      if (error instanceof RequestError) return sendJson(response, error.status, { error: error.message });
      if (error instanceof OpenAI.APIError && error.status && error.status < 500) {
        return sendJson(response, error.status, { error: error.message });
      }
      console.error(error);
      sendJson(response, 502, { error: "Image generation could not be completed." });
    });
  });
  return server.listen(port, () => console.log(`Appointment image service listening on http://localhost:${port}`));
}

if (import.meta.url === `file://${process.argv[1]}`) startAppointmentService();
