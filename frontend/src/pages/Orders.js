import React, { useEffect, useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getOrders } from '../services/api';
import { AuthContext } from '../App';

const STATUS_COLORS = {
  pending:    { bg: '#fff8e1', color: '#f57f17' },
  processing: { bg: '#e3f2fd', color: '#1565c0' },
  shipped:    { bg: '#f3e5f5', color: '#6a1b9a' },
  delivered:  { bg: '#e8f5e9', color: '#2e7d32' },
  cancelled:  { bg: '#ffebee', color: '#c62828' },
  cart:       { bg: '#f5f5f5', color: '#555' },
  paid:       { bg: '#e8f5e9', color: '#2e7d32' },
};

const styles = {
  page: { maxWidth: '900px', margin: '0 auto', padding: '40px 24px' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' },
  title: { fontSize: '32px', fontWeight: '800', color: '#1a1a1a' },
  shopBtn: {
    background: '#1a73e8',
    color: '#fff',
    padding: '10px 24px',
    borderRadius: '8px',
    textDecoration: 'none',
    fontWeight: '600',
    fontSize: '14px',
  },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' },
  th: { background: '#f8f9fa', padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #eee' },
  td: { padding: '16px', fontSize: '14px', color: '#333', borderBottom: '1px solid #f0f0f0' },
  statusBadge: (status) => ({
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '700',
    ...(STATUS_COLORS[status?.toLowerCase()] || { bg: '#f5f5f5', color: '#555' }),
    background: (STATUS_COLORS[status?.toLowerCase()] || { bg: '#f5f5f5' }).bg,
  }),
  loader: { textAlign: 'center', padding: '64px', color: '#666', fontSize: '18px' },
  error: { textAlign: 'center', padding: '24px', color: '#c62828', background: '#ffebee', borderRadius: '8px' },
  empty: {
    textAlign: 'center',
    padding: '80px 24px',
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  },
  emptyIcon: { fontSize: '56px', marginBottom: '16px' },
  emptyText: { fontSize: '20px', fontWeight: '700', color: '#1a1a1a', marginBottom: '8px' },
  emptySub: { fontSize: '14px', color: '#888', marginBottom: '24px' },
};

export default function Orders() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    getOrders()
      .then((res) => {
        const data = res.data;
        setOrders(Array.isArray(data) ? data : data.orders || data.data || []);
      })
      .catch(() => setError('Failed to load orders.'))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTotal = (order) => {
    const total = order.total || order.total_price || order.amount;
    return total ? `$${Number(total).toFixed(2)}` : '—';
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.title}>My Orders</div>
        <Link to="/products" style={styles.shopBtn}>+ New Order</Link>
      </div>

      {loading && <div style={styles.loader}>Loading orders…</div>}
      {error && <div style={styles.error}>{error}</div>}

      {!loading && !error && orders.length === 0 && (
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>🛍️</div>
          <div style={styles.emptyText}>No orders yet</div>
          <div style={styles.emptySub}>Start shopping to see your orders here.</div>
          <Link to="/products" style={{ ...styles.shopBtn, display: 'inline-block' }}>Browse Products</Link>
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Order ID</th>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Items</th>
              <th style={styles.th}>Total</th>
              <th style={styles.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const status = order.status || 'pending';
              const itemCount = order.items?.length ?? order.item_count ?? '—';
              return (
                <tr
                  key={order.id}
                  style={{ cursor: 'default' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#fafafa')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ ...styles.td, fontWeight: '600', color: '#1a73e8' }}>#{order.id}</td>
                  <td style={styles.td}>{formatDate(order.created_at || order.createdAt)}</td>
                  <td style={styles.td}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</td>
                  <td style={{ ...styles.td, fontWeight: '700' }}>{formatTotal(order)}</td>
                  <td style={styles.td}>
                    <span style={styles.statusBadge(status)}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
