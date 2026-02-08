/**
 * Bot Management Routes
 * Copyright © 2025 DarkSide Developers
 */

const express = require('express');
const QRCode = require('qrcode');
const { Bot } = require('../database/models');
const { authenticateToken } = require('../middleware/auth');
const { botLimiter } = require('../middleware/rateLimiter');
const { createBotSession, getBotStatus, updateBotSettings } = require('../services/botService');

const router = express.Router();

// Get user's bots
router.get('/my-bots', authenticateToken, async (req, res) => {
    try {
        const bots = await Bot.findAll({
            where: { userId: req.user.id },
            order: [['createdAt', 'DESC']]
        });

        res.json({
            success: true,
            data: bots
        });
    } catch (error) {
        console.error('Get bots error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch bots'
        });
    }
});

// Create new bot
router.post('/create', authenticateToken, botLimiter, async (req, res) => {
    try {
        const { phoneNumber, botName } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }

        // Check if bot already exists
        const existingBot = await Bot.findOne({
            where: { phoneNumber }
        });

        if (existingBot) {
            return res.status(409).json({
                success: false,
                message: 'Bot with this phone number already exists'
            });
        }

        // Create bot record
        const bot = await Bot.create({
            userId: req.user.id,
            phoneNumber,
            botName: botName || 'QUEEN-MINI',
            status: 'disconnected'
        });

        res.status(201).json({
            success: true,
            message: 'Bot created successfully',
            data: bot
        });
    } catch (error) {
        console.error('Create bot error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create bot'
        });
    }
});

// Get pairing code
router.post('/pair', authenticateToken, botLimiter, async (req, res) => {
    try {
        const { botId } = req.body;

        const bot = await Bot.findOne({
            where: { 
                id: botId,
                userId: req.user.id 
            }
        });

        if (!bot) {
            return res.status(404).json({
                success: false,
                message: 'Bot not found'
            });
        }

        // Generate pairing code
        const pairingCode = await createBotSession(bot);

        await bot.update({
            pairingCode,
            status: 'connecting'
        });

        // Emit real-time update
        global.io.to(`user_${req.user.id}`).emit('bot_status_update', {
            botId: bot.id,
            status: 'connecting',
            pairingCode
        });

        res.json({
            success: true,
            data: {
                pairingCode,
                botId: bot.id
            }
        });
    } catch (error) {
        console.error('Pairing error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate pairing code'
        });
    }
});

// Get QR code
router.post('/qr', authenticateToken, botLimiter, async (req, res) => {
    try {
        const { botId } = req.body;

        const bot = await Bot.findOne({
            where: { 
                id: botId,
                userId: req.user.id 
            }
        });

        if (!bot) {
            return res.status(404).json({
                success: false,
                message: 'Bot not found'
            });
        }

        // Generate QR code (implement in botService)
        const qrData = await createBotSession(bot, 'qr');
        const qrCode = await QRCode.toDataURL(qrData);

        await bot.update({
            qrCode,
            status: 'connecting'
        });

        res.json({
            success: true,
            data: {
                qrCode,
                botId: bot.id
            }
        });
    } catch (error) {
        console.error('QR generation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate QR code'
        });
    }
});

// Update bot settings
router.put('/settings/:botId', authenticateToken, async (req, res) => {
    try {
        const { botId } = req.params;
        const settings = req.body;

        const bot = await Bot.findOne({
            where: { 
                id: botId,
                userId: req.user.id 
            }
        });

        if (!bot) {
            return res.status(404).json({
                success: false,
                message: 'Bot not found'
            });
        }

        await bot.update({ settings });

        // Update live bot settings if connected
        if (bot.status === 'connected') {
            await updateBotSettings(botId, settings);
        }

        // Emit real-time update
        global.io.to(`user_${req.user.id}`).emit('bot_settings_update', {
            botId: bot.id,
            settings
        });

        res.json({
            success: true,
            message: 'Settings updated successfully',
            data: bot
        });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update settings'
        });
    }
});

// Delete bot
router.delete('/:botId', authenticateToken, async (req, res) => {
    try {
        const { botId } = req.params;

        const bot = await Bot.findOne({
            where: { 
                id: botId,
                userId: req.user.id 
            }
        });

        if (!bot) {
            return res.status(404).json({
                success: false,
                message: 'Bot not found'
            });
        }

        await bot.destroy();

        res.json({
            success: true,
            message: 'Bot deleted successfully'
        });
    } catch (error) {
        console.error('Delete bot error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete bot'
        });
    }
});

// Disconnect bot
router.post('/disconnect', authenticateToken, async (req, res) => {
    try {
        const { botId } = req.body;

        const bot = await Bot.findOne({
            where: { 
                id: botId,
                userId: req.user.id 
            }
        });

        if (!bot) {
            return res.status(404).json({
                success: false,
                message: 'Bot not found'
            });
        }

        const { disconnectBot } = require('../services/botService');
        await disconnectBot(botId);

        // Emit real-time update
        global.io.to(`user_${req.user.id}`).emit('bot_status_update', {
            botId: bot.id,
            status: 'disconnected'
        });

        res.json({
            success: true,
            message: 'Bot disconnected successfully'
        });
    } catch (error) {
        console.error('Disconnect bot error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to disconnect bot'
        });
    }
});

// Get bot status
router.get('/status/:botId', authenticateToken, async (req, res) => {
    try {
        const { botId } = req.params;

        const bot = await Bot.findOne({
            where: { 
                id: botId,
                userId: req.user.id 
            }
        });

        if (!bot) {
            return res.status(404).json({
                success: false,
                message: 'Bot not found'
            });
        }

        const status = await getBotStatus(botId);

        res.json({
            success: true,
            data: {
                ...bot.toJSON(),
                liveStatus: status
            }
        });
    } catch (error) {
        console.error('Get status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get bot status'
        });
    }
});

module.exports = router;