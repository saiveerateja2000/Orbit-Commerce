import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../services/api';
import { AuthContext } from '../App';

const styles = {
  wrapper: {
    minHeight: 'calc(100vh - 60px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f0f4ff',
    padding: '24px',
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
    padding: '40px',
    width: '100%',
    maxWidth: '420px',
  },
  title: { fontSize: '28px', fontWeight: '800', color: '#1a1a1a', marginBottom: '8px' },
  sub: { fontSize: '14px', color: '#666', marginBottom: '32px' },
  row: { display: 'flex', gap: '16px' },
  label: { display: 'block', fontSize: '13px', fontWeight: '600', color: '#444', marginBottom: '6px' },
  input: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '15px',
    outline: 'none',
    marginBottom: '20px',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  },
  btn: {
    width: '100%',
    padding: '12px',
    background: '#1a73e8',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '4px',
  },
  error: {
    background: '#ffebee',
    color: '#c62828',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '20px',
  },
  success: {
    background: '#e8f5e9',
    color: '#2e7d32',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '20px',
  },
  footer: { textAlign: 'center', marginTop: '24px', fontSize: '14px', color: '#666' },
  footerLink: { color: '#1a73e8', fontWeight: '600', textDecoration: 'none' },
};

export default function Register() {
  const { setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.email || !form.password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await register({
        username: form.username,
        email: form.email,
        password: form.password,
      });
      const data = res.data;
      const token = data.token || data.access_token;
      if (token) {
        localStorage.setItem('token', token);
        setUser(data.user || { email: form.email, username: form.username });
        navigate('/');
      } else {
        // Registration succeeded but no auto-login token — redirect to login
        navigate('/login');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Registration failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputFocus = (e) => (e.target.style.borderColor = '#1a73e8');
  const inputBlur = (e) => (e.target.style.borderColor = '#ddd');

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.title}>Create an account 🚀</div>
        <div style={styles.sub}>Join OrbitCommerce today — it's free!</div>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <label style={styles.label}>Username</label>
          <input
            style={styles.input}
            type="text"
            name="username"
            placeholder="johndoe"
            value={form.username}
            onChange={handleChange}
            autoComplete="username"
            onFocus={inputFocus}
            onBlur={inputBlur}
          />

          <label style={styles.label}>Email</label>
          <input
            style={styles.input}
            type="email"
            name="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
            onFocus={inputFocus}
            onBlur={inputBlur}
          />

          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            name="password"
            placeholder="Min. 6 characters"
            value={form.password}
            onChange={handleChange}
            autoComplete="new-password"
            onFocus={inputFocus}
            onBlur={inputBlur}
          />

          <label style={styles.label}>Confirm Password</label>
          <input
            style={styles.input}
            type="password"
            name="confirm"
            placeholder="Repeat your password"
            value={form.confirm}
            onChange={handleChange}
            autoComplete="new-password"
            onFocus={inputFocus}
            onBlur={inputBlur}
          />

          <button style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <div style={styles.footer}>
          Already have an account?{' '}
          <Link to="/login" style={styles.footerLink}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
