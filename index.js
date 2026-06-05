/**
 * ARCANE-MINI Main Server (CLI Version)
 * Copyright © 2025 DarkSide Developers
 * Owner: DarkWinzo
 * GitHub: https://github.com/DarkWinzo
 */

const readline = require('readline');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');

const config = require('./config');
const { connectDatabase, Bot } = require('./database');
const { 
    startAllBots,
    createBotSession,
    getBotStatus,
    updateBotSettings,
    disconnectBot
} = require('./services/botService');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

let isLooping = true;

async function listBots() {
    try {
        const bots = await Bot.findAll();
        if (bots.length === 0) {
            console.log(chalk.yellow('\nNo bots configured yet.'));
            return;
        }
        
        console.log(chalk.cyan('\nConfigured Bots:'));
        for (const bot of bots) {
            const statusInfo = await getBotStatus(bot.id);
            const statusColor = statusInfo.online ? chalk.green('Connected') : chalk.red('Disconnected');
            console.log(`- ${chalk.bold(bot.botName)} (${bot.phoneNumber}) [ID: ${bot.id}] - Status: ${statusColor}`);
        }
    } catch (err) {
        console.error(chalk.red('Error listing bots:'), err.message);
    }
}

async function addNewBot() {
    try {
        console.log(chalk.cyan('\n--- Add & Pair a New Bot ---'));
        const phoneNumber = await question('Enter WhatsApp Phone Number (with country code, e.g., 2348123456789): ');
        if (!phoneNumber) {
            console.log(chalk.red('Phone number is required.'));
            return;
        }
        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        if (!cleanNumber || cleanNumber.length < 10 || cleanNumber.length > 15) {
            console.log(chalk.red('Invalid phone number format. Must be numeric and between 10 and 15 digits.'));
            return;
        }
        
        const existingBot = await Bot.findOne({ where: { phoneNumber: cleanNumber } });
        if (existingBot) {
            console.log(chalk.red(`A bot with number ${cleanNumber} already exists.`));
            return;
        }

        const botName = await question('Enter Bot Name (default: PATRON-MINI): ') || 'PATRON-MINI';
        
        console.log('Select Pairing Method:');
        console.log('1. Pairing Code (Standard)');
        console.log('2. QR Code (Prints QR in terminal)');
        const methodChoice = await question('Select choice (1-2, default: 1): ');
        const method = methodChoice.trim() === '2' ? 'qr' : 'pair';
        
        // Creating the Bot in DB first
        const bot = await Bot.create({
            phoneNumber: cleanNumber,
            botName: botName,
            status: 'connecting'
        });
        
        console.log(chalk.yellow(`Bot entry created in database. Initiating session pairing for ${cleanNumber}...`));
        
        if (method === 'pair') {
            const pairingCode = await createBotSession(bot, 'pair');
            if (pairingCode) {
                console.log(chalk.green(`\n==============================================`));
                console.log(`  PAIRING CODE FOR ${cleanNumber}: ${chalk.bold(pairingCode)}`);
                console.log(`==============================================\n`);
                console.log(chalk.yellow('Enter this code in WhatsApp -> Linked Devices -> Link with Phone Number.'));
            } else {
                console.log(chalk.red('Failed to retrieve pairing code. Check logs.'));
            }
        } else {
            console.log(chalk.yellow('Generating QR session... The QR code will print below. Please scan it:'));
            await createBotSession(bot, 'qr');
        }
    } catch (err) {
        console.error(chalk.red('Error adding new bot:'), err.message);
    }
}

