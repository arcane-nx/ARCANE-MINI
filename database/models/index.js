/**
 * Database Models Index
 * Copyright © 2025 DarkSide Developers
 */

const User = require('./User');
const Bot = require('./Bot');

// Define associations
User.hasMany(Bot, { foreignKey: 'userId', as: 'bots' });
Bot.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = {
    User,
    Bot
};