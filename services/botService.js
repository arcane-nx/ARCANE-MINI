/**
 * Bot Service
 * Copyright © 2025 DarkSide Developers
 */

const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('baileys');
const fs = require('fs-extra');
const path = require('path');
const pino = require('pino');
const { Bot } = require('../database/models');

const activeSockets = new Map();
const SESSION_BASE_PATH = './sessions';

// Ensure session directory exists
if (!fs.existsSync(SESSION_BASE_PATH)) {
    fs.mkdirSync(SESSION_BASE_PATH, { recursive: true });
}

// Create bot session
const createBotSession = async (bot, method = 'pair', isReconnect = false) => {
    try {
        const sessionPath = path.join(SESSION_BASE_PATH, `session_${bot.id}`);
        
        // If it's a new pairing request and not a reconnection, and not registered, 
        // we might want to start fresh. But let's keep it for now and just handle the socket.
        
        // Close existing socket if any
        if (activeSockets.has(bot.id)) {
            const oldSocket = activeSockets.get(bot.id);
            try {
                oldSocket.ev.removeAllListeners('connection.update');
                oldSocket.ev.removeAllListeners('creds.update');
                oldSocket.ev.removeAllListeners('messages.upsert');
                if (oldSocket.ws) oldSocket.ws.close();
            } catch (e) {
                console.error(`Error closing old socket for ${bot.id}:`, e.message);
            }
            activeSockets.delete(bot.id);
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`Using Baileys v${version.join('.')}${isLatest ? ' (latest)' : ''}`);
        
        const logger = pino({ level: 'silent' });
        
        const socket = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false,
            logger,
            version,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            markOnline: true,
            syncFullHistory: false,
        });

        // Store socket reference
        activeSockets.set(bot.id, socket);

        // Handle connection updates
        socket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr && method === 'qr') {
                // Return QR data for QR method
                return qr;
            }
            
            if (connection === 'open') {
                console.log(`Bot ${bot.id} (${bot.phoneNumber}) connected successfully`);
                await bot.update({
                    status: 'connected',
                    lastSeen: new Date()
                });
                
                // Emit real-time update
                global.io.emit('bot_status_update', {
                    botId: bot.id,
                    status: 'connected'
                });
            } else if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.log(`Bot ${bot.id} connection closed. Status code: ${statusCode}. Reconnecting: ${shouldReconnect}`);
                
                await bot.update({
                    status: shouldReconnect ? 'connecting' : 'disconnected'
                });
                
                activeSockets.delete(bot.id);
                
                if (shouldReconnect) {
                    // Only reconnect automatically if it was already registered OR if it was already connected
                    // If we are in the middle of pairing, we should probably not auto-reconnect 
                    // and let the user trigger it again if it fails, to avoid invalidating codes.
                    if (state.creds.registered || isReconnect) {
                        setTimeout(() => createBotSession(bot, method, true), 5000);
                    }
                }
            }
        });

        // Handle credentials update
        socket.ev.on('creds.update', saveCreds);

        // Setup message handlers
        setupMessageHandlers(socket, bot);

        // Request pairing code for pair method
        if (method === 'pair' && !socket.authState.creds.registered && !isReconnect) {
            let retries = 3;
            let code;
            
            const phoneNumber = bot.phoneNumber.replace(/[^0-9]/g, '');
            console.log(`Requesting pairing code for ${phoneNumber}...`);
            
            while (retries > 0) {
                try {
                    await delay(3000); // Wait for socket to be ready
                    code = await socket.requestPairingCode(phoneNumber);
                    console.log(`Generated pairing code for ${phoneNumber}: ${code}`);
                    break;
                } catch (error) {
                    retries--;
                    console.warn(`Failed to request pairing code for ${phoneNumber}: ${error.message}, retries left: ${retries}`);
                    await delay(3000);
                }
            }
            
            return code;
        }

        return method === 'qr' ? 'QR_GENERATED' : 'SESSION_CREATED';
    } catch (error) {
        console.error('Create bot session error:', error);
        throw error;
    }
};

