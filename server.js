const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();

app.use(express.json());
app.use(cors());

// WhatsApp Web Client Setup with AWS EC2 / Linux Chrome Sandbox Fixes
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('Mee WhatsApp nundi scan cheyandi (Scan this QR code in terminal):');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('WhatsApp successfully linked to your personal number!');
});

client.initialize();

const otpStorage = {};
const userOtpStorage = {};

app.get('/', (req, res) => {
    res.send('Server is up and running successfully!');
});

// 1. User Login - Send OTP Route
app.post('/api/user/send-otp', async (req, res) => {
    let { name, phone } = req.body;
    
    if (!phone) {
        return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    phone = String(phone).trim().replace(/\D/g, '');
    if (phone.length > 10) {
        phone = phone.slice(-10);
    }

    const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
    userOtpStorage[phone] = generatedOtp;

    console.log(`[User Login OTP] Name: ${name}, Phone: ${phone}, OTP: ${generatedOtp}`);

    try {
        const chatId = `91${phone}@c.us`; 
        const messageText = `Hello ${name || 'User'}, Your LKS Login OTP is: ${generatedOtp}`;
        
        await client.sendMessage(chatId, messageText);
        console.log(`User OTP successfully sent to ${phone}!`);

        res.json({ 
            success: true, 
            message: `OTP sent successfully to ${phone}` 
        });
    } catch (error) {
        console.error("Failed to send WhatsApp message:", error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to send WhatsApp message. Make sure WhatsApp is linked properly.',
            error: error.message 
        });
    }
});

// 2. User Login - Verify OTP Route
app.post('/api/user/verify-otp', (req, res) => {
    let { name, phone, otp } = req.body;

    if (!phone || !otp) {
        return res.status(400).json({ success: false, message: 'Phone and OTP are required' });
    }

    let cleanPhone = String(phone).trim().replace(/\D/g, '').slice(-10);
    const savedOtp = userOtpStorage[cleanPhone];

    if (savedOtp && savedOtp === String(otp).trim()) {
        delete userOtpStorage[cleanPhone];
        return res.json({ 
            success: true, 
            message: 'Verified successfully',
            user: { name: name || 'User', phone: cleanPhone }
        });
    } else {
        return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }
});

// 3. Admin Order Delivery - Send WhatsApp OTP Route
app.post('/api/send-whatsapp-otp', async (req, res) => {
    let { orderId, phone } = req.body;
    
    if (!orderId || !phone) {
        return res.status(400).json({ success: false, message: 'Order ID and Phone number are required' });
    }

    phone = String(phone).trim().replace(/\D/g, '');
    if (phone.length > 10) {
        phone = phone.slice(-10);
    }

    const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
    otpStorage[orderId] = generatedOtp;

    console.log(`[WhatsApp OTP] Order: ${orderId}, Clean Phone: ${phone}, OTP: ${generatedOtp}`);

    try {
        const chatId = `91${phone}@c.us`; 
        const messageText = `Your LKS Delivery Verification OTP is: ${generatedOtp}`;
        
        await client.sendMessage(chatId, messageText);
        console.log(`OTP successfully sent to ${phone} from your WhatsApp!`);

        res.json({ 
            success: true, 
            message: `OTP sent successfully to customer (${phone}) WhatsApp from your number`
        });
    } catch (error) {
        console.error("Failed to send WhatsApp message:", error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to send WhatsApp message. Make sure WhatsApp is linked properly.',
            error: error.message 
        });
    }
});

// 4. Admin Order Delivery - Verify OTP Route
app.post('/api/verify-otp', (req, res) => {
    const { orderId, otp } = req.body;

    if (!orderId || !otp) {
        return res.status(400).json({ success: false, message: 'Order ID and OTP are required' });
    }

    const savedOtp = otpStorage[orderId];

    if (savedOtp && savedOtp === otp.trim()) {
        delete otpStorage[orderId];
        return res.json({ success: true, message: 'OTP verified successfully' });
    } else {
        return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});