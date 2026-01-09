import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTask, submitChecklistResponse, saveDraftResponse, getDraftResponse, deleteDraftResponse, getInventoryItems } from '../api/api';

function ChecklistForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [metadata, setMetadata] = useState({
    maintenance_team: '',
    inspected_by: '',
    approved_by: ''
  });
  // Store images for failed items.
  // Key format: `${sectionId}_${itemId}`
  // Value: { file?, comment?, preview?, uploaded? { id, image_path, image_filename }, uploadedAt? }
  const [itemImages, setItemImages] = useState({});
  const [sparesUsed, setSparesUsed] = useState([]); // [{ item_code, qty_used }]
  const [inventoryOptions, setInventoryOptions] = useState([]);
  const [sparesSearchQuery, setSparesSearchQuery] = useState('');
  const [filteredInventoryOptions, setFilteredInventoryOptions] = useState([]);
  const [autoSaveStatus, setAutoSaveStatus] = useState(''); // 'saving', 'saved', 'error'
  const autoSaveTimeoutRef = useRef(null);
  const lastSavedRef = useRef(null);
  const sparesSearchDebounceRef = useRef(null);
  // Unplanned CM time fields
  const [cmOccurredAt, setCmOccurredAt] = useState('');
  const [cmStartedAt, setCmStartedAt] = useState('');
  const [cmCompletedAt, setCmCompletedAt] = useState('');

  useEffect(() => {
    loadTaskAndDraft();
    loadInventoryOptions();

    // Auto-save on unmount + on mobile pagehide
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleAutoSave();
      }
    };
    const onPageHide = () => handleAutoSave();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
      handleAutoSave();
    };
  }, [id]);

  const loadInventoryOptions = async (searchQuery) => {
    try {
      const query = searchQuery?.trim() || undefined;
      const resp = await getInventoryItems({ q: query });
      const items = resp.data || [];
      setInventoryOptions(items);
      setFilteredInventoryOptions(items);
    } catch (e) {
      // inventory is optional; don't block checklist
      console.log('Inventory not available:', e?.message);
    }
  };

  // Debounced search for spares (same as Inventory component)
  useEffect(() => {
    if (sparesSearchDebounceRef.current) clearTimeout(sparesSearchDebounceRef.current);
    sparesSearchDebounceRef.current = setTimeout(() => {
      loadInventoryOptions(sparesSearchQuery);
    }, 450);

    return () => {
      if (sparesSearchDebounceRef.current) clearTimeout(sparesSearchDebounceRef.current);
    };
  }, [sparesSearchQuery]);

  // Auto-save function
  const handleAutoSave = useCallback(async () => {
    if (!task || !task.checklist_template_id) return;

    // Skip if nothing has changed
    const currentState = JSON.stringify({ formData, metadata, images: itemImages, sparesUsed });
    if (currentState === lastSavedRef.current) return;

    try {
      setAutoSaveStatus('saving');
      await saveDraftResponse({
        task_id: id,
        checklist_template_id: task.checklist_template_id || task.id,
        response_data: formData,
        maintenance_team: metadata.maintenance_team,
        inspected_by: metadata.inspected_by,
        approved_by: metadata.approved_by,
        images: itemImages,
        spares_used: sparesUsed
      });
      lastSavedRef.current = currentState;
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus(''), 2000); // Clear status after 2 seconds
    } catch (error) {
      console.error('Auto-save error:', error);
      setAutoSaveStatus('error');
      setTimeout(() => setAutoSaveStatus(''), 3000);
    }
  }, [formData, metadata, itemImages, sparesUsed, task, id]);

  // Debounced auto-save
  useEffect(() => {
    if (!task) return;

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for auto-save (3 seconds after last change)
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleAutoSave();
    }, 3000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [formData, metadata, handleAutoSave, task]);

  const mergeDeep = (base, override) => {
    if (!override) return base;
    if (Array.isArray(base) || Array.isArray(override)) return override ?? base;
    if (typeof base !== 'object' || base === null) return override ?? base;
    const out = { ...base };
    for (const key of Object.keys(override)) {
      const ov = override[key];
      if (ov && typeof ov === 'object' && !Array.isArray(ov)) {
        out[key] = mergeDeep(base[key] || {}, ov);
      } else {
        out[key] = ov;
      }
    }
    return out;
  };

  const loadTaskAndDraft = async () => {
    try {
      const response = await getTask(id);
      setTask(response.data);
      
      // Initialize form data structure
      // checklist_structure comes from the checklist_templates table joined to the task
      const checklistStructure = response.data.checklist_structure;
      if (checklistStructure && checklistStructure.sections) {
        const initialData = {};
        checklistStructure.sections.forEach((section) => {
          initialData[section.id] = {};
          section.items.forEach((item) => {
            if (item.type === 'checkbox') {
              initialData[section.id][item.id] = false;
            } else if (item.type === 'pass_fail' || item.type === 'pass_fail_with_measurement') {
              // Initialize pass_fail items with status and observations
              initialData[section.id][item.id] = {
                status: '', // 'pass' or 'fail'
                observations: '',
                ...(item.measurement_fields ? 
                  item.measurement_fields.reduce((acc, field) => {
                    acc[field.id] = '';
                    return acc;
                  }, {}) : {})
              };
            } else {
              initialData[section.id][item.id] = '';
            }
          });
        });

        // Load draft AFTER we have initial structure, and merge it on top
        try {
          const draft = await getDraftResponse(id);
          const draftResponseData = draft?.response_data || {};
          setFormData(mergeDeep(initialData, draftResponseData));
          setMetadata({
            maintenance_team: draft?.maintenance_team || '',
            inspected_by: draft?.inspected_by || '',
            approved_by: draft?.approved_by || ''
          });
          // Restore uploaded image references (if any) without requiring re-select
          if (draft?.images && typeof draft.images === 'object') {
            setItemImages(draft.images);
          }
          if (Array.isArray(draft?.spares_used)) {
            setSparesUsed(draft.spares_used);
          }
          lastSavedRef.current = JSON.stringify({ formData: mergeDeep(initialData, draftResponseData), metadata: {
            maintenance_team: draft?.maintenance_team || '',
            inspected_by: draft?.inspected_by || '',
            approved_by: draft?.approved_by || ''
          }});
          console.log('Draft loaded and merged successfully');
        } catch (e) {
          setFormData(initialData);
          console.log('No draft found, starting fresh');
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading task:', error);
      setLoading(false);
    }
  };

  const handleInputChange = (sectionId, itemId, value, subField = null) => {
    setFormData((prev) => {
      const sectionData = prev[sectionId] || {};
      const itemData = sectionData[itemId] || {};
      
      if (subField) {
        // For measurement fields or observations
        return {
          ...prev,
          [sectionId]: {
            ...sectionData,
            [itemId]: {
              ...itemData,
              [subField]: value,
            },
          },
        };
      } else {
        // For main field value
        return {
          ...prev,
          [sectionId]: {
            ...sectionData,
            [itemId]: value,
          },
        };
      }
    });
    // Clear error for this field
    const errorKey = subField ? `${itemId}_${subField}` : itemId;
    if (errors[errorKey]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };

  const handleImageUpload = async (sectionId, itemId, file, comment) => {
    if (!file) return null;

    const formData = new FormData();
    formData.append('image', file);
    formData.append('task_id', id);
    formData.append('item_id', itemId);
    formData.append('section_id', sectionId);
    if (comment) formData.append('comment', comment);

    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL ||
        `${window.location.protocol}//${window.location.hostname}:3001/api`;
      
      const response = await fetch(`${API_BASE_URL}/upload/failed-item`, {
        method: 'POST',
        body: formData,
        credentials: 'include' // keep session on mobile/desktop
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      return { ...data, sectionId, itemId };
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});

    // Validate metadata
    if (!metadata.inspected_by) {
      alert('Please enter the name of the person who inspected (Inspected By)');
      setSubmitting(false);
      return;
    }

    try {
      // Upload any pending images (we also upload immediately on selection; this is a safety net)
      const imageUploads = [];
      for (const [key, imageData] of Object.entries(itemImages)) {
        // Already uploaded
        if (imageData?.uploaded?.image_path) {
          imageUploads.push({
            ...imageData.uploaded,
            sectionId: key.split('_')[0],
            itemId: key.split('_')[1],
            comment: imageData.comment || ''
          });
          continue;
        }

        // Needs upload
        if (imageData?.file) {
          const [sectionId, itemId] = key.split('_');
          const uploadResult = await handleImageUpload(sectionId, itemId, imageData.file, imageData.comment);
          if (uploadResult) {
            imageUploads.push(uploadResult);
          }
        }
      }

      // For UCM tasks, include time fields
      const submitData = {
        task_id: id,
        checklist_template_id: task.checklist_template_id || task.id,
        response_data: formData,
        submitted_by: task.assigned_to || null,
        maintenance_team: metadata.maintenance_team,
        inspected_by: metadata.inspected_by,
        approved_by: metadata.approved_by,
        images: imageUploads,
        spares_used: sparesUsed
      };

      // Add UCM time fields if task type is UCM
      if (task.task_type === 'UCM') {
        if (cmOccurredAt) submitData.cm_occurred_at = cmOccurredAt;
        if (cmStartedAt) submitData.started_at = cmStartedAt;
        if (cmCompletedAt) submitData.completed_at = cmCompletedAt;
      }

      const response = await submitChecklistResponse(submitData);

      if (response.data.validation && !response.data.validation.isValid) {
        // Show validation errors
        const validationErrors = {};
        response.data.validation.errors.forEach((error) => {
          validationErrors[error.itemId] = error.error;
        });
        setErrors(validationErrors);
        alert('Validation failed. Please check the form and fix errors.');
      } else {
        // Delete draft after successful submission
        try {
          await deleteDraftResponse(id);
        } catch (error) {
          console.error('Error deleting draft:', error);
        }
        
        const overallStatus = response.data.validation.overallStatus.toUpperCase();
        const message = `Checklist submitted successfully!\n\nOverall Status: ${overallStatus}\n\nYou can now download the PDF report from the Task Details page.`;
        alert(message);
        navigate(`/tasks/${id}`);
      }
    } catch (error) {
      console.error('Error submitting checklist:', error);
      console.error('Error response:', error.response);
      
      if (error.response && error.response.data) {
        // Handle validation errors
        if (error.response.data.details && Array.isArray(error.response.data.details)) {
          const validationErrors = {};
          error.response.data.details.forEach((err) => {
            validationErrors[err.itemId] = err.error;
          });
          setErrors(validationErrors);
          alert(`Validation failed. Please check the highlighted items.`);
        } else {
          // Handle other errors
          const errorMessage = error.response.data.error || error.response.data.details || 'Failed to submit checklist';
          alert(`Error: ${errorMessage}`);
        }
      } else {
        // Network or other errors
        alert(`Failed to submit checklist: ${error.message || 'Network error. Please check your connection.'}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading checklist...</div>;
  }

  if (!task) {
    return <div>Task not found</div>;
  }

  const checklistStructure = task.checklist_structure;
  if (!checklistStructure || !checklistStructure.sections) {
    return <div>Checklist template structure not found</div>;
  }

  const renderItem = (sectionId, item) => {
    const value = formData[sectionId]?.[item.id];
    const error = errors[item.id];

    switch (item.type) {
      case 'checkbox':
        return (
          <div className="checkbox-group" key={item.id}>
            <label>
              <input
                type="checkbox"
                checked={value || false}
                onChange={(e) => handleInputChange(sectionId, item.id, e.target.checked)}
              />
              <span className={item.required ? 'item-label required' : 'item-label'}>
                {item.label}
              </span>
            </label>
            {error && <div className="error">{error}</div>}
          </div>
        );

      case 'radio':
        return (
          <div className="radio-group" key={item.id}>
            <div className={item.required ? 'item-label required' : 'item-label'}>
              {item.label}
            </div>
            {item.options && item.options.map((option) => (
              <label key={option}>
                <input
                  type="radio"
                  name={`${sectionId}_${item.id}`}
                  value={option}
                  checked={value === option}
                  onChange={(e) => handleInputChange(sectionId, item.id, e.target.value)}
                />
                {option}
              </label>
            ))}
            {error && <div className="error">{error}</div>}
          </div>
        );

      case 'pass_fail':
      case 'pass_fail_with_measurement':
        const itemValue = value || { status: '', observations: '' };
        return (
          <div className="form-group" key={item.id} style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '4px' }}>
            <div className={item.required ? 'item-label required' : 'item-label'} style={{ marginBottom: '10px' }}>
              {item.label}
            </div>
            
            {/* Pass/Fail Radio Buttons */}
            <div className="radio-group" style={{ marginBottom: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <label style={{ marginRight: '20px', flex: '1', minWidth: '120px', padding: '12px', border: '1px solid #ddd', borderRadius: '4px', background: itemValue.status === 'pass' ? '#d4edda' : 'white', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={`${sectionId}_${item.id}_status`}
                  value="pass"
                  checked={itemValue.status === 'pass'}
                  onChange={(e) => handleInputChange(sectionId, item.id, e.target.value, 'status')}
                  style={{ marginRight: '8px' }}
                />
                <span style={{ color: '#28a745', fontWeight: 'bold' }}>✓ Pass</span>
              </label>
              <label style={{ flex: '1', minWidth: '120px', padding: '12px', border: '1px solid #ddd', borderRadius: '4px', background: itemValue.status === 'fail' ? '#f8d7da' : 'white', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={`${sectionId}_${item.id}_status`}
                  value="fail"
                  checked={itemValue.status === 'fail'}
                  onChange={(e) => handleInputChange(sectionId, item.id, e.target.value, 'status')}
                  style={{ marginRight: '8px' }}
                />
                <span style={{ color: '#dc3545', fontWeight: 'bold' }}>✗ Fail</span>
              </label>
            </div>

            {/* Measurement Fields (for pass_fail_with_measurement) */}
            {item.measurement_fields && item.measurement_fields.map((field) => (
              <div key={field.id} style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                  {field.label} {field.required && <span style={{ color: 'red' }}>*</span>}
                </label>
                <input
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={itemValue[field.id] || ''}
                  onChange={(e) => handleInputChange(sectionId, item.id, e.target.value, field.id)}
                  style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
                  step={field.type === 'number' ? '0.01' : undefined}
                />
              </div>
            ))}

            {/* Observations Field */}
            {item.has_observations && (
              <div style={{ marginTop: '10px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                  Observations
                </label>
                <textarea
                  value={itemValue.observations || ''}
                  onChange={(e) => handleInputChange(sectionId, item.id, e.target.value, 'observations')}
                  placeholder="Enter observations or notes..."
                  style={{ width: '100%', minHeight: '60px', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
            )}

            {/* Image Upload for Failed Items */}
            {itemValue.status === 'fail' && (
              <div style={{ marginTop: '15px', padding: '15px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>
                  📷 Upload Image for Failed Item (Required for CM)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onClick={() => {
                    // Save draft before opening camera/gallery (mobile can unload the page)
                    handleAutoSave();
                  }}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const key = `${sectionId}_${item.id}`;
                      const previewUrl = URL.createObjectURL(file);

                      // Optimistic update for preview
                      setItemImages(prev => ({
                        ...prev,
                        [key]: {
                          ...prev[key],
                          file,
                          preview: previewUrl
                        }
                      }));

                      // Upload immediately so a refresh/camera return won't lose it
                      (async () => {
                        const uploadResult = await handleImageUpload(sectionId, item.id, file, itemImages[key]?.comment || '');
                        if (uploadResult) {
                          setItemImages(prev => ({
                            ...prev,
                            [key]: {
                              ...prev[key],
                              uploaded: {
                                id: uploadResult.id,
                                image_path: uploadResult.image_path,
                                image_filename: uploadResult.image_filename
                              },
                              uploadedAt: new Date().toISOString()
                            }
                          }));
                          // Save draft after upload so it's recoverable on mobile
                          handleAutoSave();
                        }
                      })();
                    }
                  }}
                  style={{ marginBottom: '10px', width: '100%' }}
                />
                {itemImages[`${sectionId}_${item.id}`]?.preview && (
                  <div style={{ marginBottom: '10px' }}>
                    <img 
                      src={itemImages[`${sectionId}_${item.id}`].preview} 
                      alt="Preview" 
                      style={{ maxWidth: '100%', maxHeight: '200px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                  </div>
                )}
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                  Comment for this failure:
                </label>
                <textarea
                  value={itemImages[`${sectionId}_${item.id}`]?.comment || ''}
                  onChange={(e) => {
                    setItemImages(prev => ({
                      ...prev,
                      [`${sectionId}_${item.id}`]: {
                        ...prev[`${sectionId}_${item.id}`],
                        comment: e.target.value
                      }
                    }));
                  }}
                  placeholder="Describe the issue or failure..."
                  style={{ width: '100%', minHeight: '60px', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
            )}

            {error && <div className="error">{error}</div>}
          </div>
        );

      case 'text':
        return (
          <div className="form-group" key={item.id}>
            <label className={item.required ? 'item-label required' : 'item-label'}>
              {item.label}
            </label>
            <input
              type="text"
              value={value || ''}
              onChange={(e) => handleInputChange(sectionId, item.id, e.target.value)}
            />
            {error && <div className="error">{error}</div>}
          </div>
        );

      case 'textarea':
        return (
          <div className="form-group" key={item.id}>
            <label className={item.required ? 'item-label required' : 'item-label'}>
              {item.label}
            </label>
            <textarea
              value={value || ''}
              onChange={(e) => handleInputChange(sectionId, item.id, e.target.value)}
              placeholder={item.placeholder || ''}
            />
            {error && <div className="error">{error}</div>}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <button className="btn btn-secondary" onClick={() => navigate(`/tasks/${id}`)}>
          ← Back to Task
        </button>
      </div>

      <div className="card">
        <h2>{task.template_name || 'Checklist'}</h2>
        
        {/* Auto-save status indicator */}
        {autoSaveStatus && (
          <div style={{ 
            marginBottom: '15px', 
            padding: '8px 15px', 
            borderRadius: '4px',
            fontSize: '14px',
            background: autoSaveStatus === 'saving' ? '#fff3cd' : 
                        autoSaveStatus === 'saved' ? '#d4edda' : '#f8d7da',
            color: autoSaveStatus === 'saving' ? '#856404' : 
                   autoSaveStatus === 'saved' ? '#155724' : '#721c24',
            border: `1px solid ${autoSaveStatus === 'saving' ? '#ffc107' : 
                                autoSaveStatus === 'saved' ? '#28a745' : '#dc3545'}`
          }}>
            {autoSaveStatus === 'saving' && '💾 Saving draft...'}
            {autoSaveStatus === 'saved' && '✓ Draft saved'}
            {autoSaveStatus === 'error' && '⚠ Error saving draft'}
          </div>
        )}

        <div style={{ marginBottom: '15px', padding: '15px', background: '#e7f3ff', borderRadius: '4px', border: '2px solid #007bff' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginBottom: '10px' }}>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <p style={{ marginBottom: '5px', fontSize: '12px', color: '#666' }}>TASK CODE</p>
              <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{task.task_code}</p>
            </div>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <p style={{ marginBottom: '5px', fontSize: '12px', color: '#666' }}>ASSET</p>
              <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#007bff' }}>
                {task.asset_name}
                {task.asset_code && <span style={{ fontSize: '14px', color: '#666' }}> ({task.asset_code})</span>}
              </p>
            </div>
            {task.location && (
              <div style={{ flex: '1', minWidth: '200px' }}>
                <p style={{ marginBottom: '5px', fontSize: '12px', color: '#666' }}>LOCATION</p>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{task.location}</p>
              </div>
            )}
          </div>
          
          {/* Inspector and metadata at the top */}
          <div style={{ 
            marginTop: '15px', 
            padding: '12px', 
            background: '#ffffff', 
            borderRadius: '4px',
            border: '1px solid #dee2e6'
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
              {metadata.inspected_by && (
                <div>
                  <span style={{ fontSize: '12px', color: '#666', marginRight: '5px' }}>Inspected By:</span>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#28a745' }}>{metadata.inspected_by}</span>
                </div>
              )}
              {metadata.approved_by && (
                <div>
                  <span style={{ fontSize: '12px', color: '#666', marginRight: '5px' }}>Approved By:</span>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#007bff' }}>{metadata.approved_by}</span>
                </div>
              )}
              {metadata.maintenance_team && (
                <div>
                  <span style={{ fontSize: '12px', color: '#666', marginRight: '5px' }}>Team:</span>
                  <span style={{ fontSize: '14px' }}>{metadata.maintenance_team}</span>
                </div>
              )}
            </div>
          </div>

          <p style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
            <strong>Task Type:</strong> {task.task_type} | <strong>Asset Type:</strong> {task.asset_type || 'asset'}
          </p>
        </div>

        {/* UCM Time Fields */}
        {task.task_type === 'UCM' && (
          <div className="section" style={{ marginTop: '20px', marginBottom: '20px', background: '#fff3cd', borderLeft: '4px solid #ffc107' }}>
            <div className="section-title" style={{ color: '#856404' }}>UCM Time Information</div>
            <p style={{ marginTop: 0, color: '#856404', fontSize: '14px' }}>
              Please provide the times for when the CM issue occurred, when you started the task, and when you finished.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginTop: '15px' }}>
              <div className="form-group">
                <label>CM Issue Occurred At *</label>
                <input
                  type="datetime-local"
                  value={cmOccurredAt}
                  onChange={(e) => setCmOccurredAt(e.target.value)}
                  required
                  style={{ width: '100%', padding: '12px 16px', fontSize: '16px', border: '2px solid #ddd', borderRadius: '6px' }}
                />
                <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  When did the issue occur?
                </small>
              </div>
              <div className="form-group">
                <label>Task Started At *</label>
                <input
                  type="datetime-local"
                  value={cmStartedAt}
                  onChange={(e) => setCmStartedAt(e.target.value)}
                  required
                  style={{ width: '100%', padding: '12px 16px', fontSize: '16px', border: '2px solid #ddd', borderRadius: '6px' }}
                />
                <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  When did you start working on this task?
                </small>
              </div>
              <div className="form-group">
                <label>Task Completed At *</label>
                <input
                  type="datetime-local"
                  value={cmCompletedAt}
                  onChange={(e) => setCmCompletedAt(e.target.value)}
                  required
                  style={{ width: '100%', padding: '12px 16px', fontSize: '16px', border: '2px solid #ddd', borderRadius: '6px' }}
                />
                <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  When did you finish this task?
                </small>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ marginTop: '30px' }}>
          {checklistStructure.sections.map((section) => (
            <div className="section" key={section.id}>
              <div className="section-title">{section.title}</div>
              {section.items.map((item) => renderItem(section.id, item))}
            </div>
          ))}

          {/* Spares Used */}
          <div className="section" style={{ marginTop: '30px', background: '#f9f9f9', borderLeft: '4px solid #6c757d' }}>
            <div className="section-title">Spares Used (Inventory)</div>
            <p style={{ marginTop: 0, color: '#666', fontSize: '14px' }}>
              Optional: add spares used during this task. On submit, stock is deducted and a usage slip is recorded for audit.
            </p>

            {inventoryOptions.length === 0 ? (
              <p style={{ color: '#666' }}>Inventory list not loaded (optional).</p>
            ) : (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <input
                    type="text"
                    value={sparesSearchQuery}
                    onChange={(e) => setSparesSearchQuery(e.target.value)}
                    placeholder="Search by section number or description..."
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '16px',
                      border: '2px solid #ddd',
                      borderRadius: '6px',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#007bff'}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#ddd'}
                  />
                </div>
                {sparesUsed.map((line, idx) => (
                  <div key={idx} className="spare-item-row" style={{ 
                    display: 'flex', 
                    gap: '10px', 
                    flexWrap: 'wrap', 
                    alignItems: 'flex-start', 
                    marginBottom: '15px',
                    padding: '12px',
                    background: '#fff',
                    borderRadius: '8px',
                    border: '1px solid #ddd'
                  }}>
                    <select
                      value={line.item_code || ''}
                      onChange={(e) => {
                        const next = [...sparesUsed];
                        next[idx] = { ...next[idx], item_code: e.target.value };
                        setSparesUsed(next);
                      }}
                      className="spare-select"
                      style={{ 
                        flex: '1 1 100%',
                        minWidth: '200px',
                        padding: '10px 12px',
                        fontSize: '14px',
                        border: '2px solid #ddd',
                        borderRadius: '6px',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#007bff'}
                      onBlur={(e) => e.currentTarget.style.borderColor = '#ddd'}
                    >
                      <option value="">Select spare...</option>
                      {filteredInventoryOptions.map((it) => {
                        // Extract subtitle part (before " | ") for display, same as Inventory component
                        const fullSection = String(it.section || '').trim();
                        const section = fullSection.includes(' | ') 
                          ? fullSection.split(' | ')[0].trim() 
                          : fullSection;
                        return (
                          <option key={it.id} value={it.item_code}>
                            {section ? `${section} - ` : ''}{it.item_description || it.item_code} (Qty: {it.actual_qty})
                          </option>
                        );
                      })}
                    </select>
                    <div style={{ display: 'flex', gap: '8px', flex: '1 1 auto', minWidth: '150px' }}>
                      <input
                        type="number"
                        min="1"
                        value={line.qty_used || ''}
                        onChange={(e) => {
                          const next = [...sparesUsed];
                          next[idx] = { ...next[idx], qty_used: e.target.value };
                          setSparesUsed(next);
                        }}
                        placeholder="Qty"
                        className="spare-qty-input"
                        style={{ 
                          flex: '1',
                          padding: '10px 12px',
                          fontSize: '14px',
                          border: '2px solid #ddd',
                          borderRadius: '6px',
                          outline: 'none',
                          transition: 'border-color 0.2s',
                          minWidth: '80px'
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = '#007bff'}
                        onBlur={(e) => e.currentTarget.style.borderColor = '#ddd'}
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-danger spare-remove-btn"
                        onClick={() => setSparesUsed(sparesUsed.filter((_, i) => i !== idx))}
                        style={{
                          padding: '10px 16px',
                          fontSize: '12px',
                          whiteSpace: 'nowrap',
                          minWidth: 'auto'
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSparesUsed([...sparesUsed, { item_code: '', qty_used: '' }])}
                >
                  + Add Spare Used
                </button>
              </>
            )}
          </div>

          {/* Metadata Section */}
          <div className="section" style={{ marginTop: '30px', background: '#f0f8ff', borderLeft: '4px solid #007bff' }}>
            <div className="section-title">Inspection Information</div>
            
            <div className="form-group">
              <label>
                Maintenance Team <span style={{ fontSize: '12px', color: '#666' }}>(Optional)</span>
              </label>
              <input
                type="text"
                value={metadata.maintenance_team}
                onChange={(e) => setMetadata({ ...metadata, maintenance_team: e.target.value })}
                placeholder="Enter maintenance team name(s)"
              />
            </div>

            <div className="form-group">
              <label>
                Inspected By (Technician) <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                value={metadata.inspected_by}
                onChange={(e) => setMetadata({ ...metadata, inspected_by: e.target.value })}
                placeholder="Enter technician name"
                required
              />
            </div>

            <div className="form-group">
              <label>
                Approved By (Supervisor/Manager) <span style={{ fontSize: '12px', color: '#666' }}>(Optional)</span>
              </label>
              <input
                type="text"
                value={metadata.approved_by}
                onChange={(e) => setMetadata({ ...metadata, approved_by: e.target.value })}
                placeholder="Enter supervisor/manager name"
              />
            </div>
          </div>

          <div style={{ marginTop: '30px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Checklist'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate(`/tasks/${id}`)}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ChecklistForm;

