// ============================================================
// pages/Dashboard.jsx
// ============================================================
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboard, getAlerts } from '../api';

export default function Dashboard() {
  const [dash,    setDash]    = useState(null);
  const [alerts,  setAlerts]  = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getDashboard(), getAlerts()])
      .then(([d, a]) => { setDash(d.dashboard); setAlerts(a.alerts); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingPage />;

  const metrics = [
    { label: 'Total SKUs',      value: dash?.total_skus       || 0, icon: '📦', color: 'var(--blue)'  },
    { label: 'Low Stock',       value: dash?.low_stock_count  || 0, icon: '⚠️', color: 'var(--orange)' },
    { label: 'Expiring Soon',   value: dash?.expiring_7_days  || 0, icon: '📅', color: 'var(--red)'   },
    { label: 'Out of Stock',    value: dash?.out_of_stock     || 0, icon: '❌', color: 'var(--red)'   },
    { label: 'Open Containers', value: dash?.open_containers  || 0, icon: '🫙', color: 'var(--gold)'  },
    { label: 'Open Alerts',     value: alerts.filter(a => a.status === 'OPEN').length, icon: '🔔', color: 'var(--orange)' },
  ];

  return (
    <div className="page">
      <div className="page-title">Kitchen Inventory</div>
      <div className="page-subtitle">Last sync: {dash?.last_sync || '—'}</div>

      {/* Metric grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
        {metrics.map(m => (
          <div key={m.label} className="card" style={{ cursor: 'pointer' }}
            onClick={() => navigate(m.label === 'Open Alerts' ? '/alerts' : m.label === 'Open Containers' ? '/containers' : '/inventory')}>
            <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>{m.icon}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: m.value > 0 ? m.color : 'var(--text)', lineHeight: 1 }}>
              {m.value}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Consumption split */}
      <div className="section-header">Stock by Consumption</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { label: 'Family',  value: dash?.family_items || 0, color: 'var(--blue)' },
          { label: 'Staff',   value: dash?.staff_items  || 0, color: 'var(--green)' },
          { label: 'Shared',  value: dash?.shared_items || 0, color: 'var(--gold)' },
        ].map(t => (
          <div key={t.label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: t.color }}>{t.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 2 }}>{t.label}</div>
          </div>
        ))}
      </div>

      {/* Recent alerts */}
      {alerts.length > 0 && (
        <>
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            Recent Alerts
            <span style={{ color: 'var(--gold)', cursor: 'pointer', fontWeight: 500 }}
              onClick={() => navigate('/alerts')}>See all →</span>
          </div>
          {alerts.slice(0, 3).map(a => (
            <AlertCard key={a.alert_id} alert={a} compact />
          ))}
        </>
      )}

      {/* FAB */}
      <button
        onClick={() => navigate('/scan')}
        style={{
          position: 'fixed', bottom: 80, right: 20, width: 56, height: 56,
          borderRadius: '50%', background: 'var(--gold)', border: 'none',
          fontSize: '1.5rem', cursor: 'pointer', boxShadow: '0 4px 20px rgba(240,192,64,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >⬡</button>
    </div>
  );
}

function AlertCard({ alert, compact }) {
  const typeStyle = {
    LOW_STOCK:       { color: 'var(--orange)', label: 'Low Stock' },
    OUT_OF_STOCK:    { color: 'var(--red)',    label: 'Out of Stock' },
    EXPIRY:          { color: 'var(--red)',    label: 'Expiry' },
    CONTAINER_STALE: { color: 'var(--gold)',   label: 'Stale Container' },
  };
  const style = typeStyle[alert.alert_type] || { color: 'var(--muted)', label: alert.alert_type };

  return (
    <div className="card" style={{ borderLeftWidth: 3, borderLeftColor: style.color }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.87rem' }}>{alert.product_name || alert.item_id}</div>
          {!compact && alert.current_qty !== '' && (
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 2 }}>
              {alert.current_qty} {alert.unit_type} remaining
            </div>
          )}
        </div>
        <span className="badge" style={{ color: style.color, background: style.color + '18', border: `1px solid ${style.color}30` }}>
          {style.label}
        </span>
      </div>
    </div>
  );
}


