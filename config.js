const PORT = process.env.PORT || process.env.SERVER_PORT || 8099;
const HOST = '0.0.0.0';
const DISPLAY_HOST = process.env.IP || process.env.SERVER_IP || 'localhost';

module.exports = {
    // Application Settings
    APP_NAME: 'PATRON-MINI',
    APP_VERSION: '2.0.0',
    APP_DESCRIPTION: 'Advanced WhatsApp Bot Management System',
    
    // Server Configuration
    PORT: PORT,
    HOST: HOST,
    DISPLAY_HOST: DISPLAY_HOST,
    NODE_ENV: process.env.NODE_ENV || 'development',
    
    // Database Configuration
    DATABASE_URL: "local", // Change to PostgreSQL URL for cloud database
    
    BASE_URL: process.env.BASE_URL || `http://${DISPLAY_HOST}:${PORT}`,
    
    // JWT Configuration
    JWT_SECRET: 'queen-mini-jwt-secret-key-2025-darkside-developers',
    JWT_EXPIRES_IN: '7d',
    
    // Email Configuration (Nodemailer)
    EMAIL_HOST: 'smtp.gmail.com',
    EMAIL_PORT: 587,
    EMAIL_USER: 'patronffx6@gmail.com',
    EMAIL_PASS: 'Maximus0000.',
    EMAIL_FROM: 'PATRON-MINI <patron-mini@resend.dev>',
    // Resend (https://resend.com) - optional provider
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'resend', // 'resend' or 'nodemailer'
    RESEND_API_KEY: process.env.RESEND_API_KEY || 're_Ta3QaT4x_ERWt7GpLdXqhroEMH8XS4bPk',
    
    // WhatsApp Bot Configuration
    BOT_NAME: 'PATRON-MINI',
    BOT_VERSION: '2.0.0',
    BOT_FOOTER: '© 2025 patron Developers',
    PREFIX: '.',
    
    // Admin Configuration
    ADMIN_EMAIL: 'admin@patron-mini.com',
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
    GITHUB_REPO_OWNER: process.env.GITHUB_REPO_OWNER || '',
    GITHUB_REPO_NAME: process.env.GITHUB_REPO_NAME || '',
    
    // Copyright Information
    COPYRIGHT: {
        COMPANY: 'patron Developers',
        OWNER: 'Patron',
        GITHUB: 'https://github.com/Itzpatron',
        YEAR: new Date().getFullYear()
    }
};