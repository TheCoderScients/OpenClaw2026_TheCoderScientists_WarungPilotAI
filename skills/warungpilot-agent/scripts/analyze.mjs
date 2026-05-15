#!/usr/bin/env node

const endpoint =
  process.env.WARUNGPILOT_OPENCLAW_ENDPOINT ||
  "http://localhost:3000/api/openclaw/analyze";

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : "";
}

async function readStdin() {
  if (process.stdin.isTTY) {
    return "";
  }

  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8").trim();
}

const message = readArg("--message") || (await readStdin());

if (!message.trim()) {
  throw new Error("Provide customer chat with --message or stdin.");
}

const response = await fetch(endpoint, {
  body: JSON.stringify({ message }),
  headers: {
    "Content-Type": "application/json",
  },
  method: "POST",
});

const text = await response.text();

if (!response.ok) {
  throw new Error(`WarungPilot OpenClaw endpoint failed: ${response.status} ${text}`);
}

process.stdout.write(`${JSON.stringify(JSON.parse(text), null, 2)}\n`);

