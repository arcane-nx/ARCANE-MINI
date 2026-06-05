/**
 * Database Connection Handler (JSON-based with Auto-Migration)
 * Copyright © 2025 DarkSide Developers
 */

const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const { Op } = require('./JSONModel');

const storePath = './database/store';
const dbPath = path.join(storePath, 'queen-mini.db');
const usersFile = path.join(storePath, 'users.json');
const botsFile = path.join(storePath, 'bots.json');

// Advanced Database Connection Interface for JSON File Store
const database = {
    sync: async () => {
        fs.ensureDirSync(storePath);
        
        if (!fs.existsSync(usersFile)) {
            fs.writeJsonSync(usersFile, []);
        }
        if (!fs.existsSync(botsFile)) {
            fs.writeJsonSync(botsFile, []);
        }
        return true;
    },
    authenticate: async () => {
        return true;
    },
    close: async () => {
        return true;
    }
};

// Auto-migration from SQLite to JSON
const migrateToJSON = async () => {
    try {
        const usersExist = fs.existsSync(usersFile) && fs.readJsonSync(usersFile).length > 0;
        const botsExist = fs.existsSync(botsFile) && fs.readJsonSync(botsFile).length > 0;

        if (fs.existsSync(dbPath) && (!usersExist || !botsExist)) {
            console.log(chalk.yellow('🔄 Found legacy SQLite database and JSON files are empty. Initiating automatic migration...'));
            const sqlite3 = require('sqlite3').verbose();
            const db = new sqlite3.Database(dbPath);

            return new Promise((resolve) => {
                db.serialize(() => {
                    let usersMigrated = false;
                    let botsMigrated = false;

                    const checkComplete = () => {
                        if (usersMigrated && botsMigrated) {
                            db.close((err) => {
                                if (err) console.error(chalk.red('Error closing SQLite during migration:'), err.message);
                                resolve(true);
                            });
                        }
                    };

                    // Migrate Users
                    db.all("SELECT * FROM Users", [], (err, rows) => {
                        if (err) {
                            console.error(chalk.red('Error reading Users from SQLite:'), err.message);
                            usersMigrated = true;
                            checkComplete();
                            return;
                        }
                        if (rows && rows.length > 0 && !usersExist) {
                            const users = rows.map(row => ({
                                ...row,
                                isActive: row.isActive === undefined ? true : !!row.isActive,
                                isBanned: !!row.isBanned,
                                isAdmin: !!row.isAdmin,
                                emailVerified: !!row.emailVerified
                            }));
                            fs.writeJsonSync(usersFile, users, { spaces: 2 });
                            console.log(chalk.green(`✅ Migrated ${users.length} users successfully.`));
                        }
                        usersMigrated = true;
                        checkComplete();
                    });

                    // Migrate Bots
                    db.all("SELECT * FROM Bots", [], (err, rows) => {
                        if (err) {
                            console.error(chalk.red('Error reading Bots from SQLite:'), err.message);
                            botsMigrated = true;
                            checkComplete();
                            return;
                        }
                        if (rows && rows.length > 0 && !botsExist) {
                            const bots = rows.map(row => {
                                let settings = row.settings;
                                if (typeof settings === 'string') {
                                    try { settings = JSON.parse(settings); } catch (e) {}
                                }
                                let statistics = row.statistics;
                                if (typeof statistics === 'string') {
                                    try { statistics = JSON.parse(statistics); } catch (e) {}
                                }
                                return {
                                    ...row,
                                    isActive: row.isActive === undefined ? true : !!row.isActive,
                                    settings: settings || {},
                                    statistics: statistics || {}
                                };
                            });
                            fs.writeJsonSync(botsFile, bots, { spaces: 2 });
                            console.log(chalk.green(`✅ Migrated ${bots.length} bots successfully.`));
                        }
                        botsMigrated = true;
                        checkComplete();
                    });
                });
            });
        }
    } catch (migrationError) {
        console.error(chalk.red('⚠️ SQLite to JSON migration failed:'), migrationError.message);
    }
};

// Connection Test with JSON Storage and Auto-Migration
const connectDatabase = async () => {
    try {
        await database.authenticate();
        console.log(chalk.green('✅ Database connection (JSON Engine) established successfully.'));
        
        // Sync JSON storage files
        await database.sync();
        console.log(chalk.blue('📊 Database models (JSON files) synchronized.'));

        // Run auto-migration
        await migrateToJSON();
        
        return true;
    } catch (error) {
        console.error(chalk.red('❌ Unable to connect to the JSON database:'), error.message);
        return false;
    }
};

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n🔄 Gracefully shutting down database connection...'));
    await database.close();
    console.log(chalk.green('✅ Database connection closed.'));
    process.exit(0);
});

module.exports = { database, connectDatabase, Op };