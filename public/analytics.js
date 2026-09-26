/* Explicit page views only. Disable GA4 Enhanced measurement on this stream. */
(function () {
  "use strict";
  const sites = {
    "model-citizen.dev": [
      "Model Citizen",
      [
        "rules",
        "skills",
        "hooks",
        "agents",
        "preferences",
        "docs",
        "changelog",
        "contributing",
      ],
    ],
    "agent-harness.jakeselby.com": [
      "Agent Harness",
      [
        "rules",
        "skills",
        "hooks",
        "agents",
        "preferences",
        "docs",
        "changelog",
        "contributing",
      ],
    ],
    "sovereign.jakeselby.com": [
      "Sovereign Library",
      [
        "design",
        "devlog",
        "mocks",
        "structures",
        "components",
        "water",
        "provenance",
        "notices",
      ],
    ],
    "fable.jakeselby.com": ["Fable", []],
    "groundwork.jakeselby.com": [
      "Groundwork",
      [
        "login",
        "demo",
        "demo-welcome",
        "dashboard",
        "lists",
        "turf",
        "canvassing",
        "scripts",
        "reports",
        "settings",
        "billing",
        "voters",
        "roadmap",
        "zones",
        "admin",
      ],
    ],
    "research.jakeselby.com": [
      "Research",
      ["engagements", "library", "flows", "outputs", "runs"],
    ],
    "cortex.jakeselby.com": ["Cortex", ["brain", "pitch"]],
    "consul.jakeselby.com": [
      "Consul",
      [
        "briefing",
        "settings",
        "ledger",
        "memory",
        "about-me",
        "audit",
        "rules",
        "sources",
        "onboarding",
        "entities",
      ],
    ],
  };
  const host = window.location.hostname;
  if (
    !Object.prototype.hasOwnProperty.call(sites, host) ||
    window.__personalAnalytics
  )
    return;
  window.__personalAnalytics = true;
  const site = sites[host];
  const measurementId = "G-8SM20QJMP2";
  let initialized = false;
  let previous = "";
  let timer;
  let referrer = "";
  try {
    const referringUrl = new URL(document.referrer);
    if (["http:", "https:"].includes(referringUrl.protocol))
      referrer = referringUrl.origin;
  } catch {
    /* Direct visits have no referrer. */
  }

  function page() {
    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(url.hash.slice(1));
    let path;
    try {
      path = decodeURIComponent(url.pathname).toLowerCase();
    } catch {
      return null;
    }
    // Exclude credential-bearing entry routes, including callbacks delivered to '/'.
    if (
      /(^|\/)(auth|callback|invite|invites|invitation|invitations|invite-accepted|accept-invite|accept-invitation)(\/|$)/.test(
        path,
      ) ||
      ["code", "access_token", "id_token", "invitation", "ticket"].some((key) =>
        url.searchParams.has(key),
      ) ||
      ["code", "access_token", "id_token"].some((key) => fragment.has(key))
    )
      return null;
    const section = path.split("/")[1];
    const route =
      path === "/" ? "/" : site[1].includes(section) ? "/" + section : "/other";
    return {
      page_location: "https://" + host + route,
      page_title: site[0],
      page_referrer: referrer,
    };
  }

  function track() {
    const parameters = page();
    if (!parameters) {
      previous = "";
      return;
    }
    if (parameters.page_location === previous) return;
    if (previous) parameters.page_referrer = previous;
    previous = parameters.page_location;
    if (!initialized) {
      initialized = true;
      window.dataLayer = window.dataLayer || [];
      window.gtag =
        window.gtag ||
        function () {
          window.dataLayer.push(arguments);
        };
      window.gtag("set", parameters);
      window.gtag("js", new Date());
      window.gtag("config", measurementId, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      });
      const script = document.createElement("script");
      script.async = true;
      script.referrerPolicy = "no-referrer";
      script.src =
        "https://www.googletagmanager.com/gtag/js?id=" + measurementId;
      document.head.appendChild(script);
    }
    window.gtag("set", parameters);
    window.gtag("event", "page_view", parameters);
  }

  function schedule() {
    window.clearTimeout(timer);
    timer = window.setTimeout(track, 0);
  }
  ["pushState", "replaceState"].forEach(function (method) {
    const original = window.history[method];
    window.history[method] = function () {
      const result = original.apply(this, arguments);
      schedule();
      return result;
    };
  });
  window.addEventListener("popstate", schedule);
  schedule();
})();
