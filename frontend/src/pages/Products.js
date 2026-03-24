import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProducts } from '../services/api';

const CATEGORIES = ['All', 'Electronics', 'Clothing', 'Books', 'Home', 'Sports', 'Toys'];

const styles = {
  page: { maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' },
  title: { fontSize: '32px', fontWeight: '700', color: '#1a1a1a' },
  filters: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  filterBtn: (active) => ({
    padding: '6px 16px',
    borderRadius: '20px',
    border: `1px solid ${active ? '#1a73e8' : '#ddd'}`,
    background: active ? '#1a73e8' : '#fff',
    color: active ? '#fff' : '#444',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
  }),
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
  },
  cardImg: {
    width: '100%',
    height: '180px',
    background: 'linear-gradient(135deg, #e3f0ff 0%, #bbdefb 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '52px',
  },
  cardBody: { padding: '16px' },
  cardName: { fontSize: '15px', fontWeight: '600', color: '#1a1a1a', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  cardCategory: { fontSize: '12px', color: '#888', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  cardPrice: { fontSize: '20px', fontWeight: '700', color: '#1a73e8' },
  cardLink: {
    display: 'block',
    marginTop: '12px',
    background: '#1a73e8',
    color: '#fff',
    textAlign: 'center',
    textDecoration: 'none',
    padding: '8px',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '14px',
  },
  pagination: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '40px' },
  pageBtn: (disabled) => ({
    padding: '8px 20px',
    background: disabled ? '#f5f5f5' : '#1a73e8',
    color: disabled ? '#bbb' : '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: disabled ? 'default' : 'pointer',
    fontWeight: '600',
  }),
  pageInfo: { color: '#555', fontSize: '14px' },
  loader: { textAlign: 'center', padding: '64px', color: '#666', fontSize: '18px' },
  error: { textAlign: 'center', padding: '24px', color: '#c62828', background: '#ffebee', borderRadius: '8px' },
  empty: { textAlign: 'center', padding: '64px', color: '#888', fontSize: '18px' },
};

const EMOJIS = ['📦', '🎯', '⭐', '🔥', '💎', '🚀', '🎁', '🛍️'];

export default function Products() {
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    getProducts(page, category)
      .then((res) => {
        const data = res.data;
        const items = data.products || data.data || data || [];
        setProducts(Array.isArray(items) ? items : []);
        setTotalPages(data.total_pages || data.totalPages || data.pages || 1);
      })
      .catch(() => setError('Failed to load products. Please try again.'))
      .finally(() => setLoading(false));
  }, [page, category]);

  const handleCategory = (cat) => {
    setCategory(cat === 'All' ? '' : cat);
    setPage(1);
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.title}>Products</div>
        <div style={styles.filters}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              style={styles.filterBtn(category === (cat === 'All' ? '' : cat))}
              onClick={() => handleCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading && <div style={styles.loader}>Loading products…</div>}
      {error && <div style={styles.error}>{error}</div>}
      {!loading && !error && products.length === 0 && (
        <div style={styles.empty}>No products found.</div>
      )}

      {!loading && !error && products.length > 0 && (
        <>
          <div style={styles.grid}>
            {products.map((p, i) => (
              <div
                key={p.id}
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
                <div style={styles.cardImg}>{EMOJIS[(p.id || i) % EMOJIS.length]}</div>
                <div style={styles.cardBody}>
                  <div style={styles.cardName}>{p.name}</div>
                  {p.category && <div style={styles.cardCategory}>{p.category}</div>}
                  <div style={styles.cardPrice}>${Number(p.price).toFixed(2)}</div>
                  <Link to={`/products/${p.id}`} style={styles.cardLink}>View Details</Link>
                </div>
              </div>
            ))}
          </div>

          <div style={styles.pagination}>
            <button
              style={styles.pageBtn(page <= 1)}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              ← Prev
            </button>
            <span style={styles.pageInfo}>Page {page} of {totalPages}</span>
            <button
              style={styles.pageBtn(page >= totalPages)}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
