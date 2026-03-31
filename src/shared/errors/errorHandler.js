/**
 * =============================================================================
 * ERROR HANDLER (Centralized Error Handling)
 * =============================================================================
 * Implements Express error middleware following Clean Architecture
 */

const { AppError } = require('../errors/AppError');
const logger = require('../utils/logger');

const handleCastErrorDB = (err) => {
    const message = `Valor inválido para ${err.path}: ${err.value}`;
    return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
    const field = Object.keys(err.keyValue)[0];
    const message = `Valor já existe para o campo: ${field}`;
    return new AppError(message, 409);
};

const handleValidationErrorDB = (err) => {
    const errors = Object.values(err.errors).map(e => e.message);
    return new ValidationError('Erro de validação', errors);
};

const sendErrorDev = (err, res) => {
    res.status(err.statusCode).json({
        status: 'error',
        message: err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

const sendErrorProd = (err, res) => {
    if (err.isOperational) {
        res.status(err.statusCode).json({
            status: 'error',
            message: err.message
        });
    } else {
        logger.error('ERROR 💥', err);
        res.status(500).json({
            status: 'error',
            message: 'Algo deu errado. Tente novamente mais tarde.'
        });
    }
};

const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    
    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err, res);
    } else {
        let error = { ...err };
        error.message = err.message;

        if (err.name === 'CastError') error = handleCastErrorDB(error);
        if (err.code === 11000) error = handleDuplicateFieldsDB(error);
        if (err.name === 'ValidationError') error = handleValidationErrorDB(error);

        sendErrorProd(error, res);
    }
};

module.exports = errorHandler;