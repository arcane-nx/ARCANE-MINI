/**
 * Combined Database Handler (JSON Engine)
 * Copyright © 2025 DarkSide Developers
 */

const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const storePath = path.join(__dirname, 'store');
const dbPath = path.join(storePath, 'queen-mini.db');
const usersFile = path.join(storePath, 'users.json');
const botsFile = path.join(storePath, 'bots.json');

// ValidationError to mock Sequelize validation errors
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SequelizeValidationError';
        this.errors = [{ message }];
    }
}

// Op object mimicking Sequelize Operators
const Op = {
    or: Symbol('or'),
    iLike: Symbol('iLike'),
    like: Symbol('like')
};

class JSONModel {
    static filePath = '';
    static modelName = '';

    constructor(data) {
        Object.assign(this, data);
    }

    static hasMany() {}
    static belongsTo() {}

    static _load() {
        try {
            if (!fs.existsSync(this.filePath)) {
                fs.ensureDirSync(path.dirname(this.filePath));
                fs.writeJsonSync(this.filePath, []);
                return [];
            }
            return fs.readJsonSync(this.filePath) || [];
        } catch (error) {
            console.error(`Error loading JSON file ${this.filePath}:`, error);
            return [];
        }
    }

    static _save(data) {
        try {
            fs.ensureDirSync(path.dirname(this.filePath));
            fs.writeJsonSync(this.filePath, data, { spaces: 2 });
        } catch (error) {
            console.error(`Error saving JSON file ${this.filePath}:`, error);
        }
    }

    static _filterAttributes(record, options) {
        if (!record) return null;
        let data = { ...record };
        if (options && options.attributes) {
            if (Array.isArray(options.attributes)) {
                const filtered = {};
                options.attributes.forEach(attr => {
                    if (data[attr] !== undefined) filtered[attr] = data[attr];
                });
                data = filtered;
            } else if (options.attributes.exclude && Array.isArray(options.attributes.exclude)) {
                options.attributes.exclude.forEach(attr => {
                    delete data[attr];
                });
            }
        }
        return data;
    }

    static _applyInclude(record, options) {
        if (!record || !options || !options.include) return record;
        const recordCopy = { ...record };
        
        for (const inc of options.include) {
            const targetModel = inc.model;
            const as = inc.as;
            
            if (as === 'user' && recordCopy.userId) {
                const userObj = targetModel._load().find(u => u.id === recordCopy.userId);
                if (userObj) {
                    recordCopy[as] = targetModel._filterAttributes(userObj, inc);
                }
            } else if (as === 'bots') {
                const bots = targetModel._load().filter(b => b.userId === recordCopy.id);
                recordCopy[as] = bots.map(b => targetModel._filterAttributes(b, inc));
            }
        }
        return recordCopy;
    }

    static _filter(records, where) {
        if (!where) return records;
        
        return records.filter(record => {
            const keys = Reflect.ownKeys(where);
            for (const key of keys) {
                const value = where[key];
                
                if (key === Op.or) {
                    if (Array.isArray(value)) {
                        const anyMatch = value.some(cond => {
                            const condKeys = Reflect.ownKeys(cond);
                            return condKeys.every(cKey => {
                                const cVal = cond[cKey];
                                
                                if (cVal && typeof cVal === 'object' && !Array.isArray(cVal)) {
                                    const cValKeys = Reflect.ownKeys(cVal);
                                    return cValKeys.every(opKey => {
                                        if (opKey === Op.iLike || opKey === Op.like) {
                                            const pattern = cVal[opKey].replace(/%/g, '').toLowerCase();
                                            return record[cKey] && record[cKey].toLowerCase().includes(pattern);
                                        }
                                        return record[cKey] === cVal[opKey];
                                    });
                                }
                                
                                return record[cKey] === cVal;
                            });
                        });
                        if (!anyMatch) return false;
                    }
                    continue;
                }

                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    const opKeys = Reflect.ownKeys(value);
                    let matchesOp = true;
                    for (const opKey of opKeys) {
                        if (opKey === Op.iLike || opKey === Op.like) {
                            const pattern = value[opKey].replace(/%/g, '').toLowerCase();
                            if (!record[key] || !record[key].toLowerCase().includes(pattern)) {
                                matchesOp = false;
                            }
                        } else {
                            if (record[key] !== value[opKey]) {
                                matchesOp = false;
                            }
                        }
                    }
                    if (!matchesOp) return false;
                } else if (Array.isArray(value)) {
                    if (!value.includes(record[key])) {
                        return false;
                    }
                } else {
                    if (record[key] !== value) {
                        return false;
                    }
                }
            }
            return true;
        });
    }

    // Static Query Methods
    static async findByPk(id, options = {}) {
        if (!id) return null;
        const records = this._load();
        const found = records.find(r => r.id === id);
        if (!found) return null;
        
        let instData = this._filterAttributes(found, options);
        instData = this._applyInclude(instData, options);
        return new this(instData);
    }

    static async findOne(options = {}) {
        const records = this._load();
        const filtered = this._filter(records, options.where);
        if (filtered.length === 0) return null;
        
        let instData = this._filterAttributes(filtered[0], options);
        instData = this._applyInclude(instData, options);
        return new this(instData);
    }

    static async findAll(options = {}) {
        let records = this._load();
        
        if (options.where) {
            records = this._filter(records, options.where);
        }
        
        if (options.order) {
            const [field, direction] = options.order[0];
            records.sort((a, b) => {
                const valA = a[field];
                const valB = b[field];
                if (valA < valB) return direction === 'DESC' ? 1 : -1;
                if (valA > valB) return direction === 'DESC' ? -1 : 1;
                return 0;
            });
        } else {
            if (records.length > 0 && records[0].createdAt) {
                records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            }
        }

        const offset = options.offset || 0;
        const limit = options.limit !== undefined ? options.limit : records.length;
        records = records.slice(offset, offset + limit);

        return records.map(r => {
            let instData = this._filterAttributes(r, options);
            instData = this._applyInclude(instData, options);
            return new this(instData);
        });
    }

    static async findAndCountAll(options = {}) {
        let records = this._load();
        if (options.where) {
            records = this._filter(records, options.where);
        }
        const count = records.length;
        
        let rows = [...records];
        if (options.order) {
            const [field, direction] = options.order[0];
            rows.sort((a, b) => {
                const valA = a[field];
                const valB = b[field];
                if (valA < valB) return direction === 'DESC' ? 1 : -1;
                if (valA > valB) return direction === 'DESC' ? -1 : 1;
                return 0;
            });
        } else {
            if (rows.length > 0 && rows[0].createdAt) {
                rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            }
        }

        const offset = options.offset || 0;
        const limit = options.limit !== undefined ? options.limit : rows.length;
        rows = rows.slice(offset, offset + limit);

        rows = rows.map(r => {
            let instData = this._filterAttributes(r, options);
            instData = this._applyInclude(instData, options);
            return new this(instData);
        });

        return { count, rows };
    }

    static async count(options = {}) {
        let records = this._load();
        if (options.where) {
            records = this._filter(records, options.where);
        }
        return records.length;
    }

    static async create(data = {}) {
        if (this.validate) {
            this.validate(data, false);
        }

        const records = this._load();
        
        const newRecord = {
            id: uuidv4(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...data
        };

        if (this.modelName === 'User' && newRecord.password) {
            newRecord.password = await bcrypt.hash(newRecord.password, 12);
        }

        records.push(newRecord);
        this._save(records);
        return new this(newRecord);
    }

    static async update(values, options = {}) {
        const records = this._load();
        let updatedCount = 0;
        
        for (let i = 0; i < records.length; i++) {
            let matches = true;
            if (options.where) {
                const filtered = this._filter([records[i]], options.where);
                if (filtered.length === 0) matches = false;
            }
            
            if (matches) {
                const updatedFields = { ...values };
                
                if (this.modelName === 'User' && updatedFields.password) {
                    updatedFields.password = await bcrypt.hash(updatedFields.password, 12);
                }

                records[i] = {
                    ...records[i],
                    ...updatedFields,
                    updatedAt: new Date().toISOString()
                };
                updatedCount++;
            }
        }
        
        if (updatedCount > 0) {
            this._save(records);
        }
        return [updatedCount];
    }

    async update(values) {
        const records = this.constructor._load();
        const index = records.findIndex(r => r.id === this.id);
        
        if (index !== -1) {
            const updatedFields = { ...values };

            if (this.constructor.validate) {
                this.constructor.validate({ ...records[index], ...updatedFields }, true);
            }

            if (this.constructor.modelName === 'User' && updatedFields.password) {
                updatedFields.password = await bcrypt.hash(updatedFields.password, 12);
            }
            
            const updated = {
                ...records[index],
                ...updatedFields,
                updatedAt: new Date().toISOString()
            };
            
            records[index] = updated;
            this.constructor._save(records);
            
            Object.assign(this, updated);
        }
        return this;
    }

    async destroy() {
        const records = this.constructor._load();
        const filtered = records.filter(r => r.id !== this.id);
        this.constructor._save(filtered);
        return this;
    }

    toJSON() {
        const obj = {};
        for (const key of Object.keys(this)) {
            if (typeof this[key] !== 'function') {
                obj[key] = this[key];
            }
        }
        return obj;
    }
}

// User Model Class
class User extends JSONModel {
    static filePath = usersFile;
    static modelName = 'User';

    async comparePassword(candidatePassword) {
        if (!this.password) return false;
        return await bcrypt.compare(candidatePassword, this.password);
    }

    getFullName() {
        return `${this.firstName || ''} ${this.lastName || ''}`.trim() || this.username;
    }

    static validate(data, isUpdate = false) {
        if (!isUpdate || data.username !== undefined) {
            if (!data.username || data.username.length < 3 || data.username.length > 30) {
                throw new ValidationError('Username must be between 3 and 30 characters');
            }
            if (!/^[a-zA-Z0-9_]+$/.test(data.username)) {
                throw new ValidationError('Username can only contain letters, numbers, and underscores');
            }
            const records = this._load();
            const exists = records.find(r => r.username && r.username.toLowerCase() === data.username.toLowerCase() && r.id !== data.id);
            if (exists) {
                throw new ValidationError('User with this username already exists');
            }
        }

        if (!isUpdate || data.password !== undefined) {
            if (!data.password || data.password.length < 6 || data.password.length > 100) {
                throw new ValidationError('Password must be between 6 and 100 characters');
            }
        }

        if (data.firstName !== undefined && data.firstName !== null && data.firstName !== '') {
            if (data.firstName.length < 2 || data.firstName.length > 50) {
                throw new ValidationError('First name must be between 2 and 50 characters');
            }
        }

        if (data.lastName !== undefined && data.lastName !== null && data.lastName !== '') {
            if (data.lastName.length < 2 || data.lastName.length > 50) {
                throw new ValidationError('Last name must be between 2 and 50 characters');
            }
        }

        if (data.phoneNumber !== undefined && data.phoneNumber !== null && data.phoneNumber !== '') {
            if (!/^[0-9]+$/.test(data.phoneNumber) || data.phoneNumber.length < 10 || data.phoneNumber.length > 15) {
                throw new ValidationError('Phone number must be numeric and between 10 and 15 digits');
            }
        }
    }
}

// Bot Model Class
class Bot extends JSONModel {
    static filePath = botsFile;
    static modelName = 'Bot';

    static validate(data, isUpdate = false) {
        if (!isUpdate || data.phoneNumber !== undefined) {
            if (!data.phoneNumber) {
                throw new ValidationError('Phone number is required');
            }
            
            const cleanNumber = data.phoneNumber.replace(/[^0-9]/g, '');
            if (!cleanNumber || cleanNumber.length < 10 || cleanNumber.length > 15) {
                throw new ValidationError('Phone number must be numeric and between 10 and 15 digits');
            }

            // Normalize in the data object so it gets saved clean
            data.phoneNumber = cleanNumber;

            const records = this._load();
            const exists = records.find(r => r.phoneNumber === cleanNumber && r.id !== data.id);
            if (exists) {
                throw new ValidationError('Bot with this phone number already exists');
            }
        }
    }

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

// Database Connection Helper
const database = {
    sync: async () => {
        fs.ensureDirSync(storePath);
        if (!fs.existsSync(usersFile)) fs.writeJsonSync(usersFile, []);
        if (!fs.existsSync(botsFile)) fs.writeJsonSync(botsFile, []);
        return true;
    },
    authenticate: async () => true,
    close: async () => true
};

const migrateToJSON = async () => {
    try {
        const usersExist = fs.existsSync(usersFile) && fs.readJsonSync(usersFile).length > 0;
        const botsExist = fs.existsSync(botsFile) && fs.readJsonSync(botsFile).length > 0;

        if (fs.existsSync(dbPath) && (!usersExist || !botsExist)) {
            console.log(chalk.yellow('🔄 Found legacy SQLite database and JSON files are empty. Initiating automatic migration...'));
            let sqlite3;
            try {
                sqlite3 = require('sqlite3').verbose();
            } catch (err) {
                console.log(chalk.yellow('⚠️ sqlite3 package is not installed. Skipping SQLite to JSON migration.'));
                return;
            }
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
                                isAdmin: !!row.isAdmin
                            }));
                            fs.writeJsonSync(usersFile, users, { spaces: 2 });
                            console.log(chalk.green(`✅ Migrated ${users.length} users successfully.`));
                        }
                        usersMigrated = true;
                        checkComplete();
                    });

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

const connectDatabase = async () => {
    try {
        await database.authenticate();
        console.log(chalk.green('✅ Database connection (JSON Engine) established successfully.'));
        await database.sync();
        console.log(chalk.blue('📊 Database models (JSON files) synchronized.'));
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

module.exports = {
    User,
    Bot,
    Op,
    connectDatabase,
    database
};
