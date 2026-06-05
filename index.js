/**
 * ARCANE-MINI Main Server
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
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const multer = require('multer');

const config = require('./config');
const { User, Bot, Op, connectDatabase } = require('./database');
const { authenticateToken, requireAdmin, generalLimiter, authLimiter, botLimiter } = require('./middleware');
const { 
    startAllBots,
    createBotSession,
    getBotStatus,
    updateBotSettings,
    disconnectBot,
    getPairingCodeOnly
} = require('./services/botService');

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

// -------------------------
// Multer Configuration (Avatar Upload)
// -------------------------
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, config.UPLOAD_PATH);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: config.MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// -------------------------
// 1. Authentication Routes
// -------------------------
const authRouter = express.Router();

// Register
authRouter.post('/register', authLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password must be provided'
            });
        }

        const existingUser = await User.findOne({
            where: { username }
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'User with this username already exists'
            });
        }

        const user = await User.create({
            username,
            password
        });

        const token = jwt.sign(
            { userId: user.id, username: user.username },
            config.JWT_SECRET,
            { expiresIn: config.JWT_EXPIRES_IN }
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    isAdmin: user.isAdmin
                },
                token
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                success: false,
                message: error.errors[0].message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Registration failed'
        });
    }
});

// Login
authRouter.post('/login', authLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        const user = await User.findOne({
            where: { username }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        if (user.isBanned) {
            return res.status(403).json({
                success: false,
                message: 'Account is banned'
            });
        }

        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        await user.update({ lastLogin: new Date() });

        const token = jwt.sign(
            { userId: user.id, username: user.username },
            config.JWT_SECRET,
            { expiresIn: config.JWT_EXPIRES_IN }
        );

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    isAdmin: user.isAdmin,
                    theme: user.theme
                },
                token
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
});

// -------------------------
// 2. Bot Management Routes
// -------------------------
const botRouter = express.Router();

botRouter.get('/my-bots', authenticateToken, async (req, res) => {
    try {
        const bots = await Bot.findAll({
            where: { userId: req.user.id },
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, data: bots });
    } catch (error) {
        console.error('Get bots error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch bots' });
    }
});

botRouter.post('/create', authenticateToken, botLimiter, async (req, res) => {
    try {
        const { phoneNumber, botName } = req.body;
        if (!phoneNumber) {
            return res.status(400).json({ success: false, message: 'Phone number is required' });
        }
        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        const existingBot = await Bot.findOne({ where: { phoneNumber: cleanNumber } });
        if (existingBot) {
            return res.status(409).json({ success: false, message: 'Bot with this phone number already exists' });
        }
        const bot = await Bot.create({
            userId: req.user.id,
            phoneNumber: cleanNumber,
            botName: botName || 'QUEEN-MINI',
            status: 'disconnected'
        });
        res.status(201).json({ success: true, message: 'Bot created successfully', data: bot });
    } catch (error) {
        console.error('Create bot error:', error);
        res.status(500).json({ success: false, message: 'Failed to create bot' });
    }
});

botRouter.post('/pair', authenticateToken, botLimiter, async (req, res) => {
    try {
        const { botId } = req.body;
        const bot = await Bot.findOne({ where: { id: botId, userId: req.user.id } });
        if (!bot) {
            return res.status(404).json({ success: false, message: 'Bot not found' });
        }
        const pairingCode = await createBotSession(bot);
        await bot.update({ pairingCode, status: 'connecting' });
        global.io.to(`user_${req.user.id}`).emit('bot_status_update', {
            botId: bot.id,
            status: 'connecting',
            pairingCode
        });
        res.json({ success: true, data: { pairingCode, botId: bot.id } });
    } catch (error) {
        console.error('Pairing error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate pairing code' });
    }
});

botRouter.post('/qr', authenticateToken, botLimiter, async (req, res) => {
    try {
        const { botId } = req.body;
        const bot = await Bot.findOne({ where: { id: botId, userId: req.user.id } });
        if (!bot) {
            return res.status(404).json({ success: false, message: 'Bot not found' });
        }
        const qrData = await createBotSession(bot, 'qr');
        const qrCode = await QRCode.toDataURL(qrData);
        await bot.update({ qrCode, status: 'connecting' });
        res.json({ success: true, data: { qrCode, botId: bot.id } });
    } catch (error) {
        console.error('QR generation error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate QR code' });
    }
});

botRouter.put('/settings/:botId', authenticateToken, async (req, res) => {
    try {
        const { botId } = req.params;
        const settings = req.body;
        const bot = await Bot.findOne({ where: { id: botId, userId: req.user.id } });
        if (!bot) {
            return res.status(404).json({ success: false, message: 'Bot not found' });
        }
        await bot.update({ settings });
        if (bot.status === 'connected') {
            await updateBotSettings(botId, settings);
        }
        global.io.to(`user_${req.user.id}`).emit('bot_settings_update', { botId: bot.id, settings });
        res.json({ success: true, message: 'Settings updated successfully', data: bot });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ success: false, message: 'Failed to update settings' });
    }
});

botRouter.delete('/:botId', authenticateToken, async (req, res) => {
    try {
        const { botId } = req.params;
        const bot = await Bot.findOne({ where: { id: botId, userId: req.user.id } });
        if (!bot) {
            return res.status(404).json({ success: false, message: 'Bot not found' });
        }
        await bot.destroy();
        res.json({ success: true, message: 'Bot deleted successfully' });
    } catch (error) {
        console.error('Delete bot error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete bot' });
    }
});

botRouter.post('/disconnect', authenticateToken, async (req, res) => {
    try {
        const { botId } = req.body;
        const bot = await Bot.findOne({ where: { id: botId, userId: req.user.id } });
        if (!bot) {
            return res.status(404).json({ success: false, message: 'Bot not found' });
        }
        await disconnectBot(botId);
        global.io.to(`user_${req.user.id}`).emit('bot_status_update', { botId: bot.id, status: 'disconnected' });
        res.json({ success: true, message: 'Bot disconnected successfully' });
    } catch (error) {
        console.error('Disconnect bot error:', error);
        res.status(500).json({ success: false, message: 'Failed to disconnect bot' });
    }
});

botRouter.get('/status/:botId', authenticateToken, async (req, res) => {
    try {
        const { botId } = req.params;
        const bot = await Bot.findOne({ where: { id: botId, userId: req.user.id } });
        if (!bot) {
            return res.status(404).json({ success: false, message: 'Bot not found' });
        }
        const status = await getBotStatus(botId);
        res.json({ success: true, data: { ...bot.toJSON(), liveStatus: status } });
    } catch (error) {
        console.error('Get status error:', error);
        res.status(500).json({ success: false, message: 'Failed to get bot status' });
    }
});

// -------------------------
// 3. Admin Console Routes
// -------------------------
const adminRouter = express.Router();

adminRouter.post('/auth', authenticateToken, async (req, res) => {
    try {
        const { password } = req.body;
        if (password === config.ADMIN_PASSWORD) {
            await User.update({ isAdmin: true }, { where: { id: req.user.id } });
            return res.json({ success: true, message: 'Admin access granted successfully' });
        }
        res.status(401).json({ success: false, message: 'Invalid admin password' });
    } catch (error) {
        console.error('Admin auth error:', error);
        res.status(500).json({ success: false, message: 'Failed to process admin authentication' });
    }
});

adminRouter.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const totalUsers = await User.count();
        const totalBots = await Bot.count();
        const activeBots = await Bot.count({ where: { status: 'connected' } });
        const bannedUsers = await User.count({ where: { isBanned: true } });

        const recentUsers = await User.findAll({
            limit: 10,
            order: [['createdAt', 'DESC']],
            attributes: ['id', 'username', 'createdAt', 'isActive', 'isBanned', 'isAdmin']
        });

        const recentBots = await Bot.findAll({
            limit: 10,
            order: [['createdAt', 'DESC']],
            include: [{ model: User, as: 'user', attributes: ['username'] }]
        });

        res.json({
            success: true,
            data: {
                stats: { totalUsers, totalBots, activeBots, bannedUsers },
                recentUsers,
                recentBots
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch dashboard data' });
    }
});

adminRouter.get('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '' } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = search ? {
            [Op.or]: [
                { username: { [Op.iLike]: `%${search}%` } },
                { firstName: { [Op.iLike]: `%${search}%` } },
                { lastName: { [Op.iLike]: `%${search}%` } }
            ]
        } : {};

        const { count, rows: users } = await User.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']],
            attributes: { exclude: ['password'] },
            include: [{ model: Bot, as: 'bots', attributes: ['id', 'phoneNumber', 'status', 'createdAt'] }]
        });

        res.json({
            success: true,
            data: {
                users,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
});

adminRouter.put('/users/:userId/ban', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { banned } = req.body;
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        if (user.isAdmin) {
            return res.status(403).json({ success: false, message: 'Cannot ban admin users' });
        }
        await user.update({ isBanned: banned });
        if (banned) {
            await Bot.update({ status: 'disconnected' }, { where: { userId } });
        }
        res.json({ success: true, message: `User ${banned ? 'banned' : 'unbanned'} successfully` });
    } catch (error) {
        console.error('Ban user error:', error);
        res.status(500).json({ success: false, message: 'Failed to update user status' });
    }
});

adminRouter.get('/bots', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, status = '' } = req.query;
        const offset = (page - 1) * limit;
        const whereClause = status ? { status } : {};

        const { count, rows: bots } = await Bot.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']],
            include: [{ model: User, as: 'user', attributes: ['id', 'username', 'firstName', 'lastName'] }]
        });

        res.json({
            success: true,
            data: {
                bots,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get bots error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch bots' });
    }
});

adminRouter.put('/bots/:botId/disconnect', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { botId } = req.params;
        const bot = await Bot.findByPk(botId);
        if (!bot) {
            return res.status(404).json({ success: false, message: 'Bot not found' });
        }
        await bot.update({ status: 'disconnected' });
        global.io.to(`user_${bot.userId}`).emit('bot_status_update', { botId: bot.id, status: 'disconnected' });
        res.json({ success: true, message: 'Bot disconnected successfully' });
    } catch (error) {
        console.error('Disconnect bot error:', error);
        res.status(500).json({ success: false, message: 'Failed to disconnect bot' });
    }
});

adminRouter.delete('/bots/:botId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { botId } = req.params;
        const bot = await Bot.findByPk(botId);
        if (!bot) {
            return res.status(404).json({ success: false, message: 'Bot not found' });
        }
        await bot.destroy();
        res.json({ success: true, message: 'Bot deleted successfully' });
    } catch (error) {
        console.error('Delete bot error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete bot' });
    }
});

// -------------------------
// 4. User Profile Routes
// -------------------------
const userRouter = express.Router();

userRouter.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, { attributes: { exclude: ['password'] } });
        res.json({ success: true, data: user });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch profile' });
    }
});

userRouter.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { firstName, lastName, phoneNumber, theme } = req.body;
        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        await user.update({
            firstName: firstName || user.firstName,
            lastName: lastName || user.lastName,
            phoneNumber: phoneNumber || user.phoneNumber,
            theme: theme || user.theme
        });
        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                id: user.id,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                phoneNumber: user.phoneNumber,
                theme: user.theme
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
});

userRouter.post('/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const avatarUrl = `/uploads/${req.file.filename}`;
        await user.update({ avatar: avatarUrl });
        res.json({ success: true, message: 'Avatar uploaded successfully', data: { avatar: avatarUrl } });
    } catch (error) {
        console.error('Upload avatar error:', error);
        res.status(500).json({ success: false, message: 'Failed to upload avatar' });
    }
});

userRouter.put('/password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Current and new passwords are required' });
        }
        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const isValidPassword = await user.comparePassword(currentPassword);
        if (!isValidPassword) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        }
        await user.update({ password: newPassword });
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, message: 'Failed to change password' });
    }
});

// -------------------------
// 5. Standalone Pairing Route
// -------------------------
const pairRouter = express.Router();

pairRouter.get('/', async (req, res) => {
    try {
        const phoneNumber = req.query.number;
        if (!phoneNumber) {
            return res.status(400).json({ success: false, message: 'Phone number is required. Use /pair?number=your_number' });
        }
        const code = await getPairingCodeOnly(phoneNumber);
        res.json({ success: true, code: code });
    } catch (error) {
        console.error('Pairing route error:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to generate pairing code' });
    }
});

// API Routes mounting
app.use('/api/auth', authRouter);
app.use('/api/bot', botRouter);
app.use('/api/admin', adminRouter);
app.use('/api/user', userRouter);
app.use('/pair', pairRouter);

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
║                        ARCANE-MINI v${config.APP_VERSION}     
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

startServer();