const PORT = process.env.PORT || process.env.SERVER_PORT || 8099;
const HOST = '0.0.0.0';
const DISPLAY_HOST = process.env.IP || process.env.SERVER_IP || 'localhost';

module.exports = {
    // Application Settings
    APP_NAME: 'ARCANE-MINI',
    APP_VERSION: '2.0.0',
    APP_DESCRIPTION: 'Advanced WhatsApp Bot Management System',
    
    // Server Configuration
    PORT: PORT,
    HOST: HOST,
    DISPLAY_HOST: DISPLAY_HOST,
    NODE_ENV: process.env.NODE_ENV || 'development',
    BASE_URL: process.env.BASE_URL || `http://${DISPLAY_HOST}:${PORT}`,
    
    // JWT Configuration
    JWT_SECRET: 'queen-mini-jwt-secret-key-2025-darkside-developers',
    JWT_EXPIRES_IN: '7d',
    
    // WhatsApp Bot Configuration
    BOT_NAME: 'ARCANE-MINI',
    BOT_VERSION: '2.0.0',
    BOT_FOOTER: '© 2026 Arcane Developers',
    PREFIX: '.',
    
    // Admin Configuration
    ADMIN_PASSWORD: 'admin123', // Change this in production
    
    // Rate Limiting
    RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
    RATE_LIMIT_MAX: 100, // requests per window
    
    // File Upload
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    UPLOAD_PATH: './uploads',
    
    // Bot Settings
    AUTO_VIEW_STATUS: true,
    AUTO_LIKE_STATUS: true,
    AUTO_RECORDING: true,
    AUTO_LIKE_EMOJI: ['🧩', '🍉', '💜', '🌸', '🪴', '💊', '💫', '🍂', '🌟', '🎋'],
    MAX_RETRIES: 3,
    
    // GitHub Integration (Optional)
    GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
    GITHUB_REPO_OWNER: process.env.GITHUB_REPO_OWNER || 'arcane-nx',
    GITHUB_REPO_NAME: process.env.GITHUB_REPO_NAME || 'ARCANE-MINI',
    
    // Copyright Information
    COPYRIGHT: {
        COMPANY: 'Arcane Developers',
        OWNER: 'Arcane',
        GITHUB: 'https://github.com/arcane-nx',
        YEAR: new Date().getFullYear()
    }
};