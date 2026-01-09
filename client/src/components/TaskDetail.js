import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getTask, startTask, completeTask, downloadTaskReport, getEarlyCompletionRequests, createEarlyCompletionRequest, getSpareRequests } from '../api/api';
import { useAuth } from '../context/AuthContext';

function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const [showEarlyCompletionModal, setShowEarlyCompletionModal] = useState(false);
  const [earlyCompletionMotivation, setEarlyCompletionMotivation] = useState('');
  const [earlyCompletionRequests, setEarlyCompletionRequests] = useState([]);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [spareRequests, setSpareRequests] = useState([]);

  useEffect(() => {
    loadTask();
    loadEarlyCompletionRequests();
    loadSpareRequests();
  }, [id]);
  
  const loadEarlyCompletionRequests = async () => {
    try {
      const response = await getEarlyCompletionRequests(id);
      setEarlyCompletionRequests(response.data);
    } catch (error) {
      console.error('Error loading early completion requests:', error);
    }
  };

  const loadSpareRequests = async () => {
    try {
      const response = await getSpareRequests();
      // Filter spare requests for this task
      const taskSpareRequests = response.data.filter(sr => sr.task_id === id);
      setSpareRequests(taskSpareRequests);
    } catch (error) {
      console.error('Error loading spare requests:', error);
    }
  };

  const loadTask = async () => {
    try {
      if (!id) {
        console.error('No task ID provided');
        setLoading(false);
        return;
      }
      console.log('Loading task with ID:', id);
      const response = await getTask(id);
      setTask(response.data);
      console.log('Task loaded successfully:', response.data?.task_code);
      setLoading(false);
    } catch (error) {
      console.error('Error loading task:', error);
      if (error.response) {
        console.error('Error response:', error.response.data);
        console.error('Error status:', error.response.status);
      }
      setLoading(false);
    }
  };

  const handleStartTask = async () => {
    try {
      await startTask(id);
      loadTask();
      loadSpareRequests(); // Reload spare requests in case status changed
    } catch (error) {
      console.error('Error starting task:', error);
      const errorMessage = error.response?.data?.error || 'Failed to start task';
      const pendingSpareRequests = error.response?.data?.pending_spare_requests;
      
      if (pendingSpareRequests) {
        alert(`${errorMessage}\n\nThis CM task has ${pendingSpareRequests} pending spare request(s). Please wait for admin approval before starting the task.`);
      } else {
        const scheduledDate = error.response?.data?.scheduled_date;
        if (scheduledDate) {
          alert(`${errorMessage}\n\nScheduled date: ${new Date(scheduledDate).toLocaleDateString()}\n\nYou can request early completion if needed.`);
        } else {
          alert(errorMessage);
        }
      }
    }
  };
  
  const handleRequestEarlyCompletion = async () => {
    if (!earlyCompletionMotivation.trim() || earlyCompletionMotivation.trim().length < 10) {
      alert('Please provide a motivation (at least 10 characters)');
      return;
    }
    
    try {
      setSubmittingRequest(true);
      await createEarlyCompletionRequest({
        task_id: id,
        motivation: earlyCompletionMotivation.trim()
      });
      setShowEarlyCompletionModal(false);
      setEarlyCompletionMotivation('');
      loadEarlyCompletionRequests();
      alert('Early completion request submitted. Waiting for super admin approval.');
    } catch (error) {
      console.error('Error creating early completion request:', error);
      alert(error.response?.data?.error || 'Failed to submit early completion request');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleCompleteTask = async () => {
    if (!window.confirm('Are you sure you want to complete this task? Make sure you have submitted the checklist.')) {
      return;
    }

    try {
      await completeTask(id, {
        overall_status: task.overall_status || 'pass',
        duration_minutes: duration,
      });
      loadTask();
      alert('Task completed successfully!');
    } catch (error) {
      console.error('Error completing task:', error);
      alert('Failed to complete task');
    }
  };

  if (loading) {
    return <div className="loading">Loading task...</div>;
  }

  if (!task) {
    return <div>Task not found</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/tasks" className="btn btn-secondary">← Back to Tasks</Link>
      </div>

      <div className="card">
        <h2>Task Details</h2>
        <div className="task-details-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginTop: '20px' }}>
          <div>
            <strong>Task Code:</strong> {task.task_code}
          </div>
          <div>
            <strong>Type:</strong> <span className={`task-badge ${task.task_type}`}>{task.task_type}</span>
          </div>
          <div>
            <strong>Template:</strong> {task.template_name || 'N/A'} ({task.template_code || 'N/A'})
          </div>
          <div>
            <strong>Asset:</strong> {task.asset_name || 'N/A'} ({task.asset_code || 'N/A'})
          </div>
          <div>
            <strong>Status:</strong> <span className={`task-badge ${task.status}`}>
              {task.status.replace('_', ' ')}
            </span>
          </div>
          <div>
            <strong>Overall Status:</strong> {task.overall_status ? (
              <span className={`task-badge ${task.overall_status}`}>{task.overall_status}</span>
            ) : 'N/A'}
          </div>
          <div>
            <strong>Assigned To:</strong>{' '}
            {task.assigned_users && task.assigned_users.length > 0 ? (
              <div style={{ marginTop: '5px' }}>
                {task.assigned_users.map((user, idx) => (
                  <div key={user.id || idx} style={{ marginBottom: '4px' }}>
                    {user.full_name || user.username}
                    {user.email && <span style={{ color: '#666', marginLeft: '8px' }}>({user.email})</span>}
                  </div>
                ))}
              </div>
            ) : (
              'Unassigned'
            )}
          </div>
          <div>
            <strong>Scheduled Date:</strong> {task.scheduled_date ? new Date(task.scheduled_date).toLocaleDateString() : 'N/A'}
          </div>
          {task.hours_worked !== undefined && task.hours_worked !== null && (
            <div>
              <strong>Hours Worked:</strong> {parseFloat(task.hours_worked).toFixed(1)}h
              {task.budgeted_hours && (
                <span style={{ color: '#666', marginLeft: '8px' }}>
                  (Budget: {parseFloat(task.budgeted_hours).toFixed(1)}h)
                </span>
              )}
            </div>
          )}
          {task.is_flagged && (
            <div style={{ color: '#dc3545', fontWeight: 'bold' }}>
              ⚠ <strong>FLAGGED:</strong> {task.flag_reason || 'Task has exceeded budgeted hours'}
            </div>
          )}
          {task.can_open_before_scheduled && (
            <div style={{ color: '#28a745', fontWeight: 'bold' }}>
              ✅ Early completion approved - Task can be started before scheduled date
            </div>
          )}
          {task.started_at && (
            <div>
              <strong>Started At:</strong> {new Date(task.started_at).toLocaleString()}
            </div>
          )}
          {task.completed_at && (
            <div>
              <strong>Completed At:</strong> {new Date(task.completed_at).toLocaleString()}
            </div>
          )}
          {task.duration_minutes && (
            <div>
              <strong>Duration:</strong> {task.duration_minutes} minutes
            </div>
          )}
        </div>

        <div style={{ marginTop: '30px', padding: '20px', background: '#f9f9f9', borderRadius: '4px' }}>
          <h3>Task Identification</h3>
          <p><strong>This is a {task.task_type} task</strong> for the <strong>{task.asset_type || 'asset'}</strong> asset type.</p>
          <p>Checklist Template: <strong>{task.template_name}</strong> ({task.template_code})</p>
        </div>

        {/* Early Completion Request Section */}
        {task.status === 'pending' && task.scheduled_date && 
         task.assigned_users && task.assigned_users.some(u => u.id === user?.id) && 
         !task.can_open_before_scheduled && (
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            background: '#fff3cd', 
            borderLeft: '4px solid #ffc107',
            borderRadius: '4px'
          }}>
            <h4 style={{ marginTop: 0 }}>⚠ Task Scheduled for {new Date(task.scheduled_date).toLocaleDateString()}</h4>
            <p style={{ marginBottom: '10px' }}>
              This task is scheduled for a future date. You can request to complete it early if needed.
            </p>
            {earlyCompletionRequests.some(r => r.status === 'pending') ? (
              <div style={{ padding: '10px', background: '#e3f2fd', borderRadius: '4px' }}>
                <strong>Early completion request pending approval</strong>
              </div>
            ) : earlyCompletionRequests.some(r => r.status === 'approved') ? (
              <div style={{ padding: '10px', background: '#d4edda', borderRadius: '4px', color: '#155724' }}>
                <strong>✅ Early completion approved!</strong> You can now start this task.
              </div>
            ) : (
              <button 
                className="btn btn-secondary"
                onClick={() => setShowEarlyCompletionModal(true)}
              >
                Request Early Completion
              </button>
            )}
          </div>
        )}

        <div style={{ marginTop: '30px', display: 'flex', gap: '10px', flexWrap: 'wrap', flexDirection: 'column' }}>
          {/* Check if this is a CM task with pending spare requests */}
          {task.status === 'pending' && 
           (task.task_type === 'PCM' || task.task_type === 'UCM' || (task.task_type === 'CM' && task.parent_task_id)) && 
           spareRequests.some(sr => sr.status === 'pending') && (
            <div style={{ 
              padding: '15px', 
              background: '#fff3cd', 
              borderLeft: '4px solid #ffc107',
              borderRadius: '4px',
              color: '#856404',
              width: '100%',
              marginBottom: '10px'
            }}>
              <strong>⚠️ Waiting for Spare Approval:</strong> This CM task cannot be started until the spare request(s) have been approved by an admin. 
              Please wait for notification that the spares have been approved.
            </div>
          )}
          
          {/* Only show Start Task button if user is assigned to the task */}
          {task.status === 'pending' && 
           task.assigned_users && 
           task.assigned_users.some(u => u.id === user?.id) && 
           !((task.task_type === 'PCM' || task.task_type === 'UCM' || (task.task_type === 'CM' && task.parent_task_id)) && 
             spareRequests.some(sr => sr.status === 'pending')) && (
            <button className="btn btn-primary" onClick={handleStartTask}>
              Start Task
            </button>
          )}
          {/* Show message if user is not assigned but task is pending */}
          {task.status === 'pending' && 
           (!task.assigned_users || !task.assigned_users.some(u => u.id === user?.id)) && (
            <div style={{ 
              padding: '12px', 
              background: '#fff3cd', 
              borderLeft: '4px solid #ffc107',
              borderRadius: '4px',
              color: '#856404'
            }}>
              <strong>View Only:</strong> This task is not assigned to you. You can view details and download reports, but cannot start or modify this task.
            </div>
          )}
          {/* Only show Fill Checklist and Complete Task if user is assigned */}
          {task.status === 'in_progress' && 
           task.assigned_users && 
           task.assigned_users.some(u => u.id === user?.id) && (
            <>
              <Link to={`/tasks/${id}/checklist`} className="btn btn-success">
                Fill Checklist
              </Link>
              <div className="form-group" style={{ marginLeft: '20px', width: '200px' }}>
                <label>Duration (minutes)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                  min="0"
                />
              </div>
              <button className="btn btn-success" onClick={handleCompleteTask} style={{ marginLeft: '10px' }}>
                Complete Task
              </button>
            </>
          )}
          {/* Show message if user is not assigned but task is in progress */}
          {task.status === 'in_progress' && 
           (!task.assigned_users || !task.assigned_users.some(u => u.id === user?.id)) && (
            <div style={{ 
              padding: '12px', 
              background: '#fff3cd', 
              borderLeft: '4px solid #ffc107',
              borderRadius: '4px',
              color: '#856404'
            }}>
              <strong>View Only:</strong> This task is not assigned to you. You can view details and download reports, but cannot fill the checklist or complete this task.
            </div>
          )}
          {task.status === 'completed' && task.overall_status === 'fail' && (
            <div className="success" style={{ width: '100%' }}>
              A Corrective Maintenance (CM) task has been automatically generated from this failed PM task.
            </div>
          )}
        </div>

        {task.status === 'completed' && (
          <div style={{ 
            marginTop: '30px', 
            padding: '25px', 
            background: 'linear-gradient(135deg, #e7f3ff 0%, #cfe2ff 100%)', 
            borderRadius: '8px', 
            border: '3px solid #007bff',
            boxShadow: '0 4px 6px rgba(0, 123, 255, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
              <span style={{ fontSize: '32px', marginRight: '15px' }}>📄</span>
              <div>
                <h3 style={{ margin: 0, color: '#007bff' }}>Download Task Report</h3>
                <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '14px' }}>
                  Download report in original template format (Word or Excel)
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <a
                href={downloadTaskReport(id)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ 
                  textDecoration: 'none', 
                  display: 'inline-block',
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 4px rgba(0, 123, 255, 0.3)'
                }}
                onClick={(e) => {
                  if (!id) {
                    e.preventDefault();
                    alert('Error: Task ID not found. Please refresh the page.');
                    return;
                  }
                  console.log('Downloading report for task:', id);
                }}
              >
                📥 Download Report
              </a>
              <span style={{ color: '#666', fontSize: '14px' }}>
                Format is chosen by the template (Word or Excel). File saves to your Downloads.
              </span>
            </div>
            <div style={{ marginTop: '15px', padding: '12px', background: '#f8f9fa', borderRadius: '4px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
                <strong>Note:</strong> Reports are generated from original templates and saved to <code>D:\PJs\ChecksheetsApp\server\reports\</code>
              </p>
            </div>
            {task.overall_status === 'fail' && (
              <div style={{ 
                marginTop: '15px', 
                padding: '12px', 
                background: '#fff3cd', 
                borderRadius: '4px',
                border: '1px solid #ffc107'
              }}>
                <strong>⚠️ Note:</strong> This task failed. A Corrective Maintenance (CM) task has been automatically created.
              </div>
            )}
          </div>
        )}
        
        {/* Show notice if not completed */}
        {task.status !== 'completed' && task.overall_status && (
          <div style={{ 
            marginTop: '30px', 
            padding: '20px', 
            background: '#fff3cd', 
            borderRadius: '4px', 
            border: '2px solid #ffc107' 
          }}>
            <h3 style={{ marginBottom: '15px' }}>⚠️ Task Not Yet Completed</h3>
            <p style={{ marginBottom: '15px' }}>
              The checklist has been submitted, but the task is not yet marked as completed. 
              Please complete the task to download the report.
            </p>
            {task.status === 'in_progress' && (
              <button className="btn btn-success" onClick={handleCompleteTask}>
                Mark Task as Completed
              </button>
            )}
          </div>
        )}
      </div>

      {/* Early Completion Request Modal */}
      {showEarlyCompletionModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowEarlyCompletionModal(false)}
        >
          <div 
            style={{
              background: 'white',
              padding: '30px',
              borderRadius: '8px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Request Early Completion</h3>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
              Please provide a reason for completing this task before its scheduled date ({task.scheduled_date ? new Date(task.scheduled_date).toLocaleDateString() : 'N/A'}).
            </p>
            <div className="form-group">
              <label>
                Motivation/Reason <span style={{ color: 'red' }}>*</span>
              </label>
              <textarea
                value={earlyCompletionMotivation}
                onChange={(e) => setEarlyCompletionMotivation(e.target.value)}
                placeholder="Explain why you need to complete this task early..."
                rows="5"
                required
                minLength={10}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
              <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                Minimum 10 characters. This request will be reviewed by a super admin.
              </small>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowEarlyCompletionModal(false);
                  setEarlyCompletionMotivation('');
                }}
                disabled={submittingRequest}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleRequestEarlyCompletion}
                disabled={submittingRequest || !earlyCompletionMotivation.trim() || earlyCompletionMotivation.trim().length < 10}
              >
                {submittingRequest ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskDetail;

