/**
 * Overtime Utility
 * Handles overtime/after-hours work detection and validation
 */

const WORKING_HOURS_START = 7; // 07:00 AM
const WORKING_HOURS_END = 16; // 16:00 PM (4:00 PM)

/**
 * Check if current time is outside working hours (07:00-16:00)
 * @param {Date} date - Optional date to check (defaults to current time)
 * @returns {boolean} - True if outside working hours
 */
function isOutsideWorkingHours(date = null) {
  const now = date || new Date();
  const hour = now.getHours();
  
  // Working hours are 07:00 to 16:00 (7 AM to 4 PM)
  // Outside working hours: before 7 AM or after 4 PM
  return hour < WORKING_HOURS_START || hour >= WORKING_HOURS_END;
}

/**
 * Get working hours range as string
 * @returns {string} - Working hours description
 */
function getWorkingHoursDescription() {
  return `${WORKING_HOURS_START}:00 - ${WORKING_HOURS_END}:00`;
}

/**
 * Format time for display
 * @param {Date} date - Date to format
 * @returns {string} - Formatted time string
 */
function formatTime(date) {
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
}

module.exports = {
  isOutsideWorkingHours,
  getWorkingHoursDescription,
  formatTime,
  WORKING_HOURS_START,
  WORKING_HOURS_END
};
