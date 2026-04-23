import { useEffect, useMemo, useState } from 'react';

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

  const isAdmin = auth?.user?.role === 'admin';

  const greeting = useMemo(() => {
    if (!auth?.user) {
      return 'Sign in to start asking SOP questions.';
    }
    return `Logged in as ${auth.user.email} (${auth.user.role}, ${auth.user.planTier})`;
  }, [auth]);

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

      {!auth && (
        <section className="card auth-card">
          <div className="auth-toggle">
            <button type="button" onClick={() => setAuthMode('login')} className={authMode === 'login' ? 'active' : ''}>Login</button>
            <button type="button" onClick={() => setAuthMode('register')} className={authMode === 'register' ? 'active' : ''}>Register</button>
          </div>
          <form onSubmit={handleAuthSubmit} className="auth-form">
            <label>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </label>
            <label>
              Password
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={8} required />
            </label>
            {authMode === 'register' && (
              <label>
                Role
                <select value={registerRole} onChange={(e) => setRegisterRole(e.target.value)}>
                  <option value="employee">employee</option>
                  <option value="admin">admin</option>
                </select>
              </label>
            )}
            <button type="submit">{authMode === 'login' ? 'Login' : 'Create account'}</button>
          </form>
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
              {sessions.map((session) => (
                <div key={session.sessionId} className="session-item">
                  <button type="button" onClick={() => loadSession(session)}>{session.sessionId.slice(0, 8)}</button>
                  <button type="button" className="danger" onClick={() => clearSession(session.sessionId)}>x</button>
                </div>
              ))}
            </div>
          </aside>

          <section className="content card">
            {tab === 'chat' && (
              <>
                <div className="chat-window">
                  {messages.map((message, index) => (
                    <article key={`${message.role}-${index}`} className={`message ${message.role}`}>
                      <h4>{message.role}</h4>
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
                  <button type="submit" disabled={streaming}>{streaming ? 'Streaming...' : 'Send'}</button>
                </form>
              </>
            )}

            {tab === 'admin' && isAdmin && (
              <>
                <form onSubmit={uploadDocuments} className="upload-form">
                  <input
                    type="file"
                    multiple
                    accept="application/pdf"
                    onChange={(event) => setUploadFiles(Array.from(event.target.files || []))}
                  />
                  <button type="submit">Upload PDFs</button>
                </form>

                <div className="document-list">
                  {documents.map((doc) => (
                    <article key={doc._id} className="document-item">
                      <h4>{doc.originalName}</h4>
                      <p>Status: {doc.status} | Chunks: {doc.chunkCount} | Pages: {doc.pageCount}</p>
                      <div className="button-row">
                        <button type="button" onClick={() => reindexDocument(doc._id)}>Reindex</button>
                        <button type="button" className="danger" onClick={() => removeDocument(doc._id)}>Delete</button>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}

            {tab === 'billing' && (
              <div className="billing-panel">
                <div className="button-row">
                  <button type="button" onClick={createCheckout}>Create Checkout</button>
                  <button type="button" onClick={openPortal}>Open Portal</button>
                </div>
                {billingInfo && <pre>{JSON.stringify(billingInfo, null, 2)}</pre>}
              </div>
            )}
          </section>
        </main>
      )}

      <footer className="status-bar">Status: {status}</footer>
    </div>
  );
}
