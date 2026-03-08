import { useState } from 'react';
import { useApp } from '../App';
import { addStock } from '../api';

// ── Helpers ───────────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0];

// ============================================================
// InboundForm
// Pre-populated from BarcodeResolver result.
// Handles adding stock to inventory.
// ============================================================
export function InboundForm({ product, barcode, onSuccess, onCancel }) {
  const { options, categories, showToast } = useApp();

  const [form, setForm] = useState({
    product_name:      product?.product_name      || '',
    brand:             product?.brand             || '',
    category:          product?.default_category  || '',
    sub_category:      product?.default_sub_category || '',
    unit_type:         product?.default_unit_type || 'kg',
    consumption_track: product?.default_consumption_track || 'SHARED',
    qty_added:         '',
    purchase_date:     today(),
    expiry_date:       '',
    storage_location:  'Pantry',
    supplier:          '',
    unit_price:        '',
    invoice_no:        '',
    notes:             '',
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState({});

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const subCategories = form.category && categories
    ? (categories[form.category]?.sub_categories || [])
    : [];

  const validate = () => {
    const e = {};
    if (!form.product_name) e.product_name = 'Required';
    if (!form.category)     e.category     = 'Required';
    if (!form.unit_type)    e.unit_type    = 'Required';
    if (!form.qty_added || parseFloat(form.qty_added) <= 0) e.qty_added = 'Must be > 0';
    if (!form.storage_location)  e.storage_location  = 'Required';
    if (!form.consumption_track) e.consumption_track = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await addStock({ barcode, ...form });
      showToast(`✓ ${form.product_name} added to inventory`);
      onSuccess?.();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!options) return <div className="spinner" style={{ margin: '24px auto' }} />;

  return (
    <div>
      <div className="bottom-sheet-title">Add Stock</div>
      <div className="bottom-sheet-subtitle">{barcode}</div>

      {/* Product Name */}
      <div className="field-group">
        <label className="label">Product Name *</label>
        <input className="input-field" value={form.product_name}
          onChange={e => set('product_name', e.target.value)} placeholder="e.g. Aashirvaad Atta" />
        {errors.product_name && <ErrorMsg msg={errors.product_name} />}
      </div>

      {/* Brand */}
      <div className="field-group">
        <label className="label">Brand</label>
        <input className="input-field" value={form.brand}
          onChange={e => set('brand', e.target.value)} placeholder="e.g. Aashirvaad" />
      </div>

      {/* Category */}
      <div className="field-group">
        <label className="label">Category *</label>
        <select className="input-field" value={form.category}
          onChange={e => { set('category', e.target.value); set('sub_category', ''); }}>
          <option value="">Select category…</option>
          {categories && Object.entries(categories).map(([name]) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        {errors.category && <ErrorMsg msg={errors.category} />}
      </div>

      {/* Sub-Category */}
      {subCategories.length > 0 && (
        <div className="field-group">
          <label className="label">Sub-Category</label>
          <select className="input-field" value={form.sub_category}
            onChange={e => set('sub_category', e.target.value)}>
            <option value="">Select sub-category…</option>
            {subCategories.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Qty + Unit */}
      <div className="field-row">
        <div className="field-group">
          <label className="label">Quantity *</label>
          <input className="input-field" type="number" min="0.01" step="0.01"
            value={form.qty_added} onChange={e => set('qty_added', e.target.value)}
            placeholder="0" />
          {errors.qty_added && <ErrorMsg msg={errors.qty_added} />}
        </div>
        <div className="field-group">
          <label className="label">Unit *</label>
          <select className="input-field" value={form.unit_type}
            onChange={e => set('unit_type', e.target.value)}>
            {options.UNIT_TYPE.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>

      {/* Dates */}
      <div className="field-row">
        <div className="field-group">
          <label className="label">Purchase Date *</label>
          <input className="input-field" type="date" value={form.purchase_date}
            onChange={e => set('purchase_date', e.target.value)} />
        </div>
        <div className="field-group">
          <label className="label">Expiry Date</label>
          <input className="input-field" type="date" value={form.expiry_date}
            onChange={e => set('expiry_date', e.target.value)} />
        </div>
      </div>

      {/* Storage + Track */}
      <div className="field-row">
        <div className="field-group">
          <label className="label">Storage *</label>
          <select className="input-field" value={form.storage_location}
            onChange={e => set('storage_location', e.target.value)}>
            {options.STORAGE_LOCATION.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label className="label">For *</label>
          <select className="input-field" value={form.consumption_track}
            onChange={e => set('consumption_track', e.target.value)}>
            {options.CONSUMPTION_TRACK.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Cost */}
      <div className="field-row">
        <div className="field-group">
          <label className="label">Unit Price (₹)</label>
          <input className="input-field" type="number" min="0" step="0.01"
            value={form.unit_price} onChange={e => set('unit_price', e.target.value)}
            placeholder="0.00" />
        </div>
        <div className="field-group">
          <label className="label">Supplier</label>
          <input className="input-field" value={form.supplier}
            onChange={e => set('supplier', e.target.value)} placeholder="e.g. DMart" />
        </div>
      </div>

      {/* Notes */}
      <div className="field-group">
        <label className="label">Notes</label>
        <input className="input-field" value={form.notes}
          onChange={e => set('notes', e.target.value)} placeholder="Optional" />
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
        <button className="btn btn-secondary btn-full" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary btn-full" onClick={handleSubmit} disabled={loading}>
          {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Add Stock'}
        </button>
      </div>
    </div>
  );
}


// ============================================================
// OutboundForm
// For drawing stock down from inventory.
// ============================================================
export function OutboundForm({ item, onSuccess, onCancel }) {
  const { options, showToast } = useApp();
  const { removeStock } = require('../api');

  const [qty,    setQty]    = useState('');
  const [reason, setReason] = useState('COOKING');
  const [notes,  setNotes]  = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!qty || parseFloat(qty) <= 0) { showToast('Enter a valid quantity', 'error'); return; }

    setLoading(true);
    try {
      await removeStock({
        item_id:         item.item_id,
        qty_removed:     parseFloat(qty),
        drawdown_reason: reason,
        notes,
      });
      showToast(`✓ ${item.product_name} updated`);
      onSuccess?.();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="bottom-sheet-title">Use / Draw Down</div>
      <div className="bottom-sheet-subtitle">{item.product_name} — {item.brand}</div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 2 }}>Current Stock</div>
        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: item.current_qty <= item.reorder_level ? 'var(--orange)' : 'var(--green)' }}>
          {item.current_qty} <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>{item.unit_type}</span>
        </div>
        {item.reorder_level > 0 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 3 }}>
            Reorder at {item.reorder_level} {item.unit_type}
          </div>
        )}
      </div>

      <div className="field-row">
        <div className="field-group">
          <label className="label">Quantity Used *</label>
          <input className="input-field" type="number" min="0.01" step="0.01"
            value={qty} onChange={e => setQty(e.target.value)}
            placeholder={`Max: ${item.current_qty}`} />
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
        <input className="input-field" value={notes}
          onChange={e => setNotes(e.target.value)} placeholder="Optional" />
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

function ErrorMsg({ msg }) {
  return <p style={{ fontSize: '0.72rem', color: 'var(--red)', marginTop: 3 }}>{msg}</p>;
}
