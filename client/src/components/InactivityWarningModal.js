import React from 'react';
import './InactivityWarningModal.css';

/**
 * Modal component that warns users before automatic logout due to inactivity
 */
function InactivityWarningModal({ show, timeRemaining, onExtendSession }) {
  if (!show) return null;

  const minutes = Math.floor(timeRemaining / 60000);
  const seconds = Math.floor((timeRemaining % 60000) / 1000);
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="inactivity-warning-overlay">
      <div className="inactivity-warning-modal">
        <div className="inactivity-warning-header">
          <h2>Session Timeout Warning</h2>
        </div>
        <div className="inactivity-warning-body">
          <p>You will be automatically logged out due to inactivity in:</p>
          <div className="inactivity-timer">
            <span className="timer-value">{formattedTime}</span>
          </div>
          <p className="inactivity-message">
            Click "Stay Logged In" to continue your session.
          </p>
        </div>
        <div className="inactivity-warning-actions">
          <button 
            className="btn btn-primary" 
            onClick={onExtendSession}
            autoFocus
          >
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
}

export default InactivityWarningModal;
