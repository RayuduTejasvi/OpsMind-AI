import { useEffect, useMemo, useRef, useState } from 'react';

const AUTH_STORAGE_KEY = 'opsmind_auth';

function loadAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
}

function saveAuth(payload) {
  if (!payload) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
}

async function apiRequest(path, options = {}, accessToken = '') {
  const headers = new Headers(options.headers || {});
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(path, { ...options, headers });
  return response;
}

function parseEventBlock(block) {
  const lines = block.split('\n');
  let event = '';
  let data = '';

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      data += line.slice(5).trim();
    }
  }

  if (!event) {
    return null;
  }

  return { event, data };
}

export default function App() {
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registerRole, setRegisterRole] = useState('employee');
  const [auth, setAuth] = useState(() => loadAuth());
  const [status, setStatus] = useState('Ready');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [serverHealth, setServerHealth] = useState('checking');

  const [tab, setTab] = useState('chat');
  const [query, setQuery] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [streaming, setStreaming] = useState(false);

  const [documents, setDocuments] = useState([]);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [billingInfo, setBillingInfo] = useState(null);
  const uploadInputRef = useRef(null);

  const isAdmin = auth?.user?.role === 'admin';

  const greeting = useMemo(() => {
    if (!auth?.user) {
      return 'Sign in to start asking SOP questions.';
    }
    return `Logged in as ${auth.user.email} (${auth.user.role}, ${auth.user.planTier})`;
  }, [auth]);

  const adminSummary = useMemo(() => {
    const total = documents.length;
    const indexed = documents.filter((doc) => String(doc.status || '').toLowerCase().includes('index')).length;
    const processing = documents.filter((doc) => String(doc.status || '').toLowerCase().includes('process')).length;
    const errored = documents.filter((doc) => String(doc.status || '').toLowerCase().includes('error')).length;

    return { total, indexed, processing, errored };
  }, [documents]);

  useEffect(() => {
    fetch('/health')
      .then((r) => r.json())
      .then((data) => setServerHealth(data.status || 'unknown'))
      .catch(() => setServerHealth('down'));
  }, []);

  useEffect(() => {
    saveAuth(auth);
  }, [auth]);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setStatus('Authenticating...');

    const path = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const payload = authMode === 'login'
      ? { email, password }
      : { email, password, role: registerRole };

    const response = await apiRequest(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const body = await response.json();
    if (!response.ok) {
      setStatus(body.message || 'Authentication failed');
      return;
    }

    setAuth(body);
    setStatus('Authentication successful');
    setEmail('');
    setPassword('');
    await refreshChatHistory(body.accessToken);
    if (body.user.role === 'admin') {
      await refreshDocuments(body.accessToken);
    }
  }

  function logout() {
    setAuth(null);
    setMessages([]);
    setSessions([]);
    setDocuments([]);
    setSessionId('');
    setStatus('Logged out');
  }

  async function refreshChatHistory(token = auth?.accessToken) {
    if (!token) {
      return;
    }

    const response = await apiRequest('/api/chat/history', { method: 'GET' }, token);
    if (!response.ok) {
      return;
    }

    const body = await response.json();
    setSessions(body.sessions || []);
  }

  async function refreshDocuments(token = auth?.accessToken) {
    if (!token || !isAdmin) {
      return;
    }

    const response = await apiRequest('/api/admin/documents', { method: 'GET' }, token);
    const body = await response.json();
    if (response.ok) {
      setDocuments(body.documents || []);
    }
  }

  function appendToken(text) {
    setMessages((previous) => {
      if (!previous.length || previous[previous.length - 1].role !== 'assistant') {
        return [...previous, { role: 'assistant', content: text, citations: [] }];
      }

      const next = [...previous];
      const last = { ...next[next.length - 1] };
      last.content = `${last.content}${text}`;
      next[next.length - 1] = last;
      return next;
    });
  }

  function appendCitation(citation) {
    setMessages((previous) => {
      if (!previous.length || previous[previous.length - 1].role !== 'assistant') {
        return previous;
      }

      const next = [...previous];
      const last = { ...next[next.length - 1] };
      last.citations = [...(last.citations || []), citation];
      next[next.length - 1] = last;
      return next;
    });
  }

  async function askQuestion(event) {
    event.preventDefault();
    if (!auth?.accessToken || !query.trim() || streaming) {
      return;
    }

    const question = query.trim();
    setQuery('');
    setStreaming(true);
    setStatus('Streaming answer...');
    setMessages((previous) => [...previous, { role: 'user', content: question, citations: [] }]);

    const response = await apiRequest(
      '/api/chat',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ query: question, session_id: sessionId || undefined }),
      },
      auth.accessToken
    );

    if (!response.ok || !response.body) {
      const body = await response.json().catch(() => ({ message: 'Chat request failed' }));
      setStatus(body.message || 'Chat request failed');
      setStreaming(false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';

      for (const block of blocks) {
        const parsed = parseEventBlock(block);
        if (!parsed) {
          continue;
        }

        if (parsed.event === 'token') {
          const data = JSON.parse(parsed.data || '{}');
          appendToken(data.text || '');
        }

        if (parsed.event === 'citation') {
          const citation = JSON.parse(parsed.data || '{}');
          appendCitation(citation);
        }

        if (parsed.event === 'done') {
          const donePayload = JSON.parse(parsed.data || '{}');
          setSessionId(donePayload.session_id || sessionId);
          setStatus(`Answer complete (${donePayload.total_tokens || 0} tokens)`);
          setStreaming(false);
          await refreshChatHistory();
        }
      }
    }

    setStreaming(false);
  }

  async function loadSession(session) {
    setSessionId(session.sessionId);
    setMessages(session.messages || []);
    setStatus(`Loaded session ${session.sessionId}`);
  }

  async function clearSession(targetSessionId) {
    if (!auth?.accessToken) {
      return;
    }

    const response = await apiRequest(`/api/chat/history/${targetSessionId}`, { method: 'DELETE' }, auth.accessToken);
    if (response.ok) {
      if (targetSessionId === sessionId) {
        setSessionId('');
        setMessages([]);
      }
      await refreshChatHistory();
      setStatus('Session deleted');
    }
  }

  async function uploadDocuments(event) {
    event.preventDefault();
    if (!auth?.accessToken || !uploadFiles.length) {
      return;
    }

    const formData = new FormData();
    for (const file of uploadFiles) {
      formData.append('file', file);
    }

    setStatus('Uploading and indexing...');
    const response = await apiRequest('/api/admin/upload', {
      method: 'POST',
      body: formData,
    }, auth.accessToken);

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(body.message || 'Upload failed');
      return;
    }

    setStatus('Documents indexed successfully');
    setUploadFiles([]);
    await refreshDocuments();
  }

  async function removeDocument(documentId) {
    if (!auth?.accessToken) {
      return;
    }

    const response = await apiRequest(`/api/admin/documents/${documentId}`, { method: 'DELETE' }, auth.accessToken);
    if (response.status === 204) {
      await refreshDocuments();
      setStatus('Document deleted');
    }
  }

  async function reindexDocument(documentId) {
    if (!auth?.accessToken) {
      return;
    }

    setStatus('Reindexing document...');
    const response = await apiRequest(`/api/admin/documents/${documentId}/reindex`, { method: 'POST' }, auth.accessToken);
    const body = await response.json().catch(() => ({}));

    if (response.ok) {
      setStatus(body.message || 'Reindexed');
      await refreshDocuments();
    }
  }

  async function createCheckout() {
    if (!auth?.accessToken) {
      return;
    }

    const response = await apiRequest('/api/billing/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'pro' }),
    }, auth.accessToken);

    const body = await response.json();
    setBillingInfo(body);
    setStatus('Checkout payload received');
  }

  async function openPortal() {
    if (!auth?.accessToken) {
      return;
    }

    const response = await apiRequest('/api/billing/portal', { method: 'GET' }, auth.accessToken);
    const body = await response.json();
    setBillingInfo(body);
    setStatus('Billing portal payload received');
  }

  useEffect(() => {
    if (auth?.accessToken) {
      refreshChatHistory(auth.accessToken);
      if (auth.user?.role === 'admin') {
        refreshDocuments(auth.accessToken);
      }
    }
  }, [auth?.accessToken]);

  return (
    <div className="app-shell">
      <div className="aurora" />
      {auth && (
        <header className="top-bar">
          <div>
            <h1>OpsMind AI</h1>
            <p>Enterprise SOP Brain</p>
          </div>
          <div className="pill-group">
            <span className={`pill ${serverHealth === 'ok' ? 'ok' : 'error'}`}>API: {serverHealth}</span>
            <span className="pill">{greeting}</span>
          </div>
        </header>
      )}

      {!auth && (
        <section className="w-full max-w-[1000px] grid grid-cols-1 md:grid-cols-2 bg-surface-container-lowest rounded-xl overflow-hidden auth-portal-card border border-outline-variant mx-auto">
          {/* Left: Branding */}
          <div className="hidden md:flex flex-col justify-between p-xl bg-primary text-on-primary relative overflow-hidden">
            <div className="z-10">
              <div className="flex items-center gap-sm mb-xl">
                <span className="material-symbols-outlined text-on-primary" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
                <span className="text-h3 font-h3 tracking-tight">OpsMind AI</span>
              </div>
              <h1 className="text-h1 font-h1 mb-md">Operational Intelligence at scale.</h1>
              <p className="text-body-lg opacity-80 max-w-sm">Simplify complex SOPs and streamline your workspace with our enterprise-grade AI assistant.</p>
            </div>
            <div className="z-10 bg-white/10 backdrop-blur-md p-lg rounded-lg border border-white/20">
              <p className="text-label-sm italic opacity-90 mb-sm">"The transition to OpsMind has reduced our operational overhead by 40%."</p>
              <div className="flex items-center gap-sm">
                <div className="w-8 h-8 rounded-full bg-secondary-fixed" />
                <div>
                  <p className="text-label-sm font-bold">Sarah Chen</p>
                  <p className="text-[10px] uppercase tracking-wider opacity-70">Operations Director</p>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-primary-container rounded-full blur-3xl opacity-30" />
            <div className="absolute top-10 right-10 w-40 h-40 bg-indigo-400 rounded-full blur-3xl opacity-20" />
          </div>

          {/* Right: Auth Canvas */}
          <div className="p-xl flex flex-col justify-center">
            {/* Error Toast */}
            {(status && (status.toLowerCase().includes('invalid') || status.toLowerCase().includes('failed') || status.toLowerCase().includes('unauthorized'))) && (
              <div className="fixed top-lg right-lg z-50 flex items-center gap-md bg-error-container text-on-error-container px-lg py-md rounded-xl shadow-lg border border-error/10">
                <span className="material-symbols-outlined text-[20px]">error</span>
                <span className="font-label-sm">{status}</span>
                <button className="ml-sm hover:opacity-70 transition-opacity" onClick={() => setStatus('Ready')}>
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            )}

            {/* Login View */}
            {authMode === 'login' && (
              <div className="space-y-lg" id="login-view">
              <div className="space-y-sm">
                <h2 className="text-h2 font-h2 text-on-surface">Welcome back</h2>
                <p className="text-on-surface-variant text-body-md">Enter your credentials to access your workspace.</p>
              </div>
              <form className="space-y-md" onSubmit={handleAuthSubmit}>
                <div className="space-y-xs">
                  <label className="text-label-sm font-semibold text-on-surface-variant">Email Address</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline text-[20px]">mail</span>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-xl pr-md py-md bg-surface-container-low border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline/50" placeholder="name@company.com" type="email" required />
                  </div>
                </div>
                <div className="space-y-xs">
                  <div className="flex justify-between items-center">
                    <label className="text-label-sm font-semibold text-on-surface-variant">Password</label>
                    <a className="text-label-sm text-primary hover:underline" href="#">Forgot Password?</a>
                  </div>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline text-[20px]">lock</span>
                    <input value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-xl pr-md py-md bg-surface-container-low border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline/50" placeholder="••••••••" type="password" minLength={8} required />
                  </div>
                </div>
                <button className="w-full py-md bg-primary text-on-primary font-semibold rounded-lg hover:bg-primary-container transition-colors shadow-sm active:scale-[0.98] duration-150" type="submit">Login to Workspace</button>
              </form>

              <div className="relative py-sm">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-outline-variant" /></div>
                <div className="relative flex justify-center text-label-sm"><span className="bg-surface-container-lowest px-md text-outline">Or continue with</span></div>
              </div>

              <div className="grid grid-cols-2 gap-md">
                <button className="flex items-center justify-center gap-sm py-sm border border-outline-variant rounded-lg hover:bg-surface-container-low transition-colors font-label-sm">
                  <img className="w-4 h-4" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDPIDI5Xx6eog4w23Y4HcRa1BPUcOabYPMvF65OoRNeV-LGJrKzpu8hNtTsCoFi3K0oGjEhNcWDWWDZuvAIdbIwEr0CoG4JeC2TVMN3LrFLD3Zq5SGwanxYWGvUwhbwNNvXhzyH4Bgll-vZakGaXEp-bRAF-Qc0NZm6Y015ccnGUFia2SMLwlc5RTJJ1t4nwSL9ZTEf6VbQVNAlEflA0O3vbFl_3I-givtltU3o_KA2rvmAVxHn887hXZJjG2PSzYcr79xsqcjG_bJp" alt="Google" />
                  Google
                </button>
                <button className="flex items-center justify-center gap-sm py-sm border border-outline-variant rounded-lg hover:bg-surface-container-low transition-colors font-label-sm">
                  <span className="material-symbols-outlined text-[18px]">terminal</span>
                  SSO
                </button>
              </div>

                <p className="text-center text-body-md text-on-surface-variant pt-md">Don't have an account? <button type="button" className="text-primary font-semibold hover:underline" onClick={() => setAuthMode('register')}>Switch to Register</button></p>
              </div>
            )}

            {/* Register View */}
            {authMode === 'register' && (
              <div className="space-y-lg" id="register-view">
                <div className="space-y-sm">
                  <h2 className="text-h2 font-h2 text-on-surface">Create account</h2>
                  <p className="text-on-surface-variant text-body-md">Join OpsMind AI and start optimizing your operations.</p>
                </div>
                <form className="space-y-md" onSubmit={handleAuthSubmit}>
                  <div className="space-y-xs">
                    <label className="text-label-sm font-semibold text-on-surface-variant">Work Email</label>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-md py-md bg-surface-container-low border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" placeholder="name@company.com" type="email" required />
                  </div>
                  <div className="space-y-xs">
                    <label className="text-label-sm font-semibold text-on-surface-variant">Password</label>
                    <input value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-md py-md bg-surface-container-low border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" placeholder="Create a strong password" type="password" minLength={8} required />
                  </div>
                  <div className="space-y-xs">
                    <label className="text-label-sm font-semibold text-on-surface-variant">Organization Role</label>
                    <select value={registerRole} onChange={(e) => setRegisterRole(e.target.value)} className="w-full px-md py-md bg-surface-container-low border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all appearance-none">
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="flex items-start gap-sm py-sm">
                    <input checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-1 rounded border-outline-variant text-primary focus:ring-primary" id="terms" type="checkbox" />
                    <label className="text-[12px] text-on-surface-variant leading-relaxed" htmlFor="terms">I agree to the <a className="text-primary hover:underline" href="#">Terms of Service</a> and <a className="text-primary hover:underline" href="#">Privacy Policy</a>.</label>
                  </div>
                  <button disabled={!termsAccepted} className="w-full py-md bg-primary text-on-primary font-semibold rounded-lg hover:bg-primary-container transition-colors shadow-sm active:scale-[0.98] duration-150" type="submit">Register Account</button>
                </form>
                <p className="text-center text-body-md text-on-surface-variant pt-md">Already have an account? <button type="button" className="text-primary font-semibold hover:underline" onClick={() => setAuthMode('login')}>Back to Login</button></p>
              </div>
            )}

            <div className="fixed bottom-lg left-1/2 -translate-x-1/2 flex items-center gap-xl opacity-40 text-label-sm">
              <span>© 2024 OpsMind AI Inc.</span>
              <div className="flex gap-md">
                <a className="hover:text-primary transition-colors" href="#">Support</a>
                <a className="hover:text-primary transition-colors" href="#">Privacy</a>
                <a className="hover:text-primary transition-colors" href="#">Terms</a>
              </div>
            </div>
          </div>
        </section>
      )}

      {auth && (
        <main className="workspace">
          <aside className="sidebar card">
            <button type="button" onClick={() => setTab('chat')} className={tab === 'chat' ? 'active' : ''}>Chat</button>
            {isAdmin && <button type="button" onClick={() => setTab('admin')} className={tab === 'admin' ? 'active' : ''}>Admin</button>}
            <button type="button" onClick={() => setTab('billing')} className={tab === 'billing' ? 'active' : ''}>Billing</button>
            <button type="button" onClick={logout}>Logout</button>

            <h3>Sessions</h3>
            <div className="session-list">
              {sessions.length === 0 ? (
                <div className="session-empty">
                  No saved sessions yet.
                </div>
              ) : (
                sessions.map((session) => (
                  <div key={session.sessionId} className="session-item">
                    <button type="button" onClick={() => loadSession(session)}>{session.sessionId.slice(0, 8)}</button>
                    <button type="button" className="danger" onClick={() => clearSession(session.sessionId)}>x</button>
                  </div>
                ))
              )}
            </div>
          </aside>

          <section className="content card">
            {tab === 'chat' && (
              <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm">
                <div className="flex items-center justify-between mb-md">
                  <div>
                    <h2 className="font-h3 text-h3">Chat</h2>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">Ask questions about your SOPs</p>
                  </div>
                  <div className="text-sm text-on-surface-variant">{greeting}</div>
                </div>

                <div className="chat-window mb-md">
                  {messages.map((message, index) => (
                    <article key={`${message.role}-${index}`} className={`message ${message.role}`}>
                      <h4 className="capitalize">{message.role}</h4>
                      <p>{message.content}</p>
                      {(message.citations || []).length > 0 && (
                        <ul>
                          {message.citations.map((citation, citationIndex) => (
                            <li key={`${citation.filename}-${citationIndex}`}>
                              {citation.filename} | Page {citation.page} | Section {citation.section || 'N/A'}
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  ))}
                </div>

                <form onSubmit={askQuestion} className="chat-form">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask anything about SOPs"
                    disabled={streaming}
                  />
                  <button className="bg-primary text-on-primary px-md py-sm rounded-lg" type="submit" disabled={streaming}>{streaming ? 'Streaming...' : 'Send'}</button>
                </form>
              </div>
            )}

            {tab === 'admin' && isAdmin && (
              <div className="min-h-full bg-background text-on-background">
                <div className="w-full grid grid-cols-1 xl:grid-cols-[240px_1fr] gap-lg">
                  <aside className="border border-slate-200 bg-slate-50 flex flex-col p-4 space-y-6 rounded-xl">
                    <div className="space-y-1">
                      <div className="text-indigo-600 font-black uppercase tracking-widest text-xs mb-1">Workspace</div>
                      <div className="text-slate-500 text-[11px] font-medium px-1">Operational Intel</div>
                    </div>
                    <nav className="flex-1 space-y-1">
                      <button type="button" className="w-full flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-200/50 rounded-lg transition-all text-[13px] leading-relaxed text-left">
                        <span className="material-symbols-outlined">chat_bubble</span>
                        <span>Sessions</span>
                      </button>
                      <button type="button" className="w-full flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-200/50 rounded-lg transition-all text-[13px] leading-relaxed text-left">
                        <span className="material-symbols-outlined">database</span>
                        <span>Knowledge Base</span>
                      </button>
                      <button type="button" className="w-full flex items-center gap-3 px-3 py-2 bg-indigo-50 text-indigo-700 border-l-4 border-indigo-600 rounded-r-lg font-semibold text-[13px] leading-relaxed text-left">
                        <span className="material-symbols-outlined">shield_person</span>
                        <span>Admin Panel</span>
                      </button>
                      <button type="button" className="w-full flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-200/50 rounded-lg transition-all text-[13px] leading-relaxed text-left">
                        <span className="material-symbols-outlined">settings</span>
                        <span>Settings</span>
                      </button>
                    </nav>
                    <button type="button" onClick={() => setTab('chat')} className="bg-indigo-600 text-white rounded-lg px-4 py-2.5 flex items-center justify-center gap-2 font-semibold text-[13px] shadow-sm hover:opacity-90 transition-opacity border-0">
                      <span className="material-symbols-outlined text-[18px]">add</span>
                      New Session
                    </button>
                    <div className="pt-4 border-t border-slate-200">
                      <button type="button" className="w-full flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-200/50 rounded-lg transition-all text-[13px] leading-relaxed text-left">
                        <span className="material-symbols-outlined">help</span>
                        <span>Help Center</span>
                      </button>
                    </div>
                  </aside>

                  <div className="flex flex-col gap-lg">
                    <header className="bg-white border border-slate-200 shadow-sm flex justify-between items-center w-full px-6 py-2 h-14 rounded-xl">
                      <div className="flex items-center gap-4">
                        <div className="text-lg font-bold tracking-tight text-slate-900">OpsMind AI</div>
                        <div className="h-6 w-[1px] bg-slate-200 mx-2" />
                        <div className="flex items-center bg-slate-100 rounded-full px-3 py-1.5 gap-2 w-64">
                          <span className="material-symbols-outlined text-slate-400 text-[18px]">search</span>
                          <input className="bg-transparent border-none focus:ring-0 text-sm w-full p-0" placeholder="Search operational intel..." type="text" />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button type="button" className="p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors border-0 bg-transparent">
                          <span className="material-symbols-outlined">account_circle</span>
                        </button>
                        <button type="button" onClick={logout} className="p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors border-0 bg-transparent">
                          <span className="material-symbols-outlined">logout</span>
                        </button>
                      </div>
                    </header>

                    <main className="flex-1 overflow-y-auto space-y-lg">
                      <div className="flex flex-col gap-sm">
                        <h1 className="font-h1 text-h1 text-on-surface">Admin Panel</h1>
                        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">Manage your organization's knowledge base, API configurations, and document processing pipeline.</p>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
                        <section className="lg:col-span-4 flex flex-col gap-md">
                          <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm flex flex-col gap-md h-full">
                            <div className="flex items-center gap-sm">
                              <span className="material-symbols-outlined text-primary">upload_file</span>
                              <h2 className="font-h3 text-h3">Upload Documents</h2>
                            </div>

                            <button
                              type="button"
                              onClick={() => uploadInputRef.current?.click()}
                              className="border-2 border-dashed border-outline-variant rounded-xl p-xl flex flex-col items-center justify-center text-center gap-sm bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer group"
                            >
                              <span className="material-symbols-outlined text-primary text-[48px] mb-2 group-hover:scale-110 transition-transform">cloud_upload</span>
                              <div className="font-h3 text-h3 text-on-surface">Drop PDF files here</div>
                              <p className="font-label-sm text-label-sm text-on-surface-variant">Max file size: 50MB. PDFs only.</p>
                              <span className="mt-sm bg-primary text-on-primary px-lg py-sm rounded-lg font-medium text-body-md shadow-sm">Browse Files</span>
                            </button>

                            <input
                              ref={uploadInputRef}
                              className="hidden"
                              type="file"
                              multiple
                              accept="application/pdf"
                              onChange={(event) => setUploadFiles(Array.from(event.target.files || []))}
                            />

                            {uploadFiles.length > 0 && (
                              <form onSubmit={uploadDocuments}>
                                <button type="submit" className="w-full bg-inverse-surface text-inverse-on-surface py-sm rounded-lg font-medium hover:opacity-90 transition-opacity">Upload {uploadFiles.length} file(s)</button>
                              </form>
                            )}

                            <div className="space-y-base">
                              <div className="flex justify-between items-center px-base">
                                <span className="font-label-sm text-label-sm text-on-surface-variant">{uploadFiles[0]?.name || 'No file selected'}</span>
                                <span className="font-label-sm text-label-sm text-primary">{uploadFiles.length ? 'Ready' : '0%'}</span>
                              </div>
                              <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                                <div className={`bg-primary h-full ${uploadFiles.length ? 'w-full' : 'w-0'}`} style={{ transition: 'width 0.3s ease' }} />
                              </div>
                            </div>
                          </div>
                        </section>

                        <section className="lg:col-span-8 flex flex-col gap-lg">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg h-full">
                            <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm flex flex-col gap-md">
                              <div className="flex items-center gap-sm">
                                <span className="material-symbols-outlined text-primary">key</span>
                                <h2 className="font-h3 text-h3">API Configuration</h2>
                              </div>
                              <div className="space-y-md">
                                <div className="space-y-xs">
                                  <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">OpenAI API Key</label>
                                  <div className="flex gap-sm">
                                    <input className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg px-md py-sm font-code text-code focus:ring-2 focus:ring-primary focus:border-transparent outline-none" type="password" value="sk-••••••••••••••••••••••••" readOnly />
                                    <button type="button" className="p-2 text-primary hover:bg-primary-fixed rounded-lg transition-colors border-0 bg-transparent">
                                      <span className="material-symbols-outlined">visibility</span>
                                    </button>
                                  </div>
                                </div>
                                <div className="space-y-xs">
                                  <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Base URL</label>
                                  <input className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-sm font-body-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none" placeholder="https://api.openai.com/v1" type="text" />
                                </div>
                                <button type="button" className="w-full bg-inverse-surface text-inverse-on-surface py-sm rounded-lg font-medium hover:opacity-90 transition-opacity">Save Keys</button>
                              </div>
                            </div>

                            <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm flex flex-col gap-md">
                              <div className="flex items-center gap-sm">
                                <span className="material-symbols-outlined text-primary">settings_suggest</span>
                                <h2 className="font-h3 text-h3">System Preferences</h2>
                              </div>
                              <div className="space-y-lg py-md">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <div className="font-body-md font-semibold text-on-surface">Dark Mode</div>
                                    <div className="font-label-sm text-label-sm text-on-surface-variant">Switch between light and dark interface</div>
                                  </div>
                                  <div className="w-12 h-6 bg-surface-container-highest rounded-full p-1 relative flex items-center shadow-inner">
                                    <div className="w-4 h-4 bg-white rounded-full shadow-sm translate-x-0" />
                                  </div>
                                </div>
                                <div className="flex justify-between items-center">
                                  <div>
                                    <div className="font-body-md font-semibold text-on-surface">Auto-Indexing</div>
                                    <div className="font-label-sm text-label-sm text-on-surface-variant">Automatically index documents after upload</div>
                                  </div>
                                  <div className="w-12 h-6 bg-primary-container rounded-full p-1 relative flex items-center shadow-inner">
                                    <div className="w-4 h-4 bg-white rounded-full shadow-sm translate-x-6" />
                                  </div>
                                </div>
                              </div>
                              <div className="mt-auto p-md bg-secondary-container rounded-lg border border-outline-variant flex items-start gap-sm">
                                <span className="material-symbols-outlined text-secondary">info</span>
                                <p className="font-label-sm text-label-sm text-on-secondary-container">Your changes are automatically synced across the operational workspace.</p>
                              </div>
                            </div>
                          </div>
                        </section>
                      </div>

                      <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
                        <div className="p-lg border-b border-outline-variant flex flex-col md:flex-row md:items-center justify-between gap-md">
                          <div className="flex flex-col">
                            <h2 className="font-h2 text-h2 text-on-surface">Knowledge Base Documents</h2>
                            <p className="font-label-sm text-label-sm text-on-surface-variant">Managing {adminSummary.total} documents ({adminSummary.indexed} indexed, {adminSummary.processing} processing, {adminSummary.errored} errors).</p>
                          </div>
                          <div className="flex gap-sm">
                            <button type="button" className="flex items-center gap-xs px-md py-sm border border-outline-variant rounded-lg font-medium text-body-md hover:bg-surface-container transition-colors bg-transparent">
                              <span className="material-symbols-outlined text-[20px]">filter_list</span>
                              Filter
                            </button>
                            <button type="button" onClick={() => refreshDocuments()} className="flex items-center gap-xs px-md py-sm bg-primary text-on-primary rounded-lg font-medium text-body-md hover:opacity-90 transition-opacity border-0">
                              <span className="material-symbols-outlined text-[20px]">refresh</span>
                              Sync All
                            </button>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="bg-surface-container-low border-b border-outline-variant">
                                <th className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Filename</th>
                                <th className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Upload Date</th>
                                <th className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Page Count</th>
                                <th className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Status</th>
                                <th className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant">
                              {documents.length === 0 && (
                                <tr>
                                  <td className="px-lg py-md text-on-surface-variant" colSpan={5}>No documents found. Upload PDFs to populate the knowledge base.</td>
                                </tr>
                              )}
                              {documents.map((doc) => {
                                const statusLower = String(doc.status || '').toLowerCase();
                                const isIndexed = statusLower.includes('index');
                                const isProcessing = statusLower.includes('process');
                                const isError = statusLower.includes('error');

                                const statusClass = isIndexed
                                  ? 'bg-green-100 text-green-700'
                                  : isProcessing
                                    ? 'bg-blue-100 text-blue-700'
                                    : isError
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-slate-100 text-slate-700';

                                const dotClass = isIndexed
                                  ? 'bg-green-500'
                                  : isProcessing
                                    ? 'bg-blue-500 animate-pulse'
                                    : isError
                                      ? 'bg-red-500'
                                      : 'bg-slate-500';

                                return (
                                  <tr key={doc._id} className="hover:bg-surface-container-lowest transition-colors">
                                    <td className="px-lg py-md">
                                      <div className="flex items-center gap-md">
                                        <div className="w-10 h-10 bg-error-container text-on-error-container rounded flex items-center justify-center">
                                          <span className="material-symbols-outlined">picture_as_pdf</span>
                                        </div>
                                        <div>
                                          <div className="font-body-md font-semibold text-on-surface">{doc.originalName}</div>
                                          <div className="font-label-sm text-label-sm text-on-surface-variant">Chunks: {doc.chunkCount || 0}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-lg py-md font-body-md text-on-surface-variant">{new Date(doc.createdAt || Date.now()).toLocaleDateString()}</td>
                                    <td className="px-lg py-md font-body-md text-on-surface-variant">{doc.pageCount || 0} Pages</td>
                                    <td className="px-lg py-md">
                                      <span className={`px-3 py-1 rounded-full font-label-sm text-label-sm flex items-center w-fit gap-1 ${statusClass}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} /> {doc.status || 'Unknown'}
                                      </span>
                                    </td>
                                    <td className="px-lg py-md text-right">
                                      <div className="flex justify-end gap-sm">
                                        <button type="button" className="p-2 hover:bg-surface-container rounded-lg transition-colors text-on-surface-variant border-0 bg-transparent" title="Reindex" onClick={() => reindexDocument(doc._id)}><span className="material-symbols-outlined">sync</span></button>
                                        <button type="button" className="p-2 hover:bg-error-container rounded-lg transition-colors text-error border-0 bg-transparent" title="Delete" onClick={() => removeDocument(doc._id)}><span className="material-symbols-outlined">delete</span></button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div className="p-md border-t border-outline-variant flex items-center justify-between bg-surface-container-low">
                          <span className="font-label-sm text-label-sm text-on-surface-variant">Showing {documents.length ? `1-${documents.length}` : '0'} of {documents.length} documents</span>
                          <div className="flex gap-xs">
                            <button type="button" className="p-2 hover:bg-surface-container rounded-lg transition-colors disabled:opacity-30" disabled><span className="material-symbols-outlined">chevron_left</span></button>
                            <button type="button" className="p-2 hover:bg-surface-container rounded-lg transition-colors" disabled><span className="material-symbols-outlined">chevron_right</span></button>
                          </div>
                        </div>
                      </section>

                      <div className="relative w-full h-[300px] rounded-2xl overflow-hidden shadow-xl border border-outline-variant">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary-container via-primary to-inverse-surface mix-blend-multiply opacity-90" />
                        <img alt="AI Background" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAHKo4nX6C-8A28eWl5qh-ymOolGwYeqG07cU660pIqpCsb5fqAcZD7tffPPaEyucG6ACojesCrPDs54uN9grq32Gf5Ju8-4CdyGhBrO4COKizKsgFTK1Y9kNLq3s2TZg49P-rjxYdKeNJAVpcUok-iuPwiRV2mpDoyThF8wb2JnxwK-B8wsjWTcEr6yPoetoVN6FPRv_JVKowY3sJiL6WbLnbJZiajeqkUsMTE5M41nK4DB1RsOVtMvANFyZNwWugL_a4EgKCYwUKp" />
                        <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-xl gap-md text-white">
                          <div className="bg-white/20 backdrop-blur-md px-lg py-sm rounded-full font-label-sm text-label-sm tracking-widest uppercase">Operational Status: Optimal</div>
                          <h2 className="font-h1 text-h1 max-w-xl">Intelligent SOP Indexing Engine</h2>
                          <p className="font-body-lg text-body-lg max-w-2xl opacity-90">Your documents are processed using multi-vector embedding models for hyper-accurate conversational retrieval.</p>
                        </div>
                      </div>
                    </main>
                  </div>
                </div>
              </div>
            )}

            {tab === 'billing' && (
              <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm">
                <div className="flex items-center justify-between mb-md">
                  <div>
                    <h2 className="font-h3 text-h3">Billing & Plans</h2>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">Manage subscriptions and billing portal access</p>
                  </div>
                  <div className="font-label-sm text-label-sm text-on-surface-variant">Plan: {auth?.user?.planTier || 'free'}</div>
                </div>

                <div className="button-row mb-md">
                  <button type="button" className="px-md py-sm bg-primary text-on-primary rounded-lg" onClick={createCheckout}>Create Checkout</button>
                  <button type="button" className="px-md py-sm border border-outline-variant rounded-lg" onClick={openPortal}>Open Portal</button>
                </div>

                {billingInfo && (
                  <div className="bg-white p-md rounded-lg border border-outline-variant">
                    <pre className="text-sm">{JSON.stringify(billingInfo, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
          </section>
        </main>
      )}

      {auth && <footer className="status-bar">Status: {status}</footer>}
    </div>
  );
}
