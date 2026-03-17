'use client';

import { FormEvent, useState } from 'react';

export default function HomePage() {
  const [studentId, setStudentId] = useState('');
  const [signature, setSignature] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setIsCorrect(null);

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, signature }),
      });

      const data = await res.json();

      if (!data.ok) {
        setMessage(data.error ?? 'Submission failed.');
        setIsCorrect(false);
        return;
      }

      setMessage(data.isCorrect ? 'Correct.' : 'Incorrect.');
      setIsCorrect(data.isCorrect);
      setStudentId('');
      setSignature('');
    } catch {
      setMessage('Network error.');
      setIsCorrect(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <h1 style={styles.h1}>Lab Quiz Submission</h1>
        <p style={styles.p}>Enter your student ID and computed signature.</p>

        <form onSubmit={onSubmit} style={styles.form}>
          <label style={styles.label}>Student ID</label>
          <input
            style={styles.input}
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            required
          />

          <label style={styles.label}>Signature</label>
          <input
            style={styles.input}
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            required
          />

          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit'}
          </button>
        </form>

        {message && (
          <div
            style={{
              ...styles.message,
              background: isCorrect ? '#e8f5e9' : '#ffebee',
              color: isCorrect ? '#1b5e20' : '#b71c1c',
            }}
          >
            {message}
          </div>
        )}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: 24,
    background: '#f7f7f7',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    background: '#fff',
    padding: 24,
    borderRadius: 12,
    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
  },
  h1: { margin: 0, marginBottom: 8, fontSize: 28 },
  p: { marginTop: 0, color: '#555' },
  form: { display: 'grid', gap: 12, marginTop: 20 },
  label: { fontWeight: 600 },
  input: {
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #ccc',
    fontSize: 16,
  },
  button: {
    marginTop: 8,
    padding: '12px 16px',
    borderRadius: 8,
    border: 'none',
    background: '#111',
    color: '#fff',
    fontSize: 16,
    cursor: 'pointer',
  },
  message: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    fontWeight: 600,
  },
};