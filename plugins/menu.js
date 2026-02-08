/**
 * Menu Command Plugin
 * Copyright © 2025 DarkSide Developers
 */

module.exports = async (socket, msg, bot) => {
    try {
        const prefix = bot.settings.prefix || '.';
        
        const menuMessage = `
╭──────────────────────╮
│   👑 QUEEN-MINI MENU   │
│  Advanced Bot System   │
╰──────────────────────╯

🤖 *BOT INFO*
├ Name: ${bot.botName}
├ Version: 2.0.0
├ Prefix: ${prefix}
└ Status: Active

📋 *MAIN COMMANDS*
├ ${prefix}alive - Bot status
├ ${prefix}ping - Check latency
├ ${prefix}help - Show help
└ ${prefix}settings - Bot settings

🎵 *MEDIA COMMANDS*
├ ${prefix}song <name> - Download song
├ ${prefix}video <name> - Download video
├ ${prefix}ytmp3 <url> - YouTube to MP3
└ ${prefix}ytmp4 <url> - YouTube to MP4

🛠️ *UTILITY COMMANDS*
├ ${prefix}sticker - Create sticker
├ ${prefix}weather <city> - Weather info
├ ${prefix}translate <text> - Translate
└ ${prefix}qr <text> - Generate QR code

👥 *GROUP COMMANDS*
├ ${prefix}tagall - Tag everyone
├ ${prefix}promote - Promote member
├ ${prefix}demote - Demote admin
└ ${prefix}kick - Remove member

🎮 *FUN COMMANDS*
├ ${prefix}joke - Random joke
├ ${prefix}quote - Inspirational quote
├ ${prefix}meme - Random meme
└ ${prefix}fact - Random fact

*© 2025 DarkSide Developers*
*Owner: DarkWinzo*
*GitHub: github.com/DarkWinzo*
        `.trim();

        await socket.sendMessage(msg.key.remoteJid, {
            text: menuMessage
        }, { quoted: msg });

        // Update statistics
        const stats = bot.statistics || {};
        stats.messagesSent = (stats.messagesSent || 0) + 1;
        await bot.update({ statistics: stats });

    } catch (error) {
        console.error('Menu command error:', error);
        await socket.sendMessage(msg.key.remoteJid, {
            text: '❌ Error executing menu command'
        }, { quoted: msg });
    }
};