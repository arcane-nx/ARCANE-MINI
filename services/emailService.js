/**
 * Email Service - Resend Only
 * Copyright © 2025 DarkSide Developers
 */

const config = require('../config');
const { Resend } = require('resend');

// --------------------
// Initialize Resend
// --------------------
if (config.EMAIL_PROVIDER !== 'resend') {
    throw new Error('EMAIL_PROVIDER must be set to "resend"');
}

if (!config.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is missing');
}

const resendClient = new Resend(config.RESEND_API_KEY);
console.log('Resend client initialized');

// --------------------
// Resolve Base URL (SYNC SAFE)
// --------------------
let cachedBaseUrl = null;

const getBaseUrl = async () => {
    if (cachedBaseUrl) return cachedBaseUrl;

    if (config.BASE_URL) {
        cachedBaseUrl = config.BASE_URL;
    } else {
        cachedBaseUrl = `http://${config.HOST || 'localhost'}:${config.PORT}`;
    }
    return cachedBaseUrl;
};

// --------------------
// Send Welcome Email
// --------------------
const sendWelcomeEmail = async (email, firstName, verificationToken) => {
    const baseUrl = await getBaseUrl();
    const verificationUrl = `${baseUrl}/api/auth/verify-email/${verificationToken}`;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <body>
        <h2>Welcome, ${firstName}! 🎉</h2>
        <p>Please verify your email to get started:</p>
        <p>
            <a href="${verificationUrl}" target="_blank">
                Verify Email
            </a>
        </p>
        <p>This link expires in 24 hours.</p>
    </body>
    </html>
    `;

    const response = await resendClient.emails.send({
        from: config.EMAIL_FROM, // MUST be verified
        to: [email],
        subject: '🎉 Welcome to QUEEN-MINI - Verify Your Email',
        html: htmlContent,
        text: `Verify your email: ${verificationUrl}`
    });

    console.log('Resend response:', response);
};

// --------------------
// Send Password Reset Email
// --------------------
const sendPasswordResetEmail = async (email, resetToken) => {
    const baseUrl = await getBaseUrl();
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <body>
        <h2>Password Reset</h2>
        <p>Click the link below to reset your password:</p>
        <p>
            <a href="${resetUrl}" target="_blank">
                Reset Password
            </a>
        </p>
        <p>This link expires in 1 hour.</p>
    </body>
    </html>
    `;

    const response = await resendClient.emails.send({
        from: config.EMAIL_FROM,
        to: [email],
        subject: '🔐 QUEEN-MINI - Password Reset',
        html: htmlContent,
        text: `Reset your password: ${resetUrl}`
    });

    console.log('Resend response:', response);
};

module.exports = {
    sendWelcomeEmail,
    sendPasswordResetEmail
};