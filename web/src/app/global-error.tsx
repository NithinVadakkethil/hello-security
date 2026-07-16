'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          backgroundColor: '#121214',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          margin: 0,
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '12px' }}>
          Something went wrong!
        </h2>
        <p style={{ color: '#8e8e9a', fontSize: '0.95rem', marginBottom: '24px', maxWidth: '480px' }}>
          An unexpected application-level error occurred. Please try reloading the page.
        </p>
        <button
          onClick={() => reset()}
          style={{
            backgroundColor: '#3b82f6',
            color: '#ffffff',
            border: 'none',
            padding: '12px 24px',
            fontSize: '0.9rem',
            fontWeight: 600,
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
