import { useEffect, useMemo, useRef, useState } from 'react';
import './styles.css';

const AUTH_STORAGE_KEY = 'opsmind_auth';

function loadAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveAuth(payload) {
  if (!payload) { localStorage.removeItem(AUTH_STORAGE_KEY); return; }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
}

async function apiRequest(path, options = {}, accessToken = '') {
  const headers = new Headers(options.headers || {});
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  
  try {
    const res = await fetch(path, { ...options, headers, signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('Request timed out. Is the server running?');
    throw err;
  }
}

function parseEventBlock(block) {
  const lines = block.split('\n');
  let event = '', data = '';
  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  return event ? { event, data } : null;
}

function getInitials(email) {
  return email ? email.slice(0, 2).toUpperCase() : '??';
}

/* ─────────────────────────────────────────
   AUTH PAGE
───────────────────────────────────────── */
function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('employee');
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const payload = mode === 'login' ? { email, password } : { email, password, role };
    const res = await apiRequest(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    setLoading(false);
    if (!res.ok) { setError(body.message || 'Authentication failed'); return; }
    onAuth(body);
  }

  return (
    <div className="auth-page">
      {/* Left brand panel */}
      <div className="auth-brand">
        <div className="auth-brand-grid" />
        <div className="brand-logo">
          <div className="brand-logo-icon">
            <span className="material-symbols-outlined">psychology</span>
          </div>
          <span className="brand-logo-name">OpsMind AI</span>
        </div>
        <div className="brand-hero">
          <h2>Operational<br /><span>Intelligence</span><br />at scale.</h2>
          <p>Eliminate SOP confusion. Get instant, accurate answers from your entire knowledge base with enterprise-grade AI.</p>
          <div className="brand-stats">
            <div className="brand-stat">
              <span className="brand-stat-num">40%</span>
              <span className="brand-stat-label">Overhead cut</span>
            </div>
            <div className="brand-stat">
              <span className="brand-stat-num">10x</span>
              <span className="brand-stat-label">Faster lookup</span>
            </div>
            <div className="brand-stat">
              <span className="brand-stat-num">99.9%</span>
              <span className="brand-stat-label">Uptime</span>
            </div>
          </div>
        </div>
        <div className="brand-testimonial">
          <p>"The transition to OpsMind has reduced our operational overhead significantly. Our teams get answers instantly."</p>
          <div className="brand-testimonial-author">
            <div className="avatar">SC</div>
            <div>
              <div className="brand-testimonial-name">Sarah Chen</div>
              <div className="brand-testimonial-role">Operations Director, Nexus Corp</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="auth-form-panel">
        {error && (
          <div className="toast error">
            <span className="material-symbols-outlined">error</span>
            <span style={{ flex: 1 }}>{error}</span>
            <button className="toast-close" onClick={() => setError('')}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        )}

        <div className="auth-card">
          <div className="auth-card-header">
            <h1>{mode === 'login' ? 'Welcome back' : 'Create account'}</h1>
            <p>{mode === 'login' ? 'Sign in to access your workspace.' : 'Join OpsMind AI and streamline your operations.'}</p>
          </div>

          <div className="auth-tabs">
            <button className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>Sign In</button>
            <button className={`auth-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')}>Register</button>
          </div>

          <div className="oauth-row">
            <button className="oauth-btn">
              <span className="material-symbols-outlined">g_translate</span>
              Google
            </button>
            <button className="oauth-btn">
              <span className="material-symbols-outlined">terminal</span>
              SSO
            </button>
          </div>

          <div className="divider"><span>or continue with email</span></div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Work Email</label>
              <div className="form-input-wrap">
                <span className="material-symbols-outlined">mail</span>
                <input className="form-input" type="email" placeholder="name@company.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
            </div>
            <div className="form-group">
              <div className="form-input-row">
                <label className="form-label" style={{ margin: 0 }}>Password</label>
                {mode === 'login' && <a className="form-link" href="#">Forgot password?</a>}
              </div>
              <div className="form-input-wrap">
                <span className="material-symbols-outlined">lock</span>
                <input className="form-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required />
              </div>
            </div>
            {mode === 'register' && (
              <div className="form-group">
                <label className="form-label">Organization Role</label>
                <select className="form-select" value={role} onChange={e => setRole(e.target.value)}>
                  <option value="employee">Employee</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            )}
            {mode === 'register' && (
              <div className="form-checkbox-row">
                <input type="checkbox" id="terms" checked={terms} onChange={e => setTerms(e.target.checked)} />
                <label htmlFor="terms">I agree to the <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.</label>
              </div>
            )}
            <button className="btn btn-primary btn-full" type="submit" disabled={loading || (mode === 'register' && !terms)}>
              {loading ? 'Authenticating…' : mode === 'login' ? 'Sign in to Workspace' : 'Create Account'}
            </button>
          </form>

          <div className="auth-switch">
            {mode === 'login' ? (
              <>No account? <button onClick={() => setMode('register')}>Create one free</button></>
            ) : (
              <>Already registered? <button onClick={() => setMode('login')}>Sign in</button></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   CHAT VIEW
───────────────────────────────────────── */
function ChatView({ auth, sessionId, setSessionId, messages, setMessages, streaming, setStreaming, setStatus, onSessionsChange }) {
  const [query, setQuery] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function appendToken(text) {
    setMessages(prev => {
      if (!prev.length || prev[prev.length - 1].role !== 'assistant') {
        return [...prev, { role: 'assistant', content: text, citations: [] }];
      }
      const next = [...prev];
      const last = { ...next[next.length - 1], content: next[next.length - 1].content + text };
      next[next.length - 1] = last;
      return next;
    });
  }

  function appendCitation(citation) {
    setMessages(prev => {
      if (!prev.length || prev[prev.length - 1].role !== 'assistant') return prev;
      const next = [...prev];
      const last = { ...next[next.length - 1], citations: [...(next[next.length - 1].citations || []), citation] };
      next[next.length - 1] = last;
      return next;
    });
  }

  async function sendMessage(e) {
    e?.preventDefault();
    if (!auth?.accessToken || !query.trim() || streaming) return;
    const question = query.trim();
    setQuery('');
    setStreaming(true);
    setStatus('Streaming…');
    setMessages(prev => [...prev, { role: 'user', content: question, citations: [] }]);

    const res = await apiRequest('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ query: question, session_id: sessionId || undefined }),
    }, auth.accessToken);

    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => ({}));
      setStatus(body.message || 'Chat request failed');
      setStreaming(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';
      for (const block of blocks) {
        const parsed = parseEventBlock(block);
        if (!parsed) continue;
        if (parsed.event === 'token') { const d = JSON.parse(parsed.data || '{}'); appendToken(d.text || ''); }
        if (parsed.event === 'citation') { appendCitation(JSON.parse(parsed.data || '{}')); }
        if (parsed.event === 'done') {
          const d = JSON.parse(parsed.data || '{}');
          setSessionId(d.session_id || sessionId);
          setStatus(`Done · ${d.total_tokens || 0} tokens`);
          setStreaming(false);
          onSessionsChange();
        }
      }
    }
    setStreaming(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  return (
    <div className="chat-view">
      <div className="chat-header">
        <h2>SOP Assistant</h2>
        <p>Ask questions about your operational procedures and knowledge base</p>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-3)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 40, display: 'block', marginBottom: 12, fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 48", color: 'var(--text-3)' }}>chat</span>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-3)' }}>Start a conversation — ask anything about your SOPs</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`msg ${msg.role}`}>
            <div className="msg-avatar">
              <span className="material-symbols-outlined">
                {msg.role === 'user' ? 'person' : 'psychology'}
              </span>
            </div>
            <div className="msg-body">
              <div className="msg-role">{msg.role === 'user' ? 'You' : 'OpsMind AI'}</div>
              <div className="msg-content">{msg.content}</div>
              {(msg.citations || []).length > 0 && (
                <div className="msg-citations">
                  {msg.citations.map((c, ci) => (
                    <span key={ci} className="citation-chip">
                      <span className="material-symbols-outlined">attach_file</span>
                      {c.filename} · p.{c.page}{c.section ? ` · §${c.section}` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {streaming && (
          <div className="streaming-indicator">
            <div className="streaming-dots">
              <span /><span /><span />
            </div>
            OpsMind is thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        <div className="chat-input-wrap">
          <textarea
            className="chat-input"
            rows={1}
            placeholder="Ask anything about your SOPs…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming}
          />
          <button className="chat-send-btn" onClick={sendMessage} disabled={streaming || !query.trim()}>
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 8, paddingLeft: 4 }}>
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   ADMIN VIEW
───────────────────────────────────────── */
function AdminView({ auth, documents, onRefresh, setStatus }) {
  const uploadInputRef = useRef(null);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [autoIndex, setAutoIndex] = useState(true);

  const summary = useMemo(() => ({
    total: documents.length,
    indexed: documents.filter(d => String(d.status || '').toLowerCase().includes('index')).length,
    processing: documents.filter(d => String(d.status || '').toLowerCase().includes('process')).length,
    errored: documents.filter(d => String(d.status || '').toLowerCase().includes('error')).length,
  }), [documents]);

  async function uploadDocuments(e) {
    e.preventDefault();
    if (!uploadFiles.length) return;
    const formData = new FormData();
    for (const file of uploadFiles) formData.append('file', file);
    setStatus('Uploading and indexing…');
    const res = await apiRequest('/api/admin/upload', { method: 'POST', body: formData }, auth.accessToken);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setStatus(body.message || 'Upload failed'); return; }
    setStatus('Documents indexed successfully');
    setUploadFiles([]);
    onRefresh();
  }

  async function removeDocument(id) {
    const res = await apiRequest(`/api/admin/documents/${id}`, { method: 'DELETE' }, auth.accessToken);
    if (res.status === 204) { onRefresh(); setStatus('Document deleted'); }
  }

  async function reindexDocument(id) {
    setStatus('Reindexing…');
    const res = await apiRequest(`/api/admin/documents/${id}/reindex`, { method: 'POST' }, auth.accessToken);
    const body = await res.json().catch(() => ({}));
    if (res.ok) { setStatus(body.message || 'Reindexed'); onRefresh(); }
  }

  function getStatusInfo(status) {
    const s = String(status || '').toLowerCase();
    if (s.includes('index')) return { cls: 'indexed', label: 'Indexed' };
    if (s.includes('process')) return { cls: 'processing', label: 'Processing' };
    if (s.includes('error')) return { cls: 'error', label: 'Error' };
    return { cls: 'unknown', label: status || 'Unknown' };
  }

  return (
    <div className="admin-view">
      <div className="page-header">
        <h1>Admin Panel</h1>
        <p>Manage the knowledge base, API keys, and document processing pipeline.</p>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-icon blue"><span className="material-symbols-outlined">description</span></div>
          <div className="stat-card-val">{summary.total}</div>
          <div className="stat-card-label">Total Documents</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon green"><span className="material-symbols-outlined">check_circle</span></div>
          <div className="stat-card-val">{summary.indexed}</div>
          <div className="stat-card-label">Indexed</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon amber"><span className="material-symbols-outlined">sync</span></div>
          <div className="stat-card-val">{summary.processing}</div>
          <div className="stat-card-label">Processing</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon red"><span className="material-symbols-outlined">error</span></div>
          <div className="stat-card-val">{summary.errored}</div>
          <div className="stat-card-label">Errors</div>
        </div>
      </div>

      {/* Upload + Config */}
      <div className="config-grid">
        {/* Upload */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-header-left">
              <span className="material-symbols-outlined">upload_file</span>
              <div>
                <h2>Upload Documents</h2>
                <p>PDF files, max 50MB each</p>
              </div>
            </div>
          </div>
          <div className="panel-body">
            <div className="upload-zone" onClick={() => uploadInputRef.current?.click()}>
              <div className="upload-zone-icon"><span className="material-symbols-outlined">cloud_upload</span></div>
              <h3>Drop PDF files here</h3>
              <p>or click to browse</p>
              <button className="btn btn-ghost" style={{ marginTop: 6, fontSize: '0.8rem', padding: '6px 14px' }}
                onClick={e => { e.stopPropagation(); uploadInputRef.current?.click(); }}>
                Browse Files
              </button>
            </div>
            <input ref={uploadInputRef} type="file" multiple accept="application/pdf" className="hidden"
              style={{ display: 'none' }} onChange={e => setUploadFiles(Array.from(e.target.files || []))} />
            {uploadFiles.length > 0 && (
              <form onSubmit={uploadDocuments}>
                <div className="selected-files">
                  {uploadFiles.map((f, i) => (
                    <div key={i} className="selected-file">
                      <span className="material-symbols-outlined">picture_as_pdf</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-3)' }}>
                        {(f.size / 1024).toFixed(0)}KB
                      </span>
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary btn-full" type="submit" style={{ marginTop: 12 }}>
                  <span className="material-symbols-outlined">upload</span>
                  Upload {uploadFiles.length} file{uploadFiles.length > 1 ? 's' : ''}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Config */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="panel">
            <div className="panel-header">
              <div className="panel-header-left">
                <span className="material-symbols-outlined">key</span>
                <div><h2>API Configuration</h2></div>
              </div>
            </div>
            <div className="panel-body">
              <div className="config-row">
                <label>OpenAI API Key</label>
                <div className="config-input-wrap">
                  <input className="config-input" type="password" defaultValue="sk-••••••••••••••••••••••••" readOnly />
                  <button className="btn-icon btn" title="Show"><span className="material-symbols-outlined" style={{ fontSize: 16 }}>visibility</span></button>
                </div>
              </div>
              <div className="config-row">
                <label>Base URL</label>
                <input className="config-input" placeholder="https://api.openai.com/v1" style={{ width: '100%' }} />
              </div>
              <button className="btn btn-primary" style={{ width: '100%', marginTop: 4 }}>
                <span className="material-symbols-outlined">save</span>
                Save Keys
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="panel-header-left">
                <span className="material-symbols-outlined">settings_suggest</span>
                <div><h2>System Preferences</h2></div>
              </div>
            </div>
            <div className="panel-body">
              <div className="toggle-row">
                <div className="toggle-label">
                  <h4>Dark Mode</h4>
                  <p>Switch interface theme</p>
                </div>
                <div className={`toggle ${darkMode ? 'on' : ''}`} onClick={() => setDarkMode(!darkMode)}>
                  <div className="toggle-knob" />
                </div>
              </div>
              <div className="toggle-row">
                <div className="toggle-label">
                  <h4>Auto-Indexing</h4>
                  <p>Index after upload</p>
                </div>
                <div className={`toggle ${autoIndex ? 'on' : ''}`} onClick={() => setAutoIndex(!autoIndex)}>
                  <div className="toggle-knob" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Documents table */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-header-left">
            <span className="material-symbols-outlined">database</span>
            <div>
              <h2>Knowledge Base Documents</h2>
              <p>{summary.total} documents · {summary.indexed} indexed</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>filter_list</span>
              Filter
            </button>
            <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '6px 12px' }} onClick={onRefresh}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>refresh</span>
              Refresh
            </button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Upload Date</th>
                <th>Pages</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-3)' }}>
                  No documents yet. Upload PDFs to populate your knowledge base.
                </td></tr>
              )}
              {documents.map(doc => {
                const { cls, label } = getStatusInfo(doc.status);
                return (
                  <tr key={doc._id}>
                    <td>
                      <div className="file-cell">
                        <div className="file-icon"><span className="material-symbols-outlined">picture_as_pdf</span></div>
                        <div>
                          <div className="file-name">{doc.originalName}</div>
                          <div className="file-chunks">{doc.chunkCount || 0} chunks</div>
                        </div>
                      </div>
                    </td>
                    <td>{new Date(doc.createdAt || Date.now()).toLocaleDateString()}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{doc.pageCount || 0}</td>
                    <td>
                      <span className={`status-pill ${cls}`}>
                        <span className="status-pill-dot" />
                        {label}
                      </span>
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button className="btn btn-icon" title="Reindex" onClick={() => reindexDocument(doc._id)}>
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>sync</span>
                        </button>
                        <button className="btn btn-danger" style={{ padding: '6px 8px' }} title="Delete" onClick={() => removeDocument(doc._id)}>
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span className="table-footer-count">Showing {documents.length} of {documents.length} documents</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-icon" disabled style={{ opacity: 0.3, padding: '4px 6px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
            </button>
            <button className="btn btn-icon" disabled style={{ opacity: 0.3, padding: '4px 6px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   BILLING VIEW
───────────────────────────────────────── */
function BillingView({ auth, setStatus }) {
  const [billingInfo, setBillingInfo] = useState(null);

  const currentPlan = auth?.user?.planTier || 'free';

  async function createCheckout() {
    const res = await apiRequest('/api/billing/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'pro' }),
    }, auth.accessToken);
    setBillingInfo(await res.json());
    setStatus('Checkout payload received');
  }

  async function openPortal() {
    const res = await apiRequest('/api/billing/portal', { method: 'GET' }, auth.accessToken);
    setBillingInfo(await res.json());
    setStatus('Portal payload received');
  }

  const plans = [
    {
      name: 'Free', price: '$0', period: '/mo', current: currentPlan === 'free',
      features: ['5 queries/day', '2 documents', 'Basic support'],
    },
    {
      name: 'Pro', price: '$49', period: '/mo', featured: true, current: currentPlan === 'pro',
      features: ['Unlimited queries', '100 documents', 'Priority support', 'API access'],
    },
    {
      name: 'Enterprise', price: 'Custom', period: '', current: currentPlan === 'enterprise',
      features: ['Unlimited everything', 'Custom deployment', 'SLA guarantee', 'Dedicated support'],
    },
  ];

  return (
    <div className="billing-view">
      <div className="page-header">
        <h1>Billing & Plans</h1>
        <p>Manage your subscription and access billing history.</p>
      </div>

      <div className="plan-grid">
        {plans.map(plan => (
          <div key={plan.name} className={`plan-card ${plan.featured ? 'featured' : ''} ${plan.current ? 'current' : ''}`}>
            {plan.featured && <div className="plan-badge">Most Popular</div>}
            <div className="plan-name">{plan.name}</div>
            <div className="plan-price">
              <span className="plan-price-num">{plan.price}</span>
              <span className="plan-price-period">{plan.period}</span>
            </div>
            <ul className="plan-features">
              {plan.features.map(f => (
                <li key={f}>
                  <span className="material-symbols-outlined">check</span>
                  {f}
                </li>
              ))}
            </ul>
            {plan.current ? (
              <button className="btn btn-ghost btn-full" disabled style={{ opacity: 0.5 }}>Current Plan</button>
            ) : plan.name === 'Enterprise' ? (
              <button className="btn btn-ghost btn-full">Contact Sales</button>
            ) : (
              <button className="btn btn-primary btn-full" onClick={createCheckout}>Upgrade to {plan.name}</button>
            )}
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-header-left">
            <span className="material-symbols-outlined">receipt_long</span>
            <div><h2>Billing Portal</h2><p>Manage invoices, payment methods, and subscriptions</p></div>
          </div>
          <button className="btn btn-ghost" style={{ fontSize: '0.82rem' }} onClick={openPortal}>
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>open_in_new</span>
            Open Portal
          </button>
        </div>
        {billingInfo && (
          <div className="panel-body">
            <div className="billing-response">
              <pre>{JSON.stringify(billingInfo, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   MAIN APP
───────────────────────────────────────── */
export default function App() {
  const [auth, setAuth] = useState(() => loadAuth());
  const [tab, setTab] = useState('chat');
  const [status, setStatus] = useState('Ready');
  const [serverHealth, setServerHealth] = useState('checking');
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [documents, setDocuments] = useState([]);

  const isAdmin = auth?.user?.role === 'admin';

  useEffect(() => {
    fetch('/health').then(r => r.json()).then(d => setServerHealth(d.status || 'unknown')).catch(() => setServerHealth('down'));
  }, []);

  useEffect(() => { saveAuth(auth); }, [auth]);

  useEffect(() => {
    if (auth?.accessToken) {
      refreshSessions(auth.accessToken);
      if (auth.user?.role === 'admin') refreshDocuments(auth.accessToken);
    }
  }, [auth?.accessToken]);

  async function refreshSessions(token = auth?.accessToken) {
    if (!token) return;
    const res = await apiRequest('/api/chat/history', { method: 'GET' }, token);
    if (res.ok) { const b = await res.json(); setSessions(b.sessions || []); }
  }

  async function refreshDocuments(token = auth?.accessToken) {
    if (!token || !isAdmin) return;
    const res = await apiRequest('/api/admin/documents', { method: 'GET' }, token);
    const b = await res.json();
    if (res.ok) setDocuments(b.documents || []);
  }

  function handleAuth(body) {
    setAuth(body);
    setStatus('Authenticated');
  }

  function logout() {
    setAuth(null); setMessages([]); setSessions([]); setDocuments([]); setSessionId(''); setStatus('Logged out');
  }

  async function loadSession(session) {
    setSessionId(session.sessionId);
    setMessages(session.messages || []);
    setTab('chat');
  }

  async function clearSession(sid) {
    if (!auth?.accessToken) return;
    const res = await apiRequest(`/api/chat/history/${sid}`, { method: 'DELETE' }, auth.accessToken);
    if (res.ok) {
      if (sid === sessionId) { setSessionId(''); setMessages([]); }
      await refreshSessions();
    }
  }

  function newSession() {
    setSessionId('');
    setMessages([]);
    setTab('chat');
  }

  if (!auth) return <AuthPage onAuth={handleAuth} />;

  return (
    <div className="app-shell">
      {/* Topbar */}
      <header className="topbar">
        <div className="topbar-logo">
          <div className="topbar-logo-icon">
            <span className="material-symbols-outlined">psychology</span>
          </div>
          <span className="topbar-logo-name">OpsMind AI</span>
        </div>
        <div className="topbar-sep" />
        <span className="topbar-breadcrumb">
          {tab === 'chat' ? 'Chat' : tab === 'admin' ? 'Admin Panel' : 'Billing'}
        </span>
        <div className="topbar-right">
          <div className="status-badge">
            <div className={`status-dot ${serverHealth === 'ok' ? 'ok' : 'error'}`} />
            API {serverHealth}
          </div>
          <div className="status-badge" style={{ display: 'none' }}>{status}</div>
          <div className="topbar-user">
            <div className="avatar">{getInitials(auth.user?.email)}</div>
            <div className="topbar-user-info">
              <span className="topbar-user-email">{auth.user?.email}</span>
              <span className="topbar-user-role">{auth.user?.role} · {auth.user?.planTier || 'free'}</span>
            </div>
          </div>
          <button className="btn btn-icon" onClick={logout} title="Sign out">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-section-label">Navigation</div>
        <button className={`nav-btn ${tab === 'chat' ? 'active' : ''}`} onClick={() => setTab('chat')}>
          <span className="material-symbols-outlined">chat</span>
          Chat
        </button>
        {isAdmin && (
          <button className={`nav-btn ${tab === 'admin' ? 'active' : ''}`} onClick={() => setTab('admin')}>
            <span className="material-symbols-outlined">shield_person</span>
            Admin Panel
          </button>
        )}
        <button className={`nav-btn ${tab === 'billing' ? 'active' : ''}`} onClick={() => setTab('billing')}>
          <span className="material-symbols-outlined">credit_card</span>
          Billing
        </button>

        <div className="sidebar-divider" />

        <button className="nav-btn" onClick={newSession} style={{ borderColor: 'rgba(79,124,255,0.2)', color: 'var(--accent)' }}>
          <span className="material-symbols-outlined">add</span>
          New Session
        </button>

        <div className="sidebar-section-label" style={{ marginTop: 4 }}>Recent Sessions</div>
        <div className="sidebar-sessions">
          {sessions.length === 0 ? (
            <div className="session-empty-state">No sessions yet.<br />Start a conversation.</div>
          ) : (
            sessions.map(s => (
              <div key={s.sessionId} className="session-btn">
                <button className="session-load-btn" onClick={() => loadSession(s)}>
                  {s.sessionId.slice(0, 12)}…
                </button>
                <button className="session-del-btn" onClick={() => clearSession(s.sessionId)}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="sidebar-divider" />
        <button className="nav-btn danger" onClick={logout}>
          <span className="material-symbols-outlined">logout</span>
          Sign Out
        </button>
      </aside>

      {/* Main */}
      <main className="main-content">
        {tab === 'chat' && (
          <ChatView
            auth={auth}
            sessionId={sessionId} setSessionId={setSessionId}
            messages={messages} setMessages={setMessages}
            streaming={streaming} setStreaming={setStreaming}
            setStatus={setStatus}
            onSessionsChange={refreshSessions}
          />
        )}
        {tab === 'admin' && isAdmin && (
          <AdminView
            auth={auth}
            documents={documents}
            onRefresh={() => refreshDocuments()}
            setStatus={setStatus}
          />
        )}
        {tab === 'billing' && (
          <BillingView auth={auth} setStatus={setStatus} />
        )}
      </main>
    </div>
  );
}
