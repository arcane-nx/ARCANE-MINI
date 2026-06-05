/**
 * Bot Model (JSON version)
 * Copyright © 2025 DarkSide Developers
 */

const { JSONModel, ValidationError } = require('../JSONModel');

class Bot extends JSONModel {
    static filePath = './database/store/bots.json';
    static modelName = 'Bot';

    // Model Validations
    static validate(data, isUpdate = false) {
        if (!isUpdate || data.phoneNumber !== undefined) {
            if (!data.phoneNumber) {
                throw new ValidationError('Phone number is required');
            }
            
            const cleanNumber = data.phoneNumber.replace(/[^0-9]/g, '');
            if (!/^[0-9]+$/.test(cleanNumber) || cleanNumber.length < 10 || cleanNumber.length > 15) {
                throw new ValidationError('Phone number must be numeric and between 10 and 15 digits');
            }

            // Check phone number uniqueness
            const records = this._load();
            const exists = records.find(r => r.phoneNumber === data.phoneNumber && r.id !== data.id);
            if (exists) {
                throw new ValidationError('Bot with this phone number already exists');
            }
        }
    }

    // Override static create to merge defaults
    static async create(data = {}) {
        const defaultSettings = {
            autoViewStatus: true,
            autoLikeStatus: true,
            autoRecording: true,
            prefix: '.',
            autoReact: false,
            antiCall: true,
            antiDelete: true
        };

        const defaultStatistics = {
            messagesReceived: 0,
            messagesSent: 0,
            commandsExecuted: 0,
            uptime: 0
        };

        const botData = {
            botName: 'PATRON-MINI',
            status: 'disconnected',
            isActive: true,
            settings: defaultSettings,
            statistics: defaultStatistics,
            ...data
        };

        return super.create(botData);
    }
}

module.exports = Bot;