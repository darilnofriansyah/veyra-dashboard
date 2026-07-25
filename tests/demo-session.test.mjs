import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server.js";
import {
  DEMO_SESSION_COOKIE,
  DEMO_SESSION_VALUE,
  hasDemoSession
} from "../src/lib/demo-session.ts";
import { config, proxy } from "../src/proxy.ts";

function request(path, cookieValue) {
  const headers = cookieValue === undefined
    ? undefined
    : { cookie: `${DEMO_SESSION_COOKIE}=${cookieValue}` };

  return new NextRequest(`http://localhost${path}`, { headers });
}

test("accepts only the exact demo session value", () => {
  assert.equal(hasDemoSession(DEMO_SESSION_VALUE), true);
  assert.equal(hasDemoSession(undefined), false);
  assert.equal(hasDemoSession("invalid"), false);
});

test("redirects signed-out dashboard requests to login", () => {
  const response = proxy(request("/dashboard"));

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "http://localhost/");
});

test("redirects signed-in login requests to the dashboard", () => {
  const response = proxy(request("/", DEMO_SESSION_VALUE));

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "http://localhost/dashboard");
});

test("allows the expected route for each session state", () => {
  const login = proxy(request("/"));
  const dashboard = proxy(request("/dashboard", DEMO_SESSION_VALUE));

  assert.equal(login.status, 200);
  assert.equal(login.headers.get("location"), null);
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.headers.get("location"), null);
});

test("treats an invalid cookie as signed out and limits the matcher", () => {
  const response = proxy(request("/dashboard", "invalid"));

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "http://localhost/");
  assert.deepEqual(config.matcher, ["/", "/dashboard"]);
});
