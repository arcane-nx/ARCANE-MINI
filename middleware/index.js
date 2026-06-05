/**
 * Combined Middleware Handler
 * Copyright © 2025 DarkSide Developers
 */

const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { User } = require('../database');
const config = require('../config');

// -------------------------
// Authentication Middleware
// -------------------------
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Access token required' 
            });
        }

        const decoded = jwt.verify(token, config.JWT_SECRET);
        const user = await User.findByPk(decoded.userId, {
            attributes: { exclude: ['password'] }
        });

        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid token' 
            });
        }

        if (user.isBanned) {
            return res.status(403).json({ 
                success: false, 
                message: 'Account is banned' 
            });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({ 
            success: false, 
            message: 'Invalid or expired token' 
        });
    }
};

const requireAdmin = async (req, res, next) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ 
            success: false, 
            message: 'Admin access required' 
        });
    }
    next();
};

// -------------------------
// Rate Limiting Middleware
// -------------------------
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
    authenticateToken,
    requireAdmin,
    generalLimiter,
    authLimiter,
    botLimiter
};
