const { parentPort, workerData } = require("worker_threads");

const { taskId, durationMs, progressSteps } = workerData;

let cancelled = false;

parentPort.on("message", (message) => {
  if (message.type === "CANCEL") {
    cancelled = true;
  }
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
  const stepDuration = durationMs / progressSteps;

  for (let step = 1; step <= progressSteps; step += 1) {
    if (cancelled) {
      parentPort.postMessage({ type: "CANCELLED", taskId });
      return;
    }

    await sleep(stepDuration);

    if (cancelled) {
      parentPort.postMessage({ type: "CANCELLED", taskId });
      return;
    }

    parentPort.postMessage({
      type: "PROGRESS",
      taskId,
      progress: Math.round((step / progressSteps) * 100),
    });
  }

  parentPort.postMessage({ type: "COMPLETED", taskId });
};

run().catch((err) => {
  parentPort.postMessage({
    type: "FAILED",
    taskId,
    error: err.message,
  });
});