async function startBot() {
    try {
        const bots = await Bot.findAll();
        if (bots.length === 0) {
            console.log(chalk.yellow('\nNo bots configured yet.'));
            return;
        }
        
        console.log(chalk.cyan('\nSelect a bot to start:'));
        bots.forEach((bot, index) => {
            console.log(`${index + 1}. ${bot.botName} (${bot.phoneNumber})`);
        });
        
        const selection = await question('Enter bot number: ');
        const index = parseInt(selection.trim()) - 1;
        if (isNaN(index) || index < 0 || index >= bots.length) {
            console.log(chalk.red('Invalid selection.'));
            return;
        }
        
        const bot = bots[index];
        console.log(chalk.yellow(`Starting session for ${bot.botName}...`));
        await createBotSession(bot, 'pair', true);
        console.log(chalk.green(`Session started for ${bot.botName}.`));
    } catch (err) {
        console.error(chalk.red('Error starting bot:'), err.message);
    }
}

async function stopBot() {
    try {
        const bots = await Bot.findAll();
        if (bots.length === 0) {
            console.log(chalk.yellow('\nNo bots configured yet.'));
            return;
        }
        
        console.log(chalk.cyan('\nSelect a bot to disconnect:'));
        bots.forEach((bot, index) => {
            console.log(`${index + 1}. ${bot.botName} (${bot.phoneNumber})`);
        });
        
        const selection = await question('Enter bot number: ');
        const index = parseInt(selection.trim()) - 1;
        if (isNaN(index) || index < 0 || index >= bots.length) {
            console.log(chalk.red('Invalid selection.'));
            return;
        }
        
        const bot = bots[index];
        console.log(chalk.yellow(`Disconnecting ${bot.botName}...`));
        await disconnectBot(bot.id);
        console.log(chalk.green(`Bot ${bot.botName} disconnected.`));
    } catch (err) {
        console.error(chalk.red('Error stopping bot:'), err.message);
    }
}

async function deleteBot() {
    try {
        const bots = await Bot.findAll();
        if (bots.length === 0) {
            console.log(chalk.yellow('\nNo bots configured yet.'));
            return;
        }
        
        console.log(chalk.cyan('\nSelect a bot to delete:'));
        bots.forEach((bot, index) => {
            console.log(`${index + 1}. ${bot.botName} (${bot.phoneNumber})`);
        });
        
        const selection = await question('Enter bot number: ');
        const index = parseInt(selection.trim()) - 1;
        if (isNaN(index) || index < 0 || index >= bots.length) {
            console.log(chalk.red('Invalid selection.'));
            return;
        }
        
        const bot = bots[index];
        const confirmation = await question(`Are you sure you want to delete ${bot.botName}? This will clear its session folder and settings. (y/N): `);
        if (confirmation.trim().toLowerCase() !== 'y') {
            console.log(chalk.yellow('Deletion cancelled.'));
            return;
        }
        
        console.log(chalk.yellow(`Deleting ${bot.botName}...`));
        await disconnectBot(bot.id);
        await bot.destroy();
        
        // Clean session path
        const sessionPath = path.join('./sessions', `session_${bot.id}`);
        try {
            if (fs.existsSync(sessionPath)) {
                fs.removeSync(sessionPath);
            }
        } catch (e) {
            console.error(`Error deleting session directory: ${e.message}`);
        }
        
        console.log(chalk.green(`Bot ${bot.botName} deleted successfully.`));
    } catch (err) {
        console.error(chalk.red('Error deleting bot:'), err.message);
    }
}

