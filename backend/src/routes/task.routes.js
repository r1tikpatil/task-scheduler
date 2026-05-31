const express = require("express");
const taskController = require("../controllers/task.controller");
const authMiddleware = require("../middleware/auth.middleware");
const rateLimitMiddleware = require("../middleware/rateLimit.middleware");

const router = express.Router();

router.post(
  "/",
  authMiddleware,
  rateLimitMiddleware,
  taskController.submitTask,
);

router.post("/seed", taskController.seedTasks);
router.get("/stats", taskController.getTaskStats);
router.get("/", taskController.listTasks);
router.get("/stream", taskController.streamTasks);
router.get("/:id", taskController.getTaskById);
router.post("/:id/cancel", taskController.cancelTask);
router.post("/:id/retry", taskController.retryTask);

module.exports = router;
