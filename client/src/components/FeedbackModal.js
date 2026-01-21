/**
 * Feedback Modal Component
 * Modal form for users to submit feedback, bug reports, or feature requests
 */

import React, { useState, useEffect, useRef } from 'react';
import { submitFeedback } from '../api/api';
import './FeedbackModal.css';

const SUBJECT_OPTIONS = [
  { value: 'bug', label: 'Bug Report' },
  { value: 'feature', label: 'Feature Request' },
  { value: 'question', label: 'Question' },
  { value: 'improvement', label: 'Improvement Suggestion' },
  { value: 'other', label: 'Other' }
];

function FeedbackModal({ isOpen, onClose, user, currentPage }) {
  const [formData, setFormData] = useState({
    email: '',
    subject: 'bug',
    message: ''
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success' | 'error' | null
  const [submitMessage, setSubmitMessage] = useState('');
  const modalRef = useRef(null);
  const firstInputRef = useRef(null);

  // Pre-fill user info when modal opens
  useEffect(() => {
    if (isOpen && user) {
      setFormData(prev => ({
        ...prev,
        email: user.email || ''
      }));
    }
  }, [isOpen, user]);

  // Focus management for accessibility
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure modal is rendered
      setTimeout(() => {
        if (firstInputRef.current) {
          firstInputRef.current.focus();
        }
      }, 100);
    } else {
      // Reset form when modal closes
      setFormData({
        email: user?.email || '',
        subject: 'bug',
        message: ''
      });
      setErrors({});
      setSubmitStatus(null);
      setSubmitMessage('');
    }
  }, [isOpen, user]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen && !submitting) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, submitting, onClose]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
    } else if (formData.message.trim().length < 10) {
      newErrors.message = 'Message must be at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setSubmitStatus(null);
    setSubmitMessage('');

    try {
      await submitFeedback({
        name: user?.full_name || user?.username || 'User',
        email: formData.email.trim(),
        subject: formData.subject,
        message: formData.message.trim(),
        page_url: currentPage,
        user_id: user?.id
      });

      setSubmitStatus('success');
      setSubmitMessage('Thank you for your feedback! We will review it and get back to you if needed.');

      // Auto-close after 2 seconds on success
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setSubmitStatus('error');
      setSubmitMessage(
        error.response?.data?.error || 
        error.message || 
        'Failed to submit feedback. Please try again later.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="feedback-modal-overlay"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
    >
      <div
        ref={modalRef}
        className="feedback-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="feedback-modal-header">
          <h2 id="feedback-modal-title">Contact Developer</h2>
          <button
            className="feedback-modal-close"
            onClick={handleClose}
            disabled={submitting}
            aria-label="Close feedback form"
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="feedback-modal-form">
          <div className="feedback-form-group">
            <label htmlFor="feedback-email">
              Email <span className="required">*</span>
            </label>
            <input
              ref={firstInputRef}
              type="email"
              id="feedback-email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              disabled={submitting}
              className={errors.email ? 'error' : ''}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'feedback-email-error' : undefined}
            />
            {errors.email && (
              <span id="feedback-email-error" className="error-message" role="alert">
                {errors.email}
              </span>
            )}
          </div>

          <div className="feedback-form-group">
            <label htmlFor="feedback-subject">
              Subject <span className="required">*</span>
            </label>
            <select
              id="feedback-subject"
              name="subject"
              value={formData.subject}
              onChange={handleInputChange}
              disabled={submitting}
            >
              {SUBJECT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="feedback-form-group">
            <label htmlFor="feedback-message">
              Message <span className="required">*</span>
            </label>
            <textarea
              id="feedback-message"
              name="message"
              value={formData.message}
              onChange={handleInputChange}
              disabled={submitting}
              rows={6}
              placeholder="Please describe your feedback, issue, or suggestion in detail..."
              className={errors.message ? 'error' : ''}
              aria-invalid={!!errors.message}
              aria-describedby={errors.message ? 'feedback-message-error' : undefined}
            />
            {errors.message && (
              <span id="feedback-message-error" className="error-message" role="alert">
                {errors.message}
              </span>
            )}
            <div className="feedback-char-count">
              {formData.message.length} characters
            </div>
          </div>

          {submitStatus && (
            <div
              className={`feedback-submit-status ${submitStatus}`}
              role="alert"
              aria-live="polite"
            >
              {submitMessage}
            </div>
          )}

          <div className="feedback-modal-actions">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="feedback-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="feedback-btn-primary"
            >
              {submitting ? 'Sending...' : 'Send Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default FeedbackModal;
