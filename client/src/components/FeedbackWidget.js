/**
 * Feedback Widget Component
 * Floating action button for users to contact developer with feedback/issues
 */

import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FeedbackModal from './FeedbackModal';
import './FeedbackWidget.css';

function FeedbackWidget() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  // Don't show on login page
  if (location.pathname === '/login') {
    return null;
  }

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <button
        className="feedback-widget-button"
        onClick={handleOpenModal}
        aria-label="Send feedback or report an issue"
        title="Contact Developer - Send Feedback"
      >
        <svg
          className="feedback-widget-icon"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Round speech bubble */}
          <path
            d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 2.98.97 4.29L1 23l6.71-1.97C9.02 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"
            fill="currentColor"
          />
          {/* Thought bubbles above */}
          <circle cx="8" cy="7" r="1.2" fill="currentColor" opacity="0.9"/>
          <circle cx="12" cy="6.5" r="1.5" fill="currentColor" opacity="0.9"/>
          <circle cx="16" cy="7" r="1.2" fill="currentColor" opacity="0.9"/>
        </svg>
      </button>

      <FeedbackModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        user={user}
        currentPage={location.pathname}
      />
    </>
  );
}

export default FeedbackWidget;
