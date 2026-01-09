import React, { useState, useEffect } from 'react';
import { getSpareRequests, approveSpareRequest, rejectSpareRequest, fulfillSpareRequest, getInventoryItems } from '../api/api';
import { useAuth } from '../context/AuthContext';
import './SpareRequests.css';

function SpareRequests() {
  const { isAdmin, isTechnician } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvedQuantities, setApprovedQuantities] = useState({});
  const [inventoryItems, setInventoryItems] = useState([]);
  const [filter, setFilter] = useState('all'); // all, pending, approved, rejected, fulfilled

  useEffect(() => {
    loadRequests();
    if (isAdmin()) {
      loadInventory();
    }
  }, [filter, isAdmin]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter !== 'all') {
        params.status = filter;
      }
      const response = await getSpareRequests(params);
      setRequests(response.data);
    } catch (error) {
      setError('Failed to load spare requests: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const loadInventory = async () => {
    try {
      const response = await getInventoryItems();
      setInventoryItems(response.data);
    } catch (error) {
      console.error('Failed to load inventory:', error);
    }
  };

  const handleApprove = async () => {
    try {
      await approveSpareRequest(selectedRequest.id, {
        approved_quantities: approvedQuantities
      });
      setShowApproveModal(false);
      setSelectedRequest(null);
      setApprovedQuantities({});
      loadRequests();
    } catch (error) {
      setError('Failed to approve request: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleReject = async () => {
    try {
      await rejectSpareRequest(selectedRequest.id, {
        rejection_reason: rejectionReason
      });
      setShowRejectModal(false);
      setSelectedRequest(null);
      setRejectionReason('');
      loadRequests();
    } catch (error) {
      setError('Failed to reject request: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleFulfill = async (id) => {
    if (!window.confirm('Are you sure you want to fulfill this request? This will consume inventory.')) {
      return;
    }
    try {
      await fulfillSpareRequest(id);
      loadRequests();
    } catch (error) {
      setError('Failed to fulfill request: ' + (error.response?.data?.error || error.message));
    }
  };

  const openApproveModal = (request) => {
    setSelectedRequest(request);
    // Initialize approved quantities with requested quantities
    const quantities = {};
    if (request.items && Array.isArray(request.items)) {
      request.items.forEach(item => {
        quantities[item.inventory_item_id] = item.approved_quantity || item.quantity;
      });
    } else if (request.requested_items && Array.isArray(request.requested_items)) {
      request.requested_items.forEach(item => {
        quantities[item.item_id] = item.quantity;
      });
    }
    setApprovedQuantities(quantities);
    setShowApproveModal(true);
  };

  const openRejectModal = (request) => {
    setSelectedRequest(request);
    setShowRejectModal(true);
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { class: 'badge-warning', text: 'Pending' },
      approved: { class: 'badge-success', text: 'Approved' },
      rejected: { class: 'badge-danger', text: 'Rejected' },
      fulfilled: { class: 'badge-info', text: 'Fulfilled' }
    };
    const badge = badges[status] || { class: 'badge-secondary', text: status };
    return <span className={`badge ${badge.class}`}>{badge.text}</span>;
  };

  if (loading) {
    return <div className="loading">Loading spare requests...</div>;
  }

  return (
    <div className="spare-requests">
      <div className="page-header">
        <h2>Spare Requests</h2>
        {isAdmin() && (
          <div className="filter-buttons">
            <button 
              className={filter === 'all' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary'}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button 
              className={filter === 'pending' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary'}
              onClick={() => setFilter('pending')}
            >
              Pending
            </button>
            <button 
              className={filter === 'approved' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary'}
              onClick={() => setFilter('approved')}
            >
              Approved
            </button>
            <button 
              className={filter === 'rejected' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary'}
              onClick={() => setFilter('rejected')}
            >
              Rejected
            </button>
            <button 
              className={filter === 'fulfilled' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary'}
              onClick={() => setFilter('fulfilled')}
            >
              Fulfilled
            </button>
          </div>
        )}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {requests.length === 0 ? (
        <div className="empty-state">
          <p>No spare requests found.</p>
        </div>
      ) : (
        <div className="requests-list">
          {requests.map(request => (
            <div key={request.id} className="request-card">
              <div className="request-header">
                <div>
                  <h3>Request #{request.id.slice(0, 8)}</h3>
                  <p className="request-meta">
                    Task: {request.task_code || 'N/A'} ({request.task_type || 'N/A'}) | 
                    Requested by: {request.requested_by_name || 'Unknown'} | 
                    {new Date(request.requested_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  {getStatusBadge(request.status)}
                </div>
              </div>

              {request.notes && (
                <div className="request-notes">
                  <strong>Notes:</strong> {request.notes}
                </div>
              )}

              <div className="request-items">
                <h4>Requested Items:</h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Item Code</th>
                      <th>Description</th>
                      <th>Requested Qty</th>
                      {request.status === 'approved' && <th>Approved Qty</th>}
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(request.items || request.requested_items || []).map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.item_code || item.inventory_item_id}</td>
                        <td>{item.item_description || 'N/A'}</td>
                        <td>{item.quantity}</td>
                        {request.status === 'approved' && (
                          <td>{item.approved_quantity || item.quantity}</td>
                        )}
                        <td>{item.reason || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {isAdmin() && request.status === 'pending' && (
                <div className="request-actions">
                  <button 
                    className="btn btn-success"
                    onClick={() => openApproveModal(request)}
                  >
                    Approve
                  </button>
                  <button 
                    className="btn btn-danger"
                    onClick={() => openRejectModal(request)}
                  >
                    Reject
                  </button>
                </div>
              )}

              {isAdmin() && request.status === 'approved' && (
                <div className="request-actions">
                  <button 
                    className="btn btn-primary"
                    onClick={() => handleFulfill(request.id)}
                  >
                    Fulfill Request
                  </button>
                </div>
              )}

              {request.rejection_reason && (
                <div className="rejection-reason">
                  <strong>Rejection Reason:</strong> {request.rejection_reason}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedRequest && (
        <div className="modal-overlay" onClick={() => setShowApproveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Approve Spare Request</h3>
            <p>Adjust approved quantities if needed:</p>
            <div className="approve-quantities">
              {(selectedRequest.items || selectedRequest.requested_items || []).map((item, idx) => {
                const itemId = item.inventory_item_id || item.item_id;
                const inventoryItem = inventoryItems.find(i => i.id === itemId);
                const availableQty = inventoryItem?.actual_qty || 0;
                return (
                  <div key={idx} className="quantity-input-group">
                    <label>
                      {item.item_code || itemId} - {item.item_description || 'N/A'}
                      <br />
                      <small>Requested: {item.quantity} | Available: {availableQty}</small>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={availableQty}
                      value={approvedQuantities[itemId] || item.quantity}
                      onChange={(e) => setApprovedQuantities({
                        ...approvedQuantities,
                        [itemId]: parseInt(e.target.value) || 0
                      })}
                    />
                  </div>
                );
              })}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowApproveModal(false)}>
                Cancel
              </button>
              <button className="btn btn-success" onClick={handleApprove}>
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedRequest && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Reject Spare Request</h3>
            <label>
              Rejection Reason:
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows="4"
                placeholder="Enter reason for rejection..."
              />
            </label>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleReject}>
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SpareRequests;
