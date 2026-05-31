const Joi = require("joi");
const AppError = require("../utils/AppError");

const runValidation = (schema, value) => {
  const { error, value: validated } = schema.validate(value, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    const message = error.details
      .map((detail) => detail.message.replace(/"/g, ""))
      .join(", ");

    throw new AppError(message, 400);
  }

  return validated;
};

const analyticsQuerySchema = Joi.object({
  hours: Joi.number().integer().min(1).max(168).default(24),
});

const seedTasksSchema = Joi.object({
  count: Joi.number().integer().min(50).max(200).default(55),
});

const validateAnalyticsQuery = (query) => runValidation(analyticsQuerySchema, query);

const validateSeedTasksInput = (body) => runValidation(seedTasksSchema, body ?? {});

module.exports = {
  validateAnalyticsQuery,
  validateSeedTasksInput,
};
