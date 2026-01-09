import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getInventoryItems, adjustInventory, downloadInventoryExcel, getSparesUsage } from '../api/api';
import { useAuth } from '../context/AuthContext';

function Inventory() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const searchDebounceRef = useRef(null);

  const [adjusting, setAdjusting] = useState(null); // item
  const [qtyChange, setQtyChange] = useState('');
  const [note, setNote] = useState('');
  const [expandedSections, setExpandedSections] = useState(new Set()); // Track which sections are expanded
  const [viewMode, setViewMode] = useState('inventory'); // 'inventory' or 'usage'
  const [usagePeriod, setUsagePeriod] = useState('monthly'); // 'daily', 'weekly', 'monthly'
  const [sparesUsage, setSparesUsage] = useState([]);
  const [loadingUsage, setLoadingUsage] = useState(false);

  const load = useCallback(async (searchQuery, lowStockFilter) => {
    try {
      setLoading(true);
      setError('');
      const query = searchQuery?.trim() || undefined;
      const low_stock = lowStockFilter ? 'true' : undefined;
      const resp = await getInventoryItems({ q: query, low_stock });
      setItems(resp.data || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    load('', false);
  }, [load]);

  // Debounced auto-search (lets you type normally without firing on every keystroke)
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      load(q, lowOnly);
    }, 450);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [q, lowOnly, load]);

  const groupedBySection = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      // Extract subtitle part (before " | ") for grouping, keep numbers searchable in DB
      const fullSection = String(it.section || '').trim();
      const section = fullSection.includes(' | ') 
        ? fullSection.split(' | ')[0].trim() 
        : fullSection || 'Other';
      if (!map.has(section)) map.set(section, []);
      map.get(section).push(it);
    }
    return Array.from(map.entries()).map(([section, sectionItems]) => ({ section, items: sectionItems }));
  }, [items]);

  // Initialize all sections as collapsed by default when sections change
  useEffect(() => {
    const allSections = new Set(groupedBySection.map(g => g.section));
    setExpandedSections(prev => {
      const next = new Set();
      // Only keep sections that were already expanded (preserve user's manual expansion)
      for (const section of prev) {
        if (allSections.has(section)) {
          next.add(section);
        }
      }
      // New sections are not added (default to collapsed)
      return next;
    });
  }, [groupedBySection]);

  const toggleSection = (section) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedSections(new Set(groupedBySection.map(g => g.section)));
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
  };

  const handleDownload = async () => {
    try {
      await downloadInventoryExcel();
      // Download is handled by the API function, no need to reload
    } catch (e) {
      alert('Download failed: ' + (e.response?.data?.error || e.message));
    }
  };

  const adjustFormRef = useRef(null);

  const openAdjust = (item) => {
    setAdjusting(item);
    setQtyChange('');
    setNote('');
    // Scroll to adjustment form after a brief delay to ensure it's rendered
    setTimeout(() => {
      if (adjustFormRef.current) {
        adjustFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Focus on the quantity input
        const qtyInput = adjustFormRef.current.querySelector('input[type="number"], input[placeholder*="e.g"]');
        if (qtyInput) {
          qtyInput.focus();
        }
      }
    }, 100);
  };

  const submitAdjust = async () => {
    try {
      const delta = parseInt(qtyChange, 10);
      if (!Number.isFinite(delta) || delta === 0) {
        alert('Enter a non-zero integer quantity change (e.g., 5 or -2)');
        return;
      }
      await adjustInventory({ item_code: adjusting.item_code, qty_change: delta, note, tx_type: delta > 0 ? 'restock' : 'adjust' });
      setAdjusting(null);
      await load(q, lowOnly);
    } catch (e) {
      alert('Adjust failed: ' + (e.response?.data?.error || e.message));
    }
  };

  const loadSparesUsage = useCallback(async (period) => {
    try {
      setLoadingUsage(true);
      const resp = await getSparesUsage({ period });
      setSparesUsage(resp.data || []);
    } catch (e) {
      console.error('Failed to load spares usage:', e);
      setSparesUsage([]);
    } finally {
      setLoadingUsage(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'usage') {
      loadSparesUsage(usagePeriod);
    }
  }, [viewMode, usagePeriod, loadSparesUsage]);

  if (loading && viewMode === 'inventory') return <div className="loading">Loading inventory...</div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <h2>Inventory Count</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '8px', border: '1px solid var(--md-border)', borderRadius: '8px', padding: '4px' }}>
            <button
              className={`btn btn-sm ${viewMode === 'inventory' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('inventory')}
              style={{ minWidth: '100px' }}
            >
              Inventory
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'usage' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('usage')}
              style={{ minWidth: '100px' }}
            >
              Spares Usage
            </button>
          </div>
          {isAdmin() && viewMode === 'inventory' && (
            <button className="btn btn-primary" onClick={handleDownload}>
              Download
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {viewMode === 'usage' ? (
        <div>
          <div className="card" style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ marginTop: 0 }}>Spares Usage Report</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label style={{ fontSize: '14px', fontWeight: 500 }}>Period:</label>
                <select
                  value={usagePeriod}
                  onChange={(e) => setUsagePeriod(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '2px solid var(--md-border)', fontSize: '14px' }}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>
          </div>

          {loadingUsage ? (
            <div className="loading">Loading spares usage...</div>
          ) : sparesUsage.length === 0 ? (
            <div className="card">
              <p style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
                No spares usage found for the selected period.
              </p>
            </div>
          ) : (
            <div className="card">
              <div className="table-responsive">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Section</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Item Code</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Description</th>
                      <th style={{ padding: '12px', textAlign: 'right' }}>Total Qty Used</th>
                      <th style={{ padding: '12px', textAlign: 'right' }}>Usage Count</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Last Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sparesUsage.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                        <td data-label="Section" style={{ padding: '12px', fontWeight: '500' }}>{item.section || '-'}</td>
                        <td data-label="Item Code" style={{ padding: '12px', fontFamily: 'monospace', fontSize: '13px' }}>{item.item_code}</td>
                        <td data-label="Description" style={{ padding: '12px' }}>{item.item_description || '-'}</td>
                        <td data-label="Total Qty Used" style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: 'var(--md-error)' }}>
                          {parseInt(item.total_qty_used) || 0}
                        </td>
                        <td data-label="Usage Count" style={{ padding: '12px', textAlign: 'right', color: '#666' }}>
                          {item.usage_count || 0}
                        </td>
                        <td data-label="Last Used" style={{ padding: '12px', fontSize: '13px', color: '#666' }}>
                          {item.last_used_at ? new Date(item.last_used_at).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: '15px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by section number or description..."
            style={{
              flex: 1,
              minWidth: '300px',
              padding: '12px 16px',
              fontSize: '16px',
              border: '2px solid #ddd',
              borderRadius: '6px',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = '#007bff'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#ddd'}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                load(q, lowOnly);
              }
            }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={lowOnly}
              onChange={(e) => setLowOnly(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            Low stock only
          </label>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
              load(q, lowOnly);
            }}
            style={{ padding: '12px 24px', fontSize: '15px', whiteSpace: 'nowrap' }}
          >
            Search
          </button>
        </div>
        {q && (
          <div style={{ marginTop: '12px' }}>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => {
                setQ('');
                if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                load('', lowOnly);
              }}
            >
              Clear Search
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ marginTop: 0 }}>Items ({items.length})</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-sm btn-secondary" onClick={expandAll}>Expand All</button>
            <button className="btn btn-sm btn-secondary" onClick={collapseAll}>Collapse All</button>
          </div>
        </div>

        {groupedBySection.map((group) => {
          const isExpanded = expandedSections.has(group.section);
          return (
            <div key={group.section} style={{ marginTop: '12px' }}>
              <div
                onClick={() => toggleSection(group.section)}
                style={{
                  fontWeight: 700,
                  color: '#333',
                  marginBottom: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px',
                  background: '#f5f5f5',
                  borderRadius: '4px',
                  userSelect: 'none'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#e9e9e9'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#f5f5f5'}
              >
                <span style={{ fontSize: '14px', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                  ▶
                </span>
                <span>{group.section}</span>
                <span style={{ color: '#777', fontWeight: 500 }}>({group.items.length})</span>
              </div>
              {isExpanded && (
                <div className="table-responsive">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #ddd' }}>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Item Code</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Description</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Min</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Actual Qty</th>
                        {isAdmin() && <th style={{ padding: '10px', textAlign: 'left' }}>Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((it) => {
                        const low = (it.actual_qty ?? 0) <= (it.min_level ?? 0);
                        return (
                          <tr key={it.id} style={{ borderBottom: '1px solid #eee', background: low ? '#fff3cd' : 'transparent' }}>
                            <td style={{ padding: '10px', fontWeight: 'bold' }}>{it.item_code}</td>
                            <td style={{ padding: '10px' }}>{it.item_description || '-'}</td>
                            <td style={{ padding: '10px' }}>{it.min_level ?? 0}</td>
                            <td style={{ padding: '10px' }}>{it.actual_qty ?? 0}</td>
                            {isAdmin() && (
                              <td style={{ padding: '10px' }}>
                                <button className="btn btn-sm btn-primary" onClick={() => openAdjust(it)} title="Restock when new stock arrives">
                                  Restock
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {adjusting && (
        <div ref={adjustFormRef} className="card" style={{ marginTop: '15px', border: '2px solid var(--md-info)', boxShadow: 'var(--md-shadow-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px solid var(--md-border)' }}>
            <div>
              <h3 style={{ marginTop: 0, marginBottom: '4px', color: 'var(--md-info)' }}>Restock Item: {adjusting.item_code}</h3>
              <p style={{ color: '#666', margin: 0, fontSize: '14px' }}>{adjusting.item_description}</p>
            </div>
            <button 
              className="btn btn-sm btn-secondary" 
              onClick={() => setAdjusting(null)}
              style={{ minWidth: 'auto', padding: '8px 16px' }}
            >
              ✕ Close
            </button>
          </div>
          
          <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', marginBottom: '16px', borderLeft: '4px solid var(--md-info)' }}>
            <strong style={{ color: 'var(--md-info)', display: 'block', marginBottom: '4px' }}>ℹ️ Note:</strong>
            <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
              Use this form <strong>only when new stock arrives from suppliers</strong>. When spares are approved for use in PM/CM tasks (via spare requests), they are automatically deducted from the available stock (Actual Qty).
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Current Stock</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--md-text-dark)' }}>
                {adjusting.actual_qty ?? 0}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Minimum Level</div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: (adjusting.actual_qty ?? 0) <= (adjusting.min_level ?? 0) ? 'var(--md-error)' : 'var(--md-success)' }}>
                {adjusting.min_level ?? 0}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>
              Quantity to Add <span style={{ color: 'var(--md-error)' }}>*</span>
              <span style={{ fontSize: '12px', color: '#666', fontWeight: 'normal', display: 'block', marginTop: '4px' }}>
                Enter positive number (e.g., 10 to add 10 units)
              </span>
            </label>
            <input 
              type="number" 
              value={qtyChange} 
              onChange={(e) => {
                const val = e.target.value;
                // Only allow positive numbers for restocking
                if (val === '' || (parseInt(val, 10) > 0)) {
                  setQtyChange(val);
                }
              }} 
              placeholder="e.g. 10" 
              min="1"
              style={{ fontSize: '18px', padding: '14px 16px', fontWeight: '500' }}
            />
          </div>
          <div className="form-group">
            <label>Note (optional)</label>
            <input 
              value={note} 
              onChange={(e) => setNote(e.target.value)} 
              placeholder="e.g. New stock received from supplier..." 
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button className="btn btn-primary" onClick={submitAdjust} style={{ flex: 1 }}>
              ✓ Save Restock
            </button>
            <button className="btn btn-secondary" onClick={() => setAdjusting(null)} style={{ flex: 1 }}>
              Cancel
            </button>
          </div>
          <p style={{ marginTop: '16px', marginBottom: 0, fontSize: '11px', color: '#dc3545', textAlign: 'center' }}>
            When spares are approved for use in PM/CM tasks (via spare requests), they are automatically deducted from the available stock (Actual Qty). The "Restock" button should only be used when new stock arrives from suppliers.
          </p>
        </div>
      )}

      {!adjusting && viewMode === 'inventory' && (
        <p style={{ marginTop: '16px', marginBottom: 0, fontSize: '11px', color: '#dc3545', textAlign: 'center' }}>
          When spares are approved for use in PM/CM tasks (via spare requests), they are automatically deducted from the available stock (Actual Qty). The "Restock" button should only be used when new stock arrives from suppliers.
        </p>
      )}
        </>
      )}
    </div>
  );
}

export default Inventory;


