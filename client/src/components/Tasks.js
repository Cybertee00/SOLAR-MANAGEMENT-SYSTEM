import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getTasks, createTask, getAssets, getChecklistTemplates, getUsers } from '../api/api';
import { useAuth } from '../context/AuthContext';

function Tasks() {
  const { isAdmin } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [assets, setAssets] = useState([]);
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
    asset_id: '',
    assigned_to: '',
    task_type: 'PM',
    scheduled_date: '',
  });

  useEffect(() => {
    loadTasks();
    loadAssets();
    loadTemplates();
    if (isAdmin()) {
      loadUsers();
    }
  }, [filters, isAdmin]);

  const loadTasks = async () => {
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.task_type) params.task_type = filters.task_type;
      if (filters.completed_date) params.completed_date = filters.completed_date;
      
      const response = await getTasks(params);
      setTasks(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setLoading(false);
    }
  };

  const loadAssets = async () => {
    try {
      const response = await getAssets();
      setAssets(response.data);
    } catch (error) {
      console.error('Error loading assets:', error);
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
    
    // Validate PCM tasks have scheduled_date
    if (newTask.task_type === 'PCM' && !newTask.scheduled_date) {
      alert('Scheduled date is required for PCM tasks');
      return;
    }
    
    try {
      // For PM tasks, don't send scheduled_date (backend will set it to today)
      // For UCM, scheduled_date is optional
      const taskData = {
        ...newTask,
        scheduled_date: newTask.task_type === 'PM' ? undefined : (newTask.task_type === 'UCM' ? (newTask.scheduled_date || undefined) : newTask.scheduled_date)
      };
      
      const response = await createTask(taskData);
      console.log('Task created successfully:', response.data);
      
      setShowCreateForm(false);
      setNewTask({
        checklist_template_id: '',
        asset_id: '',
        assigned_to: '',
        task_type: 'PM',
        scheduled_date: '',
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
        <h2 style={{ marginBottom: 0 }}>Tasks</h2>
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
              <label>Asset</label>
              <select
                value={newTask.asset_id}
                onChange={(e) => setNewTask({ ...newTask, asset_id: e.target.value })}
                required
              >
                <option value="">Select asset...</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.asset_name} ({a.asset_code})
                  </option>
                ))}
              </select>
            </div>
            {isAdmin() && (
              <div className="form-group">
                <label>Assign To (User)</label>
                <select
                  value={newTask.assigned_to}
                  onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {users.filter(u => u.is_active).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.username}) - {u.role}
                    </option>
                  ))}
                </select>
                <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                  Select a user to assign this task to. Leave unassigned to assign later.
                </small>
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
                    task_type: taskType,
                    // Clear scheduled_date when switching to PM (will be auto-set)
                    scheduled_date: taskType === 'PM' ? '' : newTask.scheduled_date
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
                {newTask.task_type === 'PM' && (
                  <span style={{ fontSize: '12px', color: '#666', marginLeft: '10px' }}>
                    (Will be set to today's date automatically)
                  </span>
                )}
                {newTask.task_type === 'PCM' && (
                  <span style={{ fontSize: '12px', color: '#dc3545', marginLeft: '10px' }}>
                    * Required for PCM tasks
                  </span>
                )}
                {newTask.task_type === 'UCM' && (
                  <span style={{ fontSize: '12px', color: '#666', marginLeft: '10px' }}>
                    (Optional - can be set later)
                  </span>
                )}
              </label>
              <input
                type="date"
                value={newTask.scheduled_date}
                onChange={(e) => setNewTask({ ...newTask, scheduled_date: e.target.value })}
                required={newTask.task_type === 'PCM'}
                disabled={newTask.task_type === 'PM'}
                style={newTask.task_type === 'PM' ? { backgroundColor: '#f5f5f5', cursor: 'not-allowed' } : {}}
              />
              {newTask.task_type === 'PM' && (
                <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  PM tasks are automatically scheduled for today ({new Date().toLocaleDateString()})
                </p>
              )}
            </div>
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
                        <th style={{ padding: '10px', textAlign: 'left' }}>Asset</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Scheduled</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentTasks.map((task) => (
                        <tr key={task.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td data-label="Task Code" style={{ padding: '10px' }}>{task.task_code}</td>
                          <td data-label="Template" style={{ padding: '10px' }}>{task.template_name || 'N/A'}</td>
                          <td data-label="Type" style={{ padding: '10px' }}>
                            <span className={`task-badge ${task.task_type}`}>{task.task_type}</span>
                          </td>
                          <td data-label="Asset" style={{ padding: '10px' }}>{task.asset_name || 'N/A'}</td>
                          <td data-label="Status" style={{ padding: '10px' }}>
                            <span className={`task-badge ${task.status}`}>
                              {task.status.replace('_', ' ')}
                            </span>
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
                      ))}
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

