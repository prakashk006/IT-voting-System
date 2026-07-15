import React, { useState } from 'react';
import { User, CheckCircle2, ShieldAlert, ArrowLeft, ArrowRight } from 'lucide-react';

export default function VotingWizard({ candidates, token, onVoteSubmitted }) {
  const positions = Object.keys(candidates);
  const [currentStepIndex, setCurrentStepIndex] = useState(0); // Index of current position, or positions.length for review
  const [selections, setSelections] = useState({}); // { [position]: candidateId }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isReviewStep = currentStepIndex === positions.length;
  const currentPosition = positions[currentStepIndex];
  const currentCandidates = candidates[currentPosition] || [];

  const handleSelectCandidate = (candidateId) => {
    setSelections(prev => ({
      ...prev,
      [currentPosition]: candidateId
    }));
  };

  const handleNext = () => {
    if (!selections[currentPosition]) {
      setError('Please select a candidate before proceeding.');
      return;
    }
    setError('');
    setCurrentStepIndex(prev => prev + 1);
  };

  const handleBack = () => {
    setError('');
    setCurrentStepIndex(prev => prev - 1);
  };

  const handleSubmitBallot = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ selections })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit ballot');
      }

      onVoteSubmitted();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Find candidate details helper
  const getSelectedCandidateDetails = (position) => {
    const candId = selections[position];
    return candidates[position]?.find(c => c.id === candId);
  };

  // Calculate progress percentage
  const progressPercent = ((currentStepIndex) / (positions.length)) * 100;

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      {/* Step Progress Bar */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '2.5rem', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
            {isReviewStep ? 'BALLOT VERIFICATION' : `CASTING VOTE: ${currentStepIndex + 1} of ${positions.length}`}
          </span>
          <span className="badge badge-blue">
            {isReviewStep ? 'FINAL STEP' : currentPosition}
          </span>
        </div>
        <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${isReviewStep ? 100 : progressPercent}%`,
              height: '100%',
              background: 'linear-gradient(90deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
              transition: 'width 0.4s ease-out'
            }}
          />
        </div>
      </div>

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

      {/* Main Card */}
      {!isReviewStep ? (
        <div>
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <h2 className="header-title" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
              Select Candidate for <span className="glow-text-blue" style={{ color: 'var(--color-primary)' }}>{currentPosition}</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              Choose one candidate from the choices below. You must make a selection to proceed.
            </p>
          </div>

          <div className="candidate-grid">
            {currentCandidates.map(candidate => {
              const isSelected = selections[currentPosition] === candidate.id;
              return (
                <div
                  key={candidate.id}
                  className={`candidate-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectCandidate(candidate.id)}
                >
                  <img
                    src={window.getAssetUrl ? window.getAssetUrl(candidate.photo_url) : candidate.photo_url}
                    alt={candidate.name}
                    className="candidate-photo"
                  />
                  <h3 className="candidate-name">{candidate.name}</h3>
                  <p className="candidate-meta">{candidate.year_class}</p>
                </div>
              );
            })}
          </div>

          {/* Navigation Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3rem', gap: '1rem' }}>
            <button
              className="btn btn-secondary"
              onClick={handleBack}
              disabled={currentStepIndex === 0}
              style={{ minWidth: '120px' }}
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              className="btn btn-primary"
              onClick={handleNext}
              style={{ minWidth: '160px' }}
            >
              Continue <ArrowRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        /* Review Step */
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <h2 className="header-title" style={{ fontSize: '2.25rem', marginBottom: '0.5rem' }}>
              Verify Your Ballot
            </h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              Please review all selections carefully before casting your final ballot.
            </p>
          </div>

          {/* Selections List */}
          <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {positions.map(position => {
                const details = getSelectedCandidateDetails(position);
                return (
                  <div
                    key={position}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingBottom: '1rem',
                      borderBottom: '1px solid var(--border-light)'
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          color: 'var(--text-secondary)',
                          textTransform: 'uppercase',
                          display: 'block'
                        }}
                      >
                        {position}
                      </span>
                      <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{details?.name}</strong>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                        ({details?.year_class})
                      </span>
                    </div>
                    <img
                      src={window.getAssetUrl ? window.getAssetUrl(details?.photo_url) : details?.photo_url}
                      alt={details?.name}
                      style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid var(--color-primary)' }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Security Notice */}
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '12px',
              padding: '1.25rem',
              marginBottom: '2.5rem',
              color: 'var(--text-secondary)'
            }}
          >
            <ShieldAlert size={28} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
            <div>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.25rem' }}>
                Double-Voting Security Lock Active
              </strong>
              <span style={{ fontSize: '0.85rem' }}>
                Once submitted, this ballot is recorded and your student ID is permanently marked as voted. You cannot log back in, review, or edit your votes.
              </span>
            </div>
          </div>

          {/* Final controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <button
              className="btn btn-secondary"
              onClick={handleBack}
              disabled={loading}
              style={{ flex: 1 }}
            >
              Modify Choices
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSubmitBallot}
              disabled={loading}
              style={{ flex: 2, background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%)' }}
            >
              {loading ? (
                'Recording Ballot...'
              ) : (
                <>
                  <CheckCircle2 size={18} /> Cast Secure Ballot
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
