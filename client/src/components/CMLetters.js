import React, { useState, useEffect } from 'react';
import { getCMLetters, getCMLetter, updateCMLetterStatus, getApiBaseUrl } from '../api/api';

function CMLetters() {
  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '' });
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [letterDetails, setLetterDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [expandedLetters, setExpandedLetters] = useState(new Set());
  const [viewingImage, setViewingImage] = useState(null);

  useEffect(() => {
    loadCMLetters();
  }, [filter]);

  const loadCMLetters = async () => {
    try {
      const params = {};
      if (filter.status) params.status = filter.status;
      
      const response = await getCMLetters(params);
      setLetters(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading CM letters:', error);
      setLoading(false);
    }
  };

  const loadLetterDetails = async (letterId) => {
    if (expandedLetters.has(letterId)) {
      // Already expanded, just toggle
      setExpandedLetters(prev => {
        const next = new Set(prev);
        next.delete(letterId);
        return next;
      });
      setLetterDetails(null);
      return;
    }

    setLoadingDetails(true);
    try {
      const response = await getCMLetter(letterId);
      setLetterDetails(response.data);
      setExpandedLetters(prev => new Set(prev).add(letterId));
    } catch (error) {
      console.error('Error loading CM letter details:', error);
      alert('Failed to load CM letter details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) {
      console.warn('getImageUrl: No imagePath provided');
      return null;
    }
    
    // If it's already a full URL, return it
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    // Handle different path formats:
    // - "/uploads/filename.jpg" -> extract "filename.jpg"
    // - "uploads/filename.jpg" -> extract "filename.jpg"
    // - "filename.jpg" -> use as-is
    let filename = imagePath;
    
    if (imagePath.includes('/')) {
      // Extract filename from path (handles both "/uploads/filename.jpg" and "uploads/filename.jpg")
      filename = imagePath.split('/').pop();
    }
    
    // Remove any leading/trailing whitespace
    filename = filename.trim();
    
    // Construct URL - server serves static files from /uploads directory
    // The API base URL is like "http://hostname:3001/api", we need "http://hostname:3001"
    const apiBase = getApiBaseUrl().replace('/api', '');
    const imageUrl = `${apiBase}/uploads/${filename}`;
    
    console.log('getImageUrl:', { imagePath, filename, imageUrl, apiBase });
    return imageUrl;
  };

  const handleStatusUpdate = async (letterId, newStatus) => {
    try {
      await updateCMLetterStatus(letterId, { status: newStatus });
      loadCMLetters();
      // Reload details if this letter is expanded
      if (expandedLetters.has(letterId)) {
        loadLetterDetails(letterId);
      }
    } catch (error) {
      console.error('Error updating CM letter status:', error);
      alert('Failed to update CM letter status');
    }
  };

  const parseJsonField = (field) => {
    if (!field) return null;
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch {
        return null;
      }
    }
    return field;
  };

  if (loading) {
    return <div className="loading">Loading CM letters...</div>;
  }

  return (
    <div>
      <h2>Corrective Maintenance Letters</h2>
      
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="form-group">
          <label>Filter by Status</label>
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      <div className="card">
        {letters.length === 0 ? (
          <p>No CM letters found</p>
        ) : (
          <div>
            {letters.map((letter) => {
              const isExpanded = expandedLetters.has(letter.id);
              const details = isExpanded && letterDetails && letterDetails.id === letter.id ? letterDetails : null;
              
              // Parse images from JSONB field - handle both string and object formats
              let images = [];
              const imagesData = details?.images || letter.images;
              
              if (imagesData) {
                const parsed = parseJsonField(imagesData);
                if (Array.isArray(parsed)) {
                  images = parsed.filter(img => img && (img.path || img.image_path || img.filename || img.image_filename));
                } else if (parsed && typeof parsed === 'object') {
                  // If it's a single object, wrap it in an array
                  if (parsed.path || parsed.image_path || parsed.filename || parsed.image_filename) {
                    images = [parsed];
                  }
                }
              }
              
              console.log('CM Letter images data:', { 
                letterId: letter.id, 
                letterNumber: letter.letter_number,
                imagesData, 
                parsedImages: images,
                imagesCount: images.length,
                details: details?.images,
                letter: letter.images 
              });
              
              const failureComments = parseJsonField(details?.failure_comments || letter.failure_comments) || [];

              return (
                <div key={letter.id} style={{ marginBottom: '20px', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
                  {/* Letter Summary Row */}
                  <div
                    onClick={() => loadLetterDetails(letter.id)}
                    style={{
                      padding: '16px',
                      background: isExpanded ? '#f8f9fa' : 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px',
                      borderBottom: isExpanded ? '2px solid #007bff' : 'none',
                      transition: 'background 0.2s'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>
                        {letter.letter_number}
                      </div>
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        {letter.asset_name || 'N/A'} • {letter.task_code || 'N/A'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className={`task-badge ${letter.priority}`}>{letter.priority}</span>
                      <span className={`task-badge ${letter.status}`}>
                        {letter.status.replace('_', ' ')}
                      </span>
                      <span style={{ fontSize: '12px', color: '#999' }}>
                        {new Date(letter.generated_at).toLocaleDateString()}
                      </span>
                      <span style={{ fontSize: '18px', color: '#007bff' }}>
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div style={{ padding: '20px', background: 'white' }}>
                      {loadingDetails ? (
                        <div style={{ textAlign: 'center', padding: '20px' }}>Loading details...</div>
                      ) : (
                        <>
                          {/* Issue Description with Images */}
                          {details?.issue_description && (
                            <div style={{ marginBottom: '20px' }}>
                              <h3 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: 600 }}>Issue Description</h3>
                              <div style={{ 
                                padding: '12px', 
                                background: '#fff3cd', 
                                borderLeft: '4px solid #ffc107',
                                borderRadius: '4px',
                                whiteSpace: 'pre-wrap',
                                lineHeight: '1.6',
                                marginBottom: images.length > 0 ? '16px' : '0'
                              }}>
                                {details.issue_description}
                              </div>
                              
                              {/* Images with Descriptions - Right under Issue Description */}
                              {images.length > 0 && (
                                <div style={{ marginTop: '16px' }}>
                                  <h4 style={{ marginBottom: '12px', fontSize: '15px', fontWeight: 600, color: '#333' }}>
                                    Related Images ({images.length})
                                  </h4>
                                  <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                    gap: '16px'
                                  }}>
                                    {images.map((img, idx) => {
                                      // Try multiple possible field names for image path
                                      const imagePath = img.path || img.image_path || img.filename || img.image_filename;
                                      const imageUrl = getImageUrl(imagePath);
                                      
                                      // Get comment/description from multiple possible fields
                                      const description = img.comment || img.description || '';
                                      
                                      console.log('Image data:', { img, imagePath, imageUrl, description });
                                      
                                      if (!imageUrl) {
                                        console.warn('No image URL found for image:', img);
                                        return (
                                          <div key={idx} style={{ 
                                            padding: '12px',
                                            background: '#fff3cd',
                                            borderRadius: '8px',
                                            border: '1px solid #ffc107'
                                          }}>
                                            <div style={{ fontSize: '12px', color: '#856404', marginBottom: '4px' }}>
                                              ⚠️ Image path missing
                                            </div>
                                            {description && (
                                              <div style={{ fontSize: '13px', color: '#333' }}>
                                                <strong>Description:</strong> {description}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      }

                                      return (
                                        <div key={idx} style={{ 
                                          background: 'white',
                                          borderRadius: '8px',
                                          padding: '12px',
                                          border: '1px solid #e0e0e0',
                                          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                          display: 'flex',
                                          flexDirection: 'column'
                                        }}>
                                          <div style={{ position: 'relative', width: '100%', height: '180px', marginBottom: '12px' }}>
                                            <img
                                              src={imageUrl}
                                              alt={description || `Image ${idx + 1}`}
                                              onClick={() => setViewingImage(imageUrl)}
                                              style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                border: '2px solid #e0e0e0',
                                                transition: 'transform 0.2s, box-shadow 0.2s'
                                              }}
                                              onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'scale(1.05)';
                                                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                                              }}
                                              onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'scale(1)';
                                                e.currentTarget.style.boxShadow = 'none';
                                              }}
                                              onError={(e) => {
                                                console.error('Failed to load image:', imageUrl, 'Original data:', img);
                                                e.target.style.display = 'none';
                                                const placeholder = e.target.parentElement.querySelector('.image-placeholder');
                                                if (placeholder) placeholder.style.display = 'flex';
                                              }}
                                              onLoad={() => {
                                                console.log('Image loaded successfully:', imageUrl);
                                              }}
                                            />
                                            <div 
                                              className="image-placeholder"
                                              style={{ 
                                                display: 'none',
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: '100%',
                                                background: '#f0f0f0',
                                                borderRadius: '6px',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '12px',
                                                color: '#999',
                                                flexDirection: 'column',
                                                gap: '4px'
                                              }}
                                            >
                                              <span>📷</span>
                                              <span>Image not found</span>
                                            </div>
                                          </div>
                                          <div style={{ 
                                            fontSize: '14px', 
                                            color: '#333',
                                            padding: '10px',
                                            background: '#f8f9fa',
                                            borderRadius: '6px',
                                            lineHeight: '1.6',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            flex: 1
                                          }}>
                                            <strong style={{ color: '#007bff', display: 'block', marginBottom: '6px', fontSize: '13px' }}>
                                              📝 Description:
                                            </strong>
                                            <div style={{ color: description ? '#555' : '#999', fontStyle: description ? 'normal' : 'italic' }}>
                                              {description && description.trim() ? description : 'No description'}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Recommended Action */}
                          {details?.recommended_action && (
                            <div style={{ marginBottom: '20px' }}>
                              <h3 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: 600 }}>Recommended Action</h3>
                              <div style={{ 
                                padding: '12px', 
                                background: '#d1ecf1', 
                                borderLeft: '4px solid #17a2b8',
                                borderRadius: '4px',
                                whiteSpace: 'pre-wrap',
                                lineHeight: '1.6'
                              }}>
                                {details.recommended_action}
                              </div>
                            </div>
                          )}

                          {/* Failure Comments */}
                          {failureComments.length > 0 && (
                            <div style={{ marginBottom: '20px' }}>
                              <h3 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: 600 }}>Failure Details</h3>
                              {failureComments.map((comment, idx) => (
                                <div key={idx} style={{ 
                                  marginBottom: '12px',
                                  padding: '12px', 
                                  background: '#f8f9fa', 
                                  borderLeft: '4px solid #dc3545',
                                  borderRadius: '4px'
                                }}>
                                  {comment.comment && (
                                    <div style={{ marginBottom: '8px', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                                      {comment.comment}
                                    </div>
                                  )}
                                  {comment.item_id && (
                                    <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                                      Item ID: {comment.item_id}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Images - Show separately if no issue description */}
                          {images.length > 0 && !details?.issue_description && (
                            <div style={{ marginBottom: '20px' }}>
                              <h3 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: 600 }}>
                                Attached Images ({images.length})
                              </h3>
                              <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                gap: '16px'
                              }}>
                                {images.map((img, idx) => {
                                  const imagePath = img.path || img.image_path || img.filename || img.image_filename;
                                  const imageUrl = getImageUrl(imagePath);
                                  const description = img.comment || img.description || '';
                                  
                                  if (!imageUrl) return null;

                                  return (
                                    <div key={idx} style={{ 
                                      background: 'white',
                                      borderRadius: '8px',
                                      padding: '12px',
                                      border: '1px solid #e0e0e0',
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                      display: 'flex',
                                      flexDirection: 'column'
                                    }}>
                                      <div style={{ position: 'relative', width: '100%', height: '180px', marginBottom: description ? '12px' : '0' }}>
                                        <img
                                          src={imageUrl}
                                          alt={description || `Image ${idx + 1}`}
                                          onClick={() => setViewingImage(imageUrl)}
                                          style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            border: '2px solid #e0e0e0',
                                            transition: 'transform 0.2s, box-shadow 0.2s'
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'scale(1.05)';
                                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'scale(1)';
                                            e.currentTarget.style.boxShadow = 'none';
                                          }}
                                        />
                                      </div>
                                      {description && (
                                        <div style={{ 
                                          fontSize: '14px', 
                                          color: '#333',
                                          padding: '10px',
                                          background: '#f8f9fa',
                                          borderRadius: '6px',
                                          lineHeight: '1.6',
                                          whiteSpace: 'pre-wrap',
                                          wordBreak: 'break-word',
                                          flex: 1
                                        }}>
                                          <strong style={{ color: '#007bff', display: 'block', marginBottom: '6px', fontSize: '13px' }}>
                                            📝 Description:
                                          </strong>
                                          <div style={{ color: '#555' }}>
                                            {description}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
                            {letter.status === 'open' && (
                              <button
                                className="btn btn-success"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusUpdate(letter.id, 'in_progress');
                                }}
                                style={{ flex: '1', minWidth: '120px' }}
                              >
                                Start
                              </button>
                            )}
                            {letter.status === 'in_progress' && (
                              <button
                                className="btn btn-primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusUpdate(letter.id, 'resolved');
                                }}
                                style={{ flex: '1', minWidth: '120px' }}
                              >
                                Resolve
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Image Modal */}
      {viewingImage && (
        <div
          onClick={() => setViewingImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
            cursor: 'pointer'
          }}
        >
          <img
            src={viewingImage}
            alt="Full size"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: '8px'
            }}
          />
          <button
            onClick={() => setViewingImage(null)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              fontSize: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default CMLetters;

