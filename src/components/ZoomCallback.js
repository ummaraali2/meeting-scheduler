import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { zoomService } from '../services/zoomService';

export default function ZoomCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      zoomService.getAccessToken(code)
        .then(() => {
          navigate('/');
        })
        .catch(error => {
          console.error('OAuth error:', error);
          navigate('/');
        });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
        <p className="text-lg">Connecting to Zoom...</p>
      </div>
    </div>
  );
}