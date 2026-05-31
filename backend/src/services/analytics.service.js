const pool = require("../db/db");
const { TASK_STATUS } = require("../constants/enum");

const getAvgExecutionTimeByType = async () => {
  const [rows] = await pool.query(
    `SELECT
       type,
       COUNT(*) AS completedCount,
       ROUND(AVG(TIMESTAMPDIFF(SECOND, started_at, completed_at)), 2) AS avgSeconds
     FROM tasks
     WHERE status = ? AND started_at IS NOT NULL AND completed_at IS NOT NULL
     GROUP BY type
     ORDER BY type`,
    [TASK_STATUS.COMPLETED],
  );

  return rows.map((row) => ({
    type: row.type,
    completedCount: Number(row.completedCount),
    avgSeconds: Number(row.avgSeconds),
  }));
};

const getThroughputOverTime = async (hours = 24) => {
  const [rows] = await pool.query(
    `SELECT
       DATE_FORMAT(completed_at, '%Y-%m-%d %H:%i:00') AS minute,
       COUNT(*) AS count
     FROM tasks
     WHERE status = ? AND completed_at >= (UTC_TIMESTAMP() - INTERVAL ? HOUR)
     GROUP BY minute
     ORDER BY minute ASC`,
    [TASK_STATUS.COMPLETED, hours],
  );

  return rows.map((row) => ({
    minute: row.minute,
    count: Number(row.count),
  }));
};

const getFailureRateByType = async () => {
  const [rows] = await pool.query(
    `SELECT
       type,
       COUNT(*) AS totalCount,
       SUM(CASE WHEN status IN (?, ?) THEN 1 ELSE 0 END) AS failedCount
     FROM tasks
     GROUP BY type
     ORDER BY type`,
    [TASK_STATUS.DEAD_LETTER, TASK_STATUS.FAILED],
  );

  return rows.map((row) => {
    const totalCount = Number(row.totalCount);
    const failedCount = Number(row.failedCount);

    return {
      type: row.type,
      totalCount,
      failedCount,
      failureRate:
        totalCount === 0 ? 0 : Number((failedCount / totalCount).toFixed(4)),
    };
  });
};

const getQueueWaitDistribution = async () => {
  const [rows] = await pool.query(
    `SELECT
       CASE
         WHEN waitSeconds <= 5 THEN '0-5s'
         WHEN waitSeconds <= 15 THEN '6-15s'
         WHEN waitSeconds <= 30 THEN '16-30s'
         WHEN waitSeconds <= 60 THEN '31-60s'
         ELSE '60s+'
       END AS bucket,
       COUNT(*) AS count
     FROM (
       SELECT TIMESTAMPDIFF(SECOND, created_at, started_at) AS waitSeconds
       FROM tasks
       WHERE started_at IS NOT NULL
     ) waits
     GROUP BY bucket
     ORDER BY FIELD(bucket, '0-5s', '6-15s', '16-30s', '31-60s', '60s+')`,
  );

  return rows.map((row) => ({
    bucket: row.bucket,
    count: Number(row.count),
  }));
};

const getAnalytics = async (hours = 24) => {
  const [
    avgExecutionTimeByType,
    throughputOverTime,
    failureRateByType,
    queueWaitDistribution,
  ] = await Promise.all([
    getAvgExecutionTimeByType(),
    getThroughputOverTime(hours),
    getFailureRateByType(),
    getQueueWaitDistribution(),
  ]);

  return {
    avgExecutionTimeByType,
    throughputOverTime,
    failureRateByType,
    queueWaitDistribution,
  };
};

module.exports = {
  getAnalytics,
};
