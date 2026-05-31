const Joi = require("joi");
const { TASK_TYPE, TASK_STATUS } = require("../constants/enum");
const {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  SORTABLE_FIELDS,
} = require("../constants/config");
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

const submitTaskSchema = Joi.object({
  type: Joi.string()
    .valid(...Object.values(TASK_TYPE))
    .required()
    .messages({
      "any.required": "type is required",
      "any.only": `type must be one of: ${Object.values(TASK_TYPE).join(", ")}`,
    }),

  priority: Joi.number().integer().min(1).max(5).required().messages({
    "any.required": "priority is required",
    "number.base": "priority must be a number",
    "number.integer": "priority must be an integer",
    "number.min": "priority must be between 1 and 5",
    "number.max": "priority must be between 1 and 5",
  }),

  payload: Joi.object().default({}).messages({
    "object.base": "payload must be a JSON object",
  }),
});

const listTasksQuerySchema = Joi.object({
  status: Joi.string().optional(),
  type: Joi.string()
    .valid(...Object.values(TASK_TYPE))
    .optional()
    .messages({
      "any.only": `type must be one of: ${Object.values(TASK_TYPE).join(", ")}`,
    }),
  priority: Joi.number().integer().min(1).max(5).optional(),
  minPriority: Joi.number().integer().min(1).max(5).optional(),
  maxPriority: Joi.number().integer().min(1).max(5).optional(),
  clientId: Joi.string().optional(),
  from: Joi.date().iso().optional().messages({
    "date.format": "from must be a valid ISO date",
  }),
  to: Joi.date().iso().optional().messages({
    "date.format": "to must be a valid ISO date",
  }),
  page: Joi.number().integer().min(1).default(DEFAULT_PAGE),
  limit: Joi.number().integer().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  sort: Joi.string()
    .valid(...Object.keys(SORTABLE_FIELDS))
    .default("created_at")
    .messages({
      "any.only": `sort must be one of: ${Object.keys(SORTABLE_FIELDS).join(", ")}`,
    }),
  order: Joi.string().valid("asc", "desc").default("desc"),
});

const taskIdSchema = Joi.string().uuid({ version: "uuidv4" }).required().messages({
  "any.required": "task id is required",
  "string.guid": "task id must be a valid UUID",
});

const validateStatusFilter = (status) => {
  if (!status) {
    return;
  }

  const statuses = status
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  const invalid = statuses.filter(
    (value) => !Object.values(TASK_STATUS).includes(value),
  );

  if (invalid.length > 0) {
    throw new AppError(`Invalid status: ${invalid.join(", ")}`, 400);
  }
};

const validateSubmitTaskInput = (body) => runValidation(submitTaskSchema, body);

const validateListTasksQuery = (query) => {
  const validated = runValidation(listTasksQuerySchema, query);
  validateStatusFilter(validated.status);
  return validated;
};

const validateTaskId = (taskId) => runValidation(taskIdSchema, taskId);

module.exports = {
  validateSubmitTaskInput,
  validateListTasksQuery,
  validateTaskId,
};
