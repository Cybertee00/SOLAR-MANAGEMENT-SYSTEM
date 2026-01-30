import React, { useState, useEffect } from 'react';
import { getCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, downloadYearCalendar } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { hasOrganizationContext, isSystemOwnerWithoutCompany } from '../utils/organizationContext';
import './Calendar.css';

// Color mapping for different task frequencies (from Excel - 100% match)
const FREQUENCY_COLORS = {
  'weekly': '#ffff00',        // Yellow - WEEKLY
  'monthly': '#92d050',        // Green - MONTHLY
  'quarterly': '#00b0f0',      // Blue - QUARTERLY
  'biannually': '#BFBFBF',     // Light Grey - BI-ANNUAL
  'bi-annually': '#BFBFBF',    // Light Grey - BI-ANNUAL
  'bi-annual': '#BFBFBF',      // Light Grey - BI-ANNUAL
  'annually': '#CC5C0B',       // Orange/Brown - ANNUAL
  'annual': '#CC5C0B',         // Orange/Brown - ANNUAL
  'bimonthly': '#F9B380',      // Light Orange - BI-MONTHLY
  'bi-monthly': '#F9B380',    // Light Orange - BI-MONTHLY
  'public holiday': '#808080', // Grey - PUBLIC HOLIDAY
  'holiday': '#808080',        // Grey - PUBLIC HOLIDAY
  'public': '#808080'          // Grey - PUBLIC HOLIDAY
};

function getEventColor(event) {
  // Check for "Complete Outstanding PM's and reports" - return special marker
  if (event.task_title) {
    const title = typeof event.task_title === 'string' 
      ? event.task_title 
      : (event.task_title.text || event.task_title.richText?.map(r => r.text).join('') || '');
    if (title.toLowerCase().includes("complete outstanding")) {
      return 'OUTSTANDING_TASK'; // Special marker for outstanding tasks
    }
  }
  
  // First check if frequency is explicitly set
  if (event.frequency) {
    const freq = event.frequency.toLowerCase();
    if (FREQUENCY_COLORS[freq]) {
      return FREQUENCY_COLORS[freq];
    }
  }
  
  // Try to detect from task title
  if (event.task_title) {
    const title = typeof event.task_title === 'string' 
      ? event.task_title.toLowerCase()
      : (event.task_title.text || event.task_title.richText?.map(r => r.text).join('') || '').toLowerCase();
    
    // Check for public holiday first (most specific)
    if (title.includes('public holiday') || title.includes('holiday')) {
      return FREQUENCY_COLORS['public holiday'];
    }
    
    // Check for bi-monthly
    if (title.includes('bi-monthly') || title.includes('bimonthly')) {
      return FREQUENCY_COLORS['bi-monthly'];
    }
    
    // Check for bi-annually
    if (title.includes('bi-annually') || title.includes('biannually') || title.includes('bi-annual')) {
      return FREQUENCY_COLORS['bi-annually'];
    }
    
    // Check for annually/annual
    if (title.includes('annually') || title.includes('annual')) {
      return FREQUENCY_COLORS['annually'];
    }
    
    // Check for quarterly
    if (title.includes('quarterly') || title.includes('quaterly')) {
      return FREQUENCY_COLORS['quarterly'];
    }
    
    // Check for monthly
    if (title.includes('monthly')) {
      return FREQUENCY_COLORS['monthly'];
    }
    
    // Check for weekly
    if (title.includes('weekly')) {
      return FREQUENCY_COLORS['weekly'];
    }
  }
  
  // Default color if no match
  return '#3498db';
}

