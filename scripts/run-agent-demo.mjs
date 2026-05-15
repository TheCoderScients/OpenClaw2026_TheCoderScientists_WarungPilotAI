const endpoint =
  process.env.WARUNGPILOT_ENDPOINT || "http://localhost:3000/api/agent/run";

const response = await fetch(endpoint, {
  method: "GET",
  headers: {
    Accept: "application/json",
  },
});

const text = await response.text();

if (!response.ok) {
  throw new Error(`WarungPilot demo failed: ${response.status} ${text}`);
}

const payload = JSON.parse(text);
const result = payload.result;

console.log(
  JSON.stringify(
    {
      ok: payload.ok,
      runId: result.runId,
      metrics: result.metrics,
      autonomousTaskCompleted: result.reflection.autonomousTaskCompleted,
      decision: result.reflection.decision,
      paymentTasks: result.paymentTasks,
      approvals: result.approvals,
    },
    null,
    2,
  ),
);

