import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getTask, startTask, completeTask, downloadTaskReport } from '../api/api';

function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    loadTask();
  }, [id]);

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
    } catch (error) {
      console.error('Error starting task:', error);
      alert('Failed to start task');
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
            <strong>Assigned To:</strong> {task.assigned_to_name || 'Unassigned'}
          </div>
          <div>
            <strong>Scheduled Date:</strong> {task.scheduled_date ? new Date(task.scheduled_date).toLocaleDateString() : 'N/A'}
          </div>
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

        <div style={{ marginTop: '30px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {task.status === 'pending' && (
            <button className="btn btn-primary" onClick={handleStartTask}>
              Start Task
            </button>
          )}
          {task.status === 'in_progress' && (
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
    </div>
  );
}

export default TaskDetail;

