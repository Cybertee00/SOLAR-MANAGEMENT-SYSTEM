/**
 * Notification Utility
 * Handles creating and managing notifications for users
 */

const { sendTaskAssignmentEmail, sendTaskReminderEmail } = require('./email');

/**
 * Create a notification for a user
 * @param {Object} pool - Database connection pool
 * @param {Object} notificationData - Notification data
 * @param {string} notificationData.user_id - User ID to notify
 * @param {string} notificationData.task_id - Task ID (optional)
 * @param {string} notificationData.type - Notification type
 * @param {string} notificationData.title - Notification title
 * @param {string} notificationData.message - Notification message
 * @param {Object} notificationData.metadata - Additional metadata (optional)
 */
async function createNotification(pool, notificationData) {
  try {
    const { user_id, task_id, type, title, message, metadata } = notificationData;
    
    const result = await pool.query(
      `INSERT INTO notifications (user_id, task_id, type, title, message, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [user_id, task_id || null, type, title, message, metadata ? JSON.stringify(metadata) : null]
    );
    
    console.log(`Notification created: ${type} for user ${user_id}`);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Create task assignment notification
 * Sends email first (primary), then creates in-app notification (secondary)
 */
async function notifyTaskAssigned(pool, task, assignedUser) {
  const taskDetails = {
    task_code: task.task_code,
    task_type: task.task_type,
    scheduled_date: task.scheduled_date,
    asset_name: task.asset_name || 'Unknown Asset'
  };
  
  // PRIMARY: Send email notification first
  try {
    const emailResult = await sendTaskAssignmentEmail(assignedUser, {
      ...task,
      asset_name: taskDetails.asset_name
    });
    
    if (emailResult.success) {
      console.log(`Email notification sent successfully to ${assignedUser.email} for task ${task.task_code}`);
    } else {
      console.warn(`Email notification failed for ${assignedUser.email}: ${emailResult.reason || emailResult.error}`);
    }
  } catch (emailError) {
    console.error('Error sending task assignment email:', emailError);
    // Continue with in-app notification even if email fails
  }
  
  // SECONDARY: Create in-app notification
  return await createNotification(pool, {
    user_id: task.assigned_to,
    task_id: task.id,
    type: 'task_assigned',
    title: 'New Task Assigned',
    message: `You have been assigned a new ${task.task_type} task: ${task.task_code} for ${taskDetails.asset_name}. Scheduled for ${task.scheduled_date ? new Date(task.scheduled_date).toLocaleDateString() : 'TBD'}.`,
    metadata: {
      task: taskDetails,
      highlight: true, // Highlight this task
      scheduled_date: task.scheduled_date
    }
  });
}

/**
 * Create task reminder notification (3 days before)
 * Sends email first (primary), then creates in-app notification (secondary)
 */
async function notifyTaskReminder(pool, task, assignedUser) {
  const taskDetails = {
    task_code: task.task_code,
    task_type: task.task_type,
    scheduled_date: task.scheduled_date,
    asset_name: task.asset_name || 'Unknown Asset'
  };
  
  // PRIMARY: Send email notification first
  try {
    const emailResult = await sendTaskReminderEmail(assignedUser, {
      ...task,
      asset_name: taskDetails.asset_name
    });
    
    if (emailResult.success) {
      console.log(`Reminder email sent successfully to ${assignedUser.email} for task ${task.task_code}`);
    } else {
      console.warn(`Reminder email failed for ${assignedUser.email}: ${emailResult.reason || emailResult.error}`);
    }
  } catch (emailError) {
    console.error('Error sending task reminder email:', emailError);
    // Continue with in-app notification even if email fails
  }
  
  // SECONDARY: Create in-app notification
  return await createNotification(pool, {
    user_id: task.assigned_to,
    task_id: task.id,
    type: 'task_reminder',
    title: 'Task Reminder - Due Soon',
    message: `Reminder: Your ${task.task_type} task ${task.task_code} for ${taskDetails.asset_name} is scheduled in 3 days (${new Date(task.scheduled_date).toLocaleDateString()}).`,
    metadata: {
      task: taskDetails,
      highlight: true,
      scheduled_date: task.scheduled_date,
      days_until: 3
    }
  });
}

/**
 * Notify superadmin when task is flagged
 */
async function notifyTaskFlagged(pool, task, assignedUser) {
  // Find all super admins
  const superAdmins = await pool.query(
    `SELECT id FROM users 
     WHERE role = 'super_admin' 
        OR (roles IS NOT NULL AND roles::text LIKE '%super_admin%')
     AND is_active = true`
  );
  
  const notifications = [];
  for (const admin of superAdmins.rows) {
    const notification = await createNotification(pool, {
      user_id: admin.id,
      task_id: task.id,
      type: 'task_flagged',
      title: 'Task Flagged - Budget Exceeded',
      message: `Task ${task.task_code} assigned to ${assignedUser.full_name || assignedUser.username} has exceeded budgeted hours (${task.budgeted_hours}h budgeted, ${task.hours_worked}h worked) and is not yet completed.`,
      metadata: {
        task: {
          task_code: task.task_code,
          task_type: task.task_type,
          assigned_to_name: assignedUser.full_name || assignedUser.username,
          budgeted_hours: task.budgeted_hours,
          hours_worked: task.hours_worked
        }
      }
    });
    notifications.push(notification);
  }
  
  return notifications;
}

/**
 * Notify super admins about overtime work request
 * @param {Object} pool - Database connection pool
 * @param {Object} overtimeRequest - Overtime request object
 * @param {Object} task - Task object
 * @param {Object} user - User who requested overtime
 */
async function notifyOvertimeRequest(pool, overtimeRequest, task, user) {
  try {
    // Get all super admins
    const superAdmins = await pool.query(
      `SELECT id, full_name, email, username FROM users WHERE role = 'super_admin' AND is_active = TRUE`
    );

    if (superAdmins.rows.length === 0) {
      console.warn('No super admins found to notify about overtime request');
      return [];
    }

    const notifications = [];
    const taskDetails = {
      task_code: task.task_code,
      task_type: task.task_type,
      asset_name: task.asset_name || 'Unknown Asset'
    };

    const requestTypeText = overtimeRequest.request_type === 'start_after_hours' 
      ? 'starting a task' 
      : 'completing a task';

    for (const superAdmin of superAdmins.rows) {
      const message = `${user.full_name || user.username} is requesting approval for ${requestTypeText} outside working hours (07:00-16:00). Task: ${task.task_code}`;

      const notification = await createNotification(pool, {
        user_id: superAdmin.id,
        task_id: task.id,
        type: 'overtime_request',
        title: 'Overtime Work - Acknowledgement Required',
        message: message,
        metadata: {
          overtime_request_id: overtimeRequest.id,
          task: taskDetails,
          requested_by: {
            id: user.id,
            full_name: user.full_name,
            username: user.username
          },
          request_type: overtimeRequest.request_type,
          request_time: overtimeRequest.request_time,
          current_time: new Date().toISOString()
        }
      });

      notifications.push(notification);
    }

    console.log(`Overtime request notifications sent to ${superAdmins.rows.length} super admin(s) for task ${task.task_code}`);
    return notifications;
  } catch (error) {
    console.error('Error sending overtime request notifications:', error);
    return [];
  }
}

/**
 * Notify user about early completion request status
 */
async function notifyEarlyCompletionStatus(pool, request, task, approved) {
  const status = approved ? 'approved' : 'rejected';
  const title = approved 
    ? 'Early Completion Request Approved' 
    : 'Early Completion Request Rejected';
  const message = approved
    ? `Your request to complete task ${task.task_code} before its scheduled date has been approved. The task is now available for completion.`
    : `Your request to complete task ${task.task_code} before its scheduled date has been rejected. Reason: ${request.rejection_reason || 'Not specified'}`;
  
  return await createNotification(pool, {
    user_id: request.requested_by,
    task_id: task.id,
    type: `early_completion_${status}`,
    title: title,
    message: message,
    metadata: {
      task: {
        task_code: task.task_code,
        scheduled_date: task.scheduled_date
      },
      request_id: request.id
    }
  });
}

/**
 * Schedule reminder notifications (to be called by a cron job or scheduled task)
 * This should check for tasks scheduled 3 days from now and create reminders
 */
async function scheduleReminders(pool) {
  try {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const targetDate = threeDaysFromNow.toISOString().split('T')[0];
    
    // Find tasks scheduled exactly 3 days from now that haven't been completed
    // Get all assigned users for each task
    const tasks = await pool.query(
      `SELECT DISTINCT t.*, a.asset_name
       FROM tasks t
       LEFT JOIN assets a ON t.asset_id = a.id
       WHERE t.scheduled_date = $1
         AND t.status NOT IN ('completed', 'cancelled')
         AND EXISTS (
           SELECT 1 FROM task_assignments ta WHERE ta.task_id = t.id
         )
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.task_id = t.id
             AND n.type = 'task_reminder'
             AND n.created_at::date = CURRENT_DATE
         )`,
      [targetDate]
    );
    
    // For each task, get all assigned users and send reminders
    for (const task of tasks.rows) {
      const assignedUsers = await pool.query(
        `SELECT u.id, u.full_name, u.username, u.email
         FROM task_assignments ta
         JOIN users u ON ta.user_id = u.id
         WHERE ta.task_id = $1`,
        [task.id]
      );
      
      // Send reminder to each assigned user
      for (const assignedUser of assignedUsers.rows) {
        await notifyTaskReminder(pool, task, {
          full_name: assignedUser.full_name,
          username: assignedUser.username,
          email: assignedUser.email || null
        });
      }
    }
    
    console.log(`Scheduled ${tasks.rows.length} reminder notifications for ${targetDate}`);
    return tasks.rows.length;
  } catch (error) {
    console.error('Error scheduling reminders:', error);
    throw error;
  }
}

/**
 * Notify users when spare requests are approved for a CM task
 * @param {Object} pool - Database connection pool
 * @param {Object} spareRequest - Spare request object
 * @param {Object} task - Task object
 * @param {Array} approvedItems - Array of approved items with details
 */
async function notifySpareRequestApproved(pool, spareRequest, task, approvedItems) {
  try {
    // Get all assigned users for the task
    const assignedUsersResult = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.username
       FROM task_assignments ta
       JOIN users u ON ta.user_id = u.id
       WHERE ta.task_id = $1`,
      [task.id]
    );

    if (assignedUsersResult.rows.length === 0) {
      console.log(`No assigned users found for task ${task.task_code}`);
      return;
    }

    const assignedUsers = assignedUsersResult.rows;
    
    // Format approved items list
    const itemsList = approvedItems.map(item => {
      const qty = item.approved_quantity || item.quantity;
      return `${item.item_code || item.item_description} (Qty: ${qty})`;
    }).join(', ');

    const itemsText = approvedItems.length === 1 
      ? `spare ${itemsList} has been approved`
      : `spares ${itemsList} have been approved`;

    // Send notification to each assigned user
    for (const user of assignedUsers) {
      await createNotification(pool, {
        user_id: user.id,
        task_id: task.id,
        type: 'spare_request_approved',
        title: 'CM Task Ready - Spares Approved',
        message: `The CM task ${task.task_code} is now ready to start. The following ${itemsText}.`,
        metadata: {
          task_code: task.task_code,
          task_type: task.task_type,
          spare_request_id: spareRequest.id,
          approved_items: approvedItems,
          highlight: true
        }
      });
    }

    console.log(`Spare request approval notifications sent to ${assignedUsers.length} user(s) for task ${task.task_code}`);
  } catch (error) {
    console.error('Error sending spare request approval notifications:', error);
    // Don't throw - notification failure shouldn't break the approval process
  }
}

module.exports = {
  createNotification,
  notifyTaskAssigned,
  notifyTaskReminder,
  notifyTaskFlagged,
  notifyTaskPaused,
  notifyOvertimeRequest,
  notifyEarlyCompletionStatus,
  notifySpareRequestApproved,
  scheduleReminders
};
