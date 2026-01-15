import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getNotifications, getUnreadNotificationCount, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification, getTrackerStatusRequests, reviewTrackerStatusRequest } from '../api/api';
import { useAuth } from '../context/AuthContext';
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

  useEffect(() => {
    loadNotifications();
    loadUnreadCount();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      loadNotifications();
      loadUnreadCount();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [showUnreadOnly]);

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

  const handleMarkAsRead = async (id) => {
    try {
      await markNotificationAsRead(id);
      loadNotifications();
      loadUnreadCount();
    } catch (error) {
      console.error('Error marking notification as read:', error);
      alert('Failed to mark notification as read');
    }
  };

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

  const handleDelete = async (id) => {
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

  const handleReviewRequest = async (requestId, action) => {
    if (action === 'reject' && !rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setProcessingRequest(true);
    try {
      await reviewTrackerStatusRequest(requestId, action, rejectionReason || null);
      alert(`Request ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
      setReviewingRequest(null);
      setRejectionReason('');
      loadNotifications();
      loadUnreadCount();
    } catch (error) {
      console.error('Error reviewing request:', error);
      alert(error.response?.data?.error || 'Failed to review request');
    } finally {
      setProcessingRequest(false);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'task_assigned':
        return 'TASK';
      case 'task_reminder':
        return 'REMINDER';
      case 'task_flagged':
        return 'FLAGGED';
      case 'early_completion_approved':
        return 'APPROVED';
      case 'early_completion_rejected':
        return 'REJECTED';
      case 'tracker_status_request':
        return '📋';
      case 'tracker_status_approved':
        return '✅';
      case 'tracker_status_rejected':
        return '❌';
      default:
        return 'INFO';
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
              Mark All as Read
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

      {unreadCount > 0 && !showUnreadOnly && (
        <div className="unread-badge-header">
          <span className="unread-count-badge">{unreadCount} unread</span>
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="no-notifications">
          <p>No notifications {showUnreadOnly ? 'unread' : ''}</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`notification-item ${getNotificationClass(notification.type)} ${!notification.is_read ? 'unread' : ''}`}
              style={{
                borderLeft: notification.metadata?.highlight ? '4px solid #007bff' : undefined,
                backgroundColor: notification.metadata?.highlight ? '#e3f2fd' : undefined
              }}
            >
              <div className="notification-icon">
                {getNotificationIcon(notification.type)}
              </div>
              <div className="notification-content">
                <div className="notification-header">
                  <h3 className="notification-title">{notification.title}</h3>
                  <span className="notification-time">
                    {new Date(notification.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="notification-message">{notification.message}</p>
                
                {/* Tracker Status Request Actions (Admin Only) */}
                {notification.type === 'tracker_status_request' && 
                 (isAdmin() || isSuperAdmin()) && 
                 notification.metadata?.request_id && (
                  <div style={{ 
                    marginTop: '12px', 
                    padding: '12px', 
                    background: '#f8f9fa', 
                    borderRadius: '6px',
                    border: '1px solid #dee2e6'
                  }}>
                    <div style={{ marginBottom: '10px', fontSize: '13px', color: '#666', lineHeight: '1.6' }}>
                      <div><strong>Trackers:</strong> {notification.metadata.tracker_ids?.join(', ') || 'N/A'}</div>
                      <div><strong>Task Type:</strong> {notification.metadata.task_type === 'grass_cutting' ? '🌿 Grass Cutting' : '💧 Panel Wash'}</div>
                      <div><strong>Status:</strong> {notification.metadata.status_type === 'done' ? '✅ Done' : '🔄 Halfway'}</div>
                      {notification.metadata.message && (
                        <div style={{ marginTop: '6px', fontStyle: 'italic' }}>
                          <strong>Note:</strong> {notification.metadata.message}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleReviewRequest(notification.metadata.request_id, 'approve')}
                        className="btn btn-success"
                        disabled={processingRequest}
                        style={{ 
                          padding: '8px 16px', 
                          fontSize: '13px',
                          fontWeight: 'bold',
                          flex: '1',
                          minWidth: '120px'
                        }}
                      >
                        ✅ Approve
                      </button>
                      <button
                        onClick={() => setReviewingRequest(notification.metadata.request_id)}
                        className="btn btn-danger"
                        disabled={processingRequest}
                        style={{ 
                          padding: '8px 16px', 
                          fontSize: '13px',
                          fontWeight: 'bold',
                          flex: '1',
                          minWidth: '120px'
                        }}
                      >
                        ❌ Reject
                      </button>
                    </div>
                  </div>
                )}
                
                {notification.task_id && (
                  <Link 
                    to={`/tasks/${notification.task_id}`}
                    className="notification-link"
                    onClick={() => handleMarkAsRead(notification.id)}
                  >
                    View Task
                  </Link>
                )}
              </div>
              <div className="notification-actions">
                {!notification.is_read && (
                  <button
                    className="btn-icon"
                    onClick={() => handleMarkAsRead(notification.id)}
                    title="Mark as read"
                  >
                    Read
                  </button>
                )}
                <button
                  className="btn-icon delete"
                  onClick={() => handleDelete(notification.id)}
                  title="Delete"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rejection Reason Modal */}
      {reviewingRequest && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
          onClick={() => !processingRequest && setReviewingRequest(null)}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '25px',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 15px 0', color: '#dc3545' }}>
              ❌ Reject Tracker Status Request
            </h2>
            <p style={{ margin: '0 0 15px 0', color: '#666', fontSize: '14px' }}>
              Please provide a reason for rejecting this request:
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows="4"
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '14px',
                border: '2px solid #ddd',
                borderRadius: '6px',
                resize: 'vertical',
                fontFamily: 'inherit',
                marginBottom: '15px'
              }}
              disabled={processingRequest}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setReviewingRequest(null);
                  setRejectionReason('');
                }}
                className="btn btn-secondary"
                disabled={processingRequest}
                style={{ padding: '10px 20px', fontSize: '14px' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleReviewRequest(reviewingRequest, 'reject')}
                className="btn btn-danger"
                disabled={processingRequest || !rejectionReason.trim()}
                style={{ padding: '10px 20px', fontSize: '14px', fontWeight: 'bold' }}
              >
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
