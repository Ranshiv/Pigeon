// middleware/validateBody.js
// Tier 1: zod-based request body validation for marketplace write endpoints.
// Returns a middleware that 400s with the first zod issue on invalid input.
const { z } = require('zod');

function validateBody(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const issue = result.error.issues[0];
            return res.status(400).json({
                error: 'Validation failed',
                field: issue.path.join('.') || undefined,
                message: issue.message
            });
        }
        req.body = result.data;
        next();
    };
}

module.exports = { validateBody };