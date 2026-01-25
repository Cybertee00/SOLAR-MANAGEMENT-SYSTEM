import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getPlantMapStructure, savePlantMapStructure, submitTrackerStatusRequest, getCycleInfo, resetCycle } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { generatePlantMapReport } from '../utils/plantMapReport';
import './Plant.css';

// Correct cabinet mapping: 24 cabinets total
const getCorrectCabinet = (trackerId) => {
  if (!trackerId.startsWith('M')) return '';
  const num = parseInt(trackerId.substring(1), 10);
  if (isNaN(num) || num < 1 || num > 99) return '';
  if (num >= 93) return 'CT24'; // M93-M99 all belong to CT24
  return `CT${Math.ceil(num / 4).toString().padStart(2, '0')}`;
};

// Memoized tracker component for performance
const TrackerBlock = React.memo(({ tracker, bounds, viewMode, isSelected, onSelect, selectionMode }) => {
  const x = (tracker.col - bounds.minCol) * 28;
  const y = (tracker.row - bounds.minRow) * 28;
  const isSiteOffice = tracker.id === 'SITE_OFFICE';
  const bgColor = isSiteOffice 
    ? '#4169E1' 
    : (viewMode === 'grass_cutting' 
        ? (tracker.grassCuttingColor || '#ffffff')
        : (tracker.panelWashColor || '#ffffff'));
  
  // Use brighter colors for better visibility
  // Map old colors to new brighter colors, or use existing if already bright
  const displayColor = (bgColor === '#90EE90' || bgColor === '#4CAF50') ? '#4CAF50' : // Brighter green for done
                      (bgColor === '#FFD700' || bgColor === '#FF9800') ? '#FF9800' : // Brighter orange for halfway
                      bgColor;
  
  // Check if tracker is already done (green) - should not be selectable
  const isDone = !isSiteOffice && (bgColor === '#90EE90' || bgColor === '#4CAF50');
  const isSelectable = !isSiteOffice && !isDone && selectionMode;

  const handleClick = (e) => {
    if (isSiteOffice || !selectionMode || isDone) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(tracker);
  };

  const handleTouch = (e) => {
    if (isSiteOffice || !selectionMode || isDone) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(tracker);
  };
  
  return (
    <div
      onClick={handleClick}
      onTouchStart={handleTouch}
      style={{
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        width: '28px',
        height: '28px',
        backgroundColor: displayColor,
        border: isSelected ? '3px solid #007bff' : '1px solid #333',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isSiteOffice ? 'default' : (isSelectable ? 'pointer' : (isDone ? 'not-allowed' : 'default')),
        opacity: isDone && selectionMode ? 0.6 : 1,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        borderRadius: '2px',
        transition: 'transform 0.1s, box-shadow 0.1s, border 0.1s',
        boxShadow: isSelected ? '0 0 8px rgba(0, 123, 255, 0.6)' : 'none',
        transform: isSelected ? 'scale(1.1)' : 'scale(1)',
        zIndex: isSelected ? 10 : 1,
        touchAction: selectionMode ? 'manipulation' : 'auto',
        WebkitTapHighlightColor: 'transparent',
        msTouchAction: selectionMode ? 'manipulation' : 'auto'
      }}
      className={!isSiteOffice ? 'tracker-block' : ''}
      title={isSiteOffice ? 'Site Office' : `${tracker.label} - ${tracker.cabinet}${isDone && selectionMode ? '\nAlready completed - cannot select' : selectionMode ? '\nTap to select' : ''}`}
    >
      {isSelected && (
        <div style={{
          position: 'absolute',
          top: '-2px',
          right: '-2px',
          width: '12px',
          height: '12px',
          backgroundColor: '#007bff',
          borderRadius: '50%',
          border: '2px solid white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '8px',
          color: 'white',
          fontWeight: 'bold'
        }}>
          ✓
        </div>
      )}
      <div style={{ fontWeight: 'bold', fontSize: '7px', lineHeight: '1.1' }}>
        {tracker.label}
      </div>
      {tracker.sublabel && (
        <div style={{ fontSize: '5px', lineHeight: '1' }}>{tracker.sublabel}</div>
      )}
      {tracker.cabinet && (
        <div style={{ fontSize: '5px', color: '#555', lineHeight: '1' }}>{tracker.cabinet}</div>
      )}
    </div>
  );
});

