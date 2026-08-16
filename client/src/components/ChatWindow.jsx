import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  Mail, 
  Calendar, 
  Send, 
  Database, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Zap,
  Bot,
  User as UserIcon,
  Copy,
  Check,
  RotateCw,
  Trash2,
  X,
  Search,
  FileText
} from 'lucide-react';

/**
 * Clean & Interactive Conversational ChatWindow Component
 */
export default function ChatWindow() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: 'Welcome to **Personal Brain**. I am your AI assistant running over your synchronized **Gmail** and **Google Calendar** data in **GBrain**.\n\nAsk me any single-source or cross-source question below, or inspect/manage your data using **🧠 GBrain Store**!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncingGmail, setSyncingGmail] = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [toast, setToast] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Store Explorer Modal State
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [storeStats, setStoreStats] = useState({ emailCount: 0, eventCount: 0, recentEmails: [], recentEvents: [] });
  const [activeTab, setActiveTab] = useState('emails');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [clearingStore, setClearingStore] = useState(false);

  const messagesEndRef = useRef(null);

  // Fetch active user profile from /api/auth/me
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
        }
      })
      .catch((err) => console.log('No active OAuth user session:', err.message));
    
    fetchStoreStats();
  }, []);

  const fetchStoreStats = async () => {
    try {
      const res = await fetch('/api/store/stats');
      const data = await res.json();
      if (data.status === 'success' && data.stats) {
        setStoreStats(data.stats);
      }
    } catch (err) {
      console.log('Error fetching store stats:', err.message);
    }
  };

  // Detect ?auth=success or ?auth=error in URL after Google OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authStatus = params.get('auth');
    const userName = params.get('user');
    const reason = params.get('reason');

    if (authStatus === 'success') {
      window.history.replaceState({}, '', window.location.pathname);
      showToast(`Connected as ${decodeURIComponent(userName || 'Google User')} — syncing data into GBrain...`, 'success');
      fetch('/api/auth/me').then(r => r.json()).then(d => { if (d.user) setUser(d.user); });
      setTimeout(() => {
        handleSyncGmail();
        setTimeout(() => handleSyncCalendar(), 1500);
      }, 500);
    } else if (authStatus === 'error') {
      window.history.replaceState({}, '', window.location.pathname);
      showToast(`Authentication error: ${decodeURIComponent(reason || 'Failed')}`, 'error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const showToast = (text, type = 'info') => {
    setToast({ text, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleCopyText = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Copied to clipboard!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: Date.now(),
        sender: 'bot',
        text: 'Chat history cleared. How can I help you query your **GBrain Store** today?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    showToast('Cleared conversation history', 'info');
  };

  const handleClearGBrainStore = async () => {
    if (!window.confirm('Are you sure you want to delete all stored emails and calendar events from GBrain storage?')) {
      return;
    }
    setClearingStore(true);
    try {
      const res = await fetch('/api/store/clear', { method: 'DELETE' });
      const data = await res.json();
      if (data.status === 'success') {
        showToast('Successfully cleared GBrain store', 'success');
        setSelectedEntity(null);
        fetchStoreStats();
      } else {
        showToast(`Failed to clear store: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast(`Error clearing store: ${err.message}`, 'error');
    } finally {
      setClearingStore(false);
    }
  };

  const handleDeleteEntity = async (type, id) => {
    try {
      const endpoint = type === 'email' ? `/api/store/email/${id}` : `/api/store/event/${id}`;
      const res = await fetch(endpoint, { method: 'DELETE' });
      const data = await res.json();
      if (data.status === 'success') {
        showToast(`Deleted ${type} entity from GBrain store`, 'success');
        setSelectedEntity(null);
        fetchStoreStats();
      } else {
        showToast(`Delete error: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast(`Network error deleting entity: ${err.message}`, 'error');
    }
  };

  const handleSyncGmail = async () => {
    setSyncingGmail(true);
    try {
      const res = await fetch('/api/ingest/gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxResults: 50 })
      });
      const rawText = await res.text();
      let data = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch (pErr) {
        throw new Error(rawText || 'Server returned an empty response');
      }
      if (res.ok && data.status === 'success') {
        showToast(`Synced ${data.syncedCount} Gmail messages into GBrain Store`, 'success');
        fetchStoreStats();
      } else {
        showToast(`Gmail Sync: ${data.error || data.details || 'Failed'}`, 'error');
      }
    } catch (err) {
      showToast(`Network error syncing Gmail: ${err.message}`, 'error');
    } finally {
      setSyncingGmail(false);
    }
  };

  const handleSyncCalendar = async () => {
    setSyncingCalendar(true);
    try {
      const res = await fetch('/api/ingest/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const rawText = await res.text();
      let data = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch (pErr) {
        throw new Error(rawText || 'Server returned an empty response');
      }
      if (res.ok && data.status === 'success') {
        showToast(`Synced ${data.syncedCount} Calendar events into GBrain Store`, 'success');
        fetchStoreStats();
      } else {
        showToast(`Calendar Sync: ${data.error || data.details || 'Failed'}`, 'error');
      }
    } catch (err) {
      showToast(`Network error syncing Calendar: ${err.message}`, 'error');
    } finally {
      setSyncingCalendar(false);
    }
  };

  const handleRegenerate = () => {
    const lastUserMessage = [...messages].reverse().find(m => m.sender === 'user');
    if (lastUserMessage) {
      handleSend(lastUserMessage.text);
    }
  };

  const handleSend = async (textToSend) => {
    const prompt = textToSend || inputValue;
    if (!prompt.trim() || loading) return;

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: prompt.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInputValue('');
    setLoading(true);

    const botMessageId = Date.now() + 1;
    const botMessagePlaceholder = {
      id: botMessageId,
      sender: 'bot',
      text: '',
      statusText: 'Querying GBrain Store...',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, botMessagePlaceholder]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          message: prompt.trim(),
          query: prompt.trim(),
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let botText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.replace(/^data: /, '').trim();
            if (!dataStr) continue;
            try {
              const payload = JSON.parse(dataStr);
              if (payload.type === 'status') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === botMessageId
                      ? { ...m, statusText: payload.message }
                      : m
                  )
                );
              } else if (payload.type === 'chunk') {
                botText += payload.text;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === botMessageId
                      ? { ...m, text: botText, statusText: null }
                      : m
                  )
                );
              } else if (payload.type === 'error') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === botMessageId
                      ? {
                          ...m,
                          text: `Error: ${payload.error}`,
                          statusText: null,
                          isError: true
                        }
                      : m
                  )
                );
              }
            } catch (parseErr) {
              console.error('Error parsing SSE payload:', parseErr);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error streaming message:', err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMessageId
            ? {
                ...m,
                text: `Connection Error: ${err.message}. Ensure backend is running on port 5000.`,
                statusText: null,
                isError: true
              }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredEmails = storeStats.recentEmails.filter(e => {
    if (!searchFilter) return true;
    const sf = searchFilter.toLowerCase();
    return (
      (e.subject && e.subject.toLowerCase().includes(sf)) ||
      (e.from && e.from.toLowerCase().includes(sf)) ||
      (e.snippet && e.snippet.toLowerCase().includes(sf))
    );
  });

  const filteredEvents = storeStats.recentEvents.filter(ev => {
    if (!searchFilter) return true;
    const sf = searchFilter.toLowerCase();
    return (
      (ev.summary && ev.summary.toLowerCase().includes(sf)) ||
      (ev.organizer && ev.organizer.toLowerCase().includes(sf)) ||
      (ev.description && ev.description.toLowerCase().includes(sf))
    );
  });

  return (
    <div style={styles.container}>
      {/* Vercel Interactive Control Bar */}
      <div style={styles.controlBar}>
        <div style={styles.syncButtonGroup}>
          <button
            onClick={handleSyncGmail}
            disabled={syncingGmail}
            style={styles.vBtn}
            title="Ingest Gmail messages into GBrain Store"
          >
            {syncingGmail ? (
              <>
                <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Syncing...</span>
              </>
            ) : (
              <>
                <Mail size={14} style={{ color: '#ea4335' }} />
                <span>Sync Gmail</span>
              </>
            )}
          </button>

          <button
            onClick={handleSyncCalendar}
            disabled={syncingCalendar}
            style={styles.vBtn}
            title="Ingest Google Calendar events into GBrain Store"
          >
            {syncingCalendar ? (
              <>
                <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Syncing...</span>
              </>
            ) : (
              <>
                <Calendar size={14} style={{ color: '#4285f4' }} />
                <span>Sync Calendar</span>
              </>
            )}
          </button>

          {/* Interactive GBrain Store Inspector Button */}
          <button
            onClick={() => {
              fetchStoreStats();
              setIsStoreOpen(true);
            }}
            style={{ ...styles.vBtn, borderColor: 'rgba(80, 227, 194, 0.4)', backgroundColor: '#141414' }}
            title="Inspect & Delete GBrain Data Files"
          >
            <Database size={14} style={{ color: 'var(--vercel-cyan)' }} />
            <span>GBrain Store</span>
            <span style={styles.badgePill}>
              {storeStats.emailCount + storeStats.eventCount}
            </span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button
            onClick={handleClearHistory}
            style={{ ...styles.iconActionBtn }}
            title="Clear Chat History"
          >
            <Trash2 size={14} />
          </button>

          {user ? (
            <div style={styles.userProfile}>
              {user.picture ? (
                <img src={user.picture} alt={user.name} style={styles.avatar} />
              ) : (
                <UserIcon size={14} />
              )}
              <span style={styles.userName}>{user.name || user.email}</span>
              <a href="/api/auth/google" target="_blank" rel="noreferrer" style={styles.reAuthLink}>
                Re-Auth
              </a>
            </div>
          ) : (
            <a href="/api/auth/google" target="_blank" rel="noreferrer" style={styles.authBtn}>
              <Lock size={13} />
              <span>Connect Google OAuth</span>
            </a>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div style={{
          ...styles.toast,
          borderColor: toast.type === 'error' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)',
          backgroundColor: toast.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
          color: toast.type === 'error' ? '#fca5a5' : '#6ee7b7'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span>{toast.text}</span>
          </div>
          <button onClick={() => setToast(null)} style={styles.toastClose}>✕</button>
        </div>
      )}

      {/* Message Feed */}
      <div style={styles.messageArea}>
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';

          return (
            <div key={msg.id} className="fade-in" style={{
              ...styles.messageRow,
              justifyContent: isUser ? 'flex-end' : 'flex-start'
            }}>
              <div style={styles.avatarWrapper}>
                {isUser ? (
                  <div style={styles.userIconBox}><UserIcon size={14} color="#ffffff" /></div>
                ) : (
                  <div style={styles.botIconBox}><Bot size={14} color="#50e3c2" /></div>
                )}
              </div>

              <div style={{
                ...styles.bubble,
                backgroundColor: isUser ? '#1a1a1a' : '#0d0d0d',
                borderColor: isUser ? '#2e2e2e' : '#222222',
                borderLeft: !isUser && !msg.isError ? '3px solid var(--vercel-cyan)' : undefined
              }}>
                <div style={styles.bubbleHeader}>
                  <span style={styles.senderLabel}>{isUser ? 'You' : 'Personal Brain'}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {!isUser && msg.text && (
                      <button
                        onClick={() => handleCopyText(msg.text, msg.id)}
                        style={styles.actionIconButton}
                        title="Copy answer"
                      >
                        {copiedId === msg.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                      </button>
                    )}
                    <span style={styles.timestamp}>{msg.timestamp}</span>
                  </div>
                </div>

                <div style={styles.messageContent}>
                  {isUser ? (
                    msg.text
                  ) : msg.statusText && !msg.text ? (
                    <div style={styles.statusPill}>
                      <span className="live-dot" />
                      <span>{msg.statusText}</span>
                    </div>
                  ) : (
                    <>
                      {msg.statusText && (
                        <div style={styles.statusPill}>
                          <Zap size={12} style={{ color: 'var(--vercel-cyan)' }} />
                          <span>{msg.statusText}</span>
                        </div>
                      )}
                      <div className="markdown-body">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {loading && !messages.find(m => m.sender === 'bot' && m.statusText) && (
          <div style={styles.loadingContainer} className="fade-in">
            <div style={styles.botIconBox}><Bot size={14} color="#0070f3" /></div>
            <div style={styles.loadingPill}>
              <div className="live-dot" />
              <span>Thinking across GBrain store...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Interactive Command Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        style={styles.inputForm}
      >
        <div style={styles.inputContainer}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask a question across Gmail & Calendar..."
            style={styles.input}
          />
          {messages.some(m => m.sender === 'user') && !loading && (
            <button
              type="button"
              onClick={handleRegenerate}
              style={styles.regenBtn}
              title="Regenerate last response"
            >
              <RotateCw size={13} />
            </button>
          )}
          <button type="submit" disabled={loading || !inputValue.trim()} style={{
            ...styles.sendBtn,
            opacity: !inputValue.trim() || loading ? 0.4 : 1
          }}>
            <Send size={14} />
          </button>
        </div>
      </form>

      {/* Interactive GBrain Store Inspector & Deletion Modal */}
      {isStoreOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent} className="fade-in">
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={18} style={{ color: 'var(--vercel-cyan)' }} />
                <span style={{ fontWeight: '600', fontSize: '1rem', color: '#ffffff' }}>
                  GBrain Storage Manager
                </span>
                <span style={styles.badgePill}>{storeStats.emailCount} Emails</span>
                <span style={styles.badgePill}>{storeStats.eventCount} Events</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Delete/Clear Storage Button */}
                <button
                  onClick={handleClearGBrainStore}
                  disabled={clearingStore || (storeStats.emailCount === 0 && storeStats.eventCount === 0)}
                  style={styles.deleteStoreBtn}
                  title="Delete all files in GBrain Storage"
                >
                  <Trash2 size={13} />
                  <span>{clearingStore ? 'Clearing...' : 'Clear Storage'}</span>
                </button>
                <button onClick={() => setIsStoreOpen(false)} style={styles.closeBtn}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Controls */}
            <div style={styles.modalBody}>
              <div style={styles.tabHeader}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => { setActiveTab('emails'); setSelectedEntity(null); }}
                    style={{
                      ...styles.tabBtn,
                      backgroundColor: activeTab === 'emails' ? '#1f1f1f' : 'transparent',
                      color: activeTab === 'emails' ? '#ffffff' : 'var(--text-secondary)'
                    }}
                  >
                    <Mail size={13} />
                    <span>Emails ({storeStats.emailCount})</span>
                  </button>
                  <button
                    onClick={() => { setActiveTab('events'); setSelectedEntity(null); }}
                    style={{
                      ...styles.tabBtn,
                      backgroundColor: activeTab === 'events' ? '#1f1f1f' : 'transparent',
                      color: activeTab === 'events' ? '#ffffff' : 'var(--text-secondary)'
                    }}
                  >
                    <Calendar size={13} />
                    <span>Events ({storeStats.eventCount})</span>
                  </button>
                </div>

                <div style={styles.searchBox}>
                  <Search size={13} color="var(--text-tertiary)" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filter store entities..."
                    style={styles.searchInput}
                  />
                </div>
              </div>

              {/* Tab Grid View */}
              <div style={styles.modalGrid}>
                {/* Entity List */}
                <div style={styles.entityList}>
                  {activeTab === 'emails' ? (
                    filteredEmails.length === 0 ? (
                      <div style={styles.emptyState}>No email entities in GBrain storage.</div>
                    ) : (
                      filteredEmails.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => setSelectedEntity(item)}
                          style={{
                            ...styles.entityCard,
                            borderColor: selectedEntity === item ? 'var(--vercel-cyan)' : 'var(--border-subtle)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={styles.entitySubject}>{item.subject || '(No Subject)'}</div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEntity('email', item.messageId);
                              }}
                              style={styles.deleteCardBtn}
                              title="Delete email entity"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <div style={styles.entityFrom}>From: {item.from}</div>
                          <div style={styles.entitySnippet}>{item.snippet}</div>
                        </div>
                      ))
                    )
                  ) : (
                    filteredEvents.length === 0 ? (
                      <div style={styles.emptyState}>No event entities in GBrain storage.</div>
                    ) : (
                      filteredEvents.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => setSelectedEntity(item)}
                          style={{
                            ...styles.entityCard,
                            borderColor: selectedEntity === item ? 'var(--vercel-cyan)' : 'var(--border-subtle)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={styles.entitySubject}>{item.summary || item.title || '(No Title)'}</div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEntity('event', item.eventId);
                              }}
                              style={styles.deleteCardBtn}
                              title="Delete event entity"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <div style={styles.entityFrom}>Organizer: {item.organizer || 'N/A'}</div>
                          <div style={styles.entitySnippet}>
                            {item.start ? new Date(item.start).toLocaleString() : 'All Day'}
                          </div>
                        </div>
                      ))
                    )
                  )}
                </div>

                {/* Entity Json / Detail Preview */}
                <div style={styles.entityPreview}>
                  {selectedEntity ? (
                    <div>
                      <div style={styles.previewHeaderRow}>
                        <div style={styles.previewTitle}>
                          <FileText size={14} color="var(--vercel-cyan)" />
                          <span>Entity Properties</span>
                        </div>
                        <button
                          onClick={() => {
                            if (activeTab === 'emails') {
                              handleDeleteEntity('email', selectedEntity.messageId);
                            } else {
                              handleDeleteEntity('event', selectedEntity.eventId);
                            }
                          }}
                          style={styles.deleteSingleBtn}
                        >
                          <Trash2 size={12} />
                          <span>Delete Entity</span>
                        </button>
                      </div>
                      <pre style={styles.jsonPre}>
                        {JSON.stringify(selectedEntity, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div style={styles.previewEmpty}>
                      <Database size={24} color="var(--border-hover)" />
                      <span>Select an entity from the list to inspect or delete</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    maxWidth: '960px',
    margin: '0 auto',
    width: '100%',
    padding: '1rem',
    gap: '1rem',
    boxSizing: 'border-box'
  },
  controlBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    padding: '0.6rem 0.85rem',
    borderRadius: '10px',
    border: '1px solid var(--border-subtle)'
  },
  syncButtonGroup: {
    display: 'flex',
    gap: '0.5rem'
  },
  vBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    backgroundColor: '#111111',
    border: '1px solid #222222',
    color: '#ededed',
    padding: '0.4rem 0.75rem',
    borderRadius: '6px',
    fontSize: '0.82rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  badgePill: {
    fontSize: '0.68rem',
    padding: '1px 6px',
    borderRadius: '10px',
    backgroundColor: '#222222',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)'
  },
  iconActionBtn: {
    backgroundColor: '#111111',
    border: '1px solid #222222',
    color: 'var(--text-secondary)',
    padding: '0.4rem',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  authBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    backgroundColor: '#0070f3',
    color: '#ffffff',
    textDecoration: 'none',
    padding: '0.4rem 0.75rem',
    borderRadius: '6px',
    fontSize: '0.82rem',
    fontWeight: '500'
  },
  userProfile: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.82rem',
    color: 'var(--text-primary)'
  },
  avatar: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    border: '1px solid #333'
  },
  userName: {
    fontWeight: '500'
  },
  reAuthLink: {
    color: 'var(--text-tertiary)',
    textDecoration: 'none',
    fontSize: '0.75rem',
    marginLeft: '4px'
  },
  toast: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.6rem 1rem',
    borderRadius: '8px',
    border: '1px solid',
    fontSize: '0.84rem'
  },
  toastClose: {
    background: 'none',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: '0.9rem'
  },
  messageArea: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    paddingRight: '0.2rem'
  },
  messageRow: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'flex-start'
  },
  avatarWrapper: {
    marginTop: '2px'
  },
  userIconBox: {
    width: '26px',
    height: '26px',
    borderRadius: '6px',
    backgroundColor: '#262626',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  botIconBox: {
    width: '26px',
    height: '26px',
    borderRadius: '6px',
    backgroundColor: '#111111',
    border: '1px solid #222222',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  bubble: {
    maxWidth: '82%',
    padding: '0.85rem 1.1rem',
    borderRadius: '10px',
    border: '1px solid',
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
  },
  bubbleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.4rem',
    gap: '1rem'
  },
  senderLabel: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#ffffff'
  },
  timestamp: {
    fontSize: '0.68rem',
    color: 'var(--text-tertiary)'
  },
  actionIconButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-tertiary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: '2px'
  },
  messageContent: {
    fontSize: '0.9rem'
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
    backgroundColor: '#141414',
    border: '1px solid #262626',
    padding: '4px 10px',
    borderRadius: '20px',
    margin: '4px 0'
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem'
  },
  loadingPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: '#111111',
    border: '1px solid #222222',
    padding: '0.5rem 0.85rem',
    borderRadius: '20px',
    fontSize: '0.82rem',
    color: 'var(--text-secondary)'
  },
  inputForm: {
    marginTop: 'auto'
  },
  inputContainer: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    border: '1px solid var(--border-medium)',
    borderRadius: '10px',
    padding: '0.35rem 0.5rem 0.35rem 1rem',
    gap: '0.5rem',
    transition: 'all 0.15s ease'
  },
  input: {
    flex: 1,
    backgroundColor: 'transparent',
    border: 'none',
    color: '#ffffff',
    fontSize: '0.92rem',
    outline: 'none',
    padding: '0.5rem 0'
  },
  regenBtn: {
    backgroundColor: '#171717',
    border: '1px solid #262626',
    color: 'var(--text-secondary)',
    borderRadius: '6px',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  sendBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    backgroundColor: '#ffffff',
    color: '#000000',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(4px)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem'
  },
  modalContent: {
    backgroundColor: '#0a0a0a',
    border: '1px solid var(--border-medium)',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '920px',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.25rem',
    borderBottom: '1px solid var(--border-subtle)',
    backgroundColor: '#111111'
  },
  deleteStoreBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#ef4444',
    padding: '0.35rem 0.75rem',
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontWeight: '500',
    cursor: 'pointer'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer'
  },
  modalBody: {
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    flex: 1,
    overflow: 'hidden'
  },
  tabHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  tabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.4rem 0.85rem',
    borderRadius: '6px',
    border: '1px solid #262626',
    fontSize: '0.82rem',
    cursor: 'pointer'
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: '#111111',
    border: '1px solid #262626',
    borderRadius: '6px',
    padding: '0.35rem 0.65rem',
    width: '240px'
  },
  searchInput: {
    backgroundColor: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#ffffff',
    fontSize: '0.8rem',
    width: '100%'
  },
  modalGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.2fr',
    gap: '1rem',
    flex: 1,
    overflow: 'hidden'
  },
  entityList: {
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    paddingRight: '0.3rem'
  },
  entityCard: {
    backgroundColor: '#111111',
    border: '1px solid',
    borderRadius: '8px',
    padding: '0.65rem 0.85rem',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  deleteCardBtn: {
    background: 'none',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    opacity: 0.7,
    padding: '2px'
  },
  entitySubject: {
    fontSize: '0.84rem',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '2px'
  },
  entityFrom: {
    fontSize: '0.74rem',
    color: 'var(--vercel-cyan)',
    marginBottom: '4px'
  },
  entitySnippet: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  entityPreview: {
    backgroundColor: '#050505',
    border: '1px solid var(--border-subtle)',
    borderRadius: '8px',
    padding: '1rem',
    overflowY: 'auto'
  },
  previewHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem'
  },
  previewTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#ffffff'
  },
  deleteSingleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    color: '#ef4444',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    cursor: 'pointer'
  },
  jsonPre: {
    fontSize: '0.78rem',
    fontFamily: 'var(--font-mono)',
    color: '#a1a1a1',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  },
  emptyState: {
    color: 'var(--text-tertiary)',
    fontSize: '0.84rem',
    padding: '1rem',
    textAlign: 'center'
  },
  previewEmpty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '0.5rem',
    color: 'var(--text-tertiary)',
    fontSize: '0.82rem'
  }
};
