const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Regex to find 4-8 digit codes
const OTP_REGEX = /\b\d{4,8}\b/;

app.post('/api/fetch-otps', async (req, res) => {
    const { email, password, refresh_token, client_id } = req.body;

    if (!refresh_token || !client_id) {
        return res.status(400).json({ error: 'Missing refresh_token or client_id' });
    }

    try {
        // 1. Exchange refresh token for access token
        const tokenResponse = await axios.post(
            'https://login.microsoftonline.com/common/oauth2/v2.0/token',
            new URLSearchParams({
                client_id: client_id,
                grant_type: 'refresh_token',
                refresh_token: refresh_token,
                scope: 'https://graph.microsoft.com/.default'
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const accessToken = tokenResponse.data.access_token;

        // 2. Fetch emails
        const messagesResponse = await axios.get(
            'https://graph.microsoft.com/v1.0/me/messages?$top=10&$select=subject,bodyPreview,receivedDateTime,from',
            {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        );

        const messages = messagesResponse.data.value;
        const otps = [];

        messages.forEach(msg => {
            const subject = msg.subject || '';
            const body = msg.bodyPreview || '';
            const content = `${subject} ${body}`;

            // Basic filtering for "code", "verification", "otp"
            if (/code|verify|otp|login|confirm/i.test(content)) {
                const match = content.match(OTP_REGEX);
                if (match) {
                    otps.push({
                        email: email,
                        code: match[0],
                        subject: subject,
                        receivedAt: msg.receivedDateTime,
                        sender: msg.from?.emailAddress?.address || 'Unknown'
                    });
                }
            }
        });

        res.json({ success: true, otps });

    } catch (error) {
        console.error('Error processing:', email, error.response?.data || error.message);
        let errorMsg = 'Failed to fetch messages';
        if (error.response?.data?.error === 'invalid_grant') {
            errorMsg = 'Refresh Token Expired or Invalid';
        }
        res.status(500).json({ success: false, error: errorMsg, details: error.response?.data || error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
