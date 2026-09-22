'use client';

import React, { forwardRef } from 'react';

export interface CheckpointQrStickerProps {
  companyName?: string;
  siteName: string;
  gateName: string;
  gateCode: string;
  qrDataUrl: string;
}

/**
 * Standardized Checkpoint QR Sticker Component
 * Format: 52 × 40 mm (2.05" × 1.57") [Box P] - Landscape
 * Fixed 384px × 280px display box for 100% 1:1 crisp thermal printing.
 */
export const CheckpointQrSticker = forwardRef<
  HTMLDivElement,
  CheckpointQrStickerProps
>(({ companyName = 'HELLO ORBIT', siteName, gateName, gateCode, qrDataUrl }, ref) => {
  const isLongGateName = gateName.length > 25;
  const isMediumGateName = gateName.length > 15;
  const gateFontSize = isLongGateName ? '0.92rem' : isMediumGateName ? '0.98rem' : '1.08rem';

  return (
    <div
      ref={ref}
      style={{
        width: '384px',
        height: '280px',
        padding: '8px 10px',
        backgroundColor: '#ffffff',
        border: '2px solid #000000',
        borderRadius: '6px',
        boxSizing: 'border-box',
        color: '#000000',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '6px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Left Column: Vertical Text (Company & Site Name) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          gap: '6px',
          height: '100%',
          maxHeight: '260px',
          padding: '0 4px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            fontSize: '0.88rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: '#000000',
            whiteSpace: 'nowrap',
          }}
        >
          {companyName || 'HELLO ORBIT'}
        </div>
        <div
          style={{
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '0.92rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            color: '#000000',
            textAlign: 'center',
            lineHeight: 1.15,
            whiteSpace: 'normal',
            maxHeight: '170px',
            wordBreak: 'break-word',
          }}
        >
          {(siteName || 'Monitored Site').toUpperCase()}
        </div>
      </div>

      {/* Center Column: Perfectly Proportioned Square QR Code (146px) */}
      <div
        style={{
          backgroundColor: '#ffffff',
          padding: '4px',
          borderRadius: '10px',
          border: '2px solid #000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto',
          flexShrink: 0,
        }}
      >
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`QR Code for ${gateName}`}
            style={{
              width: '146px',
              height: '146px',
              display: 'block',
              borderRadius: '6px',
            }}
          />
        ) : (
          <div
            style={{
              width: '146px',
              height: '146px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000000',
              fontWeight: 700,
              fontSize: '0.75rem',
            }}
          >
            Loading QR...
          </div>
        )}
      </div>

      {/* Right Column: Gate Name & Monospace ID Badge */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          gap: '8px',
          height: '100%',
          maxHeight: '260px',
          padding: '0 4px',
          overflow: 'hidden',
          flex: 1,
        }}
      >
        <div
          style={{
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: gateFontSize,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            color: '#000000',
            textAlign: 'center',
            lineHeight: 1.2,
            whiteSpace: 'normal',
            maxHeight: '190px',
            wordBreak: 'break-word',
          }}
        >
          {(gateName || '').toUpperCase()}
        </div>

        <div
          style={{
            display: 'inline-block',
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '0.70rem',
            fontWeight: 800,
            color: '#000000',
            backgroundColor: '#f1f5f9',
            border: '1.5px solid #000000',
            padding: '4px 10px',
            borderRadius: '6px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          CHECKPOINT ID: {gateCode}
        </div>
      </div>

      {/* Vertical Dashed Line Divider */}
      <div
        style={{
          height: '100%',
          borderLeft: '1.5px dashed #000000',
          margin: '0 3px',
          flexShrink: 0,
        }}
      />

      {/* Far-Right Column: Footer Brand */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          whiteSpace: 'nowrap',
          gap: '6px',
          height: '100%',
          padding: '0 4px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: '0.58rem',
            fontWeight: 800,
            color: '#000000',
            letterSpacing: '0.03em',
          }}
        >
          HELLO ORBIT • POWERED BY ATLABS
        </div>
      </div>
    </div>
  );
});

CheckpointQrSticker.displayName = 'CheckpointQrSticker';

export default CheckpointQrSticker;