// Setup message handlers
const setupMessageHandlers = (socket, bot) => {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;

        try {
            // Update bot statistics
            const stats = bot.statistics || {};
            stats.messagesReceived = (stats.messagesReceived || 0) + 1;
            
            await bot.update({ statistics: stats });

            // Handle commands
            const text = msg.message.conversation || 
                        msg.message.extendedTextMessage?.text || '';
            
            if (text.startsWith(bot.settings.prefix || '.')) {
                const cmdName = text.slice((bot.settings.prefix || '.').length).split(' ')[0].toLowerCase();
                
                // Load and execute command
                await executeCommand(socket, msg, cmdName, bot);
                
                // Update command statistics
                stats.commandsExecuted = (stats.commandsExecuted || 0) + 1;
                await bot.update({ statistics: stats });
            }
        } catch (error) {
            console.error('Message handler error:', error);
        }
    });

    // Handle status updates
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (msg.key.remoteJid !== 'status@broadcast') return;

        try {
            if (bot.settings.autoViewStatus) {
                await socket.readMessages([msg.key]);
            }

            if (bot.settings.autoLikeStatus && msg.key.participant) {
                const emojis = ['❤️', '👍', '🔥', '💯', '🎉'];
                const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                
                await socket.sendMessage(
                    msg.key.remoteJid,
                    { react: { text: randomEmoji, key: msg.key } },
                    { statusJidList: [msg.key.participant] }
                );
            }
        } catch (error) {
            console.error('Status handler error:', error);
        }
    });
};

// Execute command
const executeCommand = async (socket, msg, cmdName, bot) => {
    try {
        // Load command from plugins
        const commandPath = path.join(__dirname, '..', 'plugins', `${cmdName}.js`);
        
        if (fs.existsSync(commandPath)) {
            delete require.cache[require.resolve(commandPath)];
            const command = require(commandPath);
            
            if (typeof command === 'function') {
                await command(socket, msg, bot);
            }
        }
    } catch (error) {
        console.error(`Command execution error for ${cmdName}:`, error);
    }
};

// Get bot status
const getBotStatus = async (botId) => {
    const socket = activeSockets.get(botId);
    
    if (!socket) {
        return { status: 'disconnected', online: false };
    }

    return {
        status: 'connected',
        online: true,
        user: socket.user,
        lastSeen: new Date()
    };
};

// Update bot settings
const updateBotSettings = async (botId, settings) => {
    const socket = activeSockets.get(botId);
    
    if (socket) {
        // Apply settings to live bot
        console.log(`Updated settings for bot ${botId}:`, settings);
        
        // Emit real-time update
        global.io.emit('bot_settings_update', {
            botId,
            settings
        });
    }
};

// Disconnect bot
const disconnectBot = async (botId) => {
    const socket = activeSockets.get(botId);
    
    if (socket) {
        socket.ws.close();
        activeSockets.delete(botId);
        
        await Bot.update(
            { status: 'disconnected' },
            { where: { id: botId } }
        );
    }
};

// Start all active bots on startup
const startAllBots = async () => {
    try {
        const bots = await Bot.findAll({
            where: {
                status: ['connected', 'connecting']
            }
        });
        
        console.log(`[Startup] Found ${bots.length} active bots to restart...`);
        
        for (const bot of bots) {
            console.log(`[Startup] Restarting bot: ${bot.botName} (${bot.phoneNumber})`);
            createBotSession(bot, 'pair', true).catch(err => {
                console.error(`[Startup] Failed to restart bot ${bot.id}:`, err.message);
            });
            // Small delay between bot starts to prevent rate limiting
            await delay(2000);
        }
    } catch (error) {
        console.error('[Startup] Error restarting bots:', error);
    }
};

/**
 * Generate pairing code without database interaction
 * @param {string} phoneNumber 
 * @returns {Promise<string>}
 */
const getPairingCodeOnly = async (phoneNumber) => {
    try {
        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        if (!cleanNumber) throw new Error('Invalid phone number');

        const sessionPath = path.join(SESSION_BASE_PATH, `temp_${cleanNumber}`);
        
        // Ensure directory exists
        if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const { version } = await fetchLatestBaileysVersion();
        
        const socket = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
            },
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            version,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
        });

        socket.ev.on('creds.update', saveCreds);

        // Store socket to keep it alive during pairing
        activeSockets.set(`temp_${cleanNumber}`, socket);

        socket.ev.on('connection.update', (update) => {
            const { connection } = update;
            if (connection === 'open') {
                console.log(`Temp Bot ${cleanNumber} connected successfully`);
            } else if (connection === 'close') {
                activeSockets.delete(`temp_${cleanNumber}`);
            }
        });

        await delay(3000);
        const code = await socket.requestPairingCode(cleanNumber);
        return code;
    } catch (error) {
        console.error('getPairingCodeOnly error:', error);
        throw error;
    }
};

module.exports = {
    createBotSession,
    getBotStatus,
    updateBotSettings,
    disconnectBot,
    startAllBots,
    getPairingCodeOnly
};