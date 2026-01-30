import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl } from '../api/api';
import { getErrorMessage } from '../utils/errorHandler';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Title
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import './PlatformAnalytics.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Title
);

function PlatformAnalytics() {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [timeRange, setTimeRange] = useState('30d');

  useEffect(() => {
    if (!isSuperAdmin()) {
      setError('Access denied. System owner privileges required.');
      setLoading(false);
      return;
    }
    loadAnalytics();
  }, [isSuperAdmin, timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(`${getApiBaseUrl()}/platform/analytics?range=${timeRange}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load analytics');
      }

      const data = await response.json();
      setAnalytics(data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading analytics:', error);
      setError('Failed to load analytics: ' + getErrorMessage(error));
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatPercentage = (num) => {
    return `${num}%`;
  };

  // Chart.js options for consistent styling
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            size: 12,
            family: 'Roboto, sans-serif'
          },
          padding: 15,
          usePointStyle: true
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
          weight: 'bold'
        },
        bodyFont: {
          size: 13
        },
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 6
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          font: {
            size: 11
          }
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            size: 11
          }
        }
      }
    }
  };

  // Task Activity Trend Chart (Line Chart)
  const getTaskActivityChartData = () => {
    if (!analytics?.activity || analytics.activity.length === 0) {
      return null;
    }

    const labels = analytics.activity.map(item => {
      const date = new Date(item.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    return {
      labels,
      datasets: [
        {
          label: 'Tasks Created',
          data: analytics.activity.map(item => item.tasksCreated || 0),
          borderColor: '#4285F4',
          backgroundColor: 'rgba(66, 133, 244, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#4285F4',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        },
        {
          label: 'Tasks Completed',
          data: analytics.activity.map(item => item.tasksCompleted || 0),
          borderColor: '#34A853',
          backgroundColor: 'rgba(52, 168, 83, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#34A853',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }
      ]
    };
  };

  // Task Completion Rate Trend (Line Chart)
  const getCompletionRateChartData = () => {
    if (!analytics?.activity || analytics.activity.length === 0) {
      return null;
    }

    const labels = analytics.activity.map(item => {
      const date = new Date(item.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const completionRates = analytics.activity.map(item => {
      const total = (item.tasksCreated || 0) + (item.tasksCompleted || 0);
      return total > 0 ? Math.round((item.tasksCompleted || 0) / total * 100) : 0;
    });

    return {
      labels,
      datasets: [
        {
          label: 'Completion Rate (%)',
          data: completionRates,
          borderColor: '#9C27B0',
          backgroundColor: 'rgba(156, 39, 176, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#9C27B0',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }
      ]
    };
  };

  // Organization Performance Comparison (Horizontal Bar Chart)
  const getOrganizationPerformanceChartData = () => {
    if (!analytics?.organizations || analytics.organizations.length === 0) {
      return null;
    }

    // Sort by completion rate and take top 10
    const sortedOrgs = [...analytics.organizations]
      .sort((a, b) => b.completion_rate - a.completion_rate)
      .slice(0, 10);

    return {
      labels: sortedOrgs.map(org => org.name.length > 20 ? org.name.substring(0, 20) + '...' : org.name),
      datasets: [
        {
          label: 'Completion Rate (%)',
          data: sortedOrgs.map(org => org.completion_rate),
          backgroundColor: sortedOrgs.map(org => {
            if (org.completion_rate >= 80) return '#4CAF50';
            if (org.completion_rate >= 50) return '#FF9800';
            return '#F44335';
          }),
          borderColor: '#fff',
          borderWidth: 2,
          borderRadius: 6
        }
      ]
    };
  };

  const orgPerformanceOptions = {
    ...chartOptions,
    indexAxis: 'y',
    plugins: {
      ...chartOptions.plugins,
      title: {
        display: true,
        text: 'Top Organizations by Completion Rate',
        font: {
          size: 14,
          weight: 'bold'
        },
        padding: {
          bottom: 15
        }
      }
    }
  };

  // Task Status Distribution (Doughnut Chart)
  const getTaskStatusChartData = () => {
    if (!analytics?.overview?.tasks) {
      return null;
    }

    const { total, completed, pending } = analytics.overview.tasks;
    const inProgress = total - completed - pending;

    return {
      labels: ['Completed', 'In Progress', 'Pending'],
      datasets: [
        {
          data: [completed, inProgress, pending],
          backgroundColor: [
            '#4CAF50',
            '#FF9800',
            '#F44335'
          ],
          borderColor: '#fff',
          borderWidth: 3,
          hoverOffset: 8
        }
      ]
    };
  };

  // User Growth Trend (Line Chart)
  const getUserGrowthChartData = () => {
    if (!analytics?.growth?.users || analytics.growth.users.length === 0) {
      return null;
    }

    const labels = analytics.growth.users.map(item => {
      const date = new Date(item.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    return {
      labels,
      datasets: [
        {
          label: 'New Users',
          data: analytics.growth.users.map(item => item.usersCreated),
          borderColor: '#00BCD4',
          backgroundColor: 'rgba(0, 188, 212, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#00BCD4',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }
      ]
    };
  };

  // Organization Growth Trend (Line Chart)
  const getOrgGrowthChartData = () => {
    if (!analytics?.growth?.organizations || analytics.growth.organizations.length === 0) {
      return null;
    }

    const labels = analytics.growth.organizations.map(item => {
      const date = new Date(item.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    return {
      labels,
      datasets: [
        {
          label: 'New Organizations',
          data: analytics.growth.organizations.map(item => item.organizationsCreated),
          borderColor: '#1A73E8',
          backgroundColor: 'rgba(26, 115, 232, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#1A73E8',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }
      ]
    };
  };

  if (loading) {
    return (
      <div className="platform-analytics-container">
        <div className="loading">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="platform-analytics-container">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  const { overview, activity, organizations, growth } = analytics;

  return (
    <div className="platform-analytics-container">
      <div className="platform-analytics-header">
        <div>
          <h1>Platform Analytics</h1>
          <p className="platform-subtitle">Comprehensive overview of all organizations and system performance</p>
        </div>
        
        <div className="analytics-controls">
          <div className="control-group">
            <label>Time Range:</label>
            <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} className="control-select">
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="1y">Last Year</option>
            </select>
          </div>
          <button
            className="btn btn-secondary"
            onClick={loadAnalytics}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="analytics-kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Organizations</div>
          <div className="kpi-value">{formatNumber(overview.organizations.total)}</div>
          <div className="kpi-detail">
            {overview.organizations.active} active • {overview.organizations.newThisPeriod} new
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Total Users</div>
          <div className="kpi-value">{formatNumber(overview.users.total)}</div>
          <div className="kpi-detail">
            {overview.users.active} active • {overview.users.newThisPeriod} new
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Total Tasks</div>
          <div className="kpi-value">{formatNumber(overview.tasks.total)}</div>
          <div className="kpi-detail">
            {overview.tasks.completed} completed • {overview.tasks.pending} pending
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Task Completion Rate</div>
          <div className="kpi-value">
            {overview.tasks.total > 0 
              ? formatPercentage(Math.round((overview.tasks.completed / overview.tasks.total) * 100))
              : '0%'}
          </div>
          <div className="kpi-detail">
            {overview.tasks.completed} of {overview.tasks.total} tasks
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Active Organizations</div>
          <div className="kpi-value">{formatNumber(overview.organizations.active)}</div>
          <div className="kpi-detail">
            {overview.organizations.total > 0 
              ? formatPercentage(Math.round((overview.organizations.active / overview.organizations.total) * 100))
              : '0%'} of total
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Avg Users per Org</div>
          <div className="kpi-value">
            {overview.organizations.total > 0
              ? formatNumber(Math.round(overview.users.total / overview.organizations.total))
              : '0'}
          </div>
          <div className="kpi-detail">
            Across all organizations
          </div>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="analytics-charts-grid">
        {/* Task Activity Trend */}
        <div className="analytics-section chart-section">
          <h2>Task Activity Trend</h2>
          <p className="section-description">Daily task creation and completion over time</p>
          <div className="chart-wrapper">
            {getTaskActivityChartData() ? (
              <Line data={getTaskActivityChartData()} options={chartOptions} />
            ) : (
              <div className="no-data">No activity data available</div>
            )}
          </div>
        </div>

        {/* Task Completion Rate Trend */}
        <div className="analytics-section chart-section">
          <h2>Completion Rate Trend</h2>
          <p className="section-description">Task completion percentage over time</p>
          <div className="chart-wrapper">
            {getCompletionRateChartData() ? (
              <Line data={getCompletionRateChartData()} options={chartOptions} />
            ) : (
              <div className="no-data">No completion data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Secondary Charts Section */}
      <div className="analytics-charts-grid">
        {/* Task Status Distribution */}
        <div className="analytics-section chart-section">
          <h2>Task Status Distribution</h2>
          <p className="section-description">Overall task status breakdown</p>
          <div className="chart-wrapper doughnut-wrapper">
            {getTaskStatusChartData() ? (
              <Doughnut 
                data={getTaskStatusChartData()} 
                options={{
                  ...chartOptions,
                  plugins: {
                    ...chartOptions.plugins,
                    legend: {
                      ...chartOptions.plugins.legend,
                      position: 'bottom'
                    }
                  }
                }} 
              />
            ) : (
              <div className="no-data">No task data available</div>
            )}
          </div>
        </div>

        {/* Organization Performance */}
        <div className="analytics-section chart-section">
          <h2>Organization Performance</h2>
          <p className="section-description">Top organizations by completion rate</p>
          <div className="chart-wrapper">
            {getOrganizationPerformanceChartData() ? (
              <Bar data={getOrganizationPerformanceChartData()} options={orgPerformanceOptions} />
            ) : (
              <div className="no-data">No organization data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Growth Trends */}
      <div className="analytics-charts-grid">
        {/* User Growth */}
        <div className="analytics-section chart-section">
          <h2>User Growth</h2>
          <p className="section-description">New users added over time</p>
          <div className="chart-wrapper">
            {getUserGrowthChartData() ? (
              <Line data={getUserGrowthChartData()} options={chartOptions} />
            ) : (
              <div className="no-data">No user growth data available</div>
            )}
          </div>
        </div>

        {/* Organization Growth */}
        <div className="analytics-section chart-section">
          <h2>Organization Growth</h2>
          <p className="section-description">New organizations added over time</p>
          <div className="chart-wrapper">
            {getOrgGrowthChartData() ? (
              <Line data={getOrgGrowthChartData()} options={chartOptions} />
            ) : (
              <div className="no-data">No organization growth data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Organization Comparison Table */}
      <div className="analytics-section">
        <div className="section-header">
          <div>
            <h2>Organization Activity Details</h2>
            <p className="section-description">Detailed metrics for each organization</p>
          </div>
        </div>
        <div className="org-comparison-table-container">
          {organizations.length === 0 ? (
            <div className="no-data">No organization data available</div>
          ) : (
            <table className="org-comparison-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Users</th>
                  <th>Total Tasks</th>
                  <th>Completed</th>
                  <th>Completion Rate</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map(org => (
                  <tr key={org.id}>
                    <td>
                      <strong>{org.name}</strong>
                      <div className="org-slug">{org.slug}</div>
                    </td>
                    <td>{formatNumber(org.user_count)}</td>
                    <td>{formatNumber(org.task_count)}</td>
                    <td>{formatNumber(org.completed_tasks)}</td>
                    <td>
                      <div className="completion-rate-cell">
                        <span className={`completion-rate ${org.completion_rate >= 80 ? 'high' : org.completion_rate >= 50 ? 'medium' : 'low'}`}>
                          {formatPercentage(org.completion_rate)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => navigate(`/platform/organizations/${org.id}/settings`)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlatformAnalytics;
