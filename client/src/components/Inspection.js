import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getTasks, createTask, getChecklistTemplates, getUsers } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { ErrorAlert, SuccessAlert } from './ErrorAlert';

function Inspection() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({
    status: '',
    task_type: '',
    completed_date: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [alertError, setAlertError] = useState(null);
  const [alertSuccess, setAlertSuccess] = useState(null);
  const tasksPerPage = 4;

  const [newTask, setNewTask] = useState({
    checklist_template_id: '',
    location: '',
    assigned_to: [],
    task_type: 'INSPECTION',
    scheduled_date: '',
    hours_worked: '',
    budgeted_hours: ''
  });

  useEffect(() => {
    loadTasks();
    loadTemplates();
    if (isAdmin()) {
      loadUsers();
    }
  }, [filters, isAdmin]);

  const loadTasks = async () => {
    try {
      const params = { task_type: 'INSPECTION' }; // Filter for inspection tasks only
      if (filters.status) params.status = filters.status;
      if (filters.completed_date) params.completed_date = filters.completed_date;
      
      const response = await getTasks(params);
      setTasks(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading inspection tasks:', error);
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      console.log('Loading templates for inspection creation...');
      const response = await getChecklistTemplates();
      // Filter templates for inspection type
      const inspectionTemplates = response.data.filter(t => 
        t.task_type === 'INSPECTION' || t.task_type === 'PM'
      );
      setTemplates(inspectionTemplates);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await getUsers();
      setUsers(response.data);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();

    if (!newTask.checklist_template_id || !newTask.location) {
      setAlertError('Please fill in all required fields');
      return;
    }
    
    try {
      const taskData = {
        ...newTask,
        scheduled_date: newTask.scheduled_date || undefined,
        hours_worked: newTask.hours_worked ? parseFloat(newTask.hours_worked) : undefined,
        budgeted_hours: isSuperAdmin() && newTask.budgeted_hours ? parseFloat(newTask.budgeted_hours) : undefined
      };
      
      const response = await createTask(taskData);
      console.log('Inspection task created successfully:', response.data);
      
      setShowCreateForm(false);
      setNewTask({
        checklist_template_id: '',
        location: '',
        assigned_to: [],
        task_type: 'INSPECTION',
        scheduled_date: '',
        hours_worked: '',
        budgeted_hours: ''
      });
      loadTasks();
      setAlertSuccess(`Inspection task created successfully! Task Code: ${response.data.task_code}`);
    } catch (error) {
      console.error('Error creating inspection task:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message || 'Failed to create inspection task';
      setAlertError(`Failed to create inspection task: ${errorMessage}`);
    }
  };

  if (loading) {
    return <div className="loading">Loading inspection tasks...</div>;
  }

  // Pagination
  const indexOfLastTask = currentPage * tasksPerPage;
  const indexOfFirstTask = indexOfLastTask - tasksPerPage;
  const currentTasks = tasks.slice(indexOfFirstTask, indexOfLastTask);
  const totalPages = Math.ceil(tasks.length / tasksPerPage);

  return (
    <div>
      <ErrorAlert error={alertError} onClose={() => setAlertError(null)} />
      <SuccessAlert message={alertSuccess} onClose={() => setAlertSuccess(null)} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>Inspections</h2>
        {isAdmin() && (
          <button className="btn btn-sm btn-primary" onClick={() => setShowCreateForm(!showCreateForm)} style={{ padding: '8px 16px', fontSize: '13px' }}>
            {showCreateForm ? 'Cancel' : 'Create New Inspection'}
          </button>
        )}
      </div>

      {showCreateForm && (
        <div className="card">
          <h3>Create New Inspection</h3>
          <form onSubmit={handleCreateTask}>
            <div className="form-group">
              <label>Checklist Template</label>
              <select
                value={newTask.checklist_template_id}
                onChange={(e) => setNewTask({ ...newTask, checklist_template_id: e.target.value })}
                required
              >
                <option value="">Select template...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.template_name} ({t.template_code})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Location</label>
              <input
                type="text"
                value={newTask.location}
                onChange={(e) => setNewTask({ ...newTask, location: e.target.value })}
                placeholder="Enter location (e.g., DC Combiner Board, Inverter 1, etc.)"
                required
                style={{ width: '100%', padding: '8px 12px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            {isAdmin() && (
              <div className="form-group">
                <label>Assign To (Users)</label>
                <select
                  multiple
                  value={newTask.assigned_to}
                  onChange={(e) => {
                    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                    setNewTask({ ...newTask, assigned_to: selectedOptions });
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    minHeight: '100px'
                  }}
                >
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.username} ({user.role})
                    </option>
                  ))}
                </select>
                <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  Hold Ctrl (Windows) or Cmd (Mac) to select multiple users
                </small>
                {newTask.assigned_to.length > 0 && (
                  <div style={{
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '6px',
                    padding: '8px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '4px',
                    border: '1px solid #e9ecef',
                    marginTop: '8px'
                  }}>
                    {newTask.assigned_to.map(userId => {
                      const user = users.find(u => u.id === userId);
                      return user ? (
                        <span 
                          key={userId}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 10px',
                            backgroundColor: '#007bff',
                            color: '#fff',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: '500'
                          }}
                        >
                          {user.full_name || user.username}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setNewTask({ 
                                ...newTask, 
                                assigned_to: newTask.assigned_to.filter(id => id !== userId) 
                              });
                            }}
                            style={{
                              marginLeft: '6px',
                              background: 'rgba(255,255,255,0.3)',
                              border: 'none',
                              color: '#fff',
                              borderRadius: '50%',
                              width: '18px',
                              height: '18px',
                              cursor: 'pointer',
                              fontSize: '14px',
                              lineHeight: '1',
                              padding: '0',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            )}
            <div className="form-group">
              <label>Scheduled Date</label>
              <input
                type="date"
                value={newTask.scheduled_date}
                onChange={(e) => setNewTask({ ...newTask, scheduled_date: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            {isSuperAdmin() && (
              <div className="form-group">
                <label>Budgeted Hours</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={newTask.budgeted_hours}
                  onChange={(e) => setNewTask({ ...newTask, budgeted_hours: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            )}
            <div className="form-group">
              <label>Estimated Hours</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={newTask.hours_worked}
                onChange={(e) => setNewTask({ ...newTask, hours_worked: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Create Inspection
            </button>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1', minWidth: '150px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '500' }}>Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              style={{ width: '100%', padding: '6px 10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '4px' }}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div style={{ flex: '1', minWidth: '150px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '500' }}>Completed Date</label>
            <input
              type="date"
              value={filters.completed_date}
              onChange={(e) => setFilters({ ...filters, completed_date: e.target.value })}
              style={{ width: '100%', padding: '6px 10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setFilters({ status: '', task_type: '', completed_date: '' })}
              style={{ padding: '6px 16px', fontSize: '13px' }}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Tasks Table */}
      {tasks.length === 0 ? (
        <div className="card">
          <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
            No inspection tasks found. {isAdmin() && 'Create your first inspection task above.'}
          </p>
        </div>
      ) : (
        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Task Code</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Template</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Type</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Location</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Assigned To</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Hours</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Scheduled</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentTasks.map((task) => {
                  const isFlagged = task.is_flagged;
                  const hoursExceeded = task.budgeted_hours && task.hours_worked && 
                                       task.hours_worked > task.budgeted_hours && 
                                       task.status !== 'completed';
                  
                  return (
                  <tr 
                    key={task.id} 
                    style={{ 
                      borderBottom: '1px solid #eee',
                      backgroundColor: isFlagged ? '#fff3cd' : 'transparent',
                      borderLeft: isFlagged ? '4px solid #ffc107' : 'none'
                    }}
                  >
                    <td data-label="Task Code" style={{ padding: '10px' }}>
                      {task.task_code}
                      {isFlagged && (
                        <span style={{ 
                          marginLeft: '8px', 
                          padding: '2px 6px', 
                          background: '#ffc107', 
                          color: '#000',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 'bold'
                        }}>
                          FLAGGED
                        </span>
                      )}
                    </td>
                    <td data-label="Template" style={{ padding: '10px' }}>{task.template_name || 'N/A'}</td>
                    <td data-label="Type" style={{ padding: '10px' }}>
                      <span className={`task-badge ${task.task_type}`} style={{ fontSize: '11px', padding: '4px 8px' }}>{task.task_type}</span>
                    </td>
                    <td data-label="Location" style={{ padding: '10px' }}>{task.location || task.asset_name || 'N/A'}</td>
                    <td data-label="Assigned To" style={{ padding: '10px' }}>
                      {task.assigned_users && task.assigned_users.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {task.assigned_users.map((user, idx) => {
                            const displayName = user.full_name 
                              ? user.full_name.split(' ')[0] 
                              : user.username;
                            return (
                              <span 
                                key={user.id || idx}
                                style={{
                                  padding: '2px 8px',
                                  background: '#e3f2fd',
                                  color: '#1976d2',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: '500'
                                }}
                                title={user.full_name || user.username}
                              >
                                {displayName}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span style={{ color: '#999', fontStyle: 'italic' }}>Unassigned</span>
                      )}
                    </td>
                    <td data-label="Status" style={{ padding: '10px' }}>
                      <span className={`task-badge ${task.status}`}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td data-label="Hours" style={{ padding: '10px' }}>
                      <div style={{ fontSize: '13px' }}>
                        {task.hours_worked || 0}h
                        {task.budgeted_hours && (
                          <span style={{ color: hoursExceeded ? '#dc3545' : '#666', marginLeft: '4px' }}>
                            / {task.budgeted_hours}h
                          </span>
                        )}
                      </div>
                    </td>
                    <td data-label="Scheduled" style={{ padding: '10px', fontSize: '13px', color: '#666' }}>
                      {task.scheduled_date ? new Date(task.scheduled_date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td data-label="Action" style={{ padding: '10px' }}>
                      <Link to={`/tasks/${task.id}`} className="btn btn-sm btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }}>
                        View
                      </Link>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                Previous
              </button>
              <span style={{ fontSize: '14px', color: '#666' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Inspection;
