const PORT = process.env.PORT || process.env.SERVER_PORT || 8099;
const HOST = '0.0.0.0';
const DISPLAY_HOST = process.env.IP || process.env.SERVER_IP || 'localhost';

module.exports = {
    // Server Configuration
    PORT: PORT,
    HOST: HOST,
    DISPLAY_HOST: DISPLAY_HOST,
    APP_VERSION: '2.0.0',
    
    // JWT Configuration
    JWT_SECRET: 'queen-mini-jwt-secret-key-2025-darkside-developers',
    JWT_EXPIRES_IN: '7d',
    
    // Admin Configuration
    ADMIN_PASSWORD: 'admin123', // Change this in production
    
    // Rate Limiting
    RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
    RATE_LIMIT_MAX: 100, // requests per window
    
    // File Upload
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    UPLOAD_PATH: './uploads',
    
    // Copyright Information (Used during server printout)
    COPYRIGHT: {
        COMPANY: 'Arcane Developers',
        OWNER: 'Arcane',
        GITHUB: 'https://github.com/arcane-nx',
        YEAR: new Date().getFullYear()
    }
};