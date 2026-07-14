import React, { useState, useEffect } from 'react';
import { Award, Users, BarChart2, ShieldCheck, Trophy, LogIn } from 'lucide-react';

export default function ResultsHub({ onGoToLogin }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchResults = async () => {
    try {
      const response = await fetch('/api/results');
      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.error || 'Failed to load results');
      }

      setData(resData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
    // Poll results every 10 seconds in case results are released live
    const interval = setInterval(fetchResults, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <h2 style={{ color: 'var(--text-secondary)' }}>Retrieving Election Outcomes...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', maxWidth: '500px', margin: '2rem auto' }}>
        <h3 style={{ color: '#f87171', marginBottom: '1rem' }}>Failed to retrieve results</h3>
        <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
      </div>
    );
  }

  // If results are not released yet
  if (data && !data.released) {
    return (
      <div className="glass-panel animate-fade-in" style={{ padding: '3rem 2rem', textAlign: 'center', maxWidth: '540px', margin: '3rem auto' }}>
        <div
          style={{
            display: 'inline-flex',
            padding: '1.25rem',
            borderRadius: '50%',
            background: 'rgba(59, 130, 246, 0.1)',
            color: 'var(--color-primary)',
            marginBottom: '1.5rem',
            border: '1px solid rgba(59, 130, 246, 0.2)'
          }}
        >
          <ShieldCheck size={36} />
        </div>
        <h2 className="header-title" style={{ fontSize: '1.85rem', marginBottom: '1rem' }}>
          Election Results Locked
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.6' }}>
          Thank you for casting your vote! The voting session is currently active. Voters cannot see the outcomes until the IT department admin concludes the election and releases the winners.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button className="btn btn-primary" onClick={fetchResults}>
            Refresh Results Status
          </button>
          <button className="btn btn-secondary" onClick={onGoToLogin}>
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div
          style={{
            display: 'inline-flex',
            padding: '0.5rem 1rem',
            borderRadius: '20px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            fontSize: '0.85rem',
            fontWeight: '600',
            marginBottom: '1rem',
            gap: '0.5rem',
            alignItems: 'center'
          }}
        >
          <ShieldCheck size={14} /> OFFICIAL ELECTION OUTCOMES
        </div>
        <h1 className="header-title" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
          IT Department Office Bearers
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Official winner roster and voting turnout audit report.
        </p>
      </div>

      {/* Turnout Statistics Box */}
      <div className="glass-panel" style={{ padding: '1.5rem 2rem', marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Voter Turnout Rate
            </span>
            <h3 style={{ fontSize: '2.25rem', fontWeight: '800', color: 'var(--color-primary)', marginTop: '0.25rem' }}>
              {data.stats.turnoutPercentage}%
            </h3>
          </div>
          <div style={{ width: '1px', height: '50px', background: 'var(--border-light)' }} className="divider-line" />
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Ballots Cast
            </span>
            <h3 style={{ fontSize: '2.25rem', fontWeight: '800', color: 'white', marginTop: '0.25rem' }}>
              {data.stats.votedCount}
            </h3>
          </div>
          <div style={{ width: '1px', height: '50px', background: 'var(--border-light)' }} className="divider-line" />
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pending Ballots
            </span>
            <h3 style={{ fontSize: '2.25rem', fontWeight: '800', color: 'var(--color-accent)', marginTop: '0.25rem' }}>
              {data.stats.notVotedCount}
            </h3>
          </div>
          <div style={{ width: '1px', height: '50px', background: 'var(--border-light)' }} className="divider-line" />
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Registered IT Voters
            </span>
            <h3 style={{ fontSize: '2.25rem', fontWeight: '800', color: 'white', marginTop: '0.25rem' }}>
              {data.stats.totalVoters}
            </h3>
          </div>
        </div>
      </div>

      {/* Winners Roster Section */}
      <div style={{ marginBottom: '4rem' }}>
        <h2 className="header-title" style={{ fontSize: '1.75rem', marginBottom: '1.5rem', textAlign: 'center' }}>
          🏆 Elected Office Bearers
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1.75rem'
          }}
        >
          {Object.entries(data.winners).map(([position, winnersList]) => {
            const hasTies = winnersList.length > 1;
            return winnersList.map(winner => (
              <div
                key={`${position}-${winner.id}`}
                className="glass-panel"
                style={{
                  padding: '2.5rem 1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  border: '1.5px solid rgba(139, 92, 246, 0.3)',
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(12, 18, 36, 0.6) 100%)',
                  position: 'relative'
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '-15px',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: 'white',
                    padding: '0.3rem 0.8rem',
                    borderRadius: '20px',
                    fontSize: '0.7rem',
                    fontWeight: '800',
                    letterSpacing: '0.05em',
                    boxShadow: '0 4px 10px rgba(217, 119, 6, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <Trophy size={12} /> {hasTies ? 'CO-WINNER' : 'WINNER'}
                </div>

                <img
                  src={window.getAssetUrl ? window.getAssetUrl(winner.photo_url) : winner.photo_url}
                  alt={winner.name}
                  style={{
                    width: '90px',
                    height: '90px',
                    borderRadius: '50%',
                    border: '3px solid #f59e0b',
                    boxShadow: '0 0 15px rgba(245, 158, 11, 0.2)',
                    objectFit: 'cover',
                    marginBottom: '1rem'
                  }}
                />

                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {position}
                </span>

                <h3 style={{ fontSize: '1.35rem', fontWeight: '700', margin: '0.25rem 0', color: 'white', textAlign: 'center' }}>
                  {winner.name}
                </h3>

                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {winner.year_class}
                </span>

                <div
                  style={{
                    marginTop: '1.25rem',
                    background: 'rgba(255, 255, 255, 0.04)',
                    padding: '0.4rem 1rem',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)'
                  }}
                >
                  Votes Received: <strong style={{ color: 'white' }}>{winner.vote_count}</strong>
                </div>
              </div>
            ));
          })}
        </div>
      </div>

      {/* Button to go to login */}
      <div style={{ textAlign: 'center' }}>
        <button className="btn btn-secondary" onClick={onGoToLogin} style={{ minWidth: '200px' }}>
          <LogIn size={16} /> Back to Student Login
        </button>
      </div>
    </div>
  );
}
