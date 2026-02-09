import React, { useEffect } from 'react';
import './ErrorAlert.css';

/**
 * ErrorAlert - A professional modal-style error alert component
 * Replaces browser alert() with a styled, accessible modal
 *
 * Usage:
 * const [error, setError] = useState(null);
 *
 * // In catch block:
 * setError({ message: 'Failed to save', details: error.message });
 *
 * // In render:
 * <ErrorAlert error={error} onClose={() => setError(null)} title="Save Error" />
 */
export const ErrorAlert = ({
  error,
  onClose,
  title = 'Error',
  type = 'error' // 'error', 'warning', 'success', 'info'
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && error) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [error, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (error) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [error]);

  if (!error) return null;

  const message = typeof error === 'string' ? error : error.message;
  const details = typeof error === 'object' ? error.details : null;

  // Icon based on type
  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '✕';
    }
  };

  return (
    <div className="error-alert-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`error-alert-content error-alert-${type}`}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-labelledby="error-alert-title"
        aria-describedby="error-alert-message"
      >
        <div className="error-alert-header">
          <span className={`error-alert-icon error-alert-icon-${type}`}>{getIcon()}</span>
          <h3 id="error-alert-title">{title}</h3>
          <button
            className="error-alert-close"
            onClick={onClose}
            aria-label="Close alert"
            autoFocus
          >
            ×
          </button>
        </div>
        <div className="error-alert-body">
          <p id="error-alert-message" className="error-message">{message}</p>
          {details && (
            <details className="error-details">
              <summary>Technical Details</summary>
              <pre>{typeof details === 'object' ? JSON.stringify(details, null, 2) : details}</pre>
            </details>
          )}
        </div>
        <div className="error-alert-footer">
          <button className="error-alert-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * SuccessAlert - Convenience wrapper for success messages
 */
export const SuccessAlert = ({ message, onClose, title = 'Success' }) => (
  <ErrorAlert error={message} onClose={onClose} title={title} type="success" />
);

/**
 * WarningAlert - Convenience wrapper for warning messages
 */
export const WarningAlert = ({ message, onClose, title = 'Warning' }) => (
  <ErrorAlert error={message} onClose={onClose} title={title} type="warning" />
);

/**
 * InfoAlert - Convenience wrapper for info messages
 */
export const InfoAlert = ({ message, onClose, title = 'Information' }) => (
  <ErrorAlert error={message} onClose={onClose} title={title} type="info" />
);

/**
 * useAlert - Custom hook for managing alert state
 *
 * Usage:
 * const { alert, showError, showSuccess, showWarning, clearAlert } = useAlert();
 *
 * // In handler:
 * try {
 *   await saveData();
 *   showSuccess('Data saved successfully!');
 * } catch (error) {
 *   showError('Failed to save data', error.message);
 * }
 *
 * // In render:
 * {alert && <ErrorAlert {...alert} onClose={clearAlert} />}
 */
export const useAlert = () => {
  const [alert, setAlert] = React.useState(null);

  const showError = (message, details = null, title = 'Error') => {
    setAlert({ error: { message, details }, title, type: 'error' });
  };

  const showSuccess = (message, title = 'Success') => {
    setAlert({ error: { message }, title, type: 'success' });
  };

  const showWarning = (message, details = null, title = 'Warning') => {
    setAlert({ error: { message, details }, title, type: 'warning' });
  };

  const showInfo = (message, title = 'Information') => {
    setAlert({ error: { message }, title, type: 'info' });
  };

  const clearAlert = () => setAlert(null);

  return {
    alert,
    showError,
    showSuccess,
    showWarning,
    showInfo,
    clearAlert
  };
};

export default ErrorAlert;
