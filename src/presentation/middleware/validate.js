/**
 * =============================================================================
 * VALIDATION MIDDLEWARE
 * =============================================================================
 * Generic validation middleware using Joi schemas (DRY principle)
 */

const validate = (schema, property = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[property], {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));
            return res.status(400).json({
                status: 'fail',
                errors
            });
        }

        req[property] = value;
        next();
    };
};

module.exports = validate;