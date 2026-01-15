import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getTasks, createTask, getChecklistTemplates, getUsers } from '../api/api';
import { useAuth } from '../context/AuthContext';

function Tasks() {
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
  const tasksPerPage = 4;

  const [newTask, setNewTask] = useState({
    checklist_template_id: '',
    location: '',
    assigned_to: [], // Changed to array for multiple users
    task_type: 'PM',
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
      const params = { task_type: 'PM' }; // Filter for PM tasks only
      if (filters.status) params.status = filters.status;
      if (filters.completed_date) params.completed_date = filters.completed_date;
      
      const response = await getTasks(params);
      setTasks(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setLoading(false);
    }
  };


  const loadTemplates = async () => {
    try {
      console.log('Loading templates for task creation...');
      const response = await getChecklistTemplates();
      console.log('Templates loaded:', response.data);
      setTemplates(response.data);
    } catch (error) {
      console.error('Error loading templates:', error);
      console.error('Error details:', error.response?.data || error.message);
      alert(`Failed to load templates: ${error.response?.data?.error || error.message}`);
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
    
    try {
      // Allow manual scheduling for all task types
      // If not provided, backend will set appropriate defaults
      const taskData = {
        ...newTask,
        scheduled_date: newTask.scheduled_date || undefined, // Send if provided, otherwise let backend decide
        hours_worked: newTask.hours_worked ? parseFloat(newTask.hours_worked) : undefined,
        budgeted_hours: isSuperAdmin() && newTask.budgeted_hours ? parseFloat(newTask.budgeted_hours) : undefined
      };
      
      const response = await createTask(taskData);
      console.log('Task created successfully:', response.data);
      
      setShowCreateForm(false);
      setNewTask({
        checklist_template_id: '',
        location: '',
        assigned_to: [],
        task_type: 'PM',
        scheduled_date: '',
        hours_worked: '',
        budgeted_hours: ''
      });
      loadTasks();
      alert(`Task created successfully! Task Code: ${response.data.task_code}`);
    } catch (error) {
      console.error('Error creating task:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message || 'Failed to create task';
      alert(`Failed to create task: ${errorMessage}`);
    }
  };

  if (loading) {
    return <div className="loading">Loading tasks...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h2 style={{ marginBottom: 0 }}>PM Tasks</h2>
        {isAdmin() && (
          <button className="btn btn-sm btn-primary" onClick={() => setShowCreateForm(!showCreateForm)} style={{ padding: '8px 16px', fontSize: '13px' }}>
            {showCreateForm ? 'Cancel' : 'Create New Task'}
          </button>
        )}
      </div>

      {showCreateForm && (
        <div className="card">
          <h3>Create New Task</h3>
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
                    minHeight: '120px',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '14px',
                    backgroundColor: '#fff',
                    WebkitAppearance: 'menulist', // Better mobile support
                    appearance: 'menulist'
                  }}
                  size={Math.min(users.filter(u => {
                    if (!u.is_active) return false;
                    // Check if user has admin or technician role
                    const userRoles = Array.isArray(u.roles) ? u.roles : (u.role ? [u.role] : []);
                    return userRoles.some(r => r === 'admin' || r === 'technician');
                  }).length, 4)} // Show max 4 options at once for mobile
                >
                  {users.filter(u => {
                    if (!u.is_active) return false;
                    // Check if user has admin or technician role
                    const userRoles = Array.isArray(u.roles) ? u.roles : (u.role ? [u.role] : []);
                    return userRoles.some(r => r === 'admin' || r === 'technician');
                  }).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </select>
                {newTask.assigned_to.length > 0 && (
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ 
                      display: 'flex', 
                      flexWrap: 'wrap', 
                      gap: '6px',
                      padding: '8px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '4px',
                      border: '1px solid #e9ecef'
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
                              title="Remove"
                            >
                              ×
                            </button>
                          </span>
                        ) : null;
                      })}
                    </div>
                    <div style={{ marginTop: '5px', fontSize: '12px', color: '#28a745', fontWeight: '500' }}>
                      {newTask.assigned_to.length} user{newTask.assigned_to.length !== 1 ? 's' : ''} selected
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="form-group">
              <label>Task Type</label>
              <select
                value={newTask.task_type}
                  onChange={(e) => {
                    const taskType = e.target.value;
                    setNewTask({
                      ...newTask,
                      task_type: taskType
                      // Keep scheduled_date when switching task types
                    });
                  }}
                required
              >
                <option value="PM">Preventive Maintenance (PM)</option>
                <option value="PCM">Planned Corrective Maintenance (PCM)</option>
                <option value="UCM">Unplanned Corrective Maintenance (UCM)</option>
              </select>
            </div>
            <div className="form-group">
              <label>
                Scheduled Date
              </label>
              <input
                type="date"
                value={newTask.scheduled_date}
                onChange={(e) => setNewTask({ ...newTask, scheduled_date: e.target.value })}
                min={new Date().toISOString().split('T')[0]} // Prevent selecting past dates
              />
            </div>
            <div className="form-group">
              <label>Hours Worked (Optional)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={newTask.hours_worked}
                onChange={(e) => setNewTask({ ...newTask, hours_worked: e.target.value })}
                placeholder="0.0"
              />
              <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                Number of hours worked on this task (if already started)
              </small>
            </div>
            {isSuperAdmin() && (
              <div className="form-group">
                <label>Budgeted Hours (Super Admin Only)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={newTask.budgeted_hours}
                  onChange={(e) => setNewTask({ ...newTask, budgeted_hours: e.target.value })}
                  placeholder="0.0"
                />
                <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                  Maximum hours allocated for this task. Task will be flagged if exceeded.
                </small>
              </div>
            )}
            <button type="submit" className="btn btn-primary">Create Task</button>
          </form>
        </div>
      )}

      <div className="card">
        <div style={{ marginBottom: '15px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '12px' }}>Filters</h3>
          <div className="filters-container" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
              <label>Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
              <label>Task Type</label>
              <select
                value={filters.task_type}
                onChange={(e) => setFilters({ ...filters, task_type: e.target.value })}
              >
                <option value="">All Types</option>
                <option value="PM">PM</option>
                <option value="PCM">PCM</option>
                <option value="UCM">UCM</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
              <label>Completed Date</label>
              <input
                type="date"
                value={filters.completed_date}
                onChange={(e) => setFilters({ ...filters, completed_date: e.target.value })}
                title="Filter by task completion date"
              />
            </div>
          </div>
          {filters.completed_date && (
            <div style={{ marginTop: '10px' }}>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setFilters({ ...filters, completed_date: '' })}
              >
                Clear Date Filter
              </button>
            </div>
          )}
        </div>

        {tasks.length === 0 ? (
          <p style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            No tasks found matching the selected filters
          </p>
        ) : (
          <>
            {(filters.status || filters.task_type || filters.completed_date) && (
              <div style={{ marginBottom: '15px', padding: '12px', background: '#e3f2fd', borderRadius: '8px', borderLeft: '4px solid #1A73E8' }}>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  Active filters: 
                  {filters.status && <span style={{ marginLeft: '8px', padding: '4px 8px', background: '#fff', borderRadius: '4px' }}>Status: {filters.status}</span>}
                  {filters.task_type && <span style={{ marginLeft: '8px', padding: '4px 8px', background: '#fff', borderRadius: '4px' }}>Type: {filters.task_type}</span>}
                  {filters.completed_date && <span style={{ marginLeft: '8px', padding: '4px 8px', background: '#fff', borderRadius: '4px' }}>Completed: {new Date(filters.completed_date).toLocaleDateString()}</span>}
                </div>
              </div>
            )}
            
            {(() => {
              const totalPages = Math.ceil(tasks.length / tasksPerPage);
              const startIndex = (currentPage - 1) * tasksPerPage;
              const endIndex = startIndex + tasksPerPage;
              const currentTasks = tasks.slice(startIndex, endIndex);
              const startTask = tasks.length > 0 ? startIndex + 1 : 0;
              const endTask = Math.min(endIndex, tasks.length);

              return (
                <>
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
                                  // Extract first name from full_name or use username
                                  const displayName = user.full_name 
                                    ? user.full_name.split(' ')[0]
                                    : (user.username ? user.username.split(' ')[0] : 'Unknown');
                                  return (
                                    <span 
                                      key={user.id || idx} 
                                      style={{ 
                                        fontSize: '12px',
                                        color: '#333',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      {displayName}
                                      {idx < task.assigned_users.length - 1 && ','}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span style={{ color: '#999', fontStyle: 'italic', fontSize: '12px' }}>Unassigned</span>
                            )}
                          </td>
                          <td data-label="Status" style={{ padding: '10px' }}>
                            <span className={`task-badge ${task.status}`} style={{ fontSize: '10px', padding: '4px 8px', lineHeight: '1.2' }}>
                              {task.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td data-label="Hours" style={{ padding: '10px' }}>
                            <div style={{ fontSize: '13px' }}>
                              {task.hours_worked ? (
                                <span style={{ color: hoursExceeded ? '#dc3545' : '#333', fontWeight: hoursExceeded ? 'bold' : 'normal' }}>
                                  {parseFloat(task.hours_worked).toFixed(1)}h
                                </span>
                              ) : (
                                <span style={{ color: '#999' }}>0h</span>
                              )}
                              {task.budgeted_hours && (
                                <span style={{ color: '#666', marginLeft: '4px' }}>
                                  / {parseFloat(task.budgeted_hours).toFixed(1)}h
                                </span>
                              )}
                              {hoursExceeded && (
                                <div style={{ fontSize: '11px', color: '#dc3545', marginTop: '2px' }}>
                                  Budget exceeded!
                                </div>
                              )}
                            </div>
                          </td>
                          <td data-label="Scheduled" style={{ padding: '10px' }}>
                            {task.scheduled_date ? new Date(task.scheduled_date).toLocaleDateString() : 'N/A'}
                          </td>
                          <td data-label="Action" style={{ padding: '10px' }}>
                            <Link to={`/tasks/${task.id}`} className="btn btn-sm btn-primary" style={{ padding: '4px 10px', fontSize: '12px', width: 'auto', minWidth: 'auto' }}>
                              View
                            </Link>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginTop: '15px',
                    flexWrap: 'wrap',
                    gap: '10px',
                    paddingTop: '12px',
                    borderTop: '1px solid #eee'
                  }}>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      Showing {startTask}-{endTask} of {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                    </div>
                    {totalPages > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          style={{
                            fontSize: '18px',
                            color: currentPage === 1 ? '#ccc' : '#007bff',
                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                            userSelect: 'none',
                            padding: '4px 8px',
                            lineHeight: '1'
                          }}
                          title="Previous page"
                        >
                          ‹
                        </span>
                        <span style={{ fontSize: '12px', color: '#666', padding: '0 4px' }}>
                          Page {currentPage} of {totalPages}
                        </span>
                        <span
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          style={{
                            fontSize: '18px',
                            color: currentPage === totalPages ? '#ccc' : '#007bff',
                            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                            userSelect: 'none',
                            padding: '4px 8px',
                            lineHeight: '1'
                          }}
                          title="Next page"
                        >
                          ›
                        </span>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}

export default Tasks;

