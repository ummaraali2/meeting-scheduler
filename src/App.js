import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Calendar, Clock, Plus, User, ChevronLeft, ChevronRight, Video, X, Trash2, Edit, Search, Filter, Download, Copy, Check, AlertCircle, LogIn, LogOut, Menu } from 'lucide-react';
import { zoomService } from './services/zoomService';
import { auth, signInWithGoogle, signOutUser } from './firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { emailService } from './services/emailService';

// Get all timezones dynamically from browser
const getAllTimezones = () => {
  const timezones = Intl.supportedValuesOf('timeZone');
  
  // Group by region for better UX
  const grouped = timezones.reduce((acc, tz) => {
    const [region] = tz.split('/');
    if (!acc[region]) acc[region] = [];
    acc[region].push(tz);
    return acc;
  }, {});

  return grouped;
};

const TIMEZONES = getAllTimezones();

const PLATFORMS = {
  zoom: { name: 'Zoom', color: 'from-blue-500 to-blue-600', bgColor: 'bg-blue-500/20', borderColor: 'border-blue-500' },
  teams: { name: 'Teams', color: 'from-purple-500 to-purple-600', bgColor: 'bg-purple-500/20', borderColor: 'border-purple-500' },
  meet: { name: 'Meet', color: 'from-green-500 to-green-600', bgColor: 'bg-green-500/20', borderColor: 'border-green-500' }
};

const VIEWS = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  AGENDA: 'agenda'
};

