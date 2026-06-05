/**
 * User Model (JSON version)
 * Copyright © 2025 DarkSide Developers
 */

const { JSONModel, ValidationError } = require('../JSONModel');
const bcrypt = require('bcryptjs');

class User extends JSONModel {
    static filePath = './database/store/users.json';
    static modelName = 'User';

    // Instance methods
    async comparePassword(candidatePassword) {
        if (!this.password) return false;
        return await bcrypt.compare(candidatePassword, this.password);
    }

    getFullName() {
        return `${this.firstName} ${this.lastName}`;
    }

    // Model Validations
    static validate(data, isUpdate = false) {
        if (!isUpdate || data.username !== undefined) {
            if (!data.username || data.username.length < 3 || data.username.length > 30) {
                throw new ValidationError('Username must be between 3 and 30 characters');
            }
            if (!/^[a-zA-Z0-9_]+$/.test(data.username)) {
                throw new ValidationError('Username can only contain letters, numbers, and underscores');
            }
            // Check username uniqueness
            const records = this._load();
            const exists = records.find(r => r.username && r.username.toLowerCase() === data.username.toLowerCase() && r.id !== data.id);
            if (exists) {
                throw new ValidationError('User with this username already exists');
            }
        }
        
        if (!isUpdate || data.email !== undefined) {
            if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
                throw new ValidationError('Invalid email format');
            }
            // Check email uniqueness
            const records = this._load();
            const exists = records.find(r => r.email && r.email.toLowerCase() === data.email.toLowerCase() && r.id !== data.id);
            if (exists) {
                throw new ValidationError('User with this email already exists');
            }
        }

        if (!isUpdate || data.password !== undefined) {
            if (!data.password || data.password.length < 6 || data.password.length > 100) {
                throw new ValidationError('Password must be between 6 and 100 characters');
            }
        }

        if (!isUpdate || data.firstName !== undefined) {
            if (!data.firstName || data.firstName.length < 2 || data.firstName.length > 50) {
                throw new ValidationError('First name must be between 2 and 50 characters');
            }
        }

        if (!isUpdate || data.lastName !== undefined) {
            if (!data.lastName || data.lastName.length < 2 || data.lastName.length > 50) {
                throw new ValidationError('Last name must be between 2 and 50 characters');
            }
        }

        if (data.phoneNumber !== undefined && data.phoneNumber !== null) {
            if (data.phoneNumber !== '' && (!/^[0-9]+$/.test(data.phoneNumber) || data.phoneNumber.length < 10 || data.phoneNumber.length > 15)) {
                throw new ValidationError('Phone number must be numeric and between 10 and 15 digits');
            }
        }
    }
}

module.exports = User;