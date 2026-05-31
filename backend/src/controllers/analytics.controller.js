const analyticsService = require("../services/analytics.service");
const asyncHandler = require("../utils/asyncHandler");
const { validateAnalyticsQuery } = require("../validators/analytics.schema");

const getAnalytics = asyncHandler(async (req, res) => {
  const { hours } = validateAnalyticsQuery(req.query);
  const analytics = await analyticsService.getAnalytics(hours);

  res.json(analytics);
});

module.exports = { getAnalytics };
