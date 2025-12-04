const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/zoom/token', async (req, res) => {
  try {
    const { code } = req.body;
    const response = await axios.post(
      'https://zoom.us/oauth/token',
      null,
      {
        params: {
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: process.env.REACT_APP_ZOOM_REDIRECT_URI
        },
        headers: {
          'Authorization': `Basic ${Buffer.from(
            `${process.env.REACT_APP_ZOOM_CLIENT_ID}:${process.env.REACT_APP_ZOOM_CLIENT_SECRET}`
          ).toString('base64')}`
        }
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Zoom token error:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/zoom/create-meeting', async (req, res) => {
  try {
    const { accessToken, meetingData } = req.body;
    const response = await axios.post(
      'https://api.zoom.us/v2/users/me/meetings',
      {
        topic: meetingData.title,
        type: 2,
        start_time: meetingData.start_time,
        duration: parseInt(meetingData.duration),
        timezone: 'UTC'
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Create meeting error:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});