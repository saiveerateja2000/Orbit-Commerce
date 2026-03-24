import React, { useEffect, useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getProducts } from '../services/api';
import { AuthContext } from '../App';

const styles = {
  hero: {
    background: 'linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%)',
    color: '#fff',
    textAlign: 'center',
    padding: '80px 24px',
  },
  heroTitle: { fontSize: '48px', fontWeight: '800', marginBottom: '16px' },
  heroSub: { fontSize: '20px', opacity: 0.9, marginBottom: '32px' },
  heroBtn: {
    display: 'inline-block',
    background: '#fff',
    color: '#1a73e8',
    padding: '14px 36px',
    borderRadius: '30px',
    textDecoration: 'none',
    fontWeight: '700',
    fontSize: '16px',
    boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
  },
  section: { maxWidth: '1200px', margin: '48px auto', padding: '0 24px' },
  sectionTitle: { fontSize: '28px', fontWeight: '700', color: '#1a1a1a', marginBottom: '24px' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '24px',
  },
  card: {
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    overflow: 'hidden',
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'pointer',
  },
  cardImg: {
    width: '100%',
    height: '180px',
    background: 'linear-gradient(135deg, #e3f0ff 0%, #bbdefb 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '48px',
  },
  cardBody: { padding: '16px' },
  cardName: { fontSize: '16px', fontWeight: '600', color: '#1a1a1a', marginBottom: '6px' },
  cardPrice: { fontSize: '20px', fontWeight: '700', color: '#1a73e8' },
  cardBtn: {
    display: 'block',
    marginTop: '12px',
    background: '#1a73e8',
    color: '#fff',
    border: 'none',
    padding: '8px 0',
    borderRadius: '6px',
    width: '100%',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'center',
    textDecoration: 'none',
    fontSize: '14px',
  },
  loader: { textAlign: 'center', padding: '48px', color: '#666', fontSize: '18px' },
  error: { textAlign: 'center', padding: '24px', color: '#c62828', background: '#ffebee', borderRadius: '8px' },
};

function ProductCard({ product }) {
  const navigate = useNavigate();
  const emoji = ['📦', '🎯', '⭐', '🔥', '💎', '🚀'][product.id % 6] || '📦';
  return (
    <div
      style={styles.card}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)';
      }}
    >
      <div style={styles.cardImg}>{emoji}</div>
      <div style={styles.cardBody}>
        <div style={styles.cardName}>{product.name}</div>
        <div style={styles.cardPrice}>${Number(product.price).toFixed(2)}</div>
        <Link to={`/products/${product.id}`} style={styles.cardBtn}>View Details</Link>
      </div>
    </div>
  );
}

export default function Home() {
  const { user } = useContext(AuthContext);
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getProducts(1)
      .then((res) => {
        const items = res.data.products || res.data.data || res.data || [];
        setFeatured(Array.isArray(items) ? items.slice(0, 4) : []);
      })
      .catch(() => setError('Could not load featured products.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* Hero */}
      <div style={styles.hero}>
        <div style={styles.heroTitle}>Your Universe of Products 🛸</div>
        <div style={styles.heroSub}>
          {user
            ? `Welcome back! Explore thousands of items.`
            : 'Discover, shop, and get it delivered. Sign up to start.'}
        </div>
        <Link to="/products" style={styles.heroBtn}>Shop Now</Link>
      </div>

      {/* Featured Products */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Featured Products</div>
        {loading && <div style={styles.loader}>Loading products…</div>}
        {error && <div style={styles.error}>{error}</div>}
        {!loading && !error && featured.length === 0 && (
          <div style={styles.loader}>No products available yet.</div>
        )}
        {!loading && !error && featured.length > 0 && (
          <div style={styles.grid}>
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
        {!loading && !error && (
          <div style={{ textAlign: 'center', marginTop: '32px' }}>
            <Link
              to="/products"
              style={{
                background: '#1a73e8',
                color: '#fff',
                padding: '12px 32px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '600',
              }}
            >
              View All Products →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
