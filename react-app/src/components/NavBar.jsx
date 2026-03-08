import { NavLink } from 'react-router-dom';

const nav = [
  { to: '/',           icon: '⊞',  label: 'Home' },
  { to: '/scan',       icon: '⬡',  label: 'Scan' },
  { to: '/inventory',  icon: '☰',  label: 'Inventory' },
  { to: '/alerts',     icon: '◎',  label: 'Alerts' },
  { to: '/admin',      icon: '⚙',  label: 'Admin' },
];

export default function NavBar() {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      background: 'rgba(13,13,13,0.96)', backdropFilter: 'blur(16px)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'center',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {nav.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          style={({ isActive }) => ({
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '10px 4px 8px', textDecoration: 'none', gap: 3,
            color: isActive ? '#f0c040' : '#555',
            transition: 'color 0.15s',
          })}
        >
          <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{item.icon}</span>
          <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.04em' }}>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
