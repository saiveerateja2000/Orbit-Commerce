import React, { useState, useEffect, createContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Orders from './pages/Orders';
import { getMe } from './services/api';

export const AuthContext = createContext({ user: null, setUser: () => {} });

const styles = {
  app: { minHeight: '100vh', background: '#f7f9fc' },
  footer: {
    background: '#1a1a2e',
    color: '#aaa',
    textAlign: 'center',
    padding: '24px',
    fontSize: '13px',
    marginTop: '64px',
  },
};

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Restore session from stored token on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setAuthLoading(false);
      return;
    }
    getMe()
      .then((res) => setUser(res.data.user || res.data))
      .catch(() => {
        // Invalid/expired token — clear it
        localStorage.removeItem('token');
      })
      .finally(() => setAuthLoading(false));
  }, []);

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '18px', color: '#666' }}>
        Loading…
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <BrowserRouter>
        <div style={styles.app}>
          <Navbar />
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:id" element={<ProductDetail />} />
              <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
              <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
              <Route
                path="/orders"
                element={
                  <ProtectedRoute user={user}>
                    <Orders />
                  </ProtectedRoute>
                }
              />
              {/* Catch-all → home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <footer style={styles.footer}>
            © {new Date().getFullYear()} OrbitCommerce. All rights reserved.
          </footer>
        </div>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