TrackerBlock.displayName = 'TrackerBlock';

function Plant() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [trackers, setTrackers] = useState([]);
  const [selectedTrackers, setSelectedTrackers] = useState(new Set()); // Multi-select
  const [selectionMode, setSelectionMode] = useState(false); // Toggle for selection mode
  const [showStatusRequestModal, setShowStatusRequestModal] = useState(false);
  const [viewMode, setViewMode] = useState('grass_cutting');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [statusRequestForm, setStatusRequestForm] = useState({
    status_type: 'done', // 'done' or 'halfway'
    message: ''
  });
  const saveTimeoutRef = useRef(null);
  const hasLoadedRef = useRef(false);
  const mapContainerRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [currentCycle, setCurrentCycle] = useState(null);
  const [cycleLoading, setCycleLoading] = useState(false);
  const [resettingCycle, setResettingCycle] = useState(false);

  // Load map structure with fallback chain: Server -> localStorage -> empty
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    
    const loadMapStructure = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Try to load from server first (with 5 second timeout)
        const serverPromise = getPlantMapStructure();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Server timeout')), 5000)
        );
        
        let structure = null;
        let loadedFromServer = false;
        let serverHasData = false;
        
        // Try to load from server first
        try {
          const result = await Promise.race([serverPromise, timeoutPromise]);
          if (result && result.structure && Array.isArray(result.structure)) {
            if (result.structure.length > 0) {
              structure = result.structure;
              loadedFromServer = true;
              serverHasData = true;
              console.log('[PLANT] Loaded structure from server:', structure.length, 'trackers');
            } else {
              // Server returned empty array - no data on server
              serverHasData = false;
              console.log('[PLANT] Server returned empty structure');
            }
          }
        } catch (serverError) {
          console.warn('[PLANT] Server load failed or timeout, trying localStorage:', serverError.message);
          serverHasData = false;
        }
        
        // Fallback to localStorage if server doesn't have data
        if (!structure || structure.length === 0) {
          const saved = localStorage.getItem('plantMapPositionsGrid');
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed) && parsed.length > 0) {
                structure = parsed;
                console.log('[PLANT] Loaded structure from localStorage:', structure.length, 'trackers');
              }
            } catch (e) {
              console.error('[PLANT] Error parsing localStorage:', e);
            }
          }
        }
        
        // Process structure
        if (structure && structure.length > 0) {
          // Filter: keep only M## trackers and SITE_OFFICE, remove roads
          const filtered = structure.filter(t => 
            (t.id && t.id.startsWith('M') && /^M\d{2}$/.test(t.id)) || t.id === 'SITE_OFFICE'
          );
          
          // Fix CT numbers
          const fixed = filtered.map(t => {
            if (t.id === 'SITE_OFFICE') return t;
            const correctCT = getCorrectCabinet(t.id);
            return correctCT ? { ...t, cabinet: correctCT } : t;
          });
          
          setTrackers(fixed);
          
          // Save to localStorage as backup
          localStorage.setItem('plantMapPositionsGrid', JSON.stringify(fixed));
          
          // If we have data but server doesn't, save to server immediately
          // This ensures other devices can access it
          if (!serverHasData && fixed.length > 0) {
            console.log('[PLANT] Server has no data, auto-syncing to server...');
            setSaving(true);
            try {
              await savePlantMapStructure(fixed);
              console.log('[PLANT] ✓ Successfully auto-saved to server');
            } catch (err) {
              console.error('[PLANT] ✗ Failed to auto-save to server:', err);
              // Don't show error to user, just log it
            } finally {
              setSaving(false);
            }
          }
        } else {
          console.warn('[PLANT] No structure found, showing empty map');
          setTrackers([]);
        }
      } catch (err) {
        console.error('[PLANT] Error loading map structure:', err);
        setError('Failed to load map structure. Please refresh the page.');
        // Try localStorage as last resort
        const saved = localStorage.getItem('plantMapPositionsGrid');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setTrackers(parsed);
            }
          } catch (e) {
            // Ignore
          }
        }
      } finally {
        setLoading(false);
      }
    };
    
    loadMapStructure();
  }, []);
  const saveToServer = useCallback(async (structureToSave, showSaving = true) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        if (showSaving) setSaving(true);
        await savePlantMapStructure(structureToSave);
        console.log('[PLANT] Structure saved to server successfully');
        // Also update localStorage
        localStorage.setItem('plantMapPositionsGrid', JSON.stringify(structureToSave));
      } catch (err) {
        console.error('[PLANT] Error saving to server:', err);
        // Still save to localStorage as backup
        localStorage.setItem('plantMapPositionsGrid', JSON.stringify(structureToSave));
      } finally {
        if (showSaving) setSaving(false);
      }
    }, 1000); // Debounce 1 second
  }, []);

  // Handle multi-select (works for both desktop and mobile)
  const handleTrackerSelect = useCallback((tracker) => {
    if (tracker.id === 'SITE_OFFICE') return;
    if (!selectionMode) return; // Only allow selection when in selection mode
    
    // Check if tracker is already done (green) - should not be selectable
    const color = viewMode === 'grass_cutting' ? tracker.grassCuttingColor : tracker.panelWashColor;
    const isDone = color === '#90EE90' || color === '#4CAF50';
    
    if (isDone) {
      // Don't allow selection of already completed trackers
      return;
    }
    
    setSelectedTrackers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tracker.id)) {
        newSet.delete(tracker.id);
      } else {
        newSet.add(tracker.id);
      }
      return newSet;
    });
  }, [selectionMode, viewMode]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedTrackers(new Set());
  }, []);

  // Toggle selection mode
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode(prev => {
      if (prev) {
        // Exiting selection mode - clear selection
        setSelectedTrackers(new Set());
      }
      return !prev;
    });
  }, []);

  // Handle status request submission
  const handleSubmitStatusRequest = useCallback(async () => {
    if (selectedTrackers.size === 0) {
      alert('Please select at least one tracker');
      return;
    }

    // Prevent duplicate submissions
    if (submittingRequest) {
      console.log('[PLANT] Submission already in progress, ignoring duplicate request');
      return;
    }

    setSubmittingRequest(true);
    try {
      const response = await submitTrackerStatusRequest({
        tracker_ids: Array.from(selectedTrackers),
        task_type: viewMode,
        status_type: statusRequestForm.status_type,
        message: statusRequestForm.message || null
      });
      
      console.log('[PLANT] Status request submitted successfully:', response.data);
      alert(`Status request submitted successfully! ${selectedTrackers.size} tracker(s) marked as ${statusRequestForm.status_type === 'done' ? 'done' : 'halfway'}. Waiting for admin approval.`);
      setShowStatusRequestModal(false);
      setSelectedTrackers(new Set());
      setStatusRequestForm({ status_type: 'done', message: '' });
    } catch (error) {
      console.error('[PLANT] Error submitting status request:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Failed to submit status request';
      
      // Handle duplicate request error gracefully
      if (error.response?.status === 409) {
        alert(`Request already submitted. ${error.response?.data?.message || 'Please wait a moment before submitting again.'}`);
      } else {
        alert(errorMessage);
      }
    } finally {
      setSubmittingRequest(false);
    }
  }, [selectedTrackers, viewMode, statusRequestForm, submittingRequest]);


  // Calculate bounding box (memoized)
  const bounds = useMemo(() => {
    if (trackers.length === 0) return { minCol: 0, maxCol: 20, minRow: 0, maxRow: 15 };
    const cols = trackers.map(t => t.col);
    const rows = trackers.map(t => t.row);
    return {
      minCol: Math.floor(Math.min(...cols)) - 1,
      maxCol: Math.ceil(Math.max(...cols)) + 2,
      minRow: Math.floor(Math.min(...rows)) - 1,
      maxRow: Math.ceil(Math.max(...rows)) + 2
    };
  }, [trackers]);

  const mapWidth = useMemo(() => (bounds.maxCol - bounds.minCol) * 28 + 10, [bounds]);
  const mapHeight = useMemo(() => (bounds.maxRow - bounds.minRow) * 28 + 10, [bounds]);

  // Calculate progress and statistics for current view mode
  const progress = useMemo(() => {
    const allTrackers = trackers.filter(t => t.id !== 'SITE_OFFICE');
    if (allTrackers.length === 0) return 0;
    
    const doneCount = allTrackers.filter(t => {
      const color = viewMode === 'grass_cutting' ? t.grassCuttingColor : t.panelWashColor;
      // Check for both old and new green colors
      return color === '#90EE90' || color === '#4CAF50';
    }).length;
    
    const halfwayCount = allTrackers.filter(t => {
      const color = viewMode === 'grass_cutting' ? t.grassCuttingColor : t.panelWashColor;
      // Check for both old and new orange colors
      return color === '#FFD700' || color === '#FF9800';
    }).length;
    
    // Progress = (done + halfway * 0.5) / total * 100
    const progressValue = ((doneCount + halfwayCount * 0.5) / allTrackers.length) * 100;
    return Math.min(100, Math.max(0, progressValue));
  }, [trackers, viewMode]);

  // Load cycle information
  useEffect(() => {
    const loadCycleInfo = async () => {
      if (!viewMode) return;
      setCycleLoading(true);
      try {
        const cycleData = await getCycleInfo(viewMode);
        setCurrentCycle(cycleData);
      } catch (error) {
        console.error('[PLANT] Error loading cycle info:', error);
        // Don't show error to user, just log it
      } finally {
        setCycleLoading(false);
      }
    };

    loadCycleInfo();
  }, [viewMode, trackers]); // Reload when viewMode or trackers change

  // Handle cycle reset
  const handleResetCycle = useCallback(async () => {
    if (!isAdmin()) {
      alert('Only administrators can reset cycles');
      return;
    }

    if (!window.confirm(`Are you sure you want to reset the ${viewMode === 'grass_cutting' ? 'Grass Cutting' : 'Panel Wash'} cycle?\n\nThis will:\n- Complete the current cycle\n- Start a new cycle\n- Reset all tracker colors to white\n\nThis action cannot be undone.`)) {
      return;
    }

    setResettingCycle(true);
    try {
      const result = await resetCycle(viewMode);
      alert(`Cycle reset successfully! New cycle: ${result.new_cycle_number}`);
      
      // Reload cycle info and trackers
      const cycleData = await getCycleInfo(viewMode);
      setCurrentCycle(cycleData);
      
      // Reload trackers to reflect reset colors
      const structureResult = await getPlantMapStructure();
      if (structureResult && structureResult.structure) {
        const filtered = structureResult.structure.filter(t => 
          (t.id && t.id.startsWith('M') && /^M\d{2}$/.test(t.id)) || t.id === 'SITE_OFFICE'
        );
        const fixed = filtered.map(t => {
          if (t.id === 'SITE_OFFICE') return t;
          const correctCT = getCorrectCabinet(t.id);
          return correctCT ? { ...t, cabinet: correctCT } : t;
        });
        setTrackers(fixed);
      }
    } catch (error) {
      console.error('[PLANT] Error resetting cycle:', error);
      alert('Failed to reset cycle: ' + (error.response?.data?.error || error.message));
    } finally {
      setResettingCycle(false);
    }
  }, [viewMode, isAdmin]);

  // Calculate detailed statistics for report
  const statistics = useMemo(() => {
    const allTrackers = trackers.filter(t => t.id !== 'SITE_OFFICE');
    if (allTrackers.length === 0) {
      return {
        progress: 0,
        doneCount: 0,
        halfwayCount: 0,
        notDoneCount: 0,
        totalTrackers: 0
      };
    }
    
    const doneCount = allTrackers.filter(t => {
      const color = viewMode === 'grass_cutting' ? t.grassCuttingColor : t.panelWashColor;
      return color === '#90EE90' || color === '#4CAF50';
    }).length;
    
    const halfwayCount = allTrackers.filter(t => {
      const color = viewMode === 'grass_cutting' ? t.grassCuttingColor : t.panelWashColor;
      return color === '#FFD700' || color === '#FF9800';
    }).length;
    
    const notDoneCount = allTrackers.length - doneCount - halfwayCount;
    const progressValue = ((doneCount + halfwayCount * 0.5) / allTrackers.length) * 100;
    
    return {
      progress: Math.min(100, Math.max(0, progressValue)),
      doneCount,
      halfwayCount,
      notDoneCount,
      totalTrackers: allTrackers.length
    };
  }, [trackers, viewMode]);

  // Handle download report
  const handleDownloadReport = useCallback(async () => {
    if (!mapContainerRef.current) {
      alert('Map container not found. Please refresh the page and try again.');
      return;
    }

    if (downloading) {
      return; // Prevent multiple simultaneous downloads
    }

    // Ensure cycle info is loaded before generating PDF
    if (cycleLoading) {
      alert('Please wait for cycle information to load before generating the report.');
      return;
    }

    setDownloading(true);
    try {
      // If cycle info hasn't loaded yet, fetch it now
      let cycleData = currentCycle;
      if (!cycleData) {
        try {
          cycleData = await getCycleInfo(viewMode);
          setCurrentCycle(cycleData);
        } catch (error) {
          console.warn('[PLANT] Could not load cycle info for PDF, continuing without it:', error);
          // Continue without cycle info rather than failing the entire PDF generation
        }
      }

      // Include cycle number in statistics for PDF
      const statsWithCycle = {
        ...statistics,
        cycleNumber: cycleData?.cycle_number || null
      };
      
      await generatePlantMapReport(
        mapContainerRef.current,
        statsWithCycle,
        viewMode
      );
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setDownloading(false);
    }
  }, [mapContainerRef, statistics, viewMode, downloading, currentCycle, cycleLoading]);

  if (loading) {
    return (
      <div className="plant-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading plant map...</div>
      </div>
    );
  }

  if (error && trackers.length === 0) {
    return (
      <div className="plant-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div style={{ fontSize: '18px', color: '#d32f2f', marginBottom: '10px' }}>{error}</div>
        <button 
          onClick={() => { hasLoadedRef.current = false; window.location.reload(); }}
          className="btn btn-primary"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="plant-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      {/* Header */}
      <div style={{ width: '100%', maxWidth: '1200px', marginBottom: '10px' }}>
        <h2 style={{ margin: '0 0 10px 0', textAlign: 'center' }}>Witkop Solar Farm Site Map</h2>
        
        {/* Controls */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          gap: '12px',
          padding: '15px',
          background: '#f5f5f5',
          borderRadius: '8px'
        }}>
          {/* First Row: View, Progress Bar, and Selection Controls */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center',
            alignItems: 'center', 
            gap: '20px', 
            flexWrap: 'wrap'
          }}>
            {/* View and Progress Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontWeight: 'bold', fontSize: '14px' }}>View:</label>
                <select 
                  value={viewMode} 
                  onChange={(e) => setViewMode(e.target.value)}
                  style={{ 
                    padding: '6px 12px', 
                    fontSize: '14px', 
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    cursor: 'pointer'
                  }}
                >
                  <option value="grass_cutting">🌿 Grass Cutting</option>
                  <option value="panel_wash">💧 Panel Wash</option>
                </select>
              </div>
              {/* Progress Bar */}
              <div style={{ width: '250px' }}>
                <div style={{
                  width: '100%',
                  height: '28px',
                  backgroundColor: '#e0e0e0',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  border: '1px solid #ccc',
                  position: 'relative'
                }}>
                  <div style={{
                    width: `${progress}%`,
                    height: '100%',
                    backgroundColor: progress >= 100 ? '#4CAF50' : progress >= 50 ? '#FF9800' : '#f44336',
                    transition: 'width 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    minWidth: progress > 0 ? '50px' : '0'
                  }}>
                    {progress > 0 && `${progress.toFixed(1)}%`}
                  </div>
                  {progress < 15 && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      color: '#666',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      pointerEvents: 'none'
                    }}>
                      {progress.toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Selection Mode Toggle */}
            <button
              onClick={toggleSelectionMode}
              className={selectionMode ? "btn btn-primary" : "btn btn-secondary"}
              style={{ 
                padding: '8px 16px', 
                fontSize: '13px',
                fontWeight: 'bold'
              }}
            >
              {selectionMode ? 'Select' : 'Enable'}
            </button>

            {/* Download Report Button */}
            <button
              onClick={handleDownloadReport}
              className="btn btn-primary"
              disabled={downloading || trackers.length === 0}
              style={{ 
                padding: '8px 16px', 
                fontSize: '13px',
                fontWeight: 'bold'
              }}
              title="Download plant map report with image and statistics"
            >
              {downloading ? 'Generating...' : 'Download'}
            </button>

            {/* Multi-Select Controls */}
            {selectionMode && (
              <div style={{ 
                display: 'flex', 
                gap: '8px', 
                alignItems: 'center',
                padding: '6px 10px',
                background: '#e3f2fd',
                borderRadius: '6px',
                border: '2px solid #2196f3'
              }}>
                {selectedTrackers.size > 0 ? (
                  <>
                    <span style={{ fontWeight: 'bold', color: '#1976d2', fontSize: '12px' }}>
                      {selectedTrackers.size} selected
                    </span>
                    <button
                      onClick={() => setShowStatusRequestModal(true)}
                      className="btn btn-primary"
                      style={{ 
                        padding: '5px 12px', 
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}
                    >
                      Status
                    </button>
                    <button
                      onClick={clearSelection}
                      className="btn btn-secondary"
                      style={{ 
                        padding: '5px 12px', 
                        fontSize: '12px'
                      }}
                    >
                      Clear
                    </button>
                  </>
                ) : (
                  <span style={{ color: '#666', fontSize: '12px' }}>
                    Tap trackers to select
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Second Row: Legend */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center',
            gap: '16px', 
            alignItems: 'center', 
            fontSize: '12px',
            paddingTop: '8px',
            borderTop: '1px solid #ddd'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '14px', height: '14px', background: '#fff', border: '1px solid #333', borderRadius: '2px' }}></span>
              Not Done
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '14px', height: '14px', background: '#4CAF50', border: '1px solid #333', borderRadius: '2px' }}></span>
              Done
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '14px', height: '14px', background: '#FF9800', border: '1px solid #333', borderRadius: '2px' }}></span>
              Halfway
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '14px', height: '14px', background: '#4169E1', border: '1px solid #333', borderRadius: '2px' }}></span>
              Site Office
            </span>
          </div>
        </div>
      </div>

      {/* Map Container - Centered */}
      <div 
        style={{ 
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          padding: '10px'
        }}
      >
        <div 
          ref={mapContainerRef}
          style={{
            position: 'relative',
            width: `${mapWidth}px`,
            height: `${mapHeight}px`,
            background: '#fafafa',
            border: '2px solid #333',
            borderRadius: '4px'
          }}
        >
          {/* Trackers */}
          {trackers.map((tracker) => (
            <TrackerBlock
              key={tracker.id}
              tracker={tracker}
              bounds={bounds}
              viewMode={viewMode}
              isSelected={selectedTrackers.has(tracker.id)}
              onSelect={handleTrackerSelect}
              selectionMode={selectionMode}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '10px', fontSize: '12px', color: '#666', textAlign: 'center' }}>
        <div style={{ marginBottom: '8px' }}>
          Trackers: {trackers.filter(t => t.id !== 'SITE_OFFICE').length}
          {selectionMode && ` | ${selectedTrackers.size} selected`}
          {currentCycle && currentCycle.cycle_number && (
            <span style={{ color: '#4CAF50', fontWeight: 'bold', marginLeft: '8px' }}>
              | Cycle: {currentCycle.cycle_number}
            </span>
          )}
          {currentCycle && (!currentCycle.cycle_number || currentCycle.cycle_number === null) && (
            <span style={{ color: '#999', fontWeight: 'normal', marginLeft: '8px' }}>
              | Cycle: Not Started
            </span>
          )}
        </div>
        
        {/* Cycle completion indicator and reset button */}
        {currentCycle && currentCycle.is_complete && (
          <div style={{ 
            marginTop: '8px', 
            padding: '8px 12px', 
            backgroundColor: '#4CAF50', 
            color: 'white', 
            borderRadius: '4px',
            display: 'inline-block',
            fontSize: '13px',
            fontWeight: '500'
          }}>
            ✓ Cycle {currentCycle.cycle_number} Completed! 
            {isAdmin() && (
              <button
                onClick={handleResetCycle}
                disabled={resettingCycle}
                style={{
                  marginLeft: '12px',
                  padding: '4px 12px',
                  backgroundColor: 'white',
                  color: '#4CAF50',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: resettingCycle ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  opacity: resettingCycle ? 0.6 : 1
                }}
              >
                {resettingCycle ? 'Resetting...' : 'Reset Cycle'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Status Request Modal */}
      {showStatusRequestModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => !submittingRequest && setShowStatusRequestModal(false)}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '30px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ margin: '0 0 10px 0', color: '#1976d2' }}>
                Update Status
              </h2>
              <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
                You've selected <strong>{selectedTrackers.size}</strong> tracker(s) for <strong>{viewMode === 'grass_cutting' ? 'Grass Cutting' : 'Panel Wash'}</strong>
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                Status Type *
              </label>
              <select
                value={statusRequestForm.status_type}
                onChange={(e) => setStatusRequestForm({ ...statusRequestForm, status_type: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '14px',
                  border: '2px solid #ddd',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
                disabled={submittingRequest}
              >
                <option value="done">✅ Done (Completed)</option>
                <option value="halfway">🔄 Halfway (In Progress)</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                Message (Optional)
              </label>
              <textarea
                value={statusRequestForm.message}
                onChange={(e) => setStatusRequestForm({ ...statusRequestForm, message: e.target.value })}
                placeholder="Add any notes or comments about this status update..."
                rows="4"
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '14px',
                  border: '2px solid #ddd',
                  borderRadius: '6px',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
                disabled={submittingRequest}
              />
            </div>

            <div style={{ 
              padding: '12px', 
              background: '#fff3cd', 
              borderRadius: '6px', 
              marginBottom: '20px',
              border: '1px solid #ffc107'
            }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#856404' }}>
                ⚠️ <strong>Note:</strong> Your request will be sent to admin/superadmin for approval. 
                The tracker colors will only change after approval.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowStatusRequestModal(false);
                  setStatusRequestForm({ status_type: 'done', message: '' });
                }}
                className="btn btn-secondary"
                disabled={submittingRequest}
                style={{ padding: '10px 20px', fontSize: '14px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitStatusRequest}
                className="btn btn-primary"
                disabled={submittingRequest}
                style={{ padding: '10px 20px', fontSize: '14px', fontWeight: 'bold' }}
              >
                {submittingRequest ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Plant;
