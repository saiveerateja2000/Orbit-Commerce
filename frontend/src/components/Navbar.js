import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../App';

const styles = {
  nav: {
    backgroundColor: '#1a73e8',
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '60px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  brand: {
    color: '#fff',
    textDecoration: 'none',
    fontSize: '22px',
    fontWeight: '700',
    letterSpacing: '-0.5px',
  },
  links: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  link: {
    color: '#fff',
    textDecoration: 'none',
    padding: '6px 14px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background 0.15s',
  },
  logoutBtn: {
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.4)',
    color: '#fff',
    padding: '6px 14px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
};

function NavLink({ to, children }) {
  return (
    <Link
      to={to}
      style={styles.link}
      onMouseEnter={(e) => (e.target.style.background = 'rgba(255,255,255,0.2)')}
      onMouseLeave={(e) => (e.target.style.background = 'transparent')}
    >
      {children}
    </Link>
  );
}

export default function Navbar() {
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/');
  };

  return (
    <nav style={styles.nav}>
      <Link to="/" style={styles.brand}>🛸 OrbitCommerce</Link>
      <div style={styles.links}>
        <NavLink to="/">Home</NavLink>
        <NavLink to="/products">Products</NavLink>
        {user ? (
          <>
            <NavLink to="/orders">Orders</NavLink>
            <button style={styles.logoutBtn} onClick={handleLogout}>
              Logout ({user.email || user.username || 'User'})
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login">Login</NavLink>
            <NavLink to="/register">Register</NavLink>
          </>
        )}
      </div>
    </nav>
  );
}
