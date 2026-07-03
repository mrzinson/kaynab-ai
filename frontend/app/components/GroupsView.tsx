"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { io } from 'socket.io-client';

interface GroupsViewProps {
  onClose: () => void;
}

export default function GroupsView({ onClose }: GroupsViewProps) {
  const { colors, language, isDark, t } = useTheme();

  // Tabs: 'your' (Joined Groups) vs 'other' (Public Groups)
  const [activeTab, setActiveTab] = useState<'your' | 'other'>('your');
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [otherGroups, setOtherGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Active Chat State
  const [activeGroup, setActiveGroup] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [showNoCreditsModal, setShowNoCreditsModal] = useState(false);

  const socketRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch groups list
  const fetchGroups = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const token = localStorage.getItem('userToken');
      
      // My Groups
      const myRes = await fetch(`https://darkpen-backend.onrender.com/api/groups/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (myRes.ok) {
        const myData = await myRes.json();
        setMyGroups(myData);
      }

      // Other Groups
      const otherRes = await fetch(`https://darkpen-backend.onrender.com/api/groups/public?search=${searchQuery}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (otherRes.ok) {
        const otherData = await otherRes.json();
        setOtherGroups(otherData);
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cachedUser = localStorage.getItem('userData');
    if (cachedUser) {
      setCurrentUserId(JSON.parse(cachedUser).id);
    }
    fetchGroups();

    // Listen to real-time notification socket
    const socket = io((process.env.NEXT_PUBLIC_API_URL || 'https://kaynab-ai-backend.onrender.com') + '', { transports: ['websocket'] });
    socket.on('receive_message', () => {
      fetchGroups(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [searchQuery, activeTab]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeGroup]);

  // Fetch credits
  const fetchCredits = async () => {
    try {
      const token = localStorage.getItem('userToken');
      const response = await fetch(`https://darkpen-backend.onrender.com/api/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.user) {
        const bal = data.user.balance || 0;
        setCredits(bal);
        if (bal <= 0) {
          setShowNoCreditsModal(true);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch messages for selected group
  const fetchGroupMessages = async (groupId: number) => {
    setChatLoading(true);
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch(`https://darkpen-backend.onrender.com/api/groups/${groupId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setChatLoading(false);
    }
  };

  // Handle Join group
  const handleJoin = async (groupId: number) => {
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch(`https://darkpen-backend.onrender.com/api/groups/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ groupId })
      });
      if (res.ok) {
        alert(language === 'so' ? 'Si guul leh ayaad ugu biirtay!' : 'Joined successfully!');
        fetchGroups(false);
        setActiveTab('your');
      } else {
        const data = await res.json();
        alert(data.message);
      }
    } catch (err) {
      alert('Cilad ayaa dhacday');
    }
  };

  // Connect sockets for active group chat
  const handleEnterGroup = (group: any) => {
    setActiveGroup(group);
    fetchGroupMessages(group.id);
    fetchCredits();

    // Establish WebSocket Connection
    const socket = io((process.env.NEXT_PUBLIC_API_URL || 'https://kaynab-ai-backend.onrender.com') + '', { transports: ['websocket'] });
    socketRef.current = socket;
    socket.emit('join_room', `group_${group.id}`);
    socket.on('receive_message', (data: any) => {
      setMessages(prev => [...prev, data]);
    });
  };

  const handleExitGroup = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setActiveGroup(null);
    setMessages([]);
    fetchGroups(false);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeGroup) return;

    const content = inputText.trim();
    setInputText('');

    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch(`https://darkpen-backend.onrender.com/api/groups/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ groupId: activeGroup.id, message: content, type: 'text' })
      });

      if (res.ok) {
        const resData = await res.json();
        const cachedUser = localStorage.getItem('userData');
        const user = JSON.parse(cachedUser || '{}');

        const newMessage = {
          id: resData.messageId || Date.now(),
          group_id: activeGroup.id,
          user_id: user.id,
          message: resData.message || content,
          type: 'text',
          sender_name: user.name || user.username || 'User',
          created_at: new Date().toISOString()
        };

        // Emit message to room
        socketRef.current?.emit('send_message', { room: `group_${activeGroup.id}`, ...newMessage });
        setMessages(prev => [...prev, newMessage]);
      } else {
        const errData = await res.json();
        if (errData.needsPayment) {
          setShowNoCreditsModal(true);
        } else {
          alert(errData.message || 'Waa la soo diri waayay fariinta');
        }
      }
    } catch (err) {
      alert('Waa la soo diri waayay fariinta');
    }
  };

  // Image Upload inside Group Chat
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeGroup) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
      const token = localStorage.getItem('userToken');

      try {
        const res = await fetch(`https://darkpen-backend.onrender.com/api/groups/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ 
            groupId: activeGroup.id, 
            message: `data:image/jpeg;base64,${base64String}`, 
            type: 'image' 
          })
        });

        if (res.ok) {
          const resData = await res.json();
          const cachedUser = localStorage.getItem('userData');
          const user = JSON.parse(cachedUser || '{}');

          const newMessage = {
            id: resData.messageId || Date.now(),
            group_id: activeGroup.id,
            user_id: user.id,
            message: resData.message,
            type: 'image',
            sender_name: user.name || 'User',
            created_at: new Date().toISOString()
          };

          socketRef.current?.emit('send_message', { room: `group_${activeGroup.id}`, ...newMessage });
          setMessages(prev => [...prev, newMessage]);
        }
      } catch (err) {
        alert('Sawirka lama diri karo');
      }
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getMediaUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `https://darkpen-backend.onrender.com${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // Group Details view
  if (activeGroup) {
    return (
      <div className="flex-1 w-full h-full flex flex-col bg-[#0D1117] relative select-none">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#161B22] border-b border-gray-800">
          <div className="flex items-center gap-3">
            <button
              onClick={handleExitGroup}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-[#0D1117] border border-gray-800 hover:bg-gray-800 text-blue-500 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-500 font-extrabold select-none">
                {activeGroup.name.substring(0, 2).toUpperCase()}
              </div>
              <h3 className="font-bold text-white text-base leading-none">{activeGroup.name}</h3>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 scrollbar-thin">
          {chatLoading ? (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 font-medium select-none">
              Malaha wax fariimo ah wali.
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.user_id === currentUserId;
              return (
                <div 
                  key={msg.id}
                  className={`flex flex-col max-w-[75%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                >
                  <span className="text-[9px] text-gray-500 font-bold mb-1 select-none">
                    {msg.sender_name} • {formatTime(msg.created_at)}
                  </span>
                  <div 
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-[#161B22] border border-gray-800 text-gray-250 rounded-tl-none'}`}
                  >
                    {msg.type === 'image' ? (
                      <img 
                        src={getMediaUrl(msg.message)} 
                        alt="Group Image" 
                        className="max-w-full max-h-[220px] rounded-xl object-cover shadow-sm select-none cursor-pointer" 
                        onClick={() => window.open(getMediaUrl(msg.message), '_blank')}
                      />
                    ) : (
                      <span className="select-text">{msg.message}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <form onSubmit={handleSend} className="px-6 py-4 bg-[#161B22] border-t border-gray-800 flex items-center gap-3">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-11 h-11 rounded-full flex items-center justify-center bg-[#0D1117] border border-gray-800 hover:bg-gray-800 text-gray-400 hover:text-white transition-all flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
            </svg>
          </button>
          
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Message Group..."
            className="flex-1 px-4 py-3 bg-[#0D1117] border border-gray-800 focus:outline-none focus:border-blue-500 rounded-full text-sm text-white"
          />

          <button
            type="submit"
            className="w-11 h-11 rounded-full flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white transition-all flex-shrink-0 shadow-md"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
          </button>
        </form>

        {/* Modal No Credits */}
        {showNoCreditsModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#161B22] border border-gray-800 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4 text-center shadow-2xl">
              <h4 className="text-base font-extrabold text-red-500">Credit Limit Exceeded</h4>
              <p className="text-xs text-gray-300 leading-relaxed font-medium">
                Ma isticmaali kartid group-ka haddii uusan credit (lacag) kuu dhex jirin. Credit-kaaga waxaad sidoo kale u isticmaali kartaa chat-ka caadiga ah.
              </p>
              <button
                onClick={() => handleExitGroup()}
                className="w-full py-3.5 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl text-xs transition-all shadow-md mt-2"
              >
                Go Back
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 w-full overflow-y-auto px-6 py-6 scrollbar-none flex flex-col gap-6 bg-[#0D1117]">
      {/* Header */}
      <div className="flex items-center justify-between select-none">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-[#161B22] border border-gray-800 hover:bg-gray-800 text-blue-500 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div>
            <h2 className="text-2xl font-extrabold text-white">Groups</h2>
            <p className="text-xs text-gray-500 font-medium">Chat and share studies with your peers in real-time.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-[#161B22] p-1 rounded-2xl border border-gray-850 self-start select-none">
        <button
          onClick={() => setActiveTab('your')}
          className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'your' ? 'bg-[#0D1117] text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Your Groups
        </button>
        <button
          onClick={() => setActiveTab('other')}
          className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'other' ? 'bg-[#0D1117] text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Other Groups
        </button>
      </div>

      {/* Search for other groups */}
      {activeTab === 'other' && (
        <div className="w-full max-w-md flex items-center bg-[#161B22] border border-gray-850 focus-within:border-blue-500 rounded-xl px-4 py-3 transition-all select-none">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500 mr-2">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.604 10.604Z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search groups..."
            className="w-full bg-transparent text-white focus:outline-none text-xs font-medium"
          />
        </div>
      )}

      {/* Groups List */}
      <div className="w-full max-w-xl flex flex-col gap-3">
        {loading ? (
          <div className="w-full py-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : activeTab === 'your' ? (
          myGroups.length > 0 ? (
            myGroups.map((group) => (
              <div
                key={group.id}
                onClick={() => handleEnterGroup(group)}
                className="bg-[#161B22] border border-gray-850 hover:bg-gray-800/60 rounded-3xl p-4 flex justify-between items-center cursor-pointer shadow-md select-none transition-all"
              >
                <div className="flex gap-3 items-center min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-500 font-extrabold select-none flex-shrink-0">
                    {group.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex flex-col">
                    <h4 className="text-sm font-extrabold text-white leading-tight truncate">{group.name}</h4>
                    <p className="text-[10px] text-gray-550 truncate mt-1">
                      {group.last_message || group.description || 'Malaha wax fariimo ah'}
                    </p>
                  </div>
                </div>
                
                {group.unread_count > 0 && (
                  <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[9px] font-bold text-white shadow-sm flex-shrink-0">
                    {group.unread_count}
                  </span>
                )}
              </div>
            ))
          ) : (
            <div className="bg-[#161B22] border border-gray-850 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-lg select-none">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-gray-600 mb-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
              </svg>
              <span className="text-xs text-gray-500 font-bold">Ma lihid wax group ah wali.</span>
            </div>
          )
        ) : (
          otherGroups.length > 0 ? (
            otherGroups.map((group) => (
              <div
                key={group.id}
                className="bg-[#161B22] border border-gray-850 rounded-3xl p-4 flex justify-between items-center shadow-md select-none"
              >
                <div className="flex gap-3 items-center min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-500 font-extrabold select-none flex-shrink-0">
                    {group.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex flex-col">
                    <h4 className="text-sm font-extrabold text-white leading-tight truncate">{group.name}</h4>
                    <p className="text-[10px] text-gray-550 truncate mt-1">{group.description || 'Public Group'}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleJoin(group.id)}
                  className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 active:scale-[0.97] text-white text-xs font-bold transition-all shadow-sm"
                >
                  Join
                </button>
              </div>
            ))
          ) : (
            <div className="bg-[#161B22] border border-gray-850 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-lg select-none">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-gray-600 mb-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.604 10.604Z" />
              </svg>
              <span className="text-xs text-gray-500 font-bold font-medium">Wax group ah lama helin.</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