async function manageSettings() {
    try {
        const bots = await Bot.findAll();
        if (bots.length === 0) {
            console.log(chalk.yellow('\nNo bots configured yet.'));
            return;
        }
        
        console.log(chalk.cyan('\nSelect a bot to manage settings:'));
        bots.forEach((bot, index) => {
            console.log(`${index + 1}. ${bot.botName} (${bot.phoneNumber})`);
        });
        
        const selection = await question('Enter bot number: ');
        const index = parseInt(selection.trim()) - 1;
        if (isNaN(index) || index < 0 || index >= bots.length) {
            console.log(chalk.red('Invalid selection.'));
            return;
        }
        
        const bot = bots[index];
        const settings = bot.settings || {};
        
        console.log(chalk.cyan(`\nCurrent Settings for ${bot.botName}:`));
        console.log(`1. Prefix: "${settings.prefix || '.'}"`);
        console.log(`2. Auto View Status: ${settings.autoViewStatus ? 'Enabled' : 'Disabled'}`);
        console.log(`3. Auto Like Status: ${settings.autoLikeStatus ? 'Enabled' : 'Disabled'}`);
        console.log(`4. Auto Recording: ${settings.autoRecording ? 'Enabled' : 'Disabled'}`);
        console.log(`5. Anti Call: ${settings.antiCall ? 'Enabled' : 'Disabled'}`);
        console.log(`6. Anti Delete: ${settings.antiDelete ? 'Enabled' : 'Disabled'}`);
        console.log('7. Go Back');
        
        const option = await question('Choose a setting to toggle/change (1-7): ');
        switch (option.trim()) {
            case '1':
                const newPrefix = await question(`Enter new prefix (current: ${settings.prefix || '.'}): `);
                if (newPrefix) settings.prefix = newPrefix;
                break;
            case '2':
                settings.autoViewStatus = !settings.autoViewStatus;
                break;
            case '3':
                settings.autoLikeStatus = !settings.autoLikeStatus;
                break;
            case '4':
                settings.autoRecording = !settings.autoRecording;
                break;
            case '5':
                settings.antiCall = !settings.antiCall;
                break;
            case '6':
                settings.antiDelete = !settings.antiDelete;
                break;
            case '7':
                return;
            default:
                console.log(chalk.red('Invalid selection.'));
                return;
        }
        
        await bot.update({ settings });
        await updateBotSettings(bot.id, settings);
        console.log(chalk.green('Settings updated successfully.'));
    } catch (err) {
        console.error(chalk.red('Error managing settings:'), err.message);
    }
}

async function mainMenu() {
    if (!isLooping) return;
    
    console.log(chalk.blue('\n===================================='));
    console.log(chalk.green(`  ARCANE-MINI v${config.APP_VERSION} Console Manager`));
    console.log(chalk.blue('===================================='));
    console.log('1. List Configured Bots');
    console.log('2. Add & Pair a New Bot');
    console.log('3. Start/Connect a Bot');
    console.log('4. Disconnect a Bot');
    console.log('5. Delete a Bot');
    console.log('6. Manage Bot Settings');
    console.log('7. Exit');
    console.log(chalk.blue('===================================='));
    
    const choice = await question('Select an option (1-7): ');
    
    switch (choice.trim()) {
        case '1':
            await listBots();
            break;
        case '2':
            await addNewBot();
            break;
        case '3':
            await startBot();
            break;
        case '4':
            await stopBot();
            break;
        case '5':
            await deleteBot();
            break;
        case '6':
            await manageSettings();
            break;
        case '7':
            console.log(chalk.yellow('Exiting console manager...'));
            isLooping = false;
            rl.close();
            process.exit(0);
        default:
            console.log(chalk.red('Invalid option, please choose 1-7.'));
            break;
    }
    
    if (isLooping) {
        setTimeout(mainMenu, 1000);
    }
}

const startApp = async () => {
    try {
        // Connect to database
        await connectDatabase();
        
        console.log(chalk.green(`
╔══════════════════════════════════════════════════════════════╗
║                        ARCANE-MINI v${config.APP_VERSION}     
║                  Advanced WhatsApp Bot System                
║                                                              
║  📊 Database: Connected                                      
║  ⚡ CLI Console: Active                                      
║                                                              
║  Copyright © ${config.COPYRIGHT.YEAR} ${config.COPYRIGHT.COMPANY} 
║  Owner: ${config.COPYRIGHT.OWNER}                             
║  GitHub: ${config.COPYRIGHT.GITHUB}                          
╚══════════════════════════════════════════════════════════════╝
        `));
        
        // Auto-restart active bots
        await startAllBots();
        
        // Show main menu
        mainMenu();

    } catch (error) {
        console.error(chalk.red('Failed to start application:'), error);
        process.exit(1);
    }
};

// Graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\nSIGINT received, shutting down gracefully...'));
    isLooping = false;
    rl.close();
    process.exit(0);
});

startApp();