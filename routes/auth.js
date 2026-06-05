/**
 * Authentication Routes
 * Copyright © 2025 DarkSide Developers
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('../database/connection');
const { User } = require('../database/models');
const { authLimiter } = require('../middleware/rateLimiter');
const { sendWelcomeEmail } = require('../services/emailService');
const config = require('../config');

const router = express.Router();

// Register
router.post('/register', authLimiter, async (req, res) => {
    try {
        const { username, email, password, firstName, lastName, phoneNumber } = req.body;

        // Validation
        if (!username || !email || !password || !firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: 'All required fields must be provided'
            });
        }

        // Check if user exists
        const existingUser = await User.findOne({
            where: {
                [Op.or]: [{ email }, { username }]
            }
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'User with this email or username already exists'
            });
        }

        // Create user
        const emailVerificationToken = uuidv4();
        const user = await User.create({
            username,
            email,
            password,
            firstName,
            lastName,
            phoneNumber,
            emailVerificationToken
        });

        // Send welcome email
        try {
            await sendWelcomeEmail(user.email, user.firstName, emailVerificationToken);
        } catch (emailError) {
            console.error('Failed to send welcome email:', emailError);
        }

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
                    isAdmin: user.isAdmin,
                    emailVerified: user.emailVerified
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
                message: 'Email and password are required'
            });
        }

        // Find user
        const user = await User.findOne({ where: { email } });
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
                    emailVerified: user.emailVerified,
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

// Verify email
router.get('/verify-email/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const user = await User.findOne({
            where: { emailVerificationToken: token }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification token'
            });
        }

        await user.update({
            emailVerified: true,
            emailVerificationToken: null
        });

        res.json({
            success: true,
            message: 'Email verified successfully'
        });
    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Email verification failed'
        });
    }
});

// Forgot password
router.post('/forgot-password', authLimiter, async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.json({
                success: true,
                message: 'If the email exists, a reset link has been sent'
            });
        }

        const resetToken = uuidv4();
        const resetExpires = new Date(Date.now() + 3600000); // 1 hour

        await user.update({
            resetPasswordToken: resetToken,
            resetPasswordExpires: resetExpires
        });

        // Send reset email (implement in emailService)
        // await sendPasswordResetEmail(user.email, resetToken);

        res.json({
            success: true,
            message: 'If the email exists, a reset link has been sent'
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process request'
        });
    }
});

module.exports = router;