export default function MeetingScheduler() {
  const [view, setView] = useState(VIEWS.MONTH);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [isZoomAuthenticated, setIsZoomAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [googleToken, setGoogleToken] = useState(() => {
    // Load saved token on initial render
    return localStorage.getItem('google_oauth_token') || null;
  });
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [meetings, setMeetings] = useState(() => {
    // Load meetings from localStorage on initial render
    const saved = localStorage.getItem('meetings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Convert date strings back to Date objects
        return parsed.map(m => ({
          ...m,
          date: new Date(m.date)
        }));
      } catch (e) {
        console.error('Error loading meetings:', e);
        return [];
      }
    }
    // Default meetings if nothing in localStorage
    return [
      { 
        id: 1, 
        date: new Date(2024, 11, 5), 
        title: 'Team Standup', 
        time: '9:00 AM',
        duration: '30 min',
        platform: 'zoom',
        participants: ['john@example.com', 'jane@example.com'],
        location: 'Virtual',
        description: 'Daily team sync',
        meetingLink: 'https://zoom.us/j/123456789',
        recurring: false,
        status: 'confirmed',
        timezone: 'America/New_York'
      },
      { 
        id: 2, 
        date: new Date(2024, 11, 5), 
        title: 'Client Review', 
        time: '2:00 PM',
        duration: '1 hour',
        platform: 'teams',
        participants: ['client@company.com'],
        location: 'Virtual',
        description: 'Q4 project review',
        meetingLink: 'https://teams.microsoft.com/l/meetup-join',
        recurring: false,
        status: 'confirmed',
        timezone: 'America/New_York'
      },
      { 
        id: 3, 
        date: new Date(2024, 11, 8), 
        title: 'Design Sync', 
        time: '11:00 AM',
        duration: '45 min',
        platform: 'meet',
        participants: ['design@example.com'],
        location: 'Virtual',
        description: 'Weekly design discussion',
        meetingLink: 'https://meet.google.com/abc-defg-hij',
        recurring: true,
        status: 'confirmed',
        timezone: 'America/Los_Angeles'
      },
    ];
  });

  // Save meetings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('meetings', JSON.stringify(meetings));
  }, [meetings]);

  useEffect(() => {
    setIsZoomAuthenticated(zoomService.isAuthenticated());
    
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithGoogle();
      setCurrentUser(result.user);
      setGoogleToken(result.token);
      // Save token to localStorage
      localStorage.setItem('google_oauth_token', result.token);
      alert(`Welcome ${result.user.displayName}! You can now send email invites.`);
    } catch (error) {
      console.error('Sign in error:', error);
      alert('Failed to sign in with Google');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setCurrentUser(null);
      setGoogleToken(null);
      // Clear saved token
      localStorage.removeItem('google_oauth_token');
      zoomService.logout();
      setIsZoomAuthenticated(false);
      alert('Signed out successfully');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const addMeeting = useCallback(async (meeting, sendInvites = false) => {
    let meetingLink = generateMeetingLink(meeting.platform);
    
    if (meeting.platform === 'zoom' && isZoomAuthenticated) {
      try {
        const result = await zoomService.createMeeting(meeting);
        meetingLink = result.meetingLink;
      } catch (error) {
        console.error('Failed to create Zoom meeting:', error);
        alert('Failed to create Zoom meeting. Using placeholder link.');
      }
    }

    const newMeeting = {
      ...meeting,
      id: Date.now(),
      status: 'confirmed',
      meetingLink
    };
    
    setMeetings(prev => [...prev, newMeeting]);
    
    // Send email invites if requested
    if (sendInvites && googleToken && newMeeting.participants.length > 0) {
      try {
        await emailService.sendInvites(googleToken, newMeeting);
        alert(`Meeting created! Email invites sent to ${newMeeting.participants.length} participant(s)`);
      } catch (error) {
        console.error('Failed to send invites:', error);
        alert('Meeting created, but failed to send email invites');
      }
    }
    
    setShowCreateModal(false);
  }, [isZoomAuthenticated, googleToken]);

  const updateMeeting = useCallback((updatedMeeting) => {
    setMeetings(prev => prev.map(m => m.id === updatedMeeting.id ? updatedMeeting : m));
    setShowEditModal(false);
    setEditingMeeting(null);
  }, []);

  const deleteMeeting = useCallback((id) => {
    if (window.confirm('Are you sure you want to delete this meeting?')) {
      setMeetings(prev => prev.filter(m => m.id !== id));
    }
  }, []);

  const handleEditMeeting = useCallback((meeting) => {
    setEditingMeeting(meeting);
    setShowEditModal(true);
  }, []);

  const handleConnectZoom = useCallback(() => {
    if (!currentUser) {
      alert('Please sign in with Google first');
      return;
    }
    zoomService.authorizeZoom();
  }, [currentUser]);

  const handleDisconnectZoom = useCallback(() => {
    zoomService.logout();
    setIsZoomAuthenticated(false);
    alert('Disconnected from Zoom');
  }, []);

  const handleJoinMeeting = useCallback((meetingLink) => {
    window.open(meetingLink, '_blank');
  }, []);

  const filteredMeetings = useMemo(() => {
    return meetings.filter(meeting => {
      const matchesSearch = meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          meeting.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPlatform = filterPlatform === 'all' || meeting.platform === filterPlatform;
      return matchesSearch && matchesPlatform;
    });
  }, [meetings, searchQuery, filterPlatform]);

  const exportToCSV = useCallback(() => {
    const headers = ['Title', 'Date', 'Time', 'Duration', 'Platform', 'Participants', 'Link'];
    const rows = meetings.map(m => [
      m.title,
      m.date.toLocaleDateString(),
      m.time,
      m.duration,
      PLATFORMS[m.platform].name,
      m.participants.join('; '),
      m.meetingLink
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meetings.csv';
    a.click();
  }, [meetings]);

  const copyMeetingLink = useCallback((id, link) => {
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const checkConflicts = useCallback((newMeeting) => {
    return meetings.filter(m => {
      if (m.id === newMeeting.id) return false;
      const isSameDay = m.date.toDateString() === newMeeting.date.toDateString();
      if (!isSameDay) return false;
      
      const [mHours, mMinutes] = m.time.match(/\d+/g);
      const mTime = parseInt(mHours) * 60 + parseInt(mMinutes);
      const [nHours, nMinutes] = newMeeting.time.match(/\d+/g);
      const nTime = parseInt(nHours) * 60 + parseInt(nMinutes);
      
      return Math.abs(mTime - nTime) < 60;
    });
  }, [meetings]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      <Header 
        view={view}
        setView={setView}
        onNewMeeting={() => setShowCreateModal(true)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        filterPlatform={filterPlatform}
        setFilterPlatform={setFilterPlatform}
        onExport={exportToCSV}
        isZoomAuthenticated={isZoomAuthenticated}
        onConnectZoom={handleConnectZoom}
        onDisconnectZoom={handleDisconnectZoom}
        currentUser={currentUser}
        onGoogleSignIn={handleGoogleSignIn}
        onSignOut={handleSignOut}
        showMobileMenu={showMobileMenu}
        setShowMobileMenu={setShowMobileMenu}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {!currentUser ? (
          <div className="flex items-center justify-center min-h-[60vh] px-4">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <User className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-semibold mb-2 sm:mb-3">Welcome to Meeting Scheduler</h2>
              <p className="text-sm sm:text-base text-gray-400 mb-4 sm:mb-6 px-4">Sign in with Google to create meetings, connect your Zoom account, and send calendar invites</p>
              <button
                onClick={handleGoogleSignIn}
                className="px-5 sm:px-6 py-2.5 sm:py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-all inline-flex items-center gap-2 sm:gap-3 text-sm sm:text-base"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z" fill="#34A853"/>
                  <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.002 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </button>
            </div>
          </div>
        ) : (
          <>
            {view === VIEWS.MONTH && (
              <MonthView
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                meetings={filteredMeetings}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                onDelete={deleteMeeting}
                onEdit={handleEditMeeting}
                onCopyLink={copyMeetingLink}
                onJoinMeeting={handleJoinMeeting}
                copiedId={copiedId}
              />
            )}
            
            {view === VIEWS.WEEK && (
              <WeekView
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                meetings={filteredMeetings}
                onDelete={deleteMeeting}
                onEdit={handleEditMeeting}
              />
            )}
            
            {view === VIEWS.DAY && (
              <DayView
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                meetings={filteredMeetings}
                onDelete={deleteMeeting}
                onEdit={handleEditMeeting}
              />
            )}
            
            {view === VIEWS.AGENDA && (
              <AgendaView
                meetings={filteredMeetings}
                onDelete={deleteMeeting}
                onEdit={handleEditMeeting}
                onCopyLink={copyMeetingLink}
                onJoinMeeting={handleJoinMeeting}
                copiedId={copiedId}
              />
            )}
          </>
        )}
      </main>

      {showCreateModal && (
        <MeetingModal
          onClose={() => setShowCreateModal(false)}
          onSave={addMeeting}
          selectedDate={selectedDate}
          currentDate={currentDate}
          checkConflicts={checkConflicts}
          isZoomAuthenticated={isZoomAuthenticated}
          canSendEmails={!!googleToken}
          userEmail={currentUser?.email}
        />
      )}

      {showEditModal && editingMeeting && (
        <MeetingModal
          meeting={editingMeeting}
          onClose={() => {
            setShowEditModal(false);
            setEditingMeeting(null);
          }}
          onSave={updateMeeting}
          checkConflicts={checkConflicts}
          isZoomAuthenticated={isZoomAuthenticated}
          canSendEmails={!!googleToken}
          isEdit
        />
      )}
    </div>
  );
}

function Header({ view, setView, onNewMeeting, searchQuery, setSearchQuery, showFilters, setShowFilters, filterPlatform, setFilterPlatform, onExport, isZoomAuthenticated, onConnectZoom, onDisconnectZoom, currentUser, onGoogleSignIn, onSignOut, showMobileMenu, setShowMobileMenu }) {
  return (
    <header className="border-b border-gray-700/50 backdrop-blur-sm bg-gray-900/50 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
        {/* Mobile Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-light tracking-tight">
                Meeting <span className="font-semibold">Scheduler</span>
              </h1>
              {currentUser && (
                <p className="text-xs text-gray-400 hidden sm:block">{currentUser.email}</p>
              )}
            </div>
          </div>
          
          <div className="flex gap-2">
            {/* Desktop Actions */}
            <div className="hidden lg:flex gap-3">
              {!currentUser ? (
                <button 
                  onClick={onGoogleSignIn}
                  className="px-4 py-2 bg-white text-gray-900 rounded-lg transition-all flex items-center gap-2 font-medium hover:bg-gray-100"
                >
                  <LogIn className="w-4 h-4" />
                  Sign in
                </button>
              ) : (
                <>
                  {isZoomAuthenticated ? (
                    <button 
                      onClick={onDisconnectZoom}
                      className="px-4 py-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-all flex items-center gap-2 text-sm"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="hidden xl:inline">Disconnect Zoom</span>
                    </button>
                  ) : (
                    <button 
                      onClick={onConnectZoom}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-all flex items-center gap-2 text-sm"
                    >
                      <Video className="w-4 h-4" />
                      <span className="hidden xl:inline">Connect Zoom</span>
                    </button>
                  )}
                  <button 
                    onClick={onExport}
                    className="px-4 py-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-all flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={onSignOut}
                    className="p-2 hover:bg-gray-700/50 rounded-lg transition-all"
                    title="Sign out"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {/* Mobile New Meeting + Menu */}
            {currentUser && (
              <>
                <button 
                  onClick={onNewMeeting}
                  className="px-3 sm:px-5 py-2 sm:py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg shadow-indigo-900/50 text-sm sm:text-base"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">New Meeting</span>
                </button>
                <button 
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className="lg:hidden p-2 hover:bg-gray-700/50 rounded-lg transition-all"
                >
                  <Menu className="w-5 h-5" />
                </button>
              </>
            )}
            
            {!currentUser && (
              <button 
                onClick={onGoogleSignIn}
                className="lg:hidden px-3 py-2 bg-white text-gray-900 rounded-lg transition-all flex items-center gap-2 text-sm"
              >
                <LogIn className="w-4 h-4" />
                Sign in
              </button>
            )}
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {showMobileMenu && currentUser && (
          <div className="lg:hidden mt-3 pb-3 border-t border-gray-700/50 pt-3 space-y-2">
            {isZoomAuthenticated ? (
              <button 
                onClick={() => { onDisconnectZoom(); setShowMobileMenu(false); }}
                className="w-full px-4 py-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-all flex items-center gap-2 text-sm"
              >
                <LogOut className="w-4 h-4" />
                Disconnect Zoom
              </button>
            ) : (
              <button 
                onClick={() => { onConnectZoom(); setShowMobileMenu(false); }}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-all flex items-center gap-2 text-sm"
              >
                <Video className="w-4 h-4" />
                Connect Zoom
              </button>
            )}
            <button 
              onClick={() => { onExport(); setShowMobileMenu(false); }}
              className="w-full px-4 py-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-all flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={() => { onSignOut(); setShowMobileMenu(false); }}
              className="w-full px-4 py-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-all flex items-center gap-2 text-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        )}

        {currentUser && (
          <div className="mt-3 sm:mt-4 space-y-3">
            {/* View Toggle */}
            <div className="flex gap-2 bg-gray-800/50 rounded-lg p-1 overflow-x-auto">
              {Object.entries(VIEWS).map(([key, value]) => (
                <button
                  key={value}
                  onClick={() => setView(value)}
                  className={`px-3 sm:px-4 py-2 rounded-md transition-all capitalize whitespace-nowrap text-sm ${
                    view === value ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>

            {/* Search and Filter Row */}
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-2 rounded-lg transition-all ${showFilters ? 'bg-indigo-600' : 'bg-gray-800/50 hover:bg-gray-700/50'}`}
                >
                  <Filter className="w-5 h-5" />
                </button>
                
                {showFilters && (
                  <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-3 space-y-2">
                    <div className="text-sm font-medium mb-2">Filter by Platform</div>
                    {['all', 'zoom', 'teams', 'meet'].map(platform => (
                      <button
                        key={platform}
                        onClick={() => { setFilterPlatform(platform); setShowFilters(false); }}
                        className={`w-full text-left px-3 py-2 rounded-md transition-all capitalize ${
                          filterPlatform === platform ? 'bg-indigo-600' : 'hover:bg-gray-700/50'
                        }`}
                      >
                        {platform}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

function MeetingModal({ meeting, onClose, onSave, selectedDate, currentDate, checkConflicts, isZoomAuthenticated, canSendEmails, userEmail, isEdit }) {
  const [formData, setFormData] = useState(meeting || {
    title: '',
    date: selectedDate ? new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDate) : new Date(),
    time: '09:00',
    duration: '30 min',
    platform: 'zoom',
    participants: '',
    location: 'Virtual',
    description: '',
    recurring: false,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'
  });
  
  const [sendInvites, setSendInvites] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const foundConflicts = checkConflicts(formData);
    setConflicts(foundConflicts);
    setShowConflictWarning(foundConflicts.length > 0);
  }, [formData.date, formData.time, checkConflicts]);

  const handleSave = async () => {
    if (!formData.title) {
      alert('Please enter a meeting title');
      return;
    }
    
    setIsCreating(true);
    
    try {
      const [hours, minutes] = formData.time.split(':');
      const meetingDate = new Date(formData.date);
      meetingDate.setHours(parseInt(hours), parseInt(minutes));
      
      const meeting = {
        ...formData,
        date: meetingDate,
        time: new Date(meetingDate).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        }),
        participants: typeof formData.participants === 'string' 
          ? formData.participants.split(',').map(p => p.trim()).filter(p => p)
          : formData.participants
      };
      
      await onSave(meeting, sendInvites);
    } catch (error) {
      console.error('Error saving meeting:', error);
      alert('Failed to save meeting');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-700/50 w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700/50 p-4 sm:p-6 flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-semibold">{isEdit ? 'Edit Meeting' : 'Create New Meeting'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-700/50 rounded-lg transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {showConflictWarning && (
            <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-yellow-400">Scheduling Conflict</div>
                <div className="text-sm text-yellow-300/80 mt-1">
                  This time overlaps with {conflicts.length} other meeting{conflicts.length > 1 ? 's' : ''}
                </div>
              </div>
            </div>
          )}



          <div>
            <label className="block text-sm font-medium mb-2">Meeting Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., Team Standup"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Date</label>
              <input
                type="date"
                value={formData.date.toISOString().split('T')[0]}
                onChange={(e) => setFormData({...formData, date: new Date(e.target.value)})}
                className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Time</label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({...formData, time: e.target.value})}
                className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Timezone</label>
            <select
              value={formData.timezone}
              onChange={(e) => setFormData({...formData, timezone: e.target.value})}
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {Object.entries(TIMEZONES).map(([region, zones]) => (
                <optgroup key={region} label={region}>
                  {zones.map(tz => (
                    <option key={tz} value={tz}>
                      {tz.replace(/_/g, ' ')}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Current selection: {formData.timezone.replace(/_/g, ' ')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Duration</label>
              <select
                value={formData.duration}
                onChange={(e) => setFormData({...formData, duration: e.target.value})}
                className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option>15 min</option>
                <option>30 min</option>
                <option>45 min</option>
                <option>1 hour</option>
                <option>1.5 hours</option>
                <option>2 hours</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.recurring}
                  onChange={(e) => setFormData({...formData, recurring: e.target.checked})}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700/50 focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-sm">Recurring Meeting</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Meeting Platform</label>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {Object.entries(PLATFORMS).map(([key, platform]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFormData({...formData, platform: key})}
                  className={`p-3 sm:p-4 rounded-lg border-2 transition-all ${
                    formData.platform === key
                      ? `${platform.borderColor} ${platform.bgColor}`
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <Video className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2" />
                  <span className="text-xs sm:text-sm font-medium">{platform.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Participants</label>
            <input
              type="text"
              value={typeof formData.participants === 'string' ? formData.participants : formData.participants.join(', ')}
              onChange={(e) => setFormData({...formData, participants: e.target.value})}
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="email1@example.com, email2@example.com"
            />
            <p className="text-xs text-gray-500 mt-1">Separate emails with commas</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows="3"
              placeholder="Meeting agenda or notes..."
            />
          </div>

          {!isEdit && canSendEmails && (
            <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendInvites}
                  onChange={(e) => setSendInvites(e.target.checked)}
                  className="w-5 h-5 mt-0.5 rounded border-gray-600 bg-gray-700/50 focus:ring-2 focus:ring-indigo-500"
                />
                <div>
                  <div className="font-medium text-green-400">Send email invites to participants</div>
                  <div className="text-sm text-green-300/80 mt-1">
                    Calendar invites will be sent from {userEmail}
                  </div>
                </div>
              </label>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              onClick={onClose}
              className="w-full px-6 py-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg font-medium transition-all"
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isCreating}
              className="w-full px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-lg font-medium transition-all shadow-lg shadow-indigo-900/50 disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : isEdit ? 'Update Meeting' : 'Create Meeting'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// MonthView, WeekView, DayView, AgendaView components remain the same...
function MonthView({ currentDate, setCurrentDate, meetings, selectedDate, setSelectedDate, onDelete, onEdit, onCopyLink, onJoinMeeting, copiedId }) {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  
  const getMeetingsForDate = useCallback((day) => {
    return meetings.filter(meeting => 
      meeting.date.getDate() === day &&
      meeting.date.getMonth() === currentDate.getMonth() &&
      meeting.date.getFullYear() === currentDate.getFullYear()
    );
  }, [meetings, currentDate]);

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Calendar */}
      <div className="w-full">
        <div className="bg-gray-800/40 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-semibold">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <div className="flex gap-2">
              <button onClick={prevMonth} className="p-2 hover:bg-gray-700/50 rounded-lg transition-all">
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button onClick={nextMonth} className="p-2 hover:bg-gray-700/50 rounded-lg transition-all">
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs sm:text-sm font-medium text-gray-400 py-2">
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{day.charAt(0)}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayMeetings = getMeetingsForDate(day);
              const isToday = 
                day === new Date().getDate() &&
                currentDate.getMonth() === new Date().getMonth() &&
                currentDate.getFullYear() === new Date().getFullYear();
              
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(day)}
                  className={`aspect-square p-1 sm:p-2 rounded-lg transition-all relative touch-manipulation ${
                    isToday ? 'bg-indigo-600/20 border-2 border-indigo-500' : 'hover:bg-gray-700/30'
                  } ${selectedDate === day ? 'ring-2 ring-indigo-500' : ''}`}
                >
                  <span className={`text-xs sm:text-sm ${isToday ? 'font-bold text-indigo-400' : ''}`}>{day}</span>
                  {dayMeetings.length > 0 && (
                    <div className="absolute bottom-0.5 sm:bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                      {dayMeetings.slice(0, 3).map((m, i) => (
                        <div key={i} className={`w-1 h-1 rounded-full ${
                          m.platform === 'zoom' ? 'bg-blue-400' :
                          m.platform === 'teams' ? 'bg-purple-400' : 'bg-green-400'
                        }`} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Side Panel - Now below calendar on mobile, side on desktop */}
      {selectedDate && (
        <div className="w-full">
          <div className="bg-gray-800/40 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-semibold mb-4">
              {monthNames[currentDate.getMonth()]} {selectedDate}
            </h3>
            
            <div className="space-y-3">
              {getMeetingsForDate(selectedDate).map(meeting => (
                <MeetingCard 
                  key={meeting.id} 
                  meeting={meeting} 
                  onDelete={onDelete} 
                  onEdit={onEdit}
                  onCopyLink={onCopyLink}
                  onJoinMeeting={onJoinMeeting}
                  copiedId={copiedId}
                />
              ))}
              {getMeetingsForDate(selectedDate).length === 0 && (
                <p className="text-gray-500 text-center py-8">No meetings scheduled</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MeetingCard({ meeting, onDelete, onEdit, onCopyLink, onJoinMeeting, copiedId }) {
  const platform = PLATFORMS[meeting.platform];

  return (
    <div className="bg-gray-700/30 rounded-lg p-3 sm:p-4 border border-gray-600/30 hover:border-gray-500/50 transition-all">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-sm sm:text-base">{meeting.title}</h4>
        <div className="flex gap-1">
          <div className={`p-1 sm:p-1.5 rounded bg-gradient-to-br ${platform.color} flex-shrink-0`}>
            <Video className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
          </div>
          <button
            onClick={() => onCopyLink(meeting.id, meeting.meetingLink)}
            className="p-1 sm:p-1.5 rounded bg-gray-600/30 hover:bg-gray-600/50 transition-all touch-manipulation"
          >
            {copiedId === meeting.id ? <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-green-400" /> : <Copy className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
          </button>
          <button
            onClick={() => onEdit(meeting)}
            className="p-1 sm:p-1.5 rounded bg-gray-600/30 hover:bg-gray-600/50 transition-all touch-manipulation"
          >
            <Edit className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          </button>
          <button
            onClick={() => onDelete(meeting.id)}
            className="p-1 sm:p-1.5 rounded bg-red-500/20 hover:bg-red-500/30 transition-all touch-manipulation"
          >
            <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-red-400" />
          </button>
        </div>
      </div>
      <p className="text-xs sm:text-sm text-gray-400 mb-1">{meeting.time} • {meeting.duration}</p>
      {meeting.timezone && (
        <p className="text-xs text-gray-500 mb-2">
          {meeting.timezone.replace(/_/g, ' ')}
        </p>
      )}
      <p className="text-xs text-gray-500 mb-3 line-clamp-2">{meeting.description}</p>
      <button 
        onClick={() => onJoinMeeting(meeting.meetingLink)}
        className={`w-full py-2 rounded-lg bg-gradient-to-r ${platform.color} text-white text-xs sm:text-sm font-medium hover:opacity-90 transition-all touch-manipulation`}
      >
        Join {platform.name}
      </button>
    </div>
  );
}

function WeekView({ currentDate, setCurrentDate, meetings, onDelete, onEdit }) {
  const weekStart = new Date(currentDate);
  weekStart.setDate(currentDate.getDate() - currentDate.getDay());
  
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    return day;
  });

  const getMeetingsForDay = (day) => {
    return meetings.filter(m => m.date.toDateString() === day.toDateString());
  };

  const prevWeek = () => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)));
  const nextWeek = () => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)));

  return (
    <div className="bg-gray-800/40 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-semibold">Week View</h2>
        <div className="flex gap-2">
          <button onClick={prevWeek} className="p-2 hover:bg-gray-700/50 rounded-lg transition-all">
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button onClick={nextWeek} className="p-2 hover:bg-gray-700/50 rounded-lg transition-all">
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
        {weekDays.map((day, i) => {
          const dayMeetings = getMeetingsForDay(day);
          const isToday = day.toDateString() === new Date().toDateString();
          
          return (
            <div key={i} className={`border rounded-lg p-2 sm:p-3 ${isToday ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-700'}`}>
              <div className="text-center mb-2 sm:mb-3">
                <div className="text-xs text-gray-400">
                  <span className="hidden sm:inline">{day.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                  <span className="sm:hidden">{day.toLocaleDateString('en-US', { weekday: 'narrow' })}</span>
                </div>
                <div className={`text-lg sm:text-2xl font-semibold ${isToday ? 'text-indigo-400' : ''}`}>{day.getDate()}</div>
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                {dayMeetings.map(meeting => (
                  <div key={meeting.id} className={`bg-gradient-to-r ${PLATFORMS[meeting.platform].color} rounded p-1.5 sm:p-2 text-xs`}>
                    <div className="font-medium text-white truncate">{meeting.title}</div>
                    <div className="text-white/80 text-xs sm:text-xs">{meeting.time}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayView({ currentDate, setCurrentDate, meetings, onDelete, onEdit }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const dayMeetings = meetings.filter(m => m.date.toDateString() === currentDate.toDateString());
  
  const prevDay = () => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 1)));
  const nextDay = () => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 1)));

  return (
    <div className="bg-gray-800/40 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-base sm:text-2xl font-semibold">
          {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </h2>
        <div className="flex gap-2">
          <button onClick={prevDay} className="p-2 hover:bg-gray-700/50 rounded-lg transition-all">
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button onClick={nextDay} className="p-2 hover:bg-gray-700/50 rounded-lg transition-all">
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      <div className="space-y-1">
        {hours.map(hour => {
          const hourMeetings = dayMeetings.filter(m => {
            const meetingHour = parseInt(m.time.split(':')[0]);
            const isPM = m.time.includes('PM');
            const hour24 = isPM && meetingHour !== 12 ? meetingHour + 12 : meetingHour;
            return hour24 === hour;
          });

          return (
            <div key={hour} className="flex border-t border-gray-700/30">
              <div className="w-14 sm:w-20 py-2 text-xs sm:text-sm text-gray-400">
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </div>
              <div className="flex-1 py-2 pl-2 sm:pl-4">
                {hourMeetings.map(meeting => (
                  <div key={meeting.id} className={`bg-gradient-to-r ${PLATFORMS[meeting.platform].color} rounded-lg p-2 sm:p-3 mb-2`}>
                    <div className="font-medium text-white text-sm sm:text-base">{meeting.title}</div>
                    <div className="text-xs sm:text-sm text-white/80">{meeting.time} - {meeting.duration}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaView({ meetings, onDelete, onEdit, onCopyLink, onJoinMeeting, copiedId }) {
  const sortedMeetings = [...meetings].sort((a, b) => a.date - b.date);
  const groupedByDate = sortedMeetings.reduce((acc, meeting) => {
    const dateKey = meeting.date.toDateString();
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(meeting);
    return acc;
  }, {});

  return (
    <div className="bg-gray-800/40 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-4 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6">Agenda View</h2>
      
      <div className="space-y-4 sm:space-y-6">
        {Object.entries(groupedByDate).map(([date, dateMeetings]) => (
          <div key={date}>
            <h3 className="text-base sm:text-lg font-medium mb-3 text-gray-300">
              {new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </h3>
            <div className="space-y-3">
              {dateMeetings.map(meeting => (
                <MeetingListItem 
                  key={meeting.id} 
                  meeting={meeting}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onCopyLink={onCopyLink}
                  onJoinMeeting={onJoinMeeting}
                  copiedId={copiedId}
                />
              ))}
            </div>
          </div>
        ))}
        
        {meetings.length === 0 && (
          <p className="text-gray-500 text-center py-12">No meetings scheduled</p>
        )}
      </div>
    </div>
  );
}

function MeetingListItem({ meeting, onDelete, onEdit, onCopyLink, onJoinMeeting, copiedId }) {
  const platform = PLATFORMS[meeting.platform];
  
  return (
    <div className="bg-gray-700/30 rounded-lg p-3 sm:p-4 border border-gray-600/30 hover:border-gray-500/50 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-3 sm:gap-4 flex-1">
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br ${platform.color} flex items-center justify-center flex-shrink-0`}>
            <Video className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-base sm:text-lg truncate">{meeting.title}</h3>
            <p className="text-sm text-gray-400 mt-1">
              {meeting.time} • {meeting.duration}
              {meeting.recurring && <span className="ml-2 text-xs bg-gray-700 px-2 py-0.5 rounded">Recurring</span>}
            </p>
            {meeting.timezone && (
              <p className="text-xs text-gray-500 mt-1">
                {meeting.timezone.replace(/_/g, ' ')}
              </p>
            )}
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{meeting.description}</p>
            <div className="flex items-center gap-2 mt-2">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">{meeting.participants.length} participants</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 sm:ml-4">
          <button
            onClick={() => onCopyLink(meeting.id, meeting.meetingLink)}
            className="p-2 hover:bg-gray-700/50 rounded-lg transition-all touch-manipulation"
            title="Copy meeting link"
          >
            {copiedId === meeting.id ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onEdit(meeting)}
            className="p-2 hover:bg-gray-700/50 rounded-lg transition-all touch-manipulation"
            title="Edit meeting"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(meeting.id)}
            className="p-2 hover:bg-red-500/20 rounded-lg transition-all touch-manipulation"
            title="Delete meeting"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>
      
      <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-700/50">
        <button 
          onClick={() => onJoinMeeting(meeting.meetingLink)}
          className={`w-full py-2.5 sm:py-2 rounded-lg bg-gradient-to-r ${platform.color} text-white font-medium hover:opacity-90 transition-all touch-manipulation text-sm sm:text-base`}
        >
          Join {platform.name} Meeting
        </button>
      </div>
    </div>
  );
}

function generateMeetingLink(platform) {
  const id = Math.random().toString(36).substring(7);
  switch(platform) {
    case 'zoom':
      return `https://zoom.us/j/${Math.floor(Math.random() * 1000000000)}`;
    case 'teams':
      return `https://teams.microsoft.com/l/meetup-join/${id}`;
    case 'meet':
      return `https://meet.google.com/${id}`;
    default:
      return '';
  }
}