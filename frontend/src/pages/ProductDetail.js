import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProduct, createOrder, createPayment } from '../services/api';
import { AuthContext } from '../App';

const styles = {
  page: { maxWidth: '960px', margin: '0 auto', padding: '40px 24px' },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#1a73e8',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '24px',
    padding: 0,
  },
  layout: { display: 'flex', gap: '48px', flexWrap: 'wrap' },
  imgBox: {
    flex: '0 0 320px',
    height: '320px',
    background: 'linear-gradient(135deg, #e3f0ff 0%, #bbdefb 100%)',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '100px',
  },
  info: { flex: 1, minWidth: '280px' },
  category: { fontSize: '12px', color: '#1a73e8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: '600' },
  name: { fontSize: '32px', fontWeight: '800', color: '#1a1a1a', marginBottom: '12px', lineHeight: 1.2 },
  price: { fontSize: '36px', fontWeight: '700', color: '#1a73e8', marginBottom: '20px' },
  desc: { fontSize: '15px', color: '#555', lineHeight: 1.7, marginBottom: '24px' },
  stockBadge: (inStock) => ({
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: '600',
    background: inStock ? '#e8f5e9' : '#ffebee',
    color: inStock ? '#2e7d32' : '#c62828',
    marginBottom: '24px',
  }),
  qtyRow: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' },
  qtyLabel: { fontSize: '14px', color: '#555', fontWeight: '600' },
  qtyBtn: {
    width: '32px', height: '32px', borderRadius: '8px',
    border: '1px solid #ddd', background: '#f5f5f5',
    fontSize: '18px', cursor: 'pointer', fontWeight: '700',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  qtyVal: { fontSize: '18px', fontWeight: '700', minWidth: '32px', textAlign: 'center' },
  btnRow: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  primaryBtn: {
    flex: 1,
    padding: '14px',
    background: '#1a73e8',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    minWidth: '140px',
  },
  secondaryBtn: {
    flex: 1,
    padding: '14px',
    background: '#fff',
    color: '#1a73e8',
    border: '2px solid #1a73e8',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    minWidth: '140px',
  },
  loader: { textAlign: 'center', padding: '80px', color: '#666', fontSize: '18px' },
  error: { textAlign: 'center', padding: '24px', color: '#c62828', background: '#ffebee', borderRadius: '8px' },
  toast: (type) => ({
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    background: type === 'success' ? '#2e7d32' : '#c62828',
    color: '#fff',
    padding: '14px 24px',
    borderRadius: '10px',
    fontWeight: '600',
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
    zIndex: 999,
    maxWidth: '320px',
  }),
};

const EMOJIS = ['📦', '🎯', '⭐', '🔥', '💎', '🚀', '🎁', '🛍️'];

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qty, setQty] = useState(1);
  const [toast, setToast] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    getProduct(id)
      .then((res) => setProduct(res.data.product || res.data))
      .catch(() => setError('Product not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const requireAuth = () => {
    if (!user) {
      navigate('/login');
      return false;
    }
    return true;
  };

  // "Add to Cart" — creates a draft order for UI feedback (no payment flow)
  const handleAddToCart = async () => {
    if (!requireAuth()) return;
    setActionLoading(true);
    try {
      await createOrder({
        items: [{ product_id: product.id, quantity: qty }],
        status: 'cart',
      });
      showToast(`${qty}× "${product.name}" added to your cart!`, 'success');
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Could not add to cart.';
      showToast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // "Buy Now" — creates order + payment and navigates to orders
  const handleBuyNow = async () => {
    if (!requireAuth()) return;
    setActionLoading(true);
    try {
      const orderRes = await createOrder({
        items: [{ product_id: product.id, quantity: qty }],
      });
      const order = orderRes.data.order || orderRes.data;
      await createPayment({
        order_id: order.id,
        amount: Number(product.price) * qty,
        method: 'card',
      });
      showToast('Order placed successfully!', 'success');
      setTimeout(() => navigate('/orders'), 1500);
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Checkout failed.';
      showToast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div style={styles.loader}>Loading…</div>;
  if (error) return <div style={{ padding: '40px 24px' }}><div style={styles.error}>{error}</div></div>;

  const emoji = EMOJIS[(product.id || 0) % EMOJIS.length];
  const inStock = product.stock === undefined || product.stock === null || Number(product.stock) > 0;

  return (
    <div style={styles.page}>
      <button style={styles.backBtn} onClick={() => navigate(-1)}>← Back to Products</button>

      <div style={styles.layout}>
        <div style={styles.imgBox}>{emoji}</div>

        <div style={styles.info}>
          {product.category && <div style={styles.category}>{product.category}</div>}
          <div style={styles.name}>{product.name}</div>
          <div style={styles.price}>${Number(product.price).toFixed(2)}</div>

          <div style={styles.stockBadge(inStock)}>
            {inStock ? '✓ In Stock' : '✗ Out of Stock'}
          </div>

          {product.description && (
            <div style={styles.desc}>{product.description}</div>
          )}

          {/* Quantity selector */}
          <div style={styles.qtyRow}>
            <span style={styles.qtyLabel}>Quantity:</span>
            <button
              style={styles.qtyBtn}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
            >−</button>
            <span style={styles.qtyVal}>{qty}</span>
            <button
              style={styles.qtyBtn}
              onClick={() => setQty((q) => q + 1)}
            >+</button>
          </div>

          <div style={styles.btnRow}>
            <button
              style={{ ...styles.secondaryBtn, opacity: actionLoading ? 0.6 : 1 }}
              onClick={handleAddToCart}
              disabled={actionLoading || !inStock}
            >
              🛒 Add to Cart
            </button>
            <button
              style={{ ...styles.primaryBtn, opacity: actionLoading ? 0.6 : 1 }}
              onClick={handleBuyNow}
              disabled={actionLoading || !inStock}
            >
              ⚡ Buy Now
            </button>
          </div>
        </div>
      </div>

      {toast && <div style={styles.toast(toast.type)}>{toast.message}</div>}
    </div>
  );
}
