import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createBackendServer } from "./server";

const frontendOrigin = "http://localhost:3000";
const allowedOrigins = process.env.ALLOWED_ORIGINS;
const contactFormEnabled = process.env.CONTACT_FORM_ENABLED;
let server: ReturnType<typeof createBackendServer>;
let apiUrl: string;

before(async () => {
  process.env.ALLOWED_ORIGINS = frontendOrigin;
  process.env.CONTACT_FORM_ENABLED = "false";
  server = createBackendServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  apiUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (allowedOrigins === undefined) delete process.env.ALLOWED_ORIGINS;
  else process.env.ALLOWED_ORIGINS = allowedOrigins;
  if (contactFormEnabled === undefined) delete process.env.CONTACT_FORM_ENABLED;
  else process.env.CONTACT_FORM_ENABLED = contactFormEnabled;
});

const validPayload = {
  name: "Test Sama",
  email: "test@example.com",
  subject: "property",
  message: "Je souhaite une information sur ce bien.",
  propertyReference: "T-TEST",
  consent: true,
};

test("accepts CORS preflight from the configured frontend", async () => {
  const response = await fetch(`${apiUrl}/api/contact`, {
    method: "OPTIONS",
    headers: { Origin: frontendOrigin },
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), frontendOrigin);
  assert.equal(response.headers.get("access-control-allow-methods"), "POST, OPTIONS");
});

test("allows authenticated admin headers in CORS preflight", async () => {
  const response = await fetch(`${apiUrl}/api/admin/session`, {
    method: "OPTIONS",
    headers: { Origin: frontendOrigin },
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-methods"), "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  assert.equal(response.headers.get("access-control-allow-headers"), "Content-Type, Authorization, X-File-Name");
});

test("rejects requests from origins that are not configured", async () => {
  const response = await fetch(`${apiUrl}/api/contact`, {
    method: "POST",
    headers: { Origin: "https://other.example", "Content-Type": "application/json" },
    body: JSON.stringify(validPayload),
  });
  assert.equal(response.status, 403);
});

test("validates the request before reporting the disabled backend", async () => {
  const response = await fetch(`${apiUrl}/api/contact`, {
    method: "POST",
    headers: { Origin: frontendOrigin, "Content-Type": "application/json" },
    body: JSON.stringify(validPayload),
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("access-control-allow-origin"), frontendOrigin);
});

test("rejects invalid payloads", async () => {
  const response = await fetch(`${apiUrl}/api/contact`, {
    method: "POST",
    headers: { Origin: frontendOrigin, "Content-Type": "application/json" },
    body: JSON.stringify({ ...validPayload, consent: false }),
  });
  assert.equal(response.status, 400);
});

test("rejects bodies above the configured size limit", async () => {
  const response = await fetch(`${apiUrl}/api/contact`, {
    method: "POST",
    headers: {
      Origin: frontendOrigin,
      "Content-Type": "application/json",
      "Content-Length": "8193",
    },
    body: " ".repeat(8193),
  });
  assert.equal(response.status, 413);
});

test("rejects unknown API paths", async () => {
  const response = await fetch(`${apiUrl}/unknown`, { headers: { Origin: frontendOrigin } });
  assert.equal(response.status, 404);
});
