const API_URL = process.env.API_URL || "http://localhost:5000";
const SEED_COUNT = Number(process.env.SEED_COUNT) || 55;

const seed = async () => {
  const response = await fetch(`${API_URL}/api/tasks/seed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count: SEED_COUNT }),
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.message || "Seed request failed");
  }

  console.log(JSON.stringify(body));
};

seed().catch((err) => {
  console.error(JSON.stringify({ level: "error", message: err.message }));
  process.exit(1);
});
