import React, { useState } from 'react';
import { Shield, Key, Lock, Mail, User, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';

export default function Login({ onVoterLogin, onAdminLogin }) {
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Voter credentials fields
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  
  // OTP phase states
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [demoOtp, setDemoOtp] = useState('');

  // Admin credentials fields
  const [adminPassword, setAdminPassword] = useState('');
  
  // UX states
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);



  const handleStep1Submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login-step1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to authenticate');
      }

      setOtpSent(true);
      setSuccess(data.message || 'Identity verified. Entering 2FA verification.');
      if (data.demoOtp) {
        setDemoOtp(data.demoOtp);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login-step2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, otp })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify OTP');
      }

      onVoterLogin(data.token, data.student);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Admin authentication failed');
      }

      onAdminLogin(data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="animate-fade-in" style={{ maxWidth: '480px', margin: '1.5rem auto', width: '100%' }}>
      
      {/* Switcher Tab */}
      <div className="glass-panel" style={{ display: 'flex', padding: '0.25rem', marginBottom: '1.5rem', borderRadius: '12px' }}>
        <button
          className="btn"
          style={{
            flex: 1,
            background: !isAdmin ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
            border: 'none',
            color: !isAdmin ? '#60a5fa' : 'var(--text-secondary)',
            padding: '0.5rem'
          }}
          onClick={() => { setIsAdmin(false); setError(''); setSuccess(''); }}
        >
          <Shield size={16} /> Student Booth
        </button>
        <button
          className="btn"
          style={{
            flex: 1,
            background: isAdmin ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
            border: 'none',
            color: isAdmin ? '#c084fc' : 'var(--text-secondary)',
            padding: '0.5rem'
          }}
          onClick={() => { setIsAdmin(true); setError(''); setSuccess(''); }}
        >
          <Key size={16} /> Control Room
        </button>
      </div>

      {/* Login Form Panel */}
      <div className="glass-panel" style={{ padding: '2.5rem 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '1rem',
              borderRadius: '50%',
              background: isAdmin ? 'rgba(139, 92, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)',
              color: isAdmin ? 'var(--color-secondary)' : 'var(--color-primary)',
              marginBottom: '1rem',
              border: `1px solid ${isAdmin ? 'rgba(139, 92, 246, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`
            }}
          >
            {isAdmin ? <Key size={30} /> : <Shield size={30} />}
          </div>
          <h2 className="header-title" style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>
            {isAdmin ? 'IT Admin Dashboard' : 'IT Student Voter Portal'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {isAdmin
              ? 'Provide master key to manage and monitor elections'
              : otpSent 
                ? 'Enter 2FA Code received to authorize voting'
                : 'Provide credentials to verify student registration'}
          </p>
        </div>

        {/* Global Notifications */}
        {error && (
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              color: '#f87171',
              fontSize: '0.85rem',
              marginBottom: '1.5rem',
              lineHeight: '1.4'
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              color: '#34d399',
              fontSize: '0.85rem',
              marginBottom: '1.5rem'
            }}
          >
            <Shield size={18} style={{ flexShrink: 0 }} />
            <span>{success}</span>
          </div>
        )}

        {/* Simulated Inbox / OTP Helper */}
        {!isAdmin && otpSent && demoOtp && (
          <div className="dev-helper">
            <span style={{ fontWeight: '600', color: '#e9d5ff' }}>📨 Mock Email Inbox</span>
            <span style={{ fontSize: '0.8rem' }}>A secure OTP was sent to your email. Copy the code:</span>
            <code style={{ fontSize: '1.35rem', color: '#c084fc', fontWeight: 'bold', letterSpacing: '3px', margin: '0.25rem 0' }}>
              {demoOtp}
            </code>
            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>(Account will lock after 3 failed password/OTP attempts)</span>
          </div>
        )}

        {isAdmin ? (
          /* Admin Form */
          <form onSubmit={handleAdminLoginSubmit}>
            <div className="form-group">
              <label className="form-label">Control Room Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  style={{ width: '100%' }}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Demo Master password is: <strong style={{ color: 'var(--text-secondary)' }}>admin</strong>
              </span>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
              {loading ? 'Entering...' : 'Authenticate Admin'}
            </button>
          </form>
        ) : (
          /* Voter Form (2-Step Flow) */
          <>
            {!otpSent ? (
              <form onSubmit={handleStep1Submit}>
                <div className="form-group">
                  <label className="form-label">Student Roll Number / Register ID</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. IT202601"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Private Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="First 2 letters of name + DOB digits"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                    Password Format: Name letters in CAPS + DOB as DDMMYYYY. (e.g., Prakash born 16/02/2006 = <strong>PR16022006</strong>)
                  </span>
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
                  {loading ? 'Authenticating...' : 'Validate Credentials'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleStep2Submit}>
                <div className="form-group">
                  <label className="form-label">2FA Verification OTP Code</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="••••••"
                    maxLength={6}
                    style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.25rem', fontWeight: 'bold' }}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => { setOtpSent(false); setDemoOtp(''); setError(''); }}
                    disabled={loading}
                  >
                    Back
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
                    {loading ? 'Verifying OTP...' : 'Verify Code & Enter'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>


    </div>
  );
}
