async function readJson(response) {
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }

  return payload;
}

export async function runAgent(input) {
  const response = await fetch("/api/agent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  return readJson(response);
}

export async function fetchMemory(sessionId) {
  const response = await fetch(`/api/memory/${sessionId}`);
  return readJson(response);
}

export async function fetchInitiative(sessionId) {
  const response = await fetch("/api/initiative", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ sessionId })
  });

  return readJson(response);
}
