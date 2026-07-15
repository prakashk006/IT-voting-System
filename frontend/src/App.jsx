import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import VotingWizard from './components/VotingWizard';
import AdminPanel from './components/AdminPanel';
import ResultsHub from './components/ResultsHub';
import { Award, Shield, LogOut, CheckCircle, RefreshCw, BarChart } from 'lucide-react';

export default function App() {
  const [view, setView] = useState('login'); // 'login' | 'voter-wizard' | 'admin-panel' | 'results' | 'voted-lock'
  const [voterToken, setVoterToken] = useState(localStorage.getItem('voterToken') || '');
  const [adminToken, setAdminToken] = useState(localStorage.getItem('adminToken') || '');
  const [student, setStudent] = useState(JSON.parse(localStorage.getItem('student')) || null);
  const [candidates, setCandidates] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto route depending on tokens present
  useEffect(() => {
    if (adminToken) {
      setView('admin-panel');
    } else if (voterToken && student) {
      if (student.hasVoted) {
        setView('voted-lock');
      } else {
        fetchCandidates(voterToken);
      }
    } else {
      setView('login');
    }
  }, [voterToken, adminToken, student]);

  const fetchCandidates = async (token) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/candidates', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 403) {
          handleLogout();
        }
        throw new Error(data.error || 'Failed to fetch candidate list');
      }
      setCandidates(data);
      setView('voter-wizard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVoterLogin = (token, studentInfo) => {
    localStorage.setItem('voterToken', token);
    localStorage.setItem('student', JSON.stringify(studentInfo));
    setVoterToken(token);
    setStudent(studentInfo);
  };

  const handleAdminLogin = (token) => {
    localStorage.setItem('adminToken', token);
    setAdminToken(token);
    setView('admin-panel');
  };

  const handleLogout = async () => {
    if (voterToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${voterToken}` }
        });
      } catch (err) {
        console.error('Failed to log logout session:', err);
      }
    }
    localStorage.removeItem('voterToken');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('student');
    setVoterToken('');
    setAdminToken('');
    setStudent(null);
    setView('login');
  };

  const handleVoteSubmitted = () => {
    const updatedStudent = { ...student, hasVoted: true };
    localStorage.setItem('student', JSON.stringify(updatedStudent));
    setStudent(updatedStudent);
    setView('voted-lock');
  };

  const triggerCheckVoterStatus = async () => {
    if (!voterToken) return;
    try {
      const response = await fetch('/api/auth/status', {
        headers: { 'Authorization': `Bearer ${voterToken}` }
      });
      const data = await response.json();
      if (response.ok && data.hasVoted) {
        handleVoteSubmitted();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="app-container">
      {/* Navbar Navigation */}
      <header
        className="glass-panel"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 2rem',
          marginBottom: '2.5rem',
          borderRadius: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => setView('login')}>
          <div
            style={{
              background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
              color: 'white',
              padding: '0.5rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Shield size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              IT DEPARTMENT ELECTION
            </h1>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: '600', letterSpacing: '0.05em' }}>
              DEPARTMENT OF INFORMATION TECHNOLOGY
            </span>
          </div>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {view === 'login' && (
            <button
              onClick={() => setView('results')}
              className="btn btn-secondary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              <BarChart size={14} /> Live Results Hub
            </button>
          )}

          {voterToken && student && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'right' }} className="user-profile-nav">
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block' }}>
                  Logged in as <strong style={{ color: 'white' }}>{student.name}</strong>
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({student.id})</span>
              </div>
              <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                <LogOut size={14} /> Log Out
              </button>
            </div>
          )}

          {adminToken && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span className="badge badge-blue" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#c084fc', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                System Admin
              </span>
              <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                <LogOut size={14} /> Log Out
              </button>
            </div>
          )}
        </nav>
      </header>

      {/* Main Core Router View */}
      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {view === 'login' && (
          <Login onVoterLogin={handleVoterLogin} onAdminLogin={handleAdminLogin} />
        )}

        {view === 'voter-wizard' && (
          <div style={{ width: '100%' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <h2 style={{ color: 'var(--text-secondary)' }}>Gathering Candidate Lists...</h2>
              </div>
            ) : (
              <VotingWizard candidates={candidates} token={voterToken} onVoteSubmitted={handleVoteSubmitted} />
            )}
          </div>
        )}

        {view === 'admin-panel' && (
          <AdminPanel token={adminToken} onLogout={handleLogout} />
        )}

        {view === 'results' && (
          <ResultsHub onGoToLogin={() => setView('login')} />
        )}

        {view === 'voted-lock' && (
          <div className="glass-panel animate-fade-in" style={{ padding: '3.5rem 2rem', textAlign: 'center', maxWidth: '540px', width: '100%' }}>
            <div
              style={{
                display: 'inline-flex',
                padding: '1.25rem',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.1)',
                color: 'var(--color-accent)',
                marginBottom: '1.5rem',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.1)'
              }}
            >
              <CheckCircle size={40} />
            </div>
            <h2 className="header-title" style={{ fontSize: '2rem', marginBottom: '1rem', color: '#34d399' }}>
              Vote Casted Successfully
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', lineHeight: '1.6' }}>
              Your secure ballot has been anonymized and registered in the IT Department archives. You have been locked out of the voting booth to prevent duplicate submissions. Results will be visible once the admin concludes the session.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                className="btn btn-primary"
                onClick={() => setView('results')}
                style={{ width: '100%' }}
              >
                Go to Results Room
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleLogout}
                style={{ width: '100%' }}
              >
                Log Out Securely
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ marginTop: '4rem', padding: '1.5rem 0', borderTop: '1px solid var(--border-light)', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <p>© 2026 Department of IT Office Bearer Elections. Encrypted & Audited.</p>
      </footer>
    </div>
  );
}
