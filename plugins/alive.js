/**
 * Alive Command Plugin
 * Copyright © 2025 DarkSide Developers
 */

module.exports = async (socket, msg, bot) => {
    try {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        const aliveMessage = `
╭─────────────────────╮
│    🤖 QUEEN-MINI    │
│      BOT ALIVE      │
╰─────────────────────╯

📱 *Bot Name:* ${bot.botName}
📞 *Phone:* ${bot.phoneNumber}
⏰ *Uptime:* ${hours}h ${minutes}m ${seconds}s
🔋 *Status:* Online & Active
👑 *Version:* 2.0.0

*© 2025 DarkSide Developers*
*Owner: DarkWinzo*
        `.trim();

        await socket.sendMessage(msg.key.remoteJid, {
            text: aliveMessage
        }, { quoted: msg });

        // Update statistics
        const stats = bot.statistics || {};
        stats.messagesSent = (stats.messagesSent || 0) + 1;
        await bot.update({ statistics: stats });

    } catch (error) {
        console.error('Alive command error:', error);
        await socket.sendMessage(msg.key.remoteJid, {
            text: '❌ Error executing alive command'
        }, { quoted: msg });
    }
};