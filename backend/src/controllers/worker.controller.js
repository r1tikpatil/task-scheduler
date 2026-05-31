const workerEngine = require("../services/workerEngine.service");
const asyncHandler = require("../utils/asyncHandler");

const getWorkerStats = asyncHandler(async (req, res) => {
  res.json(workerEngine.getStats());
});

module.exports = { getWorkerStats };
