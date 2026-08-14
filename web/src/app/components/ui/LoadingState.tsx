import React from 'react';

interface LoadingStateProps {
  message?: string;
  variant?: 'page' | 'card' | 'inline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function LoadingState({
  message = 'Loading environment data...',
  variant = 'page',
  size = 'md',
  className = '',
}: LoadingStateProps) {
  // Dimension configurations for uniform scaling
  const dimensions = {
    sm: { badge: 44, logo: 26, ring: 56, halo: 72 },
    md: { badge: 64, logo: 40, ring: 80, halo: 104 },
    lg: { badge: 84, logo: 54, ring: 104, halo: 136 },
  }[size];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className={`orbit-loader-container variant-${variant} ${className}`}
    >
      <div className="orbit-loader-wrapper">
        {/* Pulsing ambient glow halo */}
        <div
          className="orbit-loader-pulse-halo"
          style={{
            width: `${dimensions.halo}px`,
            height: `${dimensions.halo}px`,
          }}
        />

        {/* Smooth ambient spinner ring */}
        <div
          className="orbit-loader-spinner-ring"
          style={{
            width: `${dimensions.ring}px`,
            height: `${dimensions.ring}px`,
          }}
        />

        {/* Central badge holding official Hello Orbit logo */}
        <div
          className="orbit-loader-badge"
          style={{
            width: `${dimensions.badge}px`,
            height: `${dimensions.badge}px`,
          }}
        >
          <img
            src="/assets/hello-orbit-logo.png"
            alt="Hello Orbit Logo"
            className="orbit-loader-logo-img"
          />
        </div>
      </div>

      {message && <p className="orbit-loader-text">{message}</p>}
    </div>
  );
}
