import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const source = readFileSync(
  new URL("../../public/analytics.js", import.meta.url),
  "utf8",
);
const production = [
  ["agent-harness", "skills"],
  ["sovereign", "design"],
  ["fable", "other"],
  ["groundwork", "lists"],
  ["research", "engagements"],
  ["cortex", "brain"],
  ["consul", "sources"],
];

function browser(host, path = "/") {
  const scripts = [];
  const listeners = {};
  const timers = new Map();
  let nextTimer = 0;
  const location = new URL("https://" + host + path);
  const historyCalls = [];
  const window = {
    location,
    history: Object.fromEntries(
      ["pushState", "replaceState"].map((method) => [
        method,
        function (...args) {
          historyCalls.push({ receiver: this, args });
          if (args[2] != null) location.href = new URL(args[2], location).href;
          return "history-result";
        },
      ]),
    ),
    setTimeout(fn) {
      timers.set(++nextTimer, fn);
      return nextTimer;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    addEventListener(name, fn) {
      listeners[name] = fn;
    },
  };
  const context = vm.createContext({
    window,
    URL,
    document: {
      title: "secret title user@example.com",
      referrer: "https://example.com/secret-referrer?token=private",
      createElement(tag) {
        assert.equal(tag, "script");
        return {};
      },
      head: {
        appendChild(script) {
          scripts.push(script);
        },
      },
    },
  });
  const boot = () => vm.runInContext(source, context);
  const flush = () => {
    const pending = [...timers.values()];
    timers.clear();
    pending.forEach((fn) => fn());
  };
  const events = () =>
    (window.dataLayer || []).map((entry) => Array.from(entry));
  const views = () => events().filter((entry) => entry[0] === "event");
  boot();
  return {
    window,
    scripts,
    listeners,
    boot,
    flush,
    events,
    views,
    historyCalls,
  };
}

for (const [name, section] of production) {
  test(
    name + ": one loader, explicit initial view, duplicate boot is harmless",
    () => {
      const b = browser(
        name + ".jakeselby.com",
        "/" + section + "/secret-id?email=user@example.com#secret",
      );
      b.boot();
      b.flush();
      b.boot();
      b.flush();
      assert.equal(b.scripts.length, 1);
      assert.equal(
        b.scripts[0].src,
        "https://www.googletagmanager.com/gtag/js?id=G-8SM20QJMP2",
      );
      assert.equal(b.scripts[0].referrerPolicy, "no-referrer");
      const config = b.events().filter((e) => e[0] === "config");
      assert.equal(config.length, 1);
      assert.equal(config[0][2].send_page_view, false);
      assert.equal(config[0][2].allow_google_signals, false);
      assert.equal(config[0][2].allow_ad_personalization_signals, false);
      assert.equal(b.events()[0][0], "set");
      assert.equal(b.views().length, 1);
      assert.equal(
        b.views()[0][2].page_location,
        "https://" + name + ".jakeselby.com/" + section,
      );
      assert.equal(b.views()[0][2].page_referrer, "");
      assert.doesNotMatch(
        JSON.stringify(b.events()),
        /secret|user@example|email=|token=/,
      );
    },
  );
}

test("unknown, local, preview, API and lookalike hosts never initialize", () => {
  for (const host of [
    "localhost",
    "127.0.0.1",
    "staging.jakeselby.com",
    "preview.jakeselby.com",
    "api.jakeselby.com",
    "research.jakeselby.com.evil.test",
    "toString",
  ]) {
    const b = browser(host);
    b.flush();
    assert.equal(b.scripts.length, 0);
    assert.equal(b.events().length, 0);
    assert.equal(b.window.__personalAnalytics, undefined);
  }
});

test("auth and invitation entry routes never initialize, but safe navigation can start tracking", () => {
  for (const path of [
    "/auth/callback?code=secret",
    "/callback",
    "/invite-accepted",
    "/accept-invite/secret",
    "/invitations/secret",
    "/?code=secret",
    "/?invitation=secret",
    "/%61uth/callback",
  ]) {
    const b = browser("groundwork.jakeselby.com", path);
    b.flush();
    assert.equal(b.scripts.length, 0, path);
    assert.equal(b.events().length, 0, path);
    b.window.history.replaceState({}, "", "/dashboard");
    b.flush();
    assert.equal(b.scripts.length, 1);
    assert.equal(b.views().length, 1);
  }
});

test("navigation deduplicates sanitized routes and preserves history semantics", () => {
  const b = browser("research.jakeselby.com", "/engagements/secret");
  b.flush();
  const state = { private: "secret" };
  assert.equal(
    b.window.history.pushState(
      state,
      "secret",
      "/engagements/another?email=secret#private",
    ),
    "history-result",
  );
  b.flush();
  assert.equal(b.views().length, 1);
  assert.equal(b.historyCalls[0].receiver, b.window.history);
  assert.deepEqual(b.historyCalls[0].args, [
    state,
    "secret",
    "/engagements/another?email=secret#private",
  ]);
  b.window.history.pushState({}, "", "/runs/secret");
  b.flush();
  assert.equal(b.views().length, 2);
  b.window.location.href = "https://research.jakeselby.com/engagements/private";
  b.listeners.popstate();
  b.flush();
  assert.equal(b.views().length, 3);
  b.window.location.href = "https://research.jakeselby.com/runs/private";
  b.listeners.popstate();
  b.flush();
  assert.equal(b.views().length, 4);
  b.window.history.replaceState({}, "", "/private-user@example.com");
  b.flush();
  assert.equal(
    b.views().at(-1)[2].page_location,
    "https://research.jakeselby.com/other",
  );
  assert.doesNotMatch(
    JSON.stringify(b.events()),
    /secret|private|user@example/,
  );
  assert.equal(b.scripts.length, 1);
});

test("redirects coalesce, including before initialization", () => {
  const b = browser("groundwork.jakeselby.com");
  b.window.history.replaceState({}, "", "/dashboard");
  b.window.history.replaceState({}, "", "/lists/secret");
  b.flush();
  assert.equal(b.views().length, 1);
  assert.equal(
    b.views()[0][2].page_location,
    "https://groundwork.jakeselby.com/lists",
  );
  b.window.history.pushState({}, "", "/reports");
  b.window.history.replaceState({}, "", "/settings");
  b.flush();
  assert.equal(b.views().length, 2);
  assert.equal(
    b.views()[1][2].page_location,
    "https://groundwork.jakeselby.com/settings",
  );
});

test("excluded routes emit nothing after initialization and malformed paths are ignored", () => {
  const b = browser("groundwork.jakeselby.com", "/lists");
  b.flush();
  for (const path of [
    "/auth/callback?code=secret",
    "/invite-accepted",
    "/%FF",
  ]) {
    b.window.history.pushState({}, "", path);
    b.flush();
    assert.equal(b.views().length, 1);
  }
  assert.doesNotMatch(JSON.stringify(b.events()), /secret|callback|invite/);
});
