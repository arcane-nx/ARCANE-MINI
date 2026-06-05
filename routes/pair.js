const express = require('express');
const router = express.Router();
const { getPairingCodeOnly } = require('../services/botService');

/**
 * @route GET /pair
 * @desc Generate pairing code without DB saving
 * @query ?number=PHONE_NUMBER
 */
router.get('/', async (req, res) => {
    try {
        const phoneNumber = req.query.number;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required. Use /pair?number=your_number'
            });
        }

        const code = await getPairingCodeOnly(phoneNumber);

        res.json({
            success: true,
            code: code
        });
    } catch (error) {
        console.error('Pairing route error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate pairing code'
        });
    }
});

module.exports = router;
