import React, { useState, useEffect } from 'react';
// Lucide icons from global window object
const { Calendar, Target, Users, Brain, Activity, ChevronRight, Check, X, Plus, BarChart3, TrendingUp, Clock, BookOpen, Map, LogOut, Loader } = lucide;

// Supabase client setup
const SUPABASE_URL = 'https://gjxrzgvfloqjlonuryrw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqeHJ6Z3ZmbG9xamxvbnVyeXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUwNTYzMTAsImV4cCI6MjA1MDYzMjMxMH0.8xtkLenKWNV0X_FaZZTzTJMjHgmVnJ15_rkHiX2lJjA';

// Simple Supabase client
class SupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
    this.headers = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    };
    this.session = JSON.parse(localStorage.getItem('sb-session') || 'null');
  }

  async signUp(email, password) {
    try {
      const response = await fetch(`${this.url}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'apikey': this.key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          email, 
          password,
          options: {
            emailRedirectTo: window.location.origin
          }
        })
      });
      const data = await response.json();
      
      if (!response.ok) {
        return { error: data };
      }
      
      if (data.session) {
        this.session = data.session;
        localStorage.setItem('sb-session', JSON.stringify(data.session));
        this.headers['Authorization'] = `Bearer ${data.session.access_token}`;
        return { user: data.user, session: data.session };
      }
      
      return data;
    } catch (error) {
      return { error: { message: error.message } };
    }
  }

  async signIn(email, password) {
    try {
      const response = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': this.key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return { error: data };
      }
      
      if (data.access_token) {
        this.session = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          user: data.user
        };
        localStorage.setItem('sb-session', JSON.stringify(this.session));
        this.headers['Authorization'] = `Bearer ${data.access_token}`;
        return { user: data.user, session: this.session };
      }
      
      return { error: { message: 'Invalid response from server' } };
    } catch (error) {
      return { error: { message: error.message } };
    }
  }

  async signOut() {
    if (this.session?.access_token) {
      await fetch(`${this.url}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          ...this.headers,
          'Authorization': `Bearer ${this.session.access_token}`
        }
      });
    }
    this.session = null;
    localStorage.removeItem('sb-session');
  }

  getUser() {
    return this.session?.user || null;
  }

  async from(table) {
    return {
      select: async (columns = '*') => {
        const response = await fetch(`${this.url}/rest/v1/${table}?select=${columns}`, {
          headers: {
            ...this.headers,
            'Authorization': `Bearer ${this.session?.access_token || this.key}`
          }
        });
        const data = await response.json();
        return { data, error: response.ok ? null : data };
      },
      insert: async (data) => {
        const response = await fetch(`${this.url}/rest/v1/${table}`, {
          method: 'POST',
          headers: {
            ...this.headers,
            'Authorization': `Bearer ${this.session?.access_token || this.key}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(data)
        });
        const result = await response.json();
        return { data: result, error: response.ok ? null : result };
      },
      update: async (data) => {
        return {
          eq: async (column, value) => {
            const response = await fetch(`${this.url}/rest/v1/${table}?${column}=eq.${value}`, {
              method: 'PATCH',
              headers: {
                ...this.headers,
                'Authorization': `Bearer ${this.session?.access_token || this.key}`,
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(data)
            });
            const result = await response.json();
            return { data: result, error: response.ok ? null : result };
          }
        };
      },
      upsert: async (data) => {
        const response = await fetch(`${this.url}/rest/v1/${table}`, {
          method: 'POST',
          headers: {
            ...this.headers,
            'Authorization': `Bearer ${this.session?.access_token || this.key}`,
            'Prefer': 'return=representation,resolution=merge-duplicates'
          },
          body: JSON.stringify(data)
        });
        const result = await response.json();
        return { data: result, error: response.ok ? null : result };
      },
      delete: async () => {
        return {
          eq: async (column, value) => {
            const response = await fetch(`${this.url}/rest/v1/${table}?${column}=eq.${value}`, {
              method: 'DELETE',
              headers: {
                ...this.headers,
                'Authorization': `Bearer ${this.session?.access_token || this.key}`
              }
            });
            return { error: response.ok ? null : await response.json() };
          }
        };
      }
    };
  }
}

const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Auth Component
const AuthScreen = ({ onAuthenticated }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email || !password) return;
    
    setLoading(true);
    setError('');

    try {
      let result;
      if (isLogin) {
        result = await supabase.signIn(email, password);
      } else {
        result = await supabase.signUp(email, password);
      }

      console.log('Auth result:', result); // Debug log

      if (result.error) {
        if (result.error.message) {
          setError(result.error.message);
        } else if (typeof result.error === 'string') {
          setError(result.error);
        } else {
          setError('Authentication failed. Please check your credentials.');
        }
      } else if (result.user) {
        // Success!
        onAuthenticated();
      } else if (!isLogin) {
        setError('Account created! Check your email to confirm your account.');
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-100">🎯 System Beta</h1>
          <p className="text-gray-400 mt-2">Momentum over perfection</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder-gray-400"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder-gray-400"
              placeholder="••••••••"
            />
          </div>

          {!isLogin && password && password.length < 6 && (
            <p className="text-xs text-gray-400">Password must be at least 6 characters</p>
          )}

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !email || !password || password.length < 6}
            className="w-full py-3 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all"
          >
            {loading ? (
              <Loader className="animate-spin" size={20} />
            ) : (
              isLogin ? 'Sign In' : 'Create Account'
            )}
          </button>

          <div className="text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-gray-400 hover:text-gray-200 text-sm"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-gray-500">
          Your data is private and synced across all devices
        </div>
      </div>
    </div>
  );
};

const SystemBetaDashboard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // State management
  const [dailyLogs, setDailyLogs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [weeklyPlans, setWeeklyPlans] = useState([]);
  const [timeBlocksData, setTimeBlocksData] = useState({});

  const [showDailyLog, setShowDailyLog] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showWeeklyPlan, setShowWeeklyPlan] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [syncStatus, setSyncStatus] = useState('synced'); // 'syncing', 'synced', 'error'
  
  // Today's date
  const today = new Date().toISOString().split('T')[0];
  const todayLog = dailyLogs.find(log => log.date === today);

  // Get current week start date
  const getWeekStart = () => {
    const date = new Date();
    const day = date.getDay();
    const diff = date.getDate() - day;
    return new Date(date.setDate(diff)).toISOString().split('T')[0];
  };

  const currentWeekStart = getWeekStart();
  const currentWeekPlan = weeklyPlans.find(plan => plan.week_start === currentWeekStart);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const savedSession = localStorage.getItem('sb-session');
        if (savedSession) {
          const session = JSON.parse(savedSession);
          if (session && session.user) {
            setUser(session.user);
            supabase.session = session;
            supabase.headers['Authorization'] = `Bearer ${session.access_token}`;
            await loadUserData();
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Load user data from Supabase
  const loadUserData = async () => {
    setSyncStatus('syncing');
    
    try {
      // Load daily logs
      const { data: logs, error: logsError } = await supabase.from('daily_logs').select('*');
      if (!logsError && logs) {
        setDailyLogs(logs);
      }

      // Load projects
      const { data: projectsData, error: projectsError } = await supabase.from('projects').select('*');
      if (!projectsError && projectsData) {
        setProjects(projectsData);
      }

      // Load weekly plans
      const { data: plansData, error: plansError } = await supabase.from('weekly_plans').select('*');
      if (!plansError && plansData) {
        setWeeklyPlans(plansData);
      }

      // Load time blocks for today
      const { data: blocksData, error: blocksError } = await supabase.from('time_blocks').select('*').eq('date', today);
      if (!blocksError && blocksData && blocksData.length > 0) {
        setTimeBlocksData({ [today]: blocksData[0].blocks });
      }

      setSyncStatus('synced');
    } catch (error) {
      console.error('Error loading data:', error);
      setSyncStatus('error');
    }
  };

  const handleSignOut = async () => {
    await supabase.signOut();
    setUser(null);
    setDailyLogs([]);
    setProjects([]);
    setWeeklyPlans([]);
    setTimeBlocksData({});
  };

  // Time Block View Component
  const TimeBlockView = () => {
    const [timeBlocks, setTimeBlocks] = useState(() => {
      return timeBlocksData[today] || [
        { id: 1, start: '05:00', end: '07:00', activity: 'Morning Routine + Protein', type: 'routine', pillar: 'Constitution' },
        { id: 2, start: '07:00', end: '09:00', activity: 'Deep Work Block', type: 'deepWork', pillar: 'Craft' },
        { id: 3, start: '09:00', end: '10:00', activity: 'Admin/Email', type: 'shallow', pillar: 'Community' },
        { id: 4, start: '10:00', end: '11:00', activity: 'Walk + Contemplation', type: 'routine', pillar: 'Contemplation' },
      ];
    });

    const saveTimeBlocks = async (blocks) => {
      setSyncStatus('syncing');
      const { error } = await supabase.from('time_blocks').upsert({
        user_id: user.id,
        date: today,
        blocks: blocks
      });
      
      if (!error) {
        setTimeBlocksData({ ...timeBlocksData, [today]: blocks });
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
      }
    };

    const addTimeBlock = () => {
      const newBlock = {
        id: Date.now(),
        start: '12:00',
        end: '13:00',
        activity: '',
        type: 'shallow',
        pillar: 'Craft'
      };
      const updated = [...timeBlocks, newBlock];
      setTimeBlocks(updated);
      saveTimeBlocks(updated);
    };

    const updateBlock = (id, field, value) => {
      const updated = timeBlocks.map(block => 
        block.id === id ? { ...block, [field]: value } : block
      );
      setTimeBlocks(updated);
      saveTimeBlocks(updated);
    };

    const deleteBlock = (id) => {
      const updated = timeBlocks.filter(block => block.id !== id);
      setTimeBlocks(updated);
      saveTimeBlocks(updated);
    };

    const typeColors = {
      deepWork: 'bg-purple-900/30 border-purple-500/50',
      shallow: 'bg-gray-800/30 border-gray-600/50',
      routine: 'bg-green-900/30 border-green-500/50'
    };

    return (
      <div className="bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center text-gray-100">
            <Clock className="mr-2" size={24} />
            Today's Time Blocks - {new Date().toLocaleDateString()}
          </h2>
          <button
            onClick={addTimeBlock}
            className="text-blue-400 hover:text-blue-300"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="space-y-2">
          {timeBlocks.sort((a, b) => a.start.localeCompare(b.start)).map(block => (
            <div key={block.id} className={`border-2 rounded-lg p-3 ${typeColors[block.type]}`}>
              <div className="flex items-center space-x-3">
                <input
                  type="time"
                  value={block.start}
                  onChange={(e) => updateBlock(block.id, 'start', e.target.value)}
                  className="text-sm bg-gray-700 text-gray-100 rounded px-2 py-1"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="time"
                  value={block.end}
                  onChange={(e) => updateBlock(block.id, 'end', e.target.value)}
                  className="text-sm bg-gray-700 text-gray-100 rounded px-2 py-1"
                />
                <input
                  type="text"
                  value={block.activity}
                  onChange={(e) => updateBlock(block.id, 'activity', e.target.value)}
                  placeholder="Activity"
                  className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder-gray-400"
                />
                <select
                  value={block.type}
                  onChange={(e) => updateBlock(block.id, 'type', e.target.value)}
                  className="text-sm px-2 py-1 bg-gray-700 border border-gray-600 rounded text-gray-100"
                >
                  <option value="deepWork">Deep Work</option>
                  <option value="shallow">Shallow</option>
                  <option value="routine">Routine</option>
                </select>
                <button
                  onClick={() => deleteBlock(block.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded">
          <p className="text-sm text-blue-300">
            <strong>Newport's Rule:</strong> Schedule every minute of your day. Deep work blocks are sacred - protect them ruthlessly.
          </p>
        </div>
      </div>
    );
  };

  // Weekly Planning Component
  const WeeklyPlanForm = () => {
    const [formData, setFormData] = useState(currentWeekPlan || {
      week_start: currentWeekStart,
      top_priorities: ['', '', ''],
      pillar_goals: {
        Craft: '',
        Community: '',
        Constitution: '',
        Contemplation: ''
      },
      weekly_reflection: ''
    });

    const handleSubmit = async () => {
      setSyncStatus('syncing');
      
      const { error } = await supabase.from('weekly_plans').upsert({
        ...formData,
        user_id: user.id
      });

      if (!error) {
        await loadUserData();
        setShowWeeklyPlan(false);
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
        <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <h2 className="text-2xl font-bold mb-6 text-gray-100">Weekly Plan - Week of {new Date(currentWeekStart).toLocaleDateString()}</h2>
          
          <div className="space-y-6">
            {/* Top 3 Priorities */}
            <div>
              <h3 className="font-semibold mb-3 text-gray-200">Top 3 Priorities This Week</h3>
              {[0, 1, 2].map(i => (
                <input
                  key={i}
                  type="text"
                  placeholder={`Priority ${i + 1}`}
                  value={formData.top_priorities[i]}
                  onChange={(e) => {
                    const newPriorities = [...formData.top_priorities];
                    newPriorities[i] = e.target.value;
                    setFormData({...formData, top_priorities: newPriorities});
                  }}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded mb-2 text-gray-100 placeholder-gray-400"
                />
              ))}
            </div>

            {/* Pillar Goals */}
            <div>
              <h3 className="font-semibold mb-3 text-gray-200">Goals by Pillar</h3>
              {Object.keys(formData.pillar_goals).map(pillar => (
                <div key={pillar} className="mb-3">
                  <label className="block text-sm font-medium mb-1 text-gray-300">{pillar}</label>
                  <input
                    type="text"
                    value={formData.pillar_goals[pillar]}
                    onChange={(e) => setFormData({
                      ...formData,
                      pillar_goals: {...formData.pillar_goals, [pillar]: e.target.value}
                    })}
                    placeholder={`What will you accomplish in ${pillar}?`}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder-gray-400"
                  />
                </div>
              ))}
            </div>

            {/* Weekly Reflection */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-300">Weekly Reflection (End of Week)</label>
              <textarea
                value={formData.weekly_reflection}
                onChange={(e) => setFormData({...formData, weekly_reflection: e.target.value})}
                placeholder="What worked? What didn't? What will you adjust?"
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded h-24 text-gray-100 placeholder-gray-400"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowWeeklyPlan(false)}
                className="px-4 py-2 text-gray-300 hover:text-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
              >
                Save Weekly Plan
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Daily Log Form Component
  const DailyLogForm = () => {
    const [formData, setFormData] = useState(todayLog || {
      date: today,
      energy_am: 5,
      protein_breakfast: false,
      mit1: '',
      mit2: '',
      mit3: '',
      pillar_focus: 'Craft',
      walked: false,
      water: false,
      stress_level: 5,
      win_today: '',
      athlete_activated: false,
      tomorrows_one_thing: '',
      deep_work_hours: 0
    });

    const handleSubmit = async () => {
      setSyncStatus('syncing');
      
      const { error } = await supabase.from('daily_logs').upsert({
        ...formData,
        user_id: user.id
      });

      if (!error) {
        await loadUserData();
        setShowDailyLog(false);
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
        <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <h2 className="text-2xl font-bold mb-6 text-gray-100">Daily Log - {new Date().toLocaleDateString()}</h2>
          
          <div className="space-y-4">
            {/* Energy Level */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Morning Energy (1-10)</label>
              <input
                type="range"
                min="1"
                max="10"
                value={formData.energy_am}
                onChange={(e) => setFormData({...formData, energy_am: parseInt(e.target.value)})}
                className="w-full"
              />
              <div className="text-center text-lg font-semibold text-gray-100">{formData.energy_am}</div>
            </div>

            {/* Deep Work Hours */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Deep Work Hours Completed</label>
              <input
                type="number"
                min="0"
                max="8"
                step="0.5"
                value={formData.deep_work_hours}
                onChange={(e) => setFormData({...formData, deep_work_hours: parseFloat(e.target.value)})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
              />
            </div>

            {/* MITs */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Today's 3 Most Important Tasks</label>
              <input
                type="text"
                placeholder="MIT 1"
                value={formData.mit1}
                onChange={(e) => setFormData({...formData, mit1: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder-gray-400"
              />
              <input
                type="text"
                placeholder="MIT 2"
                value={formData.mit2}
                onChange={(e) => setFormData({...formData, mit2: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder-gray-400"
              />
              <input
                type="text"
                placeholder="MIT 3"
                value={formData.mit3}
                onChange={(e) => setFormData({...formData, mit3: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder-gray-400"
              />
            </div>

            {/* Pillar Focus */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Today's Pillar Focus</label>
              <select
                value={formData.pillar_focus}
                onChange={(e) => setFormData({...formData, pillar_focus: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
              >
                <option value="Craft">Craft (Writing & Creation)</option>
                <option value="Community">Community (Relationships)</option>
                <option value="Constitution">Constitution (Physical Health)</option>
                <option value="Contemplation">Contemplation (Mental/Spiritual)</option>
              </select>
            </div>

            {/* Checkboxes */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-gray-300">
                <input
                  type="checkbox"
                  checked={formData.protein_breakfast}
                  onChange={(e) => setFormData({...formData, protein_breakfast: e.target.checked})}
                  className="w-4 h-4"
                />
                <span>Protein Breakfast (30-40g)</span>
              </label>
              
              <label className="flex items-center space-x-2 text-gray-300">
                <input
                  type="checkbox"
                  checked={formData.walked}
                  onChange={(e) => setFormData({...formData, walked: e.target.checked})}
                  className="w-4 h-4"
                />
                <span>Walked Today</span>
              </label>
              
              <label className="flex items-center space-x-2 text-gray-300">
                <input
                  type="checkbox"
                  checked={formData.water}
                  onChange={(e) => setFormData({...formData, water: e.target.checked})}
                  className="w-4 h-4"
                />
                <span>Water Target (135oz)</span>
              </label>
              
              <label className="flex items-center space-x-2 text-gray-300">
                <input
                  type="checkbox"
                  checked={formData.athlete_activated}
                  onChange={(e) => setFormData({...formData, athlete_activated: e.target.checked})}
                  className="w-4 h-4"
                />
                <span className="font-semibold">Athlete Activated 💪</span>
              </label>
            </div>

            {/* Stress Level */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Stress Level (1-10)</label>
              <input
                type="range"
                min="1"
                max="10"
                value={formData.stress_level}
                onChange={(e) => setFormData({...formData, stress_level: parseInt(e.target.value)})}
                className="w-full"
              />
              <div className="text-center text-lg font-semibold text-gray-100">{formData.stress_level}</div>
            </div>

            {/* Win Today */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Today's Win</label>
              <input
                type="text"
                placeholder="What was your win today?"
                value={formData.win_today}
                onChange={(e) => setFormData({...formData, win_today: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder-gray-400"
              />
            </div>

            {/* Tomorrow's One Thing */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Tomorrow's ONE Thing</label>
              <input
                type="text"
                placeholder="What's the most important thing for tomorrow?"
                value={formData.tomorrows_one_thing}
                onChange={(e) => setFormData({...formData, tomorrows_one_thing: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder-gray-400"
              />
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-4 pt-4">
              <button
                type="button"
                onClick={() => setShowDailyLog(false)}
                className="px-4 py-2 text-gray-300 hover:text-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
              >
                Save Daily Log
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Project Form Component
  const ProjectForm = () => {
    const [formData, setFormData] = useState({
      name: '',
      pillar: 'Craft',
      status: 'Active',
      next_action: '',
      energy_required: 'Medium',
      target_date: '',
      quarterly_objective: ''
    });

    const handleSubmit = async () => {
      setSyncStatus('syncing');
      
      const { error } = await supabase.from('projects').insert({
        ...formData,
        user_id: user.id
      });

      if (!error) {
        await loadUserData();
        setShowProjectForm(false);
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
        <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
          <h2 className="text-2xl font-bold mb-6 text-gray-100">New Project</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Project Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Pillar</label>
              <select
                value={formData.pillar}
                onChange={(e) => setFormData({...formData, pillar: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
              >
                <option value="Craft">Craft</option>
                <option value="Community">Community</option>
                <option value="Constitution">Constitution</option>
                <option value="Contemplation">Contemplation</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Next Action (THE One Thing)</label>
              <input
                type="text"
                required
                value={formData.next_action}
                onChange={(e) => setFormData({...formData, next_action: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Energy Required</label>
              <select
                value={formData.energy_required}
                onChange={(e) => setFormData({...formData, energy_required: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Links to Quarterly Objective</label>
              <input
                type="text"
                value={formData.quarterly_objective}
                onChange={(e) => setFormData({...formData, quarterly_objective: e.target.value})}
                placeholder="Which quarterly goal does this support?"
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder-gray-400"
              />
            </div>

            <div className="flex justify-end space-x-4 pt-4">
              <button
                type="button"
                onClick={() => setShowProjectForm(false)}
                className="px-4 py-2 text-gray-300 hover:text-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Calculate athlete activation score for the week
  const getWeeklyAthleteScore = () => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekLogs = dailyLogs.filter(log => new Date(log.date) >= oneWeekAgo);
    const athleteDays = weekLogs.filter(log => log.athlete_activated).length;
    return { athleteDays, totalDays: weekLogs.length };
  };

  const weeklyScore = getWeeklyAthleteScore();

  // Calculate deep work hours for the week
  const getWeeklyDeepWorkHours = () => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekLogs = dailyLogs.filter(log => new Date(log.date) >= oneWeekAgo);
    return weekLogs.reduce((total, log) => total + (log.deep_work_hours || 0), 0);
  };

  // Pillar icons
  const pillarIcons = {
    Craft: Target,
    Community: Users,
    Constitution: Activity,
    Contemplation: Brain
  };

  // Navigation Component
  const Navigation = () => (
    <div className="bg-gray-800 shadow-lg mb-6">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveView('dashboard')}
              className={`py-3 border-b-2 transition-colors ${activeView === 'dashboard' ? 'border-blue-400 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveView('planning')}
              className={`py-3 border-b-2 transition-colors ${activeView === 'planning' ? 'border-blue-400 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
            >
              Multi-Scale Planning
            </button>
            <button
              onClick={() => setActiveView('timeblocks')}
              className={`py-3 border-b-2 transition-colors ${activeView === 'timeblocks' ? 'border-blue-400 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
            >
              Time Blocks
            </button>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                syncStatus === 'syncing' ? 'bg-yellow-400 animate-pulse' :
                syncStatus === 'synced' ? 'bg-green-400' :
                'bg-red-400'
              }`} />
              <span className="text-xs text-gray-400">
                {syncStatus === 'syncing' ? 'Syncing...' :
                 syncStatus === 'synced' ? 'Synced' :
                 'Sync Error'}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="text-gray-400 hover:text-gray-200"
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Multi-Scale Planning View
  const MultiScalePlanningView = () => (
    <div className="space-y-6">
      {/* Quarterly Objectives */}
      <div className="bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center text-gray-100">
          <Map className="mr-2" size={24} />
          Quarterly Objectives
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {['Craft', 'Community', 'Constitution', 'Contemplation'].map(pillar => {
            const Icon = pillarIcons[pillar];
            return (
              <div key={pillar} className="border border-gray-700 rounded-lg p-4 bg-gray-900/50">
                <div className="flex items-center mb-2">
                  <Icon className="mr-2 text-gray-400" size={20} />
                  <h3 className="font-semibold text-gray-200">{pillar}</h3>
                </div>
                <p className="text-sm text-gray-400">
                  {pillar === 'Craft' && 'Complete Constellation Cycle Part Two'}
                  {pillar === 'Community' && 'Rebuild 3 meaningful connections'}
                  {pillar === 'Constitution' && 'Lose 12-24 lbs, activate athlete identity'}
                  {pillar === 'Contemplation' && 'Daily stillness practice established'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weekly Plan */}
      <div className="bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center text-gray-100">
            <Calendar className="mr-2" size={24} />
            Weekly Plan
          </h2>
          <button
            onClick={() => setShowWeeklyPlan(true)}
            className="text-blue-400 hover:text-blue-300"
          >
            {currentWeekPlan ? 'Edit' : 'Create'} This Week's Plan
          </button>
        </div>
        
        {currentWeekPlan ? (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2 text-gray-200">Top 3 Priorities</h3>
              <ol className="list-decimal list-inside space-y-1 text-gray-300">
                {currentWeekPlan.top_priorities.filter(p => p).map((priority, i) => (
                  <li key={i}>{priority}</li>
                ))}
              </ol>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2 text-gray-200">Pillar Goals</h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(currentWeekPlan.pillar_goals).filter(([_, goal]) => goal).map(([pillar, goal]) => {
                  const Icon = pillarIcons[pillar];
                  return (
                    <div key={pillar} className="flex items-start space-x-2">
                      <Icon size={16} className="mt-1 text-gray-400" />
                      <div>
                        <p className="font-medium text-sm text-gray-300">{pillar}</p>
                        <p className="text-sm text-gray-400">{goal}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-center text-gray-400 py-8">No weekly plan yet. Create one to align with your quarterly objectives.</p>
        )}
      </div>

      {/* Deep Work Stats */}
      <div className="bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center text-gray-100">
          <BookOpen className="mr-2" size={24} />
          Deep Work Statistics
        </h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-3xl font-bold text-blue-400">{getWeeklyDeepWorkHours().toFixed(1)}</p>
            <p className="text-sm text-gray-400">Hours This Week</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-blue-400">{(getWeeklyDeepWorkHours() / 7).toFixed(1)}</p>
            <p className="text-sm text-gray-400">Daily Average</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-blue-400">{todayLog?.deep_work_hours || 0}</p>
            <p className="text-sm text-gray-400">Hours Today</p>
          </div>
        </div>
      </div>
    </div>
  );

  // Show loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader className="animate-spin text-blue-400" size={40} />
      </div>
    );
  }

  // Show auth screen if not authenticated
  if (!user) {
    return <AuthScreen onAuthenticated={() => {
      setUser(supabase.getUser());
      loadUserData();
    }} />;
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center py-8">
          <h1 className="text-4xl font-bold mb-2 text-gray-100">🎯 System Beta Dashboard</h1>
          <p className="text-gray-400">Momentum over perfection. Identity through action.</p>
        </div>

        {/* Navigation */}
        <Navigation />

        <div className="px-4">
          {activeView === 'dashboard' && (
            <>
              {/* Today's Mission */}
              <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                <h2 className="text-xl font-bold mb-4 flex items-center text-gray-100">
                  <Calendar className="mr-2" size={24} />
                  Today's Mission
                </h2>
                
                {todayLog ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-300">Energy Level:</span>
                      <span className="text-2xl text-blue-400">{todayLog.energy_am}/10</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-300">Deep Work Hours:</span>
                      <span className="text-2xl text-purple-400">{todayLog.deep_work_hours || 0}</span>
                    </div>
                    
                    <div>
                      <p className="font-medium mb-2 text-gray-300">Most Important Tasks:</p>
                      <ul className="space-y-1 ml-4 text-gray-400">
                        {todayLog.mit1 && <li>1. {todayLog.mit1}</li>}
                        {todayLog.mit2 && <li>2. {todayLog.mit2}</li>}
                        {todayLog.mit3 && <li>3. {todayLog.mit3}</li>}
                      </ul>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm">
                      <span className={`flex items-center ${todayLog.protein_breakfast ? 'text-green-400' : 'text-gray-600'}`}>
                        {todayLog.protein_breakfast ? <Check size={16} className="mr-1" /> : <X size={16} className="mr-1" />}
                        Protein
                      </span>
                      <span className={`flex items-center ${todayLog.walked ? 'text-green-400' : 'text-gray-600'}`}>
                        {todayLog.walked ? <Check size={16} className="mr-1" /> : <X size={16} className="mr-1" />}
                        Walked
                      </span>
                      <span className={`flex items-center ${todayLog.water ? 'text-green-400' : 'text-gray-600'}`}>
                        {todayLog.water ? <Check size={16} className="mr-1" /> : <X size={16} className="mr-1" />}
                        Water
                      </span>
                      <span className={`flex items-center font-semibold ${todayLog.athlete_activated ? 'text-green-400' : 'text-gray-600'}`}>
                        {todayLog.athlete_activated ? <Check size={16} className="mr-1" /> : <X size={16} className="mr-1" />}
                        Athlete Activated
                      </span>
                    </div>
                    
                    {todayLog.win_today && (
                      <div className="bg-green-900/20 border border-green-500/30 p-3 rounded">
                        <p className="text-sm font-medium text-green-400">Today's Win:</p>
                        <p className="text-green-300">{todayLog.win_today}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-400 mb-4">No log for today yet</p>
                    <button
                      onClick={() => setShowDailyLog(true)}
                      className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
                    >
                      Start Today's Log
                    </button>
                  </div>
                )}
              </div>

              {/* This Week's Momentum */}
              <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                <h2 className="text-xl font-bold mb-4 flex items-center text-gray-100">
                  <BarChart3 className="mr-2" size={24} />
                  This Week's Momentum
                </h2>
                
                <div className="grid grid-cols-7 gap-2">
                  {[...Array(7)].map((_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() - (6 - i));
                    const dateStr = date.toISOString().split('T')[0];
                    const log = dailyLogs.find(l => l.date === dateStr);
                    
                    return (
                      <div key={i} className="text-center">
                        <div className="text-xs text-gray-500 mb-1">
                          {date.toLocaleDateString('en', { weekday: 'short' })}
                        </div>
                        <div className={`h-16 rounded flex items-center justify-center ${
                          log?.athlete_activated ? 'bg-green-900/50 border-2 border-green-500' : 
                          log ? 'bg-gray-700' : 'bg-gray-800'
                        }`}>
                          {log?.athlete_activated && <Activity className="text-green-400" size={20} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-4 text-center">
                  <p className="text-2xl font-bold text-green-400">{weeklyScore.athleteDays}/{weeklyScore.totalDays}</p>
                  <p className="text-sm text-gray-400">Athlete Days This Week</p>
                </div>
              </div>

              {/* Active Projects */}
              <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold flex items-center text-gray-100">
                    <TrendingUp className="mr-2" size={24} />
                    Active Projects
                  </h2>
                  <button
                    onClick={() => setShowProjectForm(true)}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                
                {projects.filter(p => p.status === 'Active').length > 0 ? (
                  <div className="grid gap-3">
                    {projects.filter(p => p.status === 'Active').map(project => {
                      const Icon = pillarIcons[project.pillar];
                      return (
                        <div key={project.id} className="border border-gray-700 rounded-lg p-4 bg-gray-900/50">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3">
                              <Icon className="text-gray-400 mt-1" size={20} />
                              <div>
                                <h3 className="font-semibold text-gray-200">{project.name}</h3>
                                <p className="text-sm text-gray-400 mt-1">
                                  <ChevronRight size={16} className="inline" />
                                  {project.next_action}
                                </p>
                                {project.quarterly_objective && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    Links to: {project.quarterly_objective}
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded ${
                              project.energy_required === 'High' ? 'bg-red-900/50 text-red-400' :
                              project.energy_required === 'Medium' ? 'bg-yellow-900/50 text-yellow-400' :
                              'bg-green-900/50 text-green-400'
                            }`}>
                              {project.energy_required}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-gray-400 py-4">No active projects yet</p>
                )}
              </div>

              {/* Quick Actions */}
              <div className="bg-gray-800 rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-100">📝 Quick Actions</h2>
                <div className="space-y-2">
                  <button
                    onClick={() => setShowDailyLog(true)}
                    className="w-full text-left px-4 py-3 bg-gray-700 rounded hover:bg-gray-600 transition text-gray-200"
                  >
                    {todayLog ? 'Update' : 'Create'} Daily Log
                  </button>
                  <button
                    onClick={() => setShowProjectForm(true)}
                    className="w-full text-left px-4 py-3 bg-gray-700 rounded hover:bg-gray-600 transition text-gray-200"
                  >
                    Add New Project
                  </button>
                  <button
                    onClick={() => setActiveView('planning')}
                    className="w-full text-left px-4 py-3 bg-gray-700 rounded hover:bg-gray-600 transition text-gray-200"
                  >
                    Weekly Planning
                  </button>
                  <button
                    onClick={() => setActiveView('timeblocks')}
                    className="w-full text-left px-4 py-3 bg-gray-700 rounded hover:bg-gray-600 transition text-gray-200"
                  >
                    Today's Time Blocks
                  </button>
                </div>
              </div>
            </>
          )}

          {activeView === 'planning' && <MultiScalePlanningView />}
          {activeView === 'timeblocks' && <TimeBlockView />}
        </div>
      </div>

      {/* Modals */}
      {showDailyLog && <DailyLogForm />}
      {showProjectForm && <ProjectForm />}
      {showWeeklyPlan && <WeeklyPlanForm />}
    </div>
  );
};

export default SystemBetaDashboard;
// Export for use in index.html
window.SystemBetaDashboard = SystemBetaDashboard;