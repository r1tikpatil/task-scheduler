const express = require("express");
const workerController = require("../controllers/worker.controller");

const router = express.Router();

router.get("/stats", workerController.getWorkerStats);

module.exports = router;