function Calendar() {
  const { isAdmin, user, loading: authLoading } = useAuth();
  // Initialize to January 2026 (or current date if already 2026+)
  const getInitialDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    // Start from 2026, or current year if already 2026 or later
    const startYear = year >= 2026 ? year : 2026;
    return new Date(startYear, 0, 1); // January 1st
  };
  
  const [currentDate, setCurrentDate] = useState(getInitialDate());
  const [events, setEvents] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [legendExpanded, setLegendExpanded] = useState(false);
  const [eventForm, setEventForm] = useState({
    event_date: '',
    task_title: '',
    procedure_code: '',
    description: '',
    frequency: ''
  });
  
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  // Get today's date in real-time (using local time, not UTC)
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    // Wait for AuthContext to finish loading before checking organization context
    if (authLoading) {
      return; // Don't check until auth is loaded
    }
    
    // Only load events if user has organization context
    if (hasOrganizationContext(user)) {
      loadEvents();
    } else {
      // System owner without company: show empty calendar
      setEvents({});
      setLoading(false);
    }
  }, [currentYear, currentMonth, user, authLoading]);

  // Helper to format date without UTC conversion
  const formatLocalDate = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const loadEvents = async () => {
    try {
      setLoading(true);
      // Load events for the current month - use local date formatting
      const startDate = formatLocalDate(new Date(currentYear, currentMonth, 1));
      const endDate = formatLocalDate(new Date(currentYear, currentMonth + 1, 0));
      const response = await getCalendarEvents({ start_date: startDate, end_date: endDate });
      const eventsByDate = {};
      
      response.data.forEach(event => {
        // Use event_date as-is if it's already a YYYY-MM-DD string from the server
        let date = event.event_date;
        
        // If it's somehow still a Date object or needs conversion
        if (date instanceof Date) {
          date = formatLocalDate(date);
        } else if (typeof date === 'object' && date !== null) {
          // Handle serialized date objects
          date = formatLocalDate(new Date(date));
        } else if (typeof date === 'string' && date.includes('T')) {
          // ISO string like "2026-01-04T00:00:00.000Z" - extract just the date part
          date = date.split('T')[0];
        } else if (typeof date !== 'string') {
          date = String(date);
        }
        
        // Ensure frequency is properly set from task_title if missing
        if (!event.frequency && event.task_title) {
          const title = String(event.task_title).toLowerCase();
          if (title.includes('weekly')) event.frequency = 'weekly';
          else if (title.includes('monthly')) event.frequency = 'monthly';
          else if (title.includes('quarterly') || title.includes('quaterly')) event.frequency = 'quarterly';
          else if (title.includes('bi-monthly') || title.includes('bimonthly')) event.frequency = 'bi-monthly';
          else if (title.includes('bi-annually') || title.includes('biannually') || title.includes('bi-annual')) event.frequency = 'bi-annually';
          else if (title.includes('annually') || (title.includes('annual') && !title.includes('bi-annual'))) event.frequency = 'annually';
          else if (title.includes('public holiday') || title.includes('holiday')) event.frequency = 'public holiday';
        }
        
        if (!eventsByDate[date]) {
          eventsByDate[date] = [];
        }
        eventsByDate[date].push(event);
      });
      
      setEvents(eventsByDate);
      setLoading(false);
    } catch (error) {
      console.error('Error loading calendar events:', error);
      setLoading(false);
    }
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    setEditingEvent(null);
    setEventForm({
      event_date: date,
      task_title: '',
      procedure_code: '',
      description: '',
      frequency: ''
    });
    setShowEventModal(true);
  };

  const handleEventClick = (event, e) => {
    e.stopPropagation();
    setEditingEvent(event);
    setEventForm({
      event_date: event.event_date,
      task_title: event.task_title,
      procedure_code: event.procedure_code || '',
      description: event.description || '',
      frequency: event.frequency || ''
    });
    setShowEventModal(true);
  };

  const handleSaveEvent = async () => {
    try {
      if (editingEvent) {
        await updateCalendarEvent(editingEvent.id, eventForm);
      } else {
        await createCalendarEvent(eventForm);
      }
      await loadEvents();
      setShowEventModal(false);
      setEditingEvent(null);
      setSelectedDate(null);
    } catch (error) {
      console.error('Error saving event:', error);
      alert('Failed to save event. Please try again.');
    }
  };

  const handleDeleteEvent = async () => {
    if (!editingEvent || !window.confirm('Are you sure you want to delete this event?')) {
      return;
    }
    
    try {
      await deleteCalendarEvent(editingEvent.id);
      await loadEvents();
      setShowEventModal(false);
      setEditingEvent(null);
      setSelectedDate(null);
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event. Please try again.');
    }
  };
  
  const handleCloseModal = () => {
    setShowEventModal(false);
    setEditingEvent(null);
    setSelectedDate(null);
  };

  const generateCalendar = () => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      // Use local date formatting instead of UTC to avoid timezone issues
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const dayStr = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${dayStr}`;
      days.push({
        day,
        date: dateStr,
        events: events[dateStr] || []
      });
    }
    
    return {
      name: monthNames[currentMonth],
      year: currentYear,
      days
    };
  };

  const calendar = generateCalendar();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const handlePreviousMonth = () => {
    const newDate = new Date(currentYear, currentMonth - 1, 1);
    // Prevent going to 2025 or earlier
    if (newDate.getFullYear() >= 2026) {
      setCurrentDate(newDate);
    }
  };
  
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };
  
  const handleToday = () => {
    const today = new Date();
    // If today is before 2026, go to January 2026, otherwise go to today
    if (today.getFullYear() < 2026) {
      setCurrentDate(new Date(2026, 0, 1));
    } else {
      setCurrentDate(today);
    }
  };
  
  // Helper to determine text color based on background
  function getContrastColor(hexColor) {
    if (!hexColor) return '#000000';
    // Remove # if present
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  if (loading) {
    return <div className="loading">Loading calendar...</div>;
  }

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <h1>Year Calendar</h1>
        <div className="calendar-controls">
          <button 
            className="btn btn-secondary calendar-nav-btn calendar-icon-btn" 
            onClick={handlePreviousMonth}
            title="Previous Month"
          >
            ◀
          </button>
          <button 
            className="btn btn-secondary calendar-nav-btn calendar-icon-btn" 
            onClick={handleToday}
            title="Today"
          >
            ●
          </button>
          <button 
            className="btn btn-secondary calendar-nav-btn calendar-icon-btn" 
            onClick={handleNextMonth}
            title="Next Month"
          >
            ▶
          </button>
          <button 
            className="btn btn-primary calendar-download-btn" 
            onClick={() => downloadYearCalendar(currentYear)}
            title="Download Year Calendar as Excel"
          >
            Download
          </button>
        </div>
      </div>

      <div className="calendar-content-wrapper">
        {/* Calendar - Left Side */}
        <div className="calendar-month-view" style={{ position: 'relative' }}>
        <div className="calendar-month">
          <h2 className="month-name">{calendar.name} {calendar.year}</h2>
          <div className="calendar-weekdays">
            {weekDays.map(day => (
              <div key={day} className="weekday-header">{day}</div>
            ))}
          </div>
          <div className="calendar-days">
            {calendar.days.map((dayData, dayIndex) => {
              if (dayData === null) {
                return <div key={dayIndex} className="calendar-day empty"></div>;
              }
              
              const { day, date, events: dayEvents } = dayData;
              const isToday = date === getTodayDate();
              const isSelected = selectedDate === date || (showEventModal && eventForm.event_date === date);
              
              return (
                <div
                  key={dayIndex}
                  className={`calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleDateClick(date)}
                >
                  <div className="day-number">{day}</div>
                    <div className="day-events">
                      {dayEvents.slice(0, 3).map((event, eventIndex) => {
                        const eventColor = getEventColor(event);
                        // Extract task title safely (handle object formats)
                        let taskTitle = event.task_title;
                        if (taskTitle && typeof taskTitle === 'object') {
                          taskTitle = taskTitle.text || taskTitle.richText?.map(r => r.text).join('') || 'Task';
                        }
                        taskTitle = taskTitle && typeof taskTitle === 'string' ? taskTitle : 'Task';
                        
                        // Check if this is an outstanding task (no color, black border)
                        const isOutstandingTask = eventColor === 'OUTSTANDING_TASK';
                        
                        return (
                          <div
                            key={eventIndex}
                            className="calendar-event"
                            style={{ 
                              backgroundColor: isOutstandingTask ? 'transparent' : eventColor, 
                              color: isOutstandingTask ? '#000' : getContrastColor(eventColor),
                              border: isOutstandingTask ? '0.2px solid #000' : 'none',
                              fontWeight: isOutstandingTask ? '600' : 'normal'
                            }}
                            onClick={(e) => handleEventClick(event, e)}
                            title={taskTitle}
                          >
                            {taskTitle.length > 25 ? taskTitle.substring(0, 25) + '...' : taskTitle}
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <div className="calendar-event-more">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Legend - Compact Horizontal */}
        <div className="calendar-legend-compact">
          <div className="legend-trigger" onClick={() => setLegendExpanded(!legendExpanded)} title="Show/Hide Legend">
            <span className="legend-icon">Legend</span>
          </div>
          {legendExpanded && (
            <div className="legend-items-horizontal">
              <div className="legend-item-compact" title="Weekly">
                <span className="legend-color-compact" style={{ backgroundColor: FREQUENCY_COLORS.weekly }}></span>
                <span className="legend-label-compact">W</span>
              </div>
              <div className="legend-item-compact" title="Monthly">
                <span className="legend-color-compact" style={{ backgroundColor: FREQUENCY_COLORS.monthly }}></span>
                <span className="legend-label-compact">M</span>
              </div>
              <div className="legend-item-compact" title="Quarterly">
                <span className="legend-color-compact" style={{ backgroundColor: FREQUENCY_COLORS.quarterly }}></span>
                <span className="legend-label-compact">Q</span>
              </div>
              <div className="legend-item-compact" title="Bi-Monthly">
                <span className="legend-color-compact" style={{ backgroundColor: FREQUENCY_COLORS['bi-monthly'] }}></span>
                <span className="legend-label-compact">BM</span>
              </div>
              <div className="legend-item-compact" title="Bi-Annually">
                <span className="legend-color-compact" style={{ backgroundColor: FREQUENCY_COLORS['bi-annually'] }}></span>
                <span className="legend-label-compact">BA</span>
              </div>
              <div className="legend-item-compact" title="Annually">
                <span className="legend-color-compact" style={{ backgroundColor: FREQUENCY_COLORS.annually }}></span>
                <span className="legend-label-compact">A</span>
              </div>
              <div className="legend-item-compact" title="Public Holiday">
                <span className="legend-color-compact" style={{ backgroundColor: FREQUENCY_COLORS['public holiday'] }}></span>
                <span className="legend-label-compact">PH</span>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      {showEventModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content calendar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingEvent ? 'Edit Event' : 'Add Event'}</h2>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Date *</label>
                <input
                  type="date"
                  value={eventForm.event_date}
                  onChange={(e) => setEventForm({ ...eventForm, event_date: e.target.value })}
                  className="form-control"
                  required
                />
              </div>
              <div className="form-group">
                <label>Task Title *</label>
                <input
                  type="text"
                  value={eventForm.task_title}
                  onChange={(e) => setEventForm({ ...eventForm, task_title: e.target.value })}
                  className="form-control"
                  placeholder="e.g., PM-009 Weekly Artificial Ventilation"
                  required
                />
              </div>
              <div className="form-group">
                <label>Procedure Code</label>
                <input
                  type="text"
                  value={eventForm.procedure_code}
                  onChange={(e) => setEventForm({ ...eventForm, procedure_code: e.target.value })}
                  className="form-control"
                  placeholder="e.g., PM-009"
                />
              </div>
              <div className="form-group">
                <label>Frequency</label>
                <select
                  value={eventForm.frequency}
                  onChange={(e) => setEventForm({ ...eventForm, frequency: e.target.value })}
                  className="form-control"
                >
                  <option value="">Select frequency</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="bi-monthly">Bi-Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="biannually">Bi-Annually</option>
                  <option value="annually">Annually</option>
                </select>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  className="form-control"
                  rows="3"
                  placeholder="Additional details about this task..."
                />
              </div>
            </div>
            <div className="modal-footer">
              {editingEvent && (
                <button
                  className="btn btn-danger"
                  onClick={handleDeleteEvent}
                >
                  Delete
                </button>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={handleCloseModal}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveEvent}
                  disabled={!eventForm.event_date || !eventForm.task_title}
                >
                  {editingEvent ? 'Update' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Calendar;
