import React, { useState, useEffect, useRef } from 'react';
import { getSupabase } from '../lib/supabase.ts';
import { ChatMessage } from '../types.ts';
import { Send, User, MessageSquare, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const ChatBox: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [userName, setUserName] = useState<string>(localStorage.getItem('chat-nickname') || '');
  const [isSettingName, setIsSettingName] = useState(!userName);
  const [tempName, setTempName] = useState('');
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      const response = await fetch('/api/messages');
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();

    let channel: any;
    try {
      const supabase = getSupabase();
      channel = supabase.channel('room:public', {
        config: {
          presence: {
            key: userName || 'anonymous',
          },
        },
      });

      channel
        .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'messages' }, 
          (payload: any) => {
            const newMsg = payload.new as ChatMessage;
            setMessages(prev => [...prev, newMsg]);
          }
        )
        .on('presence', { event: 'sync' }, () => {
          const newState = channel.presenceState();
          const users = Object.keys(newState).filter(u => u !== 'anonymous');
          setOnlineUsers(users);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }: any) => {
          console.log('User joined:', key);
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }: any) => {
          console.log('User left:', key);
        })
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED' && userName) {
            await channel.track({ online_at: new Date().toISOString() });
          }
        });
    } catch (err) {
      console.error('Supabase Realtime Error:', err);
    }

    return () => {
      if (channel) getSupabase().removeChannel(channel);
    };
  }, [userName]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userName) return;

    const content = newMessage.trim();
    setNewMessage('');

    try {
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name: userName, content }),
      });
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const handleSetName = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) {
      const name = tempName.trim();
      setUserName(name);
      localStorage.setItem('chat-nickname', name);
      setIsSettingName(false);
    }
  };

  return (
    <div className="w-full bg-white border border-[var(--color-border)] flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-[var(--color-border)] bg-[#F8F9FA] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[var(--color-brand)]" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#32325D]">Phòng Chat Chung</span>
          </div>
          {userName && (
            <button 
              onClick={() => setIsSettingName(true)}
              className="text-[10px] text-gray-400 hover:text-[var(--color-brand)] font-bold uppercase"
            >
              Đổi tên
            </button>
          )}
        </div>
        
        {/* Online Status Bar */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <div className="flex items-center gap-1.5 shrink-0 px-2 py-1 bg-green-50 rounded-full border border-green-100">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-[9px] font-bold text-green-700 uppercase tracking-tighter">{onlineUsers.length} Online</span>
          </div>
          <div className="flex items-center gap-1">
            {onlineUsers.slice(0, 3).map((user, idx) => (
              <span key={idx} className="text-[9px] text-gray-400 font-medium bg-gray-50 px-1.5 py-0.5 rounded italic">
                {user === userName ? 'Bạn' : user}
              </span>
            ))}
            {onlineUsers.length > 3 && <span className="text-[9px] text-gray-300">+{onlineUsers.length - 3}</span>}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-200" />
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.user_name === userName ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] font-bold text-gray-400 tracking-tight uppercase">{msg.user_name}</span>
                <span className="text-[9px] text-gray-300">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className={`max-w-[60%] px-3 py-2 text-sm ${
                msg.user_name === userName 
                  ? 'bg-[var(--color-brand)] text-white' 
                  : 'bg-[#F6F9FC] text-[#525F7F] border border-[var(--color-border)]'
              }`}>
                {msg.content}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-[var(--color-border)] bg-gray-50">
        {isSettingName ? (
          <form onSubmit={handleSetName} className="space-y-2">
            <p className="text-[10px] uppercase font-bold text-gray-400 text-center tracking-widest">Nhập tên để bắt đầu chat</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                placeholder="Biệt danh..."
                className="flex-1 px-3 py-2 text-xs border border-[var(--color-border)] focus:border-[var(--color-brand)] outline-none"
                required
              />
              <button type="submit" className="geo-btn-primary !px-3">OK</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Nhập nội dung..."
              className="flex-1 px-3 py-2 text-xs border border-[var(--color-border)] focus:border-[var(--color-brand)] outline-none"
            />
            <button type="submit" className="geo-btn-primary !p-2">
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
