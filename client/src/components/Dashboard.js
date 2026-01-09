import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getTasks, getCMLetters } from '../api/api';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

function Dashboard() {
  const [stats, setStats] = useState({
    pendingTasks: 0,
    inProgressTasks: 0,
    completedTasks: 0,
    openCMLetters: 0,
  });
  const [recentTasks, setRecentTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pmPeriod, setPmPeriod] = useState('monthly'); // 'weekly', 'monthly', 'yearly'
  const [pmStats, setPmStats] = useState({
    total: 10, // Total PM tasks assigned
    completed: 4, // PM tasks completed
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [tasksRes, cmLettersRes] = await Promise.all([
        getTasks(),
        getCMLetters({ status: 'open' }),
      ]);

      const tasks = tasksRes.data;
      const statsData = {
        pendingTasks: tasks.filter(t => t.status === 'pending').length,
        inProgressTasks: tasks.filter(t => t.status === 'in_progress').length,
        completedTasks: tasks.filter(t => t.status === 'completed').length,
        openCMLetters: cmLettersRes.data.length,
      };

      setStats(statsData);
      setRecentTasks(tasks.slice(0, 5));
      setLoading(false);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div>
      <h2>Dashboard</h2>
      
      <div className="dashboard-stats">
        <div className="card stat-card">
          <h3>Pending Tasks</h3>
          <p className="stat-number" style={{ color: '#ffc107' }}>
            {stats.pendingTasks}
          </p>
        </div>
        <div className="card stat-card">
          <h3>In Progress</h3>
          <p className="stat-number" style={{ color: '#17a2b8' }}>
            {stats.inProgressTasks}
          </p>
        </div>
        <div className="card stat-card">
          <h3>Completed</h3>
          <p className="stat-number" style={{ color: '#28a745' }}>
            {stats.completedTasks}
          </p>
        </div>
        <div className="card stat-card">
          <h3>Open CM Letters</h3>
          <p className="stat-number" style={{ color: '#dc3545' }}>
            {stats.openCMLetters}
          </p>
        </div>
      </div>

      {/* PM Completion Pie Chart */}
      <div className="card" style={{ marginBottom: '30px', boxShadow: 'none', border: '1px solid var(--md-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ marginTop: 0 }}>PM Completion Rate</h3>
          <div className="pm-filter-buttons" style={{ display: 'flex', flexDirection: 'row', gap: '4px', flexWrap: 'nowrap', alignItems: 'center' }}>
            <button
              className={`btn btn-sm ${pmPeriod === 'weekly' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPmPeriod('weekly')}
              style={{ flex: '1 1 auto', fontSize: '12px', padding: '6px 8px', minWidth: '60px', whiteSpace: 'nowrap' }}
            >
              Weekly
            </button>
            <button
              className={`btn btn-sm ${pmPeriod === 'monthly' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPmPeriod('monthly')}
              style={{ flex: '1 1 auto', fontSize: '12px', padding: '6px 8px', minWidth: '60px', whiteSpace: 'nowrap' }}
            >
              Monthly
            </button>
            <button
              className={`btn btn-sm ${pmPeriod === 'yearly' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPmPeriod('yearly')}
              style={{ flex: '1 1 auto', fontSize: '12px', padding: '6px 8px', minWidth: '60px', whiteSpace: 'nowrap' }}
            >
              Yearly
            </button>
          </div>
        </div>

        <div className="pm-chart-container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div className="pie-chart-wrapper" style={{ width: '320px', height: '320px', maxWidth: '100%', position: 'relative' }}>
              <Pie
                data={{
                  labels: ['Completed', 'Remaining'],
                  datasets: [
                    {
                      label: 'PM Tasks',
                      data: [pmStats.completed, pmStats.total - pmStats.completed],
                      backgroundColor: [
                        '#66BB6A', // Vibrant green for completed
                        '#E0E0E0', // Light gray for remaining
                      ],
                      borderColor: '#ffffff',
                      borderWidth: 3,
                      hoverBorderWidth: 5,
                      hoverOffset: 10,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: true,
                  cutout: '65%',
                  plugins: {
                    legend: {
                      display: false,
                    },
                    tooltip: {
                      enabled: true,
                      backgroundColor: 'rgba(0, 0, 0, 0.85)',
                      padding: 14,
                      titleFont: {
                        size: 15,
                        weight: '600',
                        family: "'Roboto', sans-serif",
                      },
                      bodyFont: {
                        size: 14,
                        family: "'Roboto', sans-serif",
                      },
                      callbacks: {
                        title: function(context) {
                          return context[0].label;
                        },
                        label: function(context) {
                          const value = context.parsed || 0;
                          const total = context.dataset.data.reduce((a, b) => a + b, 0);
                          const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                          return `${value} tasks • ${percentage}%`;
                        },
                      },
                      displayColors: true,
                      boxPadding: 8,
                      cornerRadius: 8,
                      titleColor: '#fff',
                      bodyColor: '#fff',
                    },
                  },
                  animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 1200,
                    easing: 'easeOutQuart',
                  },
                  elements: {
                    arc: {
                      borderRadius: 12,
                      spacing: 4,
                    },
                  },
                }}
              />
              {/* Center text overlay */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                pointerEvents: 'none',
              }}>
                <div style={{ fontSize: '42px', fontWeight: '700', color: '#4CAF50', lineHeight: '1', letterSpacing: '-1px' }}>
                  {pmStats.total > 0 ? ((pmStats.completed / pmStats.total) * 100).toFixed(0) : 0}%
                </div>
                <div style={{ fontSize: '13px', color: '#757575', marginTop: '6px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Complete
                </div>
                <div style={{ fontSize: '11px', color: '#9E9E9E', marginTop: '4px' }}>
                  {pmStats.completed} of {pmStats.total}
                </div>
              </div>
            </div>
          </div>

          <div className="pm-stats-cards" style={{ display: 'flex', flexDirection: 'row', gap: '12px', flexWrap: 'nowrap', alignItems: 'stretch' }}>
            <div className="pm-stat-card" style={{ flex: '1 1 auto', padding: '16px', background: '#f8f9fa', borderRadius: '8px', borderLeft: '4px solid #4CAF50', minWidth: '0' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Completed PM Tasks
              </div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#4CAF50' }}>
                {pmStats.completed}
              </div>
              <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                {pmStats.total > 0 ? ((pmStats.completed / pmStats.total) * 100).toFixed(1) : 0}% of total
              </div>
            </div>

            <div className="pm-stat-card" style={{ flex: '1 1 auto', padding: '16px', background: '#f8f9fa', borderRadius: '8px', borderLeft: '4px solid #9e9e9e', minWidth: '0' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Remaining PM Tasks
              </div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#9e9e9e' }}>
                {pmStats.total - pmStats.completed}
              </div>
              <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                {pmStats.total > 0 ? (((pmStats.total - pmStats.completed) / pmStats.total) * 100).toFixed(1) : 0}% of total
              </div>
            </div>

            <div className="pm-stat-card" style={{ flex: '1 1 auto', padding: '16px', background: '#e3f2fd', borderRadius: '8px', borderLeft: '4px solid #1A73E8', minWidth: '0' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total PM Tasks ({pmPeriod.charAt(0).toUpperCase() + pmPeriod.slice(1)})
              </div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1A73E8' }}>
                {pmStats.total}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Recent Tasks</h3>
        {recentTasks.length === 0 ? (
          <p>No tasks found</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Task Code</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Type</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Asset</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {recentTasks.map((task) => (
                <tr key={task.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td data-label="Task Code" style={{ padding: '10px' }}>{task.task_code}</td>
                  <td data-label="Type" style={{ padding: '10px' }}>
                    <span className={`task-badge ${task.task_type}`}>{task.task_type}</span>
                  </td>
                  <td data-label="Asset" style={{ padding: '10px' }}>{task.asset_name || 'N/A'}</td>
                  <td data-label="Status" style={{ padding: '10px' }}>
                    <span className={`task-badge ${task.status}`}>
                      {task.status.replace('_', ' ')}
                    </span>
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
        )}
      </div>
    </div>
  );
}

export default Dashboard;
