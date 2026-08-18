// Hard block: the per-domain payload is only reachable through /api/domains,
// which verifies the Clerk session. Direct fetches are refused.
export async function onRequest() {
  return new Response(JSON.stringify({ error: "not accessible directly; use /api/domains with a valid session" }),
    { status: 403, headers: { "content-type": "application/json" } });
}
