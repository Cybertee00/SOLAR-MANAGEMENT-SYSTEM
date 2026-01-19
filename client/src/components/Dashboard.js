import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  getTasks, 
  getCMLetters, 
  getPlantMapStructure, 
  getCalendarEventsByDate, 
  getInventoryItems 
} from '../api/api';
import './Dashboard.css';
import { 
  Chart as ChartJS, 
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale,
  LinearScale,
  BarElement
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

// BI Color Palette
const BI_COLORS = {
  primary: '#1A73E8',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44335',
  info: '#00BCD4',
  secondary: '#9E9E9E',
  lightGray: '#E0E0E0',
  darkGray: '#757575'
};

// Create gradient function for charts
const createGradient = (ctx, chartArea, color1, color2) => {
  if (!chartArea) {
    return color1; // Fallback to solid color if chart area not available
  }
  const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);
  return gradient;
};

function Dashboard() {
  const [stats, setStats] = useState({
    pendingTasks: 0,
    inProgressTasks: 0,
    completedTasks: 0,
    openCMLetters: 0,
  });
  const [loading, setLoading] = useState(true);
  const [pmPeriod, setPmPeriod] = useState('monthly');
  const [pmStats, setPmStats] = useState({
    total: 0,
    completed: 0,
  });
  const [grassCuttingProgress, setGrassCuttingProgress] = useState(0);
  const [panelWashProgress, setPanelWashProgress] = useState(0);
  const [trackerViewMode, setTrackerViewMode] = useState('grass_cutting');
  const [inventoryStats, setInventoryStats] = useState({
    inStock: 0,
    lowStock: 0,
    outOfStock: 0,
    total: 0
  });
  const [todayActivities, setTodayActivities] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, [pmPeriod]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load all data in parallel
      const [tasksRes, cmLettersRes, plantRes, inventoryRes] = await Promise.all([
        getTasks({ task_type: 'PM' }),
        getCMLetters({ status: 'open' }),
        getPlantMapStructure().catch(() => ({ structure: [] })),
        getInventoryItems().catch(() => ({ data: [] }))
      ]);

      const tasks = tasksRes.data || [];
      const cmLetters = cmLettersRes.data || [];
      const plantStructure = plantRes.structure || [];
      const inventoryItems = inventoryRes.data || [];

      // Calculate stats
      const statsData = {
        pendingTasks: tasks.filter(t => t.status === 'pending').length,
        inProgressTasks: tasks.filter(t => t.status === 'in_progress').length,
        completedTasks: tasks.filter(t => t.status === 'completed').length,
        openCMLetters: cmLetters.length,
      };
      setStats(statsData);

      // Calculate PM stats based on period
      const now = new Date();
      let startDate, endDate;
      
      if (pmPeriod === 'weekly') {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        endDate = now;
      } else if (pmPeriod === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      } else { // yearly
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
      }

      const periodTasks = tasks.filter(task => {
        if (!task.scheduled_date) return false;
        const taskDate = new Date(task.scheduled_date);
        return taskDate >= startDate && taskDate <= endDate;
      });

      const pmData = {
        total: periodTasks.length,
        completed: periodTasks.filter(t => t.status === 'completed').length,
      };
      setPmStats(pmData);

      // Calculate Grass Cutting and Panel Wash progress from Plant data
      // Same logic as Plant.js: (done + halfway * 0.5) / total * 100
      const allTrackers = plantStructure.filter(t => 
        t.id && t.id.startsWith('M') && /^M\d{2}$/.test(t.id)
      );

      if (allTrackers.length > 0) {
        // Grass Cutting
        const grassDoneCount = allTrackers.filter(t => {
          const color = t.grassCuttingColor || '#ffffff';
          return color === '#4CAF50' || color === '#90EE90';
        }).length;
        const grassHalfwayCount = allTrackers.filter(t => {
          const color = t.grassCuttingColor || '#ffffff';
          return color === '#FF9800' || color === '#FFD700';
        }).length;
        const grassProgress = ((grassDoneCount + grassHalfwayCount * 0.5) / allTrackers.length) * 100;
        setGrassCuttingProgress(grassProgress);

        // Panel Wash
        const panelDoneCount = allTrackers.filter(t => {
          const color = t.panelWashColor || '#ffffff';
          return color === '#4CAF50' || color === '#90EE90';
        }).length;
        const panelHalfwayCount = allTrackers.filter(t => {
          const color = t.panelWashColor || '#ffffff';
          return color === '#FF9800' || color === '#FFD700';
        }).length;
        const panelProgress = ((panelDoneCount + panelHalfwayCount * 0.5) / allTrackers.length) * 100;
        setPanelWashProgress(panelProgress);
      }

      // Calculate Inventory Stats
      const invStats = {
        inStock: inventoryItems.filter(item => {
          const qty = item.quantity || 0;
          const minQty = item.minimum_quantity || 0;
          return qty > minQty;
        }).length,
        lowStock: inventoryItems.filter(item => {
          const qty = item.quantity || 0;
          const minQty = item.minimum_quantity || 0;
          return qty > 0 && qty <= minQty;
        }).length,
        outOfStock: inventoryItems.filter(item => {
          const qty = item.quantity || 0;
          return qty === 0;
        }).length,
        total: inventoryItems.length
      };
      setInventoryStats(invStats);

      // Load today's calendar activities
      const today = new Date().toISOString().split('T')[0];
      try {
        const calendarRes = await getCalendarEventsByDate(today);
        const events = calendarRes.data || [];
        setTodayActivities(events.slice(0, 5)); // Show max 5 activities
      } catch (error) {
        console.error('Error loading calendar events:', error);
        setTodayActivities([]);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setLoading(false);
    }
  };

  // PM Chart Data with Gradient
  const getPMChartData = () => {
    const completed = pmStats.completed;
    const remaining = Math.max(0, pmStats.total - completed);

    return {
      labels: ['Completed', 'Remaining'],
      datasets: [{
        data: [completed, remaining],
        backgroundColor: (context) => {
          const chart = context.chart;
          const {ctx, chartArea} = chart;
          if (context.dataIndex === 0) {
            return createGradient(ctx, chartArea, '#66BB6A', '#4CAF50');
          }
          return BI_COLORS.lightGray;
        },
        borderColor: '#ffffff',
        borderWidth: 3,
        hoverBorderWidth: 5,
        hoverOffset: 10,
      }],
    };
  };

  // Grass Cutting/Panel Wash Chart Data with Gradient
  const getTrackerChartData = () => {
    const progress = trackerViewMode === 'grass_cutting' ? grassCuttingProgress : panelWashProgress;
    const completedProgress = progress;
    const remainingProgress = 100 - progress;

    return {
      labels: ['Completed', 'Remaining'],
      datasets: [{
        data: [completedProgress, remainingProgress],
        backgroundColor: (context) => {
          const chart = context.chart;
          const {ctx, chartArea} = chart;
          if (context.dataIndex === 0) {
            return createGradient(ctx, chartArea, '#66BB6A', '#4CAF50');
          }
          return BI_COLORS.lightGray;
        },
        borderColor: '#ffffff',
        borderWidth: 3,
        hoverBorderWidth: 5,
        hoverOffset: 10,
      }],
    };
  };

  // Inventory Chart Data with Gradient
  const getInventoryChartData = () => {
    const { inStock, lowStock, outOfStock } = inventoryStats;

    return {
      labels: ['In Stock', 'Low Stock', 'Out of Stock'],
      datasets: [{
        label: 'Items',
        data: [inStock, lowStock, outOfStock],
        backgroundColor: (context) => {
          const chart = context.chart;
          const {ctx, chartArea} = chart;
          const gradients = [
            createGradient(ctx, chartArea, '#66BB6A', '#4CAF50'),
            createGradient(ctx, chartArea, '#FFB74D', '#FF9800'),
            createGradient(ctx, chartArea, '#EF5350', '#F44335')
          ];
          return gradients[context.dataIndex] || '#9E9E9E';
        },
        borderColor: '#ffffff',
        borderWidth: 2,
        borderRadius: 8,
      }],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
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
            return `${value} • ${percentage}%`;
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
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    indexAxis: 'y',
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
          label: function(context) {
            return `${context.parsed.x} items`;
          },
        },
        displayColors: true,
        boxPadding: 8,
        cornerRadius: 8,
        titleColor: '#fff',
        bodyColor: '#fff',
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          font: {
            family: "'Roboto', sans-serif",
            size: 12,
          },
        },
        grid: {
          display: false,
        },
      },
      y: {
        ticks: {
          font: {
            family: "'Roboto', sans-serif",
            size: 12,
          },
        },
        grid: {
          display: false,
        },
      },
    },
    animation: {
      duration: 1200,
      easing: 'easeOutQuart',
    },
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="dashboard-container">
      <h2 className="dashboard-header">Dashboard</h2>
      
      {/* Stat Cards */}
      <div className="dashboard-stats">
        <Link to="/tasks" className="card stat-card">
          <h3>Pending Tasks</h3>
          <p className="stat-number" style={{ color: '#ffc107' }}>
            {stats.pendingTasks}
          </p>
        </Link>
        <Link to="/tasks" className="card stat-card">
          <h3>In Progress</h3>
          <p className="stat-number" style={{ color: '#17a2b8' }}>
            {stats.inProgressTasks}
          </p>
        </Link>
        <Link to="/tasks" className="card stat-card">
          <h3>Completed</h3>
          <p className="stat-number" style={{ color: '#28a745' }}>
            {stats.completedTasks}
          </p>
        </Link>
        <Link to="/cm-letters" className="card stat-card">
          <h3>Open CM Letters</h3>
          <p className="stat-number" style={{ color: '#dc3545' }}>
            {stats.openCMLetters}
          </p>
        </Link>
      </div>

      {/* Main Dashboard Grid */}
      <div className="dashboard-grid">
        {/* PM Completion Rate */}
        <Link to="/tasks" className="dashboard-card">
          <div className="card-header">
            <h3>PM Completion Rate</h3>
            <select 
              className="period-dropdown"
              value={pmPeriod}
              onChange={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPmPeriod(e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div className="pm-chart-container">
            <div className="pm-chart-wrapper">
              <Doughnut
                data={getPMChartData()}
                options={{
                  ...chartOptions,
                  cutout: '65%',
                }}
              />
              <div className="chart-center-text">
                <div className="chart-percentage">
                  {pmStats.total > 0 ? ((pmStats.completed / pmStats.total) * 100).toFixed(0) : 0}%
                </div>
                <div className="chart-label">Complete</div>
                <div className="chart-detail">
                  {pmStats.completed} of {pmStats.total}
                </div>
              </div>
            </div>
            <div className="pm-stats-breakdown">
              <div className="pm-stat-item">
                <div className="pm-stat-label">Completed</div>
                <div className="pm-stat-value compact">{pmStats.completed}</div>
                <div className="pm-stat-percentage">
                  {pmStats.total > 0 ? ((pmStats.completed / pmStats.total) * 100).toFixed(0) : 0}%
                </div>
              </div>
              <div className="pm-stat-item">
                <div className="pm-stat-label">Remaining</div>
                <div className="pm-stat-value compact">{pmStats.total - pmStats.completed}</div>
                <div className="pm-stat-percentage">
                  {pmStats.total > 0 ? (((pmStats.total - pmStats.completed) / pmStats.total) * 100).toFixed(0) : 0}%
                </div>
              </div>
              <div className="pm-stat-item">
                <div className="pm-stat-label">Total ({pmPeriod.charAt(0).toUpperCase() + pmPeriod.slice(1)})</div>
                <div className="pm-stat-value compact">{pmStats.total}</div>
              </div>
            </div>
          </div>
        </Link>

        {/* Grass Cutting / Panel Wash Progress */}
        <Link to="/plant" className="dashboard-card">
          <div className="card-header">
            <h3>Grass Cutting Progress</h3>
            <select 
              className="period-dropdown"
              value={trackerViewMode}
              onChange={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTrackerViewMode(e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="grass_cutting">Grass Cutting</option>
              <option value="panel_wash">Panel Wash</option>
            </select>
          </div>
          <div className="tracker-chart-container">
            <div className="tracker-chart-wrapper">
              <Doughnut
                data={getTrackerChartData()}
                options={{
                  ...chartOptions,
                  cutout: '65%',
                }}
              />
              <div className="chart-center-text">
                <div className="chart-percentage">
                  {(trackerViewMode === 'grass_cutting' ? grassCuttingProgress : panelWashProgress).toFixed(0)}%
                </div>
                <div className="chart-label">Progress</div>
              </div>
            </div>
          </div>
        </Link>

        {/* Spares Inventory Status */}
        <Link to="/inventory" className="dashboard-card">
          <div className="card-header">
            <h3>Spares Inventory Status</h3>
          </div>
          <div className="spares-chart-container">
            <Bar
              data={getInventoryChartData()}
              options={barChartOptions}
            />
            <div className="inventory-summary">
              <div className="inventory-summary-item">
                <span className="summary-label">In Stock:</span>
                <span className="summary-value">{inventoryStats.inStock}</span>
              </div>
              <div className="inventory-summary-item">
                <span className="summary-label">Low Stock:</span>
                <span className="summary-value warning">{inventoryStats.lowStock}</span>
              </div>
              <div className="inventory-summary-item">
                <span className="summary-label">Out of Stock:</span>
                <span className="summary-value error">{inventoryStats.outOfStock}</span>
              </div>
            </div>
          </div>
        </Link>

        {/* Today's Activities */}
        <Link to="/calendar" className="dashboard-card daily-activities-card">
          <div className="card-header">
            <h3>Today's Activities</h3>
          </div>
          <div className="daily-activities-list">
            {todayActivities.length === 0 ? (
              <div className="no-activities">No activities scheduled for today</div>
            ) : (
              <ul>
                {todayActivities.map((activity, index) => (
                  <li key={activity.id || index} className="activity-item">
                    <div className="activity-title">{activity.title || activity.event_name || 'Untitled Event'}</div>
                    {activity.description && (
                      <div className="activity-description">{activity.description}</div>
                    )}
                    {activity.event_date && (
                      <div className="activity-time">
                        {new Date(activity.event_date).toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Link>
      </div>
    </div>
  );
}

export default Dashboard;
