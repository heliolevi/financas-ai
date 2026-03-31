/**
 * =============================================================================
 * APP FACTORY - Clean Architecture Application Setup
 * =============================================================================
 * Following SOLID principles - Single Responsibility for app configuration
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const errorHandler = require('../shared/errors/errorHandler');
const logger = require('../shared/utils/logger');

const createApp = () => {
    const app = express();

    // Security middleware
    app.use(helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false
    }));

    // Rate limiting
    const generalLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        message: { message: 'Muitas requisições. Tente novamente mais tarde.' }
    });
    app.use(generalLimiter);

    app.use(cors());
    app.use(express.json());

    // Health check
    app.get('/health', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Error handling (must be last)
    app.use(errorHandler);

    return app;
};

module.exports = { createApp };