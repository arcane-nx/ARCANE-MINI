/**
 * Authentication Routes
 * Copyright © 2025 DarkSide Developers
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const { Op } = require('../database/connection');
const { User } = require('../database/models');
const { authLimiter } = require('../middleware/rateLimiter');
const config = require('../config');

const router = express.Router();

// Register
router.post('/register', authLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validation
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password must be provided'
            });
        }

        // Check if user exists
        const existingUser = await User.findOne({
            where: { username }
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'User with this username already exists'
            });
        }

        // Create user
        const user = await User.create({
            username,
            password
        });

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            config.JWT_SECRET,
            { expiresIn: config.JWT_EXPIRES_IN }
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    isAdmin: user.isAdmin
                },
                token
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                success: false,
                message: error.errors[0].message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Registration failed'
        });
    }
});

// Login
router.post('/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username/Email and password are required'
            });
        }

        // Find user by email or username
        const user = await User.findOne({
            where: {
                [Op.or]: [
                    { email: email },
                    { username: email }
                ]
            }
        });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if banned
        if (user.isBanned) {
            return res.status(403).json({
                success: false,
                message: 'Account is banned'
            });
        }

        // Verify password
        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Update last login
        await user.update({ lastLogin: new Date() });

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            config.JWT_SECRET,
            { expiresIn: config.JWT_EXPIRES_IN }
        );

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    isAdmin: user.isAdmin,
                    theme: user.theme
                },
                token
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
});

module.exports = router;