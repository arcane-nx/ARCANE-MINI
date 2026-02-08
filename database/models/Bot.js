/**
 * Bot Model
 * Copyright © 2025 DarkSide Developers
 */

const { DataTypes } = require('sequelize');
const { database } = require('../connection');

const Bot = database.define('Bot', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Users',
            key: 'id'
        }
    },
    phoneNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isNumeric: true,
            len: [10, 15]
        }
    },
    botName: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'PATRON-MINI'
    },
    status: {
        type: DataTypes.ENUM('disconnected', 'connecting', 'connected', 'error'),
        defaultValue: 'disconnected'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    sessionData: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    qrCode: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    pairingCode: {
        type: DataTypes.STRING,
        allowNull: true
    },
    lastSeen: {
        type: DataTypes.DATE,
        allowNull: true
    },
    settings: {
        type: DataTypes.JSON,
        defaultValue: {
            autoViewStatus: true,
            autoLikeStatus: true,
            autoRecording: true,
            prefix: '.',
            autoReact: false,
            antiCall: true,
            antiDelete: true
        }
    },
    statistics: {
        type: DataTypes.JSON,
        defaultValue: {
            messagesReceived: 0,
            messagesSent: 0,
            commandsExecuted: 0,
            uptime: 0
        }
    }
}, {
    timestamps: true
});

module.exports = Bot;