// ============================================================
// pages/Scan.jsx
// ============================================================
import Scanner from '../components/Scanner';
import { InboundForm } from '../components/Forms';
import { resolveBarcode, getInventory, removeStock } from '../api';
import { useApp } from '../App';

export function Scan() {
  const { showToast, options }          = useApp();
  const [mode, setMode]                 = useState('add'); // 'add' | 'use'
  const [scanning, setScanning]         = useState(true);
  const [resolving, setResolving]       = useState(false);
  const [sheet, setSheet]               = useState(null); // null | 'inbound' | 'outbound' | 'unknown'
  const [resolvedProduct, setResolved]  = useState(null);
  const [resolvedItem, setResolvedItem] = useState(null);
  const [currentBarcode, setBarcode]    = useState('');
  const [manualBarcode, setManual]      = useState('');

  const handleScan = async (barcode) => {
    if (resolving) return;
    setBarcode(barcode);
    setResolving(true);
    setScanning(false);

    try {
      const res = await resolveBarcode(barcode);

      if (mode === 'add') {
        if (res.found) {
          setResolved(res.product);
          setSheet('inbound');
        } else {
          setSheet('unknown');
        }
      } else {
        // Use mode — need to find item in inventory
        const inv = await getInventory({});
        const item = inv.items.find(i => String(i.barcode).trim() === String(barcode).trim());
        if (item) {
          setResolvedItem(item);
          setSheet('outbound');
        } else {
          showToast('Item not found in inventory. Make sure it was added first.', 'error');
          resetScan();
        }
      }
    } catch (err) {
      showToast(err.message, 'error');
      resetScan();
    } finally {
      setResolving(false);
    }
  };

  const resetScan = () => {
    setScanning(true);
    setSheet(null);
    setResolved(null);
    setResolvedItem(null);
    setBarcode('');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#000' }}>
      {/* Camera */}
      <div style={{ position: 'relative' }}>
        <Scanner onResult={handleScan} active={scanning && !sheet} />

        {/* Mode toggle */}
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.8)', borderRadius: 30, padding: 4,
          display: 'flex', gap: 2, backdropFilter: 'blur(8px)',
        }}>
          {['add', 'use'].map(m => (
            <button key={m} onClick={() => { setMode(m); resetScan(); }} style={{
              padding: '8px 22px', borderRadius: 26, border: 'none', cursor: 'pointer',
              fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.15s',
              background: mode === m ? '#f0c040' : 'transparent',
              color: mode === m ? '#0d0d0d' : '#888',
            }}>
              {m === 'add' ? '+ Add Stock' : '− Use Stock'}
            </button>
          ))}
        </div>
      </div>

      {/* Manual entry */}
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input-field" placeholder="Or type barcode manually…"
            value={manualBarcode} onChange={e => setManual(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && manualBarcode && handleScan(manualBarcode)}
          />
          <button className="btn btn-secondary" disabled={!manualBarcode}
            onClick={() => handleScan(manualBarcode)}>Go</button>
        </div>
      </div>

      {/* Resolving spinner */}
      {resolving && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, flexDirection: 'column', gap: 12 }}>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
          <p style={{ color: '#888', fontSize: '0.84rem' }}>Looking up barcode…</p>
        </div>
      )}

      {/* Bottom sheet: Inbound */}
      {sheet === 'inbound' && (
        <BottomSheet onClose={resetScan}>
          <InboundForm
            product={resolvedProduct}
            barcode={currentBarcode}
            onSuccess={resetScan}
            onCancel={resetScan}
          />
        </BottomSheet>
      )}

      {/* Bottom sheet: Outbound */}
      {sheet === 'outbound' && resolvedItem && (
        <BottomSheet onClose={resetScan}>
          <OutboundForm item={resolvedItem} onSuccess={resetScan} onCancel={resetScan} />
        </BottomSheet>
      )}

      {/* Bottom sheet: Unknown product */}
      {sheet === 'unknown' && (
        <BottomSheet onClose={resetScan}>
          <NewProductSheet barcode={currentBarcode} onSuccess={resetScan} onCancel={resetScan} />
        </BottomSheet>
      )}
    </div>
  );
}

function BottomSheet({ children, onClose }) {
  return (
    <>
      <div className="bottom-sheet-overlay" onClick={onClose} />
      <div className="bottom-sheet">
        <div className="bottom-sheet-handle" />
        <div className="bottom-sheet-content">{children}</div>
      </div>
    </>
  );
}

function OutboundForm({ item, onSuccess, onCancel }) {
  const { options, showToast } = useApp();
  const [qty, setQty]       = useState('');
  const [reason, setReason] = useState('COOKING');
  const [notes,  setNotes]  = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!qty || parseFloat(qty) <= 0) { showToast('Enter a valid quantity', 'error'); return; }
    setLoading(true);
    try {
      await removeStock({ item_id: item.item_id, qty_removed: parseFloat(qty), drawdown_reason: reason, notes });
      showToast(`✓ ${item.product_name} updated`);
      onSuccess?.();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="bottom-sheet-title">Use / Draw Down</div>
      <div className="bottom-sheet-subtitle">{item.product_name}</div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>Current Stock</div>
        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--green)' }}>
          {item.current_qty} <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>{item.unit_type}</span>
        </div>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label className="label">Qty Used *</label>
          <input className="input-field" type="number" min="0.01" step="0.01"
            value={qty} onChange={e => setQty(e.target.value)} />
        </div>
        <div className="field-group">
          <label className="label">Reason *</label>
          <select className="input-field" value={reason} onChange={e => setReason(e.target.value)}>
            {options?.DRAWDOWN_REASON.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
      </div>
      <div className="field-group">
        <label className="label">Notes</label>
        <input className="input-field" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-secondary btn-full" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary btn-full" onClick={handleSubmit} disabled={loading}>
          {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Confirm'}
        </button>
      </div>
    </div>
  );
}

function NewProductSheet({ barcode, onSuccess, onCancel }) {
  const { showToast } = useApp();
  return (
    <div>
      <div className="bottom-sheet-title">New Product</div>
      <div className="bottom-sheet-subtitle">Barcode {barcode} not found — register it below</div>
      <InboundForm product={null} barcode={barcode} onSuccess={onSuccess} onCancel={onCancel} />
    </div>
  );
}


// ============================================================
// pages/Inventory.jsx
// ============================================================
import { getInventory as fetchInventory, submitOverride } from '../api';

export function Inventory() {
  const { showToast } = useApp();
  const [items,    setItems]   = useState([]);
  const [loading,  setLoading] = useState(true);
  const [search,   setSearch]  = useState('');
  const [catFilter,setCat]     = useState('');
  const [trackFilter,setTrack] = useState('');
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchInventory({ search, category: catFilter, consumption_track: trackFilter });
      setItems(res.items);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, catFilter, trackFilter]);

  return (
    <div className="page">
      <div className="page-title">Inventory</div>

      {/* Search */}
      <input className="input-field" placeholder="Search product, brand, barcode…"
        value={search} onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 10 }} />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
        {['FAMILY','STAFF','SHARED'].map(t => (
          <button key={t} className="btn btn-sm btn-secondary"
            style={{ flexShrink: 0, borderColor: trackFilter === t ? 'var(--gold)' : undefined, color: trackFilter === t ? 'var(--gold)' : undefined }}
            onClick={() => setTrack(trackFilter === t ? '' : t)}>{t}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📦</div>
          <div className="empty-state-title">No items found</div>
          <div className="empty-state-desc">Try adjusting your search or scan an item to add it</div>
        </div>
      ) : (
        <div>
          {items.map(item => (
            <div key={item.item_id} className="list-item" onClick={() => setSelected(item)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 2 }}>{item.product_name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{item.brand} · {item.category}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 700, color: item.current_qty <= item.reorder_level && item.reorder_level > 0 ? 'var(--orange)' : 'var(--green)', fontSize: '1rem' }}>
                  {item.current_qty}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{item.unit_type}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Item detail sheet */}
      {selected && (
        <>
          <div className="bottom-sheet-overlay" onClick={() => setSelected(null)} />
          <div className="bottom-sheet">
            <div className="bottom-sheet-handle" />
            <div className="bottom-sheet-content">
              <ItemDetail item={selected} onClose={() => { setSelected(null); load(); }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ItemDetail({ item, onClose }) {
  const { showToast } = useApp();
  const [overrideMode, setOverrideMode] = useState(false);
  const [newQty, setNewQty]   = useState('');
  const [reason, setReason]   = useState('PHYSICAL_AUDIT');
  const [notes,  setNotes]    = useState('');
  const [saving, setSaving]   = useState(false);
  const { options }           = useApp();

  const handleOverride = async () => {
    if (newQty === '') { showToast('Enter new qty', 'error'); return; }
    setSaving(true);
    try {
      await submitOverride(item.item_id, parseFloat(newQty), reason, notes);
      showToast('✓ Stock corrected');
      onClose();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div className="bottom-sheet-title">{item.product_name}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{item.brand} · {item.barcode}</div>
        </div>
        <TrackBadge track={item.consumption_track} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div className="card">
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Current Stock</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--green)' }}>{item.current_qty} <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{item.unit_type}</span></div>
        </div>
        <div className="card">
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Reorder At</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{item.reorder_level || '—'} <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{item.unit_type}</span></div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        {[['Category', item.category], ['Sub-category', item.sub_category], ['Storage', item.storage_location], ['Status', item.status], ['Last Updated', item.last_updated]].map(([k,v]) => v && (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '0.84rem' }}>
            <span style={{ color: 'var(--muted)' }}>{k}</span>
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>{String(v)}</span>
          </div>
        ))}
      </div>

      {/* Override section */}
      {!overrideMode ? (
        <button className="btn btn-secondary btn-full btn-sm" onClick={() => setOverrideMode(true)}>
          Correct Stock (Override)
        </button>
      ) : (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: '0.9rem' }}>Stock Override</div>
          <div className="field-group">
            <label className="label">Correct Qty</label>
            <input className="input-field" type="number" min="0" step="0.01"
              value={newQty} onChange={e => setNewQty(e.target.value)} placeholder="Actual qty on hand" />
          </div>
          <div className="field-group">
            <label className="label">Reason</label>
            <select className="input-field" value={reason} onChange={e => setReason(e.target.value)}>
              {options?.OVERRIDE_REASON.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label className="label">Notes</label>
            <input className="input-field" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Explain the discrepancy" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-full btn-sm" onClick={() => setOverrideMode(false)}>Cancel</button>
            <button className="btn btn-danger btn-full btn-sm" onClick={handleOverride} disabled={saving}>
              {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Apply Override'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// ============================================================
// pages/Alerts.jsx
// ============================================================
import { getAlerts as fetchAlerts, acknowledgeAlert as ack, resolveAlert as res } from '../api';

export function Alerts() {
  const { showToast } = useApp();
  const [alerts,  setAlerts]  = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { const r = await fetchAlerts(); setAlerts(r.alerts); }
    catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAck = async (alertId) => {
    try { await ack(alertId); showToast('Alert acknowledged'); load(); }
    catch (err) { showToast(err.message, 'error'); }
  };

  const handleResolve = async (alertId) => {
    try { await res(alertId); showToast('Alert resolved'); load(); }
    catch (err) { showToast(err.message, 'error'); }
  };

  const typeStyle = {
    LOW_STOCK:       { color: 'var(--orange)', label: 'Low Stock',       icon: '⚠️' },
    OUT_OF_STOCK:    { color: 'var(--red)',    label: 'Out of Stock',    icon: '❌' },
    EXPIRY:          { color: 'var(--red)',    label: 'Expiring Soon',   icon: '📅' },
    CONTAINER_STALE: { color: 'var(--gold)',   label: 'Stale Container', icon: '🫙' },
  };

  const open = alerts.filter(a => a.status === 'OPEN');
  const acknowledged = alerts.filter(a => a.status === 'ACKNOWLEDGED');

  return (
    <div className="page">
      <div className="page-title">Alerts</div>
      <div className="page-subtitle">{open.length} open alert{open.length !== 1 ? 's' : ''}</div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : alerts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">✅</div>
          <div className="empty-state-title">All clear</div>
          <div className="empty-state-desc">No alerts right now</div>
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <>
              <div className="section-header">Open</div>
              {open.map(a => {
                const s = typeStyle[a.alert_type] || { color: 'var(--muted)', label: a.alert_type, icon: '🔔' };
                return (
                  <div key={a.alert_id} className="card" style={{ borderLeftWidth: 3, borderLeftColor: s.color, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontWeight: 600 }}>{s.icon} {a.product_name}</div>
                      <span style={{ fontSize: '0.72rem', color: s.color, fontWeight: 600 }}>{s.label}</span>
                    </div>
                    {a.current_qty !== '' && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 8 }}>
                        {a.current_qty} {a.unit_type} remaining · reorder at {a.reorder_level}
                      </div>
                    )}
                    {a.expiry_date && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--red)', marginBottom: 8 }}>
                        Expires: {a.expiry_date}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleAck(a.alert_id)}>Acknowledge</button>
                      <button className="btn btn-sm" style={{ background: 'rgba(128,224,152,0.1)', color: 'var(--green)', border: '1px solid rgba(128,224,152,0.2)' }}
                        onClick={() => handleResolve(a.alert_id)}>Resolve</button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
          {acknowledged.length > 0 && (
            <>
              <div className="section-header">Acknowledged</div>
              {acknowledged.map(a => (
                <div key={a.alert_id} className="card" style={{ opacity: 0.6, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 500, fontSize: '0.87rem' }}>{a.product_name}</span>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleResolve(a.alert_id)}>Resolve</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}


// ============================================================
// pages/OpenContainers.jsx
// ============================================================
import { getOpenContainers as fetchContainers, updateContainerEstimate, reconcileContainer } from '../api';

export function OpenContainers() {
  const { showToast }           = useApp();
  const [containers, setContainers] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState(null);
  const [newEst,     setNewEst]     = useState('');
  const [saving,     setSaving]     = useState(false);

  const load = async () => {
    setLoading(true);
    try { const r = await fetchContainers(); setContainers(r.containers); }
    catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleUpdateEst = async () => {
    if (newEst === '') { showToast('Enter remaining qty', 'error'); return; }
    setSaving(true);
    try {
      await updateContainerEstimate(selected.container_id, parseFloat(newEst));
      showToast('✓ Estimate updated'); setSelected(null); load();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleReconcile = async () => {
    setSaving(true);
    try {
      await reconcileContainer(selected.container_id, 0);
      showToast('✓ Container marked empty'); setSelected(null); load();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="page">
      <div className="page-title">Open Containers</div>
      <div className="page-subtitle">Partially used packs awaiting reconciliation</div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : containers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🫙</div>
          <div className="empty-state-title">No open containers</div>
          <div className="empty-state-desc">Open containers appear when you decant a pack</div>
        </div>
      ) : (
        containers.map(c => (
          <div key={c.container_id} className="card" style={{ marginBottom: 10, borderColor: c.is_stale ? 'var(--orange)' : 'var(--border)' }}
            onClick={() => { setSelected(c); setNewEst(String(c.estimated_remaining)); }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.item_id}</div>
              {c.is_stale && <span className="badge badge-orange">Stale</span>}
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: '0.8rem', color: 'var(--muted)' }}>
              <span>Original: {c.original_qty} {c.unit_type}</span>
              <span style={{ color: 'var(--green)' }}>Est. remaining: {c.estimated_remaining} {c.unit_type}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>
              Last updated: {c.last_estimated_date || 'never'} {c.days_since_estimate !== null ? `(${c.days_since_estimate}d ago)` : ''}
            </div>
          </div>
        ))
      )}

      {selected && (
        <>
          <div className="bottom-sheet-overlay" onClick={() => setSelected(null)} />
          <div className="bottom-sheet">
            <div className="bottom-sheet-handle" />
            <div className="bottom-sheet-content">
              <div className="bottom-sheet-title">Update Container</div>
              <div className="bottom-sheet-subtitle">{selected.item_id}</div>
              <div className="field-group">
                <label className="label">Estimated Remaining ({selected.unit_type})</label>
                <input className="input-field" type="number" min="0" step="0.01"
                  value={newEst} onChange={e => setNewEst(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                <button className="btn btn-primary btn-full" onClick={handleUpdateEst} disabled={saving}>
                  {saving ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Update Estimate'}
                </button>
                <button className="btn btn-danger btn-full" onClick={handleReconcile} disabled={saving}>
                  Mark Empty (Reconcile)
                </button>
                <button className="btn btn-secondary btn-full" onClick={() => setSelected(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


// ============================================================
// pages/Admin.jsx
// ============================================================
import { getAllOverrides } from '../api';

export function Admin() {
  const { showToast }         = useApp();
  const [overrides, setOverrides] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [tab,       setTab]       = useState('overrides'); // overrides | settings

  useEffect(() => {
    getAllOverrides()
      .then(r => setOverrides(r.overrides))
      .catch(err => showToast(err.message, 'error'));
  }, []);

  const handleRunScan = async () => {
    setLoading(true);
    try {
      const base = import.meta.env.VITE_API_URL; const r = await fetch(base, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ endpoint: 'runAlertScan' }) }); const d = await r.json(); if (!d.success) throw new Error(d.error);
      showToast('✓ Alert scan complete');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="page">
      <div className="page-title">Admin</div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['overrides', 'settings'].map(t => (
          <button key={t} className="btn btn-sm btn-secondary"
            style={{ borderColor: tab === t ? 'var(--gold)' : undefined, color: tab === t ? 'var(--gold)' : undefined }}
            onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {tab === 'overrides' && (
        <div>
          <div className="section-header">Override History</div>
          {overrides.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">✅</div><div className="empty-state-title">No overrides yet</div></div>
          ) : overrides.map((o, i) => (
            <div key={i} className="card" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: '0.87rem' }}>{o.item_id}</span>
                <span className="badge badge-gold">{o.reason}</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                {o.qty_before} → {o.qty_after} ({o.difference > 0 ? '+' : ''}{o.difference}) · {o.override_by} · {o.timestamp}
              </div>
              {o.notes && <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>{o.notes}</div>}
            </div>
          ))}
        </div>
      )}

      {tab === 'settings' && (
        <div>
          <div className="section-header">System Actions</div>
          <div className="card" style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Run Alert Scan</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 12 }}>
              Manually trigger the daily scan for low stock, expiry, and stale containers.
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleRunScan} disabled={loading}>
              {loading ? 'Running…' : 'Run Now'}
            </button>
          </div>

          <div className="section-header">Configuration</div>
          <div className="card">
            <div style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>
              To update alert email, reorder thresholds, or system constants, edit <code style={{ color: 'var(--gold)', fontSize: '0.78rem' }}>Config.gs</code> in the Apps Script editor and redeploy.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ── Shared components ─────────────────────────────────────────
function LoadingPage() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', flexDirection: 'column', gap: 12 }}>
      <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      <p style={{ color: 'var(--muted)', fontSize: '0.84rem' }}>Loading…</p>
    </div>
  );
}

function TrackBadge({ track }) {
  const colors = { FAMILY: 'badge-blue', STAFF: 'badge-green', SHARED: 'badge-gold' };
  return <span className={`badge ${colors[track] || 'badge-gold'}`}>{track}</span>;
}

// ── Re-export all pages ───────────────────────────────────────
// Each page is imported by App.jsx individually.
// They are all co-located in this file for brevity but could be
// split into separate files (pages/Dashboard.jsx etc.) for larger teams.
