import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import NavBar from './components/NavBar';
import Dashboard from './pages/Dashboard';
import Scan from './pages/Scan';
import Inventory from './pages/Inventory';
import Alerts from './pages/Alerts';
import OpenContainers from './pages/OpenContainers';
import Admin from './pages/Admin';
import { getOptions, getCategories } from './api';

// ── App Context ───────────────────────────────────────────────
export const AppContext = createContext(null);

export function useApp() {
  return useContext(AppContext);
}

// ── Styles ────────────────────────────────────────────────────
const styles = `
  :root {
    --bg:       #0d0d0d;
    --surface:  #141414;
    --surface2: #1a1a1a;
    --border:   rgba(255,255,255,0.08);
    --text:     #e8e8e8;
    --muted:    #666;
    --gold:     #f0c040;
    --green:    #80e098;
    --blue:     #88c8ff;
    --red:      #e57373;
    --orange:   #ffb74d;
  }

  .page { padding: 16px 16px 100px; max-width: 600px; margin: 0 auto; }
  .page-title { font-size: 1.4rem; font-weight: 700; color: var(--text); margin-bottom: 4px; }
  .page-subtitle { font-size: 0.82rem; color: var(--muted); margin-bottom: 20px; }

  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
  .card + .card { margin-top: 10px; }

  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 10px 18px; border-radius: 8px; font-size: 0.87rem; font-weight: 600;
    cursor: pointer; border: none; transition: all 0.15s; }
  .btn-primary { background: var(--gold); color: #0d0d0d; }
  .btn-primary:hover { background: #e8b830; }
  .btn-secondary { background: var(--surface2); color: var(--text); border: 1px solid var(--border); }
  .btn-secondary:hover { border-color: var(--gold); }
  .btn-danger { background: rgba(229,115,115,0.15); color: var(--red); border: 1px solid rgba(229,115,115,0.25); }
  .btn-sm { padding: 6px 12px; font-size: 0.78rem; }
  .btn-full { width: 100%; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .input-field { width: 100%; background: var(--surface2); border: 1px solid var(--border);
    color: var(--text); padding: 10px 12px; border-radius: 8px; font-size: 0.87rem;
    transition: border-color 0.15s; outline: none; }
  .input-field:focus { border-color: var(--gold); }
  .input-field::placeholder { color: var(--muted); }

  select.input-field { cursor: pointer; }
  select.input-field option { background: #1a1a1a; }

  .label { font-size: 0.75rem; font-weight: 600; color: var(--muted); margin-bottom: 5px;
    letter-spacing: 0.06em; text-transform: uppercase; display: block; }

  .field-group { margin-bottom: 14px; }
  .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

  .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; }
  .badge-green { background: rgba(128,224,152,0.12); color: var(--green); border: 1px solid rgba(128,224,152,0.2); }
  .badge-gold  { background: rgba(240,192,64,0.12); color: var(--gold); border: 1px solid rgba(240,192,64,0.2); }
  .badge-red   { background: rgba(229,115,115,0.12); color: var(--red); border: 1px solid rgba(229,115,115,0.2); }
  .badge-blue  { background: rgba(136,200,255,0.12); color: var(--blue); border: 1px solid rgba(136,200,255,0.2); }
  .badge-orange{ background: rgba(255,183,77,0.12); color: var(--orange); border: 1px solid rgba(255,183,77,0.2); }

  .divider { height: 1px; background: var(--border); margin: 14px 0; }

  .spinner { width: 20px; height: 20px; border: 2px solid var(--border);
    border-top-color: var(--gold); border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .empty-state { text-align: center; padding: 48px 24px; color: var(--muted); }
  .empty-state-icon { font-size: 2.5rem; margin-bottom: 12px; }
  .empty-state-title { font-size: 1rem; font-weight: 600; color: var(--text); margin-bottom: 4px; }
  .empty-state-desc { font-size: 0.84rem; }

  .bottom-sheet-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 200;
    backdrop-filter: blur(4px); animation: fadeIn 0.2s ease; }
  .bottom-sheet { position: fixed; left: 0; right: 0; bottom: 0; background: var(--surface);
    border-radius: 18px 18px 0 0; z-index: 201; max-height: 90vh; overflow-y: auto;
    animation: slideUp 0.25s ease; }
  .bottom-sheet-handle { width: 36px; height: 4px; background: #333; border-radius: 2px;
    margin: 10px auto 16px; }
  .bottom-sheet-content { padding: 0 20px 40px; }
  .bottom-sheet-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 4px; color: var(--text); }
  .bottom-sheet-subtitle { font-size: 0.8rem; color: var(--muted); margin-bottom: 20px; }

  @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }

  .toast { position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%);
    background: var(--surface2); border: 1px solid var(--border); color: var(--text);
    padding: 10px 18px; border-radius: 20px; font-size: 0.84rem; font-weight: 500;
    z-index: 300; white-space: nowrap; animation: toastIn 0.25s ease; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
  .toast-success { border-color: rgba(128,224,152,0.4); color: var(--green); }
  .toast-error   { border-color: rgba(229,115,115,0.4); color: var(--red); }
  @keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

  .list-item { display: flex; align-items: center; gap: 12px; padding: 13px 16px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
    cursor: pointer; transition: border-color 0.15s; }
  .list-item:hover { border-color: rgba(240,192,64,0.3); }
  .list-item + .list-item { margin-top: 6px; }

  .section-header { font-size: 0.72rem; font-weight: 700; color: var(--muted);
    letter-spacing: 0.12em; text-transform: uppercase; margin: 20px 0 10px; }
`;

export default function App() {
  const [options, setOptions] = useState(null);
  const [categories, setCategories] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    Promise.all([getOptions(), getCategories()])
      .then(([optRes, catRes]) => {
        setOptions(optRes.options);
        setCategories(catRes.categories);
      })
      .catch(err => console.error('Failed to load app config:', err));
  }, []);

  const showToast = (message, type = 'success', duration = 3000) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), duration);
  };

  return (
    <AppContext.Provider value={{ options, categories, showToast }}>
      <style>{styles}</style>
      <BrowserRouter>
        <Routes>
          <Route path="/"           element={<Dashboard />} />
          <Route path="/scan"       element={<Scan />} />
          <Route path="/inventory"  element={<Inventory />} />
          <Route path="/alerts"     element={<Alerts />} />
          <Route path="/containers" element={<OpenContainers />} />
          <Route path="/admin"      element={<Admin />} />
          <Route path="*"           element={<Navigate to="/" />} />
        </Routes>
        <NavBar />
        {toast && (
          <div className={`toast toast-${toast.type}`}>{toast.message}</div>
        )}
      </BrowserRouter>
    </AppContext.Provider>
  );
}
