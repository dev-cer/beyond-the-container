// NusaMart 12.12 flash-sale load test (webinar before/after + workshop leaderboard).
//
//   k6 run -e BASE_URL=http://<lb-ip> k6/flash-sale.js                 # ~1m45 "sale" profile
//   k6 run -e BASE_URL=http://<lb-ip> -e PROFILE=smoke k6/flash-sale.js # 30 s check
//   kubectl apply -k k6                                                 # in-cluster Job, "quick" profile (workshop)
//   k6 run -e BASE_URL=http://<lb-ip> -e PROFILE=official k6/flash-sale.js # 5 min, facilitator run
//
// Each shopper opens the shop, browses, searches, opens a product, then asks for recommendations
// (CPU-heavy on the server - this is what throttles an undersized pod and drives the HPA).
// The last line printed is "SCORE {...}" so scripts/run-k6.ps1 and score-all.ps1 can read the result.

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:8080").replace(/\/$/, "");
const PROFILE = __ENV.PROFILE || "sale";
const LABEL = __ENV.LABEL || "";

const PROFILES = {
  smoke: [{ duration: "10s", target: 10 }, { duration: "20s", target: 10 }],
  // Workshop missions: ~2.5 min. A new HPA needs 30-60 s before it has CPU metrics (TARGETS <unknown>),
  // so the load must last long enough for it to see the rush and scale out.
  quick: [{ duration: "10s", target: 150 }, { duration: "120s", target: 150 }, { duration: "10s", target: 0 }],
  sale: [
    { duration: "15s", target: 50 },   // doors open
    { duration: "15s", target: 250 },  // 00:00 - the rush
    { duration: "60s", target: 250 },
    { duration: "15s", target: 0 },
  ],
  official: [
    { duration: "30s", target: 100 },
    { duration: "30s", target: 300 },
    { duration: "3m30s", target: 300 },
    { duration: "30s", target: 0 },
  ],
};
const RUSH = PROFILE === "quick";
const RECO_CALLS = RUSH ? 6 : 2;          // recommendations per shopper visit
const THINK_MIN = RUSH ? 0.05 : 0.5;      // seconds of think time between visits
const THINK_SPREAD = RUSH ? 0.15 : 1.0;
if (!PROFILES[PROFILE]) throw new Error(`Unknown PROFILE ${PROFILE} (use: ${Object.keys(PROFILES).join(", ")})`);

export const options = {
  scenarios: { shoppers: { executor: "ramping-vus", startVUs: 0, stages: PROFILES[PROFILE], gracefulRampDown: "10s" } },
  // Targets, not gates: the run always completes so the score can be compared before vs after.
  thresholds: { http_req_failed: ["rate<0.01"], http_req_duration: ["p(95)<500"] },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "max"],
};

const SEARCHES = ["kopi", "batik", "keyboard", "teh", "tas", "lilin"];

export function setup() {
  const res = http.get(`${BASE_URL}/health`);
  if (res.status !== 200) throw new Error(`${BASE_URL} is not ready (status ${res.status})`);
  const products = http.get(`${BASE_URL}/api/products`).json();
  return { ids: products.map((p) => p.id) };
}

export default function ({ ids }) {
  const pick = () => ids[Math.floor(Math.random() * ids.length)];
  check(http.get(`${BASE_URL}/`), { "storefront 200": (r) => r.status === 200 });
  check(http.get(`${BASE_URL}/api/products`), { "catalog 200": (r) => r.status === 200 });
  check(http.get(`${BASE_URL}/api/products?q=${SEARCHES[Math.floor(Math.random() * SEARCHES.length)]}`), { "search 200": (r) => r.status === 200 });
  check(http.get(`${BASE_URL}/api/products/${pick()}`), { "product 200": (r) => r.status === 200 });
  // Mission profile ("quick"): a real rush - shoppers hammer recommendations (the CPU-heavy endpoint) with
  // little think time, so CPU climbs well past the HPA target of 60 % of the 500m request.
  for (let i = 0; i < RECO_CALLS; i++) {
    check(http.get(`${BASE_URL}/api/recommendations?product_id=${pick()}`), { "recommendations 200": (r) => r.status === 200 });
  }
  sleep(Math.random() * THINK_SPREAD + THINK_MIN);
}

export function handleSummary(data) {
  const m = data.metrics;
  const reqs = m.http_reqs ? m.http_reqs.values : { count: 0, rate: 0 };
  const failRate = m.http_req_failed ? m.http_req_failed.values.rate : 0;
  const dur = m.http_req_duration ? m.http_req_duration.values : {};
  const score = {
    label: LABEL, profile: PROFILE,
    p95_ms: Math.round(dur["p(95)"] || 0), avg_ms: Math.round(dur.avg || 0),
    errors: Math.round(failRate * reqs.count), error_pct: Math.round(failRate * 10000) / 100,
    requests: reqs.count, rps: Math.round(reqs.rate || 0),
  };
  const line = (k, v) => `  ${k.padEnd(18)} ${v}`;
  const text = [
    "", `NusaMart 12.12 flash sale${LABEL ? " - " + LABEL : ""} (${PROFILE})`,
    line("requests", `${score.requests}  (${score.rps} req/s)`),
    line("p95 latency", `${score.p95_ms} ms   (target < 500 ms)`),
    line("avg latency", `${score.avg_ms} ms`),
    line("failed requests", `${score.errors}  (${score.error_pct}% - target < 1%)`),
    "", "SCORE " + JSON.stringify(score), "",
  ].join("\n");
  return { stdout: text };
}
