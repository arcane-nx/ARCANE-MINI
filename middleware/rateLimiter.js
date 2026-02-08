/**
 * Rate Limiting Middleware
 * Copyright © 2025 DarkSide Developers
 */

const rateLimit = require('express-rate-limit');
const config = require('../config');

const createRateLimiter = (windowMs, max, message) => {
    return rateLimit({
        windowMs,
        max,
        message: {
            success: false,
            message: message || 'Too many requests, please try again later.'
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
};

const generalLimiter = createRateLimiter(
    config.RATE_LIMIT_WINDOW,
    config.RATE_LIMIT_MAX,
    'Too many requests from this IP'
);

const authLimiter = createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    5, // 5 attempts
    'Too many authentication attempts'
);

const botLimiter = createRateLimiter(
    60 * 1000, // 1 minute
    10, // 10 requests
    'Too many bot operations'
);

module.exports = {
    generalLimiter,
    authLimiter,
    botLimiter
};