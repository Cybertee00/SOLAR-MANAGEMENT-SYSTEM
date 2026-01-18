import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getNotifications, getUnreadNotificationCount, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification, getTrackerStatusRequests, reviewTrackerStatusRequest } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { 
  FaTasks, 
  FaBell, 
  FaExclamationTriangle, 
  FaCheckCircle, 
  FaTimesCircle, 
  FaClipboardList,
  FaInfoCircle,
  FaCheck,
  FaTimes,
  FaTrash,
  FaEye,
  FaFilter,
  FaCalendarAlt,
  FaLeaf,
  FaTint
} from 'react-icons/fa';
import './Notifications.css';

function Notifications() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [reviewingRequest, setReviewingRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingRequest, setProcessingRequest] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewedNotifications, setViewedNotifications] = useState(new Set());
  const autoMarkTimers = useRef({});
  const reviewDebounceTimer = useRef(null);
  const processingRequestId = useRef(null);

  // Get unique categories from notifications
  const categories = ['all', ...new Set(notifications.map(n => {
    if (n.type.startsWith('task_')) return 'tasks';
    if (n.type.startsWith('tracker_status_')) return 'tracker';
    if (n.type.startsWith('early_completion_')) return 'completion';
    return 'other';
  }))];

  useEffect(() => {
    loadNotifications();
    loadUnreadCount();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      loadNotifications();
      loadUnreadCount();
    }, 30000);
    
    return () => {
      clearInterval(interval);
      // Clear all auto-mark timers on unmount
      Object.values(autoMarkTimers.current).forEach(timer => clearTimeout(timer));
    };
  }, [showUnreadOnly, selectedCategory]);

  // Auto-mark notifications as read after 3 seconds of viewing
  useEffect(() => {
    notifications.forEach(notification => {
      if (!notification.is_read && !viewedNotifications.has(notification.id)) {
        // Mark as viewed immediately
        setViewedNotifications(prev => new Set([...prev, notification.id]));
        
        // Auto-mark as read after 3 seconds
        const timer = setTimeout(() => {
          handleMarkAsRead(notification.id, true); // silent = true to avoid reload
        }, 3000);
        
        autoMarkTimers.current[notification.id] = timer;
      }
    });

    return () => {
      // Clean up timers for notifications that are no longer in the list
      Object.keys(autoMarkTimers.current).forEach(id => {
        if (!notifications.find(n => n.id === id)) {
          clearTimeout(autoMarkTimers.current[id]);
          delete autoMarkTimers.current[id];
        }
      });
    };
  }, [notifications]);

  const loadNotifications = async () => {
    try {
      const params = showUnreadOnly ? { unread_only: 'true' } : {};
      const response = await getNotifications(params);
      setNotifications(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading notifications:', error);
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const response = await getUnreadNotificationCount();
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const handleMarkAsRead = async (id, silent = false) => {
    try {
      await markNotificationAsRead(id);
      if (!silent) {
        loadNotifications();
        loadUnreadCount();
      } else {
        // Update local state without reloading
        setNotifications(prev => prev.map(n => 
          n.id === id ? { ...n, is_read: true } : n
        ));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      if (!silent) {
        alert('Failed to mark notification as read');
      }
    }
  };

  const handleNotificationClick = useCallback((notification, e) => {
    // Don't mark as read if clicking on action buttons or links
    if (e.target.closest('.notification-actions') || 
        e.target.closest('.notification-link') ||
        e.target.closest('button')) {
      return;
    }

    // Mark as read when clicking anywhere on the notification card
    if (!notification.is_read) {
      handleMarkAsRead(notification.id);
    }
  }, []);

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      loadNotifications();
      loadUnreadCount();
    } catch (error) {
      console.error('Error marking all as read:', error);
      alert('Failed to mark all notifications as read');
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation(); // Prevent marking as read when deleting
    if (!window.confirm('Delete this notification?')) return;
    
    try {
      await deleteNotification(id);
      loadNotifications();
      loadUnreadCount();
    } catch (error) {
      console.error('Error deleting notification:', error);
      alert('Failed to delete notification');
    }
  };

  const handleReviewRequest = useCallback(async (requestId, action) => {
    // Prevent double-clicks and rapid submissions
    if (processingRequest || processingRequestId.current === requestId) {
      console.log('[NOTIFICATIONS] Request already processing, ignoring duplicate call');
      return;
    }

    if (action === 'reject' && !rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    // Clear any existing debounce timer
    if (reviewDebounceTimer.current) {
      clearTimeout(reviewDebounceTimer.current);
    }

    // Debounce the request to prevent rapid clicks
    return new Promise((resolve, reject) => {
      reviewDebounceTimer.current = setTimeout(async () => {
        processingRequestId.current = requestId;
        setProcessingRequest(true);

        // Optimistic UI update: Remove the notification from the list immediately
        const notificationToRemove = notifications.find(n => 
          n.type === 'tracker_status_request' && 
          n.metadata?.request_id === requestId
        );
        
        if (notificationToRemove) {
          // Remove from state immediately (optimistic update)
          setNotifications(prev => prev.filter(n => n.id !== notificationToRemove.id));
          setUnreadCount(prev => Math.max(0, prev - 1));
        }

        try {
          await reviewTrackerStatusRequest(requestId, action, rejectionReason || null);
          alert(`Request ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
          setReviewingRequest(null);
          setRejectionReason('');
          
          // Reload notifications to get the updated state (but notification is already removed optimistically)
          loadNotifications();
          loadUnreadCount();
          resolve();
        } catch (error) {
          console.error('Error reviewing request:', error);
          
          // Revert optimistic update on error
          if (notificationToRemove) {
            setNotifications(prev => [...prev, notificationToRemove].sort((a, b) => 
              new Date(b.created_at) - new Date(a.created_at)
            ));
            setUnreadCount(prev => prev + 1);
          }
          
          alert(error.response?.data?.error || 'Failed to review request');
          reject(error);
        } finally {
          setProcessingRequest(false);
          processingRequestId.current = null;
        }
      }, 300); // 300ms debounce
    });
  }, [notifications, rejectionReason, processingRequest, loadNotifications, loadUnreadCount]);

  const getNotificationIcon = (type) => {
    const iconProps = { size: 24, className: 'notification-icon-svg' };
    switch (type) {
      case 'task_assigned':
        return <FaTasks {...iconProps} style={{ color: '#007bff' }} />;
      case 'task_reminder':
        return <FaBell {...iconProps} style={{ color: '#ffc107' }} />;
      case 'task_flagged':
        return <FaExclamationTriangle {...iconProps} style={{ color: '#dc3545' }} />;
      case 'early_completion_approved':
        return <FaCheckCircle {...iconProps} style={{ color: '#28a745' }} />;
      case 'early_completion_rejected':
        return <FaTimesCircle {...iconProps} style={{ color: '#dc3545' }} />;
      case 'tracker_status_request':
        return <FaClipboardList {...iconProps} style={{ color: '#17a2b8' }} />;
      case 'tracker_status_approved':
        return <FaCheckCircle {...iconProps} style={{ color: '#28a745' }} />;
      case 'tracker_status_rejected':
        return <FaTimesCircle {...iconProps} style={{ color: '#dc3545' }} />;
      default:
        return <FaInfoCircle {...iconProps} style={{ color: '#6c757d' }} />;
    }
  };

  const getNotificationClass = (type) => {
    switch (type) {
      case 'task_assigned':
        return 'notification-assigned';
      case 'task_reminder':
        return 'notification-reminder';
      case 'task_flagged':
        return 'notification-flagged';
      case 'early_completion_approved':
        return 'notification-approved';
      case 'early_completion_rejected':
        return 'notification-rejected';
      case 'tracker_status_request':
        return 'notification-tracker-request';
      case 'tracker_status_approved':
        return 'notification-approved';
      case 'tracker_status_rejected':
        return 'notification-rejected';
      default:
        return '';
    }
  };

  // Group notifications by date
  const groupNotificationsByDate = (notifications) => {
    const groups = {};
    notifications.forEach(notification => {
      const date = new Date(notification.created_at);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let dateKey;
      if (date.toDateString() === today.toDateString()) {
        dateKey = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateKey = 'Yesterday';
      } else {
        dateKey = date.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      }
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(notification);
    });
    return groups;
  };

  // Filter notifications by category
  const filterNotifications = (notifications) => {
    if (selectedCategory === 'all') return notifications;
    
    return notifications.filter(n => {
      if (selectedCategory === 'tasks') return n.type.startsWith('task_');
      if (selectedCategory === 'tracker') return n.type.startsWith('tracker_status_');
      if (selectedCategory === 'completion') return n.type.startsWith('early_completion_');
      return true;
    });
  };

  const filteredNotifications = filterNotifications(notifications);
  const groupedNotifications = groupNotificationsByDate(filteredNotifications);

  if (loading) {
    return <div className="loading">Loading notifications...</div>;
  }

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <h1>Notifications</h1>
        <div className="notifications-actions">
          {unreadCount > 0 && (
            <button 
              className="btn btn-secondary"
              onClick={handleMarkAllAsRead}
            >
              <FaCheck style={{ marginRight: '6px' }} />
              Mark All Read
            </button>
          )}
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={showUnreadOnly}
              onChange={(e) => setShowUnreadOnly(e.target.checked)}
            />
            Show unread only
          </label>
        </div>
      </div>

      {/* Category Filter */}
      <div className="notifications-filters">
        <div className="filter-group">
          <FaFilter style={{ marginRight: '8px', color: '#666' }} />
          <span className="filter-label">Category:</span>
          <select 
            className="category-filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            <option value="tasks">Tasks</option>
            <option value="tracker">Tracker Status</option>
            <option value="completion">Early Completion</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {unreadCount > 0 && !showUnreadOnly && (
        <div className="unread-badge-header">
          <span className="unread-count-badge">{unreadCount} unread</span>
        </div>
      )}

      {filteredNotifications.length === 0 ? (
        <div className="no-notifications">
          <FaBell size={48} style={{ color: '#ccc', marginBottom: '16px' }} />
          <p>No notifications {showUnreadOnly ? 'unread' : selectedCategory !== 'all' ? `in ${selectedCategory}` : ''}</p>
        </div>
      ) : (
        <div className="notifications-list">
          {Object.entries(groupedNotifications).map(([dateKey, dateNotifications]) => (
            <div key={dateKey} className="notification-date-group">
              <div className="notification-date-header">
                <FaCalendarAlt style={{ marginRight: '8px', color: '#666' }} />
                <span className="date-label">{dateKey}</span>
                <span className="date-count">({dateNotifications.length})</span>
              </div>
              {dateNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${getNotificationClass(notification.type)} ${!notification.is_read ? 'unread' : ''}`}
                  style={{
                    borderLeft: notification.metadata?.highlight ? '4px solid #007bff' : undefined,
                    backgroundColor: notification.metadata?.highlight ? '#e3f2fd' : undefined
                  }}
                  onClick={(e) => handleNotificationClick(notification, e)}
                >
                  <div className="notification-icon-wrapper">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-content">
                    <div className="notification-header">
                      <h3 className="notification-title">{notification.title}</h3>
                      <span className="notification-time">
                        {new Date(notification.created_at).toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                    <p className="notification-message">{notification.message}</p>
                    
                    {/* Tracker Status Request Actions (Admin Only) */}
                    {notification.type === 'tracker_status_request' && 
                     (isAdmin() || isSuperAdmin()) && 
                     notification.metadata?.request_id && (
                      <div className="tracker-request-details">
                        <div className="tracker-details-grid">
                          <div className="tracker-detail-item">
                            <strong>Trackers:</strong> {notification.metadata.tracker_ids?.join(', ') || 'N/A'}
                          </div>
                          <div className="tracker-detail-item">
                            <strong>Task Type:</strong>
                            <span className="task-type-badge">
                              {notification.metadata.task_type === 'grass_cutting' ? (
                                <>
                                  <FaLeaf style={{ marginRight: '4px' }} />
                                  Grass Cutting
                                </>
                              ) : (
                                <>
                                  <FaTint style={{ marginRight: '4px' }} />
                                  Panel Wash
                                </>
                              )}
                            </span>
                          </div>
                          <div className="tracker-detail-item">
                            <strong>Status:</strong>
                            <span className={`status-badge ${notification.metadata.status_type === 'done' ? 'status-done' : 'status-halfway'}`}>
                              {notification.metadata.status_type === 'done' ? (
                                <>
                                  <FaCheckCircle style={{ marginRight: '4px' }} />
                                  Done
                                </>
                              ) : (
                                <>
                                  <FaBell style={{ marginRight: '4px' }} />
                                  Halfway
                                </>
                              )}
                            </span>
                          </div>
                          {notification.metadata.message && (
                            <div className="tracker-detail-note">
                              <strong>Note:</strong> {notification.metadata.message}
                            </div>
                          )}
                        </div>
                        <div className="tracker-action-buttons">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReviewRequest(notification.metadata.request_id, 'approve');
                            }}
                            className="btn btn-success btn-with-icon"
                            disabled={processingRequest}
                          >
                            <FaCheck style={{ marginRight: '6px' }} />
                            Approve
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setReviewingRequest(notification.metadata.request_id);
                            }}
                            className="btn btn-danger btn-with-icon"
                            disabled={processingRequest}
                          >
                            <FaTimes style={{ marginRight: '6px' }} />
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {notification.task_id && (
                      <Link 
                        to={`/tasks/${notification.task_id}`}
                        className="notification-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsRead(notification.id);
                        }}
                      >
                        <FaEye style={{ marginRight: '6px' }} />
                        View Task
                      </Link>
                    )}
                  </div>
                  <div className="notification-actions" onClick={(e) => e.stopPropagation()}>
                    {!notification.is_read && (
                      <button
                        className="btn-icon"
                        onClick={() => handleMarkAsRead(notification.id)}
                        title="Mark as read"
                      >
                        <FaEye />
                      </button>
                    )}
                    <button
                      className="btn-icon delete"
                      onClick={(e) => handleDelete(notification.id, e)}
                      title="Delete"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Rejection Reason Modal */}
      {reviewingRequest && (
        <div 
          className="modal-overlay"
          onClick={() => !processingRequest && setReviewingRequest(null)}
        >
          <div 
            className="modal-content rejection-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <FaTimesCircle style={{ marginRight: '10px', color: '#dc3545' }} />
              <h2>Reject Tracker Status Request</h2>
            </div>
            <p className="modal-description">
              Please provide a reason for rejecting this request:
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows="4"
              className="rejection-textarea"
              disabled={processingRequest}
            />
            <div className="modal-footer">
              <button
                onClick={() => {
                  setReviewingRequest(null);
                  setRejectionReason('');
                }}
                className="btn btn-secondary"
                disabled={processingRequest}
              >
                Cancel
              </button>
              <button
                onClick={() => handleReviewRequest(reviewingRequest, 'reject')}
                className="btn btn-danger btn-with-icon"
                disabled={processingRequest || !rejectionReason.trim()}
              >
                <FaTimes style={{ marginRight: '6px' }} />
                {processingRequest ? 'Processing...' : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Notifications;
