import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getNotifications, getUnreadNotificationCount, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification } from '../api/api';
import './Notifications.css';

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

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

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'task_assigned':
        return '📋';
      case 'task_reminder':
        return '⏰';
      case 'task_flagged':
        return '⚠️';
      case 'early_completion_approved':
        return '✅';
      case 'early_completion_rejected':
        return '❌';
      default:
        return '🔔';
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
                {notification.task_id && (
                  <Link 
                    to={`/tasks/${notification.task_id}`}
                    className="notification-link"
                    onClick={() => handleMarkAsRead(notification.id)}
                  >
                    View Task →
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
                    ✓
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
    </div>
  );
}

export default Notifications;
