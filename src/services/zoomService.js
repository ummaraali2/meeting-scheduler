import axios from 'axios';

const CLIENT_ID = process.env.REACT_APP_ZOOM_CLIENT_ID;
const REDIRECT_URI = process.env.REACT_APP_ZOOM_REDIRECT_URI;
const BACKEND_URL = 'http://localhost:4000';

export const zoomService = {
  // Check if user is authenticated with Zoom
  isAuthenticated: () => {
    return !!localStorage.getItem('zoom_access_token');
  },

  // Redirect to Zoom for authorization
  authorizeZoom: () => {
    const authUrl = `https://zoom.us/oauth/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    window.location.href = authUrl;
  },

  // Exchange code for access token (via backend)
  getAccessToken: async (code) => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/zoom/token`, { code });
      const accessToken = response.data.access_token;
      localStorage.setItem('zoom_access_token', accessToken);
      return accessToken;
    } catch (error) {
      console.error('Error getting access token:', error);
      throw error;
    }
  },

  // Create a real Zoom meeting
  createMeeting: async (meetingData) => {
    const accessToken = localStorage.getItem('zoom_access_token');
    
    if (!accessToken) {
      throw new Error('Not authenticated with Zoom');
    }

    try {
      // Format start time for Zoom API
      const startTime = new Date(meetingData.date);
      const [hours, minutes] = meetingData.time.split(':');
      startTime.setHours(parseInt(hours), parseInt(minutes), 0);

      const response = await axios.post(
        `${BACKEND_URL}/api/zoom/create-meeting`,
        {
          accessToken,
          meetingData: {
            title: meetingData.title,
            start_time: startTime.toISOString(),
            duration: parseInt(meetingData.duration) || 30
          }
        }
      );

      return {
        meetingLink: response.data.join_url,
        meetingId: response.data.id
      };
    } catch (error) {
      console.error('Error creating Zoom meeting:', error);
      throw error;
    }
  },

  // Logout from Zoom
  logout: () => {
    localStorage.removeItem('zoom_access_token');
  }
};