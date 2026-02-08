/**
 * QUEEN-MINI Main Server
 * Copyright © 2025 DarkSide Developers
 * Owner: DarkWinzo
 * GitHub: https://github.com/DarkWinzo
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const chalk = require('chalk');

const config = require('./config');
const { connectDatabase } = require('./database/connection');
const { generalLimiter } = require('./middleware/rateLimiter');
const { startAllBots } = require('./services/botService');

// Import routes
const authRoutes = require('./routes/auth');
const botRoutes = require('./routes/bot');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Global middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(generalLimiter);

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Socket.IO for real-time updates
global.io = io;

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/bot', botRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);

// Serve main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error(chalk.red('Server Error:'), error);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(chalk.blue('Client connected:'), socket.id);
    
    socket.on('join', (room) => {
        socket.join(room);
        console.log(chalk.cyan(`Client ${socket.id} joined room: ${room}`));
    });
    
    socket.on('disconnect', () => {
        console.log(chalk.yellow('Client disconnected:'), socket.id);
    });
});

const startServer = async () => {
    try {
        // Connect to database
        await connectDatabase();
        
        // Start server
        const PORT = config.PORT;
        const HOST = config.HOST;
       server.listen(PORT, HOST, async () => {
    const displayHost = config.DISPLAY_HOST;
    console.log(chalk.green(`
╔══════════════════════════════════════════════════════════════╗
║                        QUEEN-MINI v${config.APP_VERSION}     
║                  Advanced WhatsApp Bot System                
║                                                              
║  🚀 Server:   http://${displayHost}:${PORT}                        
║  📊 Database: Connected                                      
║  🔒 Security: Enabled                                        
║  ⚡ Real-time: Socket.IO Active                              
║                                                              
║  Copyright © ${config.COPYRIGHT.YEAR} ${config.COPYRIGHT.COMPANY} 
║  Owner: ${config.COPYRIGHT.OWNER}                             
║  GitHub: ${config.COPYRIGHT.GITHUB}                          
╚══════════════════════════════════════════════════════════════╝
    `));
    
    // Auto-restart active bots
    await startAllBots();
});

    } catch (error) {
        console.error(chalk.red('Failed to start server:'), error);
        process.exit(1);
    }
};


// Graceful shutdown
process.on('SIGTERM', () => {
    console.log(chalk.yellow('SIGTERM received, shutting down gracefully...'));
    server.close(() => {
        console.log(chalk.green('Server closed'));
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log(chalk.yellow('SIGINT received, shutting down gracefully...'));
    server.close(() => {
        console.log(chalk.green('Server closed'));
        process.exit(0);
    });
});

startServer();

module.exports = app;