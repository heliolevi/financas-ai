/**
 * =============================================================================
 * CUSTOM ERROR CLASSES (Domain-Driven Design)
 * =============================================================================
 * Following Clean Code principles - errors should be meaningful and descriptive
 */

class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.isTrusted = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message, errors = []) {
        super(message, 400);
        this.errors = errors;
    }
}

class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} não encontrado(a)`, 404);
    }
}

class UnauthorizedError extends AppError {
    constructor(message = 'Acesso não autorizado') {
        super(message, 401);
    }
}

class ForbiddenError extends AppError {
    constructor(message = 'Acesso proibido') {
        super(message, 403);
    }
}

class ConflictError extends AppError {
    constructor(message) {
        super(message, 409);
    }
}

class ExternalServiceError extends AppError {
    constructor(service, message) {
        super(`Erro no serviço ${service}: ${message}`, 503);
    }
}

module.exports = {
    AppError,
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
    ConflictError,
    ExternalServiceError
};