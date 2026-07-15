import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Eye, EyeOff, RefreshCw, BarChart3, ShieldAlert, Award, Lock, Unlock, Upload } from 'lucide-react';

export default function AdminPanel({ token, onLogout }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Add Candidate Form State
  const [newName, setNewName] = useState('');
  const [newPosition, setNewPosition] = useState(''); // Text input for dynamic positions
  const [newYearClass, setNewYearClass] = useState(''); // Text input for dynamic class & year
  const [newPhotoFile, setNewPhotoFile] = useState(null); // File upload state
  const [submittingCandidate, setSubmittingCandidate] = useState(false);
  const [activeTab, setActiveTab] = useState('standings'); // 'standings' | 'audits' | 'ballots' | 'system'
  const [selectedClass, setSelectedClass] = useState('All');

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch admin stats');
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Poll stats every 10 seconds for live updates
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAddCandidate = async (e) => {
    e.preventDefault();
    setError('');
    setActionSuccess('');

    if (!newPosition.trim() || !newYearClass.trim()) {
      setError('Position and Year/Class cannot be empty.');
      return;
    }

    setSubmittingCandidate(true);

    try {
      // Use FormData to support binary file uploads
      const formData = new FormData();
      formData.append('name', newName);
      formData.append('position', newPosition.trim());
      formData.append('year_class', newYearClass.trim());
      if (newPhotoFile) {
        formData.append('photo', newPhotoFile);
      }

      const response = await fetch('/api/admin/candidates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to add candidate');

      setNewName('');
      setNewPosition('');
      setNewYearClass('');
      setNewPhotoFile(null);
      
      // Reset the file input element visually
      const fileInput = document.getElementById('candidate-photo-file');
      if (fileInput) fileInput.value = '';

      setActionSuccess(`Candidate "${data.candidate.name}" registered successfully for "${data.candidate.position}".`);
      fetchStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingCandidate(false);
    }
  };

  const handleDeleteCandidate = async (id) => {
    if (!window.confirm('Are you sure you want to remove this candidate? This will also wipe out any votes they received!')) return;
    setError('');
    setActionSuccess('');

    try {
      const response = await fetch(`/api/admin/candidates/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete candidate');

      setActionSuccess('Candidate removed successfully.');
      fetchStats();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleResults = async () => {
    setError('');
    setActionSuccess('');

    try {
      const response = await fetch('/api/admin/toggle-results', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to toggle results release');

      setActionSuccess(data.message);
      fetchStats();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUnblockStudent = async (studentId) => {
    setError('');
    setActionSuccess('');

    try {
      const response = await fetch('/api/admin/unblock-student', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ studentId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to unblock voter');

      setActionSuccess(data.message || `Student account ${studentId} successfully unlocked.`);
      fetchStats();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResetElection = async () => {
    if (!window.confirm('🚨 WARNING: This will delete ALL cast votes, logs, and custom photo uploads! Are you absolutely sure?')) return;
    setError('');
    setActionSuccess('');

    try {
      const response = await fetch('/api/admin/reset-election', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to reset election');

      setActionSuccess('Election successfully reset. All student statuses set to "Not Voted" and logs cleared.');
      fetchStats();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleClearCandidates = async () => {
    if (!window.confirm('🚨 DANGER: This will delete ALL registered candidates, custom photos, and all cast votes! Are you absolutely sure?')) return;
    setError('');
    setActionSuccess('');

    try {
      const response = await fetch('/api/admin/clear-candidates', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to clear candidates');

      setActionSuccess('All candidates and votes cleared successfully. Ballot is now clean.');
      fetchStats();
    } catch (err) {
      setError(err.message);
    }
  };

  // Group candidate tallies by position for display
  const getGroupedTallies = () => {
    if (!stats || !stats.tallies) return {};
    return stats.tallies.reduce((acc, cand) => {
      if (!acc[cand.position]) {
        acc[cand.position] = [];
      }
      acc[cand.position].push(cand);
      return acc;
    }, {});
  };

  const groupedTallies = getGroupedTallies();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <h2 style={{ color: 'var(--text-secondary)' }}>Loading Control Panel metrics...</h2>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      
      {/* Dashboard Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <h1 className="header-title" style={{ fontSize: '2.25rem', marginBottom: '0.25rem' }}>
            IT Control Room
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Real-time voter tracking, audit trails, candidate management, and election configuration.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }} className="mobile-actions-wrapper">
          <button className="btn btn-secondary" onClick={fetchStats} title="Refresh Live Data" style={{ padding: '0.75rem', width: 'auto' }}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-secondary" onClick={handleResetElection} style={{ border: '1px solid var(--color-danger)', color: '#f87171', width: 'auto' }}>
            Reset Election
          </button>
          <button className="btn btn-secondary" onClick={handleClearCandidates} style={{ border: '1px solid #d97706', color: '#d97706', width: 'auto' }}>
            Clear Candidates
          </button>
          <button className="btn btn-secondary" onClick={onLogout} style={{ width: 'auto' }}>
            Lock Dashboard
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            color: '#f87171',
            fontSize: '0.9rem',
            marginBottom: '1.5rem'
          }}
        >
          <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{error}</span>
        </div>
      )}

      {actionSuccess && (
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            color: '#34d399',
            fontSize: '0.9rem',
            marginBottom: '1.5rem'
          }}
        >
          <Award size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* 📊 Responsive Tabs Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', marginBottom: '2rem', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setActiveTab('standings')}
          className={`btn ${activeTab === 'standings' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ width: 'auto', whiteSpace: 'nowrap', padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}
        >
          <BarChart3 size={15} /> Standings & Add
        </button>
        <button 
          onClick={() => setActiveTab('audits')}
          className={`btn ${activeTab === 'audits' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ width: 'auto', whiteSpace: 'nowrap', padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}
        >
          <Users size={15} /> Voter Session Audits
        </button>
        <button 
          onClick={() => setActiveTab('ballots')}
          className={`btn ${activeTab === 'ballots' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ width: 'auto', whiteSpace: 'nowrap', padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}
        >
          <Award size={15} /> Detailed Ballots
        </button>
        <button 
          onClick={() => setActiveTab('system')}
          className={`btn ${activeTab === 'system' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ width: 'auto', whiteSpace: 'nowrap', padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}
        >
          <Lock size={15} /> Lockouts & Turnout
        </button>
      </div>

      {/* 📊 TAB 1: STANDINGS & CANDIDATES REGISTRATION */}
      {activeTab === 'standings' && (
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '2rem' }} className="admin-grid-layout">
          
          {/* Left Side: Live Tally & Candidates List */}
          <div>
            <div className="glass-panel" style={{ padding: '2rem' }}>
              <h2 className="header-title" style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart3 size={20} style={{ color: 'var(--color-primary)' }} /> Live Tally
              </h2>

              {Object.keys(groupedTallies).length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                  No candidates available on the ballot. Use the form on the right to add some.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                  {Object.entries(groupedTallies).map(([position, candidates]) => {
                    const maxVoteCount = Math.max(...candidates.map(c => c.vote_count), 1);
                    return (
                      <div key={position}>
                        <h3
                          style={{
                            fontSize: '1.05rem',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            color: 'var(--text-secondary)',
                            marginBottom: '1.25rem',
                            paddingBottom: '0.25rem',
                            borderBottom: '1px solid var(--border-light)'
                          }}
                        >
                          {position}
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                          {candidates.map(cand => {
                            const percentage = ((cand.vote_count / maxVoteCount) * 100).toFixed(0);
                            return (
                              <div key={cand.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}>
                                <img
                                  src={window.getAssetUrl ? window.getAssetUrl(cand.photo_url) : cand.photo_url}
                                  alt={cand.name}
                                  style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', background: 'var(--bg-tertiary)', flexShrink: 0 }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.95rem', gap: '0.5rem' }}>
                                    <strong style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cand.name}</strong>
                                    <span style={{ color: 'var(--text-secondary)', fontWeight: '600', flexShrink: 0 }}>
                                      {cand.vote_count} {cand.vote_count === 1 ? 'vote' : 'votes'}
                                    </span>
                                  </div>
                                  <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div
                                      style={{
                                        width: `${cand.vote_count > 0 ? percentage : 0}%`,
                                        height: '100%',
                                        background: 'linear-gradient(90deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
                                        borderRadius: '3px'
                                      }}
                                    />
                                  </div>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cand.year_class}</span>
                                </div>
                                <button
                                  onClick={() => handleDeleteCandidate(cand.id)}
                                  className="btn btn-secondary"
                                  style={{
                                    padding: '0.5rem',
                                    borderRadius: '6px',
                                    borderColor: 'transparent',
                                    background: 'rgba(239, 68, 68, 0.08)',
                                    color: '#ef4444',
                                    width: 'auto',
                                    minWidth: 'auto',
                                    flexShrink: 0
                                  }}
                                  title="Remove Candidate"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Add Candidate Form & Live Winners Standings */}
          <div>
            {/* Live Winners Standings Analysis Card */}
            <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <Award size={18} /> Live Leaderboard Standing
              </h3>
              {stats?.liveWinners && Object.keys(stats.liveWinners).length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>No votes have been cast yet.</p>
              ) : stats?.liveLeaders && Object.keys(stats.liveLeaders).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {Object.entries(stats.liveLeaders).map(([position, leader]) => (
                    <div key={position} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', fontWeight: 'bold' }}>{position}</span>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{leader ? leader.name : 'No votes cast yet'}</strong>
                      </div>
                      {leader && (
                        <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 'bold' }}>
                          {leader.vote_count} votes
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Waiting for votes to compile...</p>
              )}
            </div>

            {/* Add Candidate Card */}
            <div className="glass-panel" style={{ padding: '2rem' }}>
              <h2 className="header-title" style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={20} style={{ color: 'var(--color-secondary)' }} /> Add Candidate
              </h2>

              <form onSubmit={handleAddCandidate} encType="multipart/form-data">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Aravind Swamy"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Office Bearer Position</label>
                  <select
                    className="form-input"
                    value={newPosition}
                    onChange={(e) => setNewPosition(e.target.value)}
                    required
                  >
                    <option value="">-- Select Position --</option>
                    <option value="President">President</option>
                    <option value="Vice President">Vice President</option>
                    <option value="Secretary">Secretary</option>
                    <option value="Joint Secretary">Joint Secretary</option>
                    <option value="Treasurer">Treasurer</option>
                    <option value="Cultural">Cultural</option>
                    <option value="Sports">Sports</option>
                    <option value="Placement">Placement</option>
                    <option value="Brand Ambassador">Brand Ambassador</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Class & Year</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 4th Year IT-A, 1st Year MCA-B"
                    value={newYearClass}
                    onChange={(e) => setNewYearClass(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Upload Photo</label>
                  <div 
                    style={{
                      border: '2px dashed var(--border-light)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1.5rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: 'rgba(6,9,19,0.3)',
                      transition: 'border-color 0.2s',
                      position: 'relative'
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        setNewPhotoFile(e.dataTransfer.files[0]);
                      }
                    }}
                  >
                    <input
                      type="file"
                      id="candidate-photo-file"
                      accept="image/*"
                      onChange={(e) => setNewPhotoFile(e.target.files[0])}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer'
                      }}
                    />
                    <Upload size={24} style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }} />
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0 }}>
                      {newPhotoFile ? `Selected: ${newPhotoFile.name}` : 'Click or Drag image here to upload'}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Supports JPG, PNG, WEBP (Max 5MB)
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '1rem', background: 'linear-gradient(135deg, var(--color-secondary) 0%, var(--color-primary) 100%)' }}
                  disabled={submittingCandidate}
                >
                  {submittingCandidate ? 'Registering...' : 'Register Candidate'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 📊 TAB 2: VOTER SESSION AUDITS */}
      {activeTab === 'audits' && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 className="header-title" style={{ fontSize: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={20} style={{ color: 'var(--color-primary)' }} /> Voter Audit Logs
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Live audit trail displaying precisely when students log in, cast ballots, and log out. All times are displayed in India Standard Time (+05:30).
          </p>

          {/* Class / Section Filters */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
            {(() => {
              const uniqueClasses = stats?.voterAudits
                ? ['All', ...new Set(stats.voterAudits.map(v => v.class_name).filter(Boolean))]
                : ['All'];
              return uniqueClasses.map(cls => (
                <button
                  key={cls}
                  onClick={() => setSelectedClass(cls)}
                  className={`btn ${selectedClass === cls ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ width: 'auto', padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                >
                  {cls}
                </button>
              ));
            })()}
          </div>

          {(() => {
            const filteredAudits = stats?.voterAudits
              ? stats.voterAudits.filter(v => selectedClass === 'All' || v.class_name === selectedClass)
              : [];

            if (filteredAudits.length === 0) {
              return <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No student registration records found for this class.</p>;
            }

            return (
              <div style={{ overflowX: 'auto' }}>
                <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>
                      <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)' }}>Roll Number</th>
                      <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)' }}>Name</th>
                      <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)' }}>Class</th>
                      <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)' }}>Email</th>
                      <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)' }}>Login Time</th>
                      <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)' }}>Vote Time</th>
                      <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)' }}>Logout Time</th>
                      <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)', textAlign: 'right' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAudits.map(voter => (
                      <tr key={voter.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }} data-label="Roll Number">{voter.id}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)' }} data-label="Name">{voter.name}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }} data-label="Class">{voter.class_name || 'N/A'}</td>
                        <td style={{ padding: '0.75rem 0.5rem' }} data-label="Email">{voter.email}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#2563eb', fontWeight: '500' }} data-label="Login Time">{voter.login_time}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#10b981', fontWeight: '500' }} data-label="Vote Time">{voter.vote_time}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#ef4444', fontWeight: '500' }} data-label="Logout Time">{voter.logout_time}</td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }} data-label="Status">
                          <span style={{ background: voter.has_voted ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: voter.has_voted ? '#10b981' : '#ef4444', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                            {voter.has_voted ? 'Voted' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {/* 📊 TAB 3: DETAILED BALLOTS (De-anonymized Audit) */}
      {activeTab === 'ballots' && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 className="header-title" style={{ fontSize: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={20} style={{ color: 'var(--color-primary)' }} /> Detailed Ballots Audit Trail (De-anonymized)
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.75rem' }}>
            Security logs showing exactly who each student voted for, mapped by position. Useful for auditing and verify ballot validity.
          </p>
          {stats?.ballots && stats.ballots.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', textAlign: 'center', padding: '2rem' }}>No votes have been cast yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)' }}>Roll Number</th>
                    <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)' }}>Voter Name</th>
                    <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)' }}>Office Bearer Position</th>
                    <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)', textAlign: 'right' }}>Selected Candidate</th>
                  </tr>
                </thead>
                <tbody>
                  {stats?.ballots.map((ballot, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }} data-label="Roll Number">{ballot.studentId}</td>
                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)' }} data-label="Voter Name">{ballot.studentName}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 'bold' }} data-label="Position">{ballot.position}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: '#60a5fa', fontWeight: 'bold' }} data-label="Selected Candidate">{ballot.candidateName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 📊 TAB 4: SYSTEM CONTROLS & Turnout Overview */}
      {activeTab === 'system' && (
        <div>
          {/* Turnout Overview Panels (4-Grid Analytics Display) */}
          <div className="stats-grid" style={{ marginBottom: '2.5rem' }}>
            
            {/* Card 1: Status */}
            <div className="glass-panel stat-card" style={{ background: 'rgba(59, 130, 246, 0.03)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Election Status
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: stats?.resultsReleased ? 'var(--color-danger)' : 'var(--color-accent)', display: 'inline-block' }} />
                <span className="stat-value" style={{ fontSize: '1.6rem', color: 'var(--text-primary)', fontWeight: '800' }}>
                  {stats?.resultsReleased ? 'Concluded' : 'Active'}
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'auto' }}>
                {stats?.resultsReleased ? 'Winners published to results' : 'Voters casting ballots live'}
              </span>
            </div>

            {/* Card 2: Turnout */}
            <div className="glass-panel stat-card" style={{ background: 'rgba(59, 130, 246, 0.03)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Turnout Rate
              </span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.5rem' }}>
                <span className="stat-value" style={{ color: '#60a5fa', fontSize: '1.8rem' }}>{stats?.turnoutPercentage}%</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: '600' }}>
                  {stats?.votedCount} / {stats?.totalVoters} Voted
                </span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', marginTop: 'auto', overflow: 'hidden' }}>
                <div style={{ width: `${stats?.turnoutPercentage}%`, height: '100%', background: 'var(--color-primary)' }} />
              </div>
            </div>

            {/* Card 3: Pending */}
            <div className="glass-panel stat-card" style={{ background: 'rgba(16, 185, 129, 0.03)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Pending Voters
              </span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.5rem' }}>
                <span className="stat-value" style={{ color: '#34d399', fontSize: '1.8rem' }}>{stats?.notVotedCount}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: '600' }}>
                  Pending Ballots
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'auto' }}>
                Out of {stats?.totalVoters} registered voters
              </span>
            </div>

            {/* Card 4: Results Release Toggle */}
            <div className="glass-panel stat-card" style={{ background: 'rgba(139, 92, 246, 0.03)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Results Publication
              </span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <span className="stat-value" style={{ fontSize: '1.35rem', color: stats?.resultsReleased ? '#34d399' : '#f87171' }}>
                  {stats?.resultsReleased ? 'Released' : 'Hidden'}
                </span>
                <button
                  onClick={handleToggleResults}
                  className="btn"
                  style={{
                    background: stats?.resultsReleased ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: stats?.resultsReleased ? '#f87171' : '#34d399',
                    border: 'none',
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.75rem',
                    width: 'auto'
                  }}
                >
                  {stats?.resultsReleased ? <EyeOff size={13} /> : <Eye size={13} />}
                  {stats?.resultsReleased ? 'Lock' : 'Release'}
                </button>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'auto' }}>
                Controls winner visibility for voters
              </span>
            </div>
          </div>

          {/* Blocked Students Manager Panel */}
          <div className="glass-panel" style={{ padding: '1.75rem 2rem', background: 'rgba(239, 68, 68, 0.02)' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <Lock size={18} /> Blocked Voter Accounts (Lockout Protection)
            </h2>
            {stats?.blockedVoters && stats.blockedVoters.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                No student accounts are currently locked. System running securely.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>
                      <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)' }}>Roll Number</th>
                      <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)' }}>Name</th>
                      <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)' }}>Email</th>
                      <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)' }}>Failed Attempts</th>
                      <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats?.blockedVoters.map(voter => (
                      <tr key={voter.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }} data-label="Roll Number">{voter.id}</td>
                        <td style={{ padding: '0.75rem 0.5rem' }} data-label="Name">{voter.name}</td>
                        <td style={{ padding: '0.75rem 0.5rem' }} data-label="Email">{voter.email}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: 'var(--color-danger)' }} data-label="Failed Attempts">{voter.failed_attempts} attempts</td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }} data-label="Action">
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleUnblockStudent(voter.id)}
                            style={{
                              padding: '0.4rem 0.75rem',
                              fontSize: '0.8rem',
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#34d399',
                              borderColor: 'transparent',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                          >
                            <Unlock size={12} /> Unlock Account
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
