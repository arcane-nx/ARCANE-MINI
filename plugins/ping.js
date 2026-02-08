/**
 * Ping Command Plugin
 * Copyright © 2025 DarkSide Developers
 */

module.exports = async (socket, msg, bot) => {
    try {
        const start = Date.now();
        
        const pingMsg = await socket.sendMessage(msg.key.remoteJid, {
            text: '🏓 Pinging...'
        }, { quoted: msg });

        const end = Date.now();
        const latency = end - start;

        await socket.sendMessage(msg.key.remoteJid, {
            text: `🏓 *Pong!*\n\n⚡ *Latency:* ${latency}ms\n🤖 *Bot:* ${bot.botName}\n📱 *Status:* Online`,
            edit: pingMsg.key
        });

        // Update statistics
        const stats = bot.statistics || {};
        stats.messagesSent = (stats.messagesSent || 0) + 1;
        await bot.update({ statistics: stats });

    } catch (error) {
        console.error('Ping command error:', error);
        await socket.sendMessage(msg.key.remoteJid, {
            text: '❌ Error executing ping command'
        }, { quoted: msg });
    }
};