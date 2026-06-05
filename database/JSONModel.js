/**
 * JSON-based database model wrapper mimicking Sequelize structure.
 * Copyright © 2025 DarkSide Developers
 */

const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// Custom ValidationError to mimic Sequelize validation errors
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

    // Static association helpers to prevent errors when models are set up
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
                
                // Op.or operator
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

                // Nested Operators (e.g. { username: { [Op.iLike]: '%search%' } })
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
                    // Check if value is in array (e.g. status: ['connected', 'connecting'])
                    if (!value.includes(record[key])) {
                        return false;
                    }
                } else {
                    // Equality
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
                
                // If it's User and has password, hash it
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

    // Instance Methods
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

module.exports = {
    JSONModel,
    ValidationError,
    Op
};
