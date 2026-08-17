'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Download, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { toJpeg } from 'html-to-image';
import Modal from '../../../components/ui/Modal';

interface Gate {
  id: string;
  gateCode: string;
  name: string;
  description?: string | null;
  sequence: number;
  isActive: boolean;
}

interface CheckpointQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  gate: Gate | null;
  siteName: string;
  companyName?: string;
}

export default function CheckpointQrModal({
  isOpen,
  onClose,
  gate,
  siteName,
  companyName = 'HELLO ORBIT',
}: CheckpointQrModalProps) {
  const checkpointPrintRef = useRef<HTMLDivElement>(null);
  const [isGeneratingJpg, setIsGeneratingJpg] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (!gate) return;
    let isMounted = true;
    const rawQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(gate.id)}`;

    // Pre-fetch QR image to convert to Base64 Data URL to prevent CORS issues during HTML capture
    fetch(rawQrUrl)
      .then((res) => res.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (isMounted && reader.result) {
            setQrDataUrl(reader.result as string);
          }
        };
        reader.readAsDataURL(blob);
      })
      .catch(() => {
        if (isMounted) {
          setQrDataUrl(rawQrUrl);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [gate]);

  if (!gate) return null;

  const sanitizedGateName = gate.name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const downloadFilename = `checkpoint-${sanitizedGateName ? sanitizedGateName + '-' : ''}${gate.gateCode}.jpg`;

  const handleDownloadJpg = async () => {
    if (!checkpointPrintRef.current || isGeneratingJpg) return;

    try {
      setIsGeneratingJpg(true);

      const dataUrl = await toJpeg(checkpointPrintRef.current, {
        quality: 0.98,
        pixelRatio: 3, // High resolution rendering for sharp QR scanning
        backgroundColor: '#ffffff',
        cacheBust: true,
      });

      const link = document.createElement('a');
      link.download = downloadFilename;
      link.href = dataUrl;
      link.click();

      toast.success(`Downloaded ${downloadFilename}`);
    } catch (err: any) {
      console.error('Failed to generate JPG:', err);
      toast.error('Failed to generate JPG image. Please try again.');
    } finally {
      setIsGeneratingJpg(false);
    }
  };

  const handlePrint = () => {
    if (!gate) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print checkpoint.');
      return;
    }

    const qrImageSrc = qrDataUrl || `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(gate.id)}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Checkpoint QR - ${gate.gateCode}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 0;
              background-color: #ffffff;
              color: #0f172a;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }
            .qr-card-container {
              width: 360px;
              padding: 32px 28px;
              background-color: #ffffff;
              border: 3px double #0f172a;
              border-radius: 16px;
              text-align: center;
              box-shadow: none;
            }
            .company-name {
              font-size: 1.35rem;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              color: #0f172a;
              margin-bottom: 4px;
            }
            .site-name {
              font-size: 0.95rem;
              font-weight: 600;
              color: #475569;
              margin-bottom: 20px;
            }
            .qr-wrapper {
              background-color: #ffffff;
              padding: 16px;
              display: inline-block;
              border-radius: 12px;
              border: 1px solid #e2e8f0;
              margin-bottom: 20px;
            }
            .qr-img {
              width: 220px;
              height: 220px;
              display: block;
            }
            .gate-name {
              font-size: 1.2rem;
              font-weight: 700;
              color: #0f172a;
              margin-bottom: 4px;
            }
            .gate-code-badge {
              display: inline-block;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              font-size: 0.85rem;
              font-weight: 700;
              color: #2563eb;
              background-color: #eff6ff;
              padding: 4px 12px;
              border-radius: 6px;
              margin-bottom: 20px;
            }
            .card-footer {
              border-top: 1px dashed #cbd5e1;
              padding-top: 16px;
            }
            .footer-brand {
              font-size: 0.75rem;
              font-weight: 800;
              color: #0f172a;
              letter-spacing: 0.05em;
              margin-bottom: 4px;
            }
            .footer-instructions {
              font-size: 0.72rem;
              color: #64748b;
              line-height: 1.4;
              margin: 0;
            }
            @media print {
              body {
                min-height: auto;
              }
              @page {
                margin: 0.5cm;
              }
            }
          </style>
        </head>
        <body>
          <div class="qr-card-container">
            <div class="company-name">${companyName || 'HELLO ORBIT'}</div>
            <div class="site-name">${siteName || 'Monitored Site'}</div>
            <div class="qr-wrapper">
              <img class="qr-img" src="${qrImageSrc}" alt="Checkpoint QR Code" />
            </div>
            <div class="gate-name">${gate.name}</div>
            <div class="gate-code-badge">CHECKPOINT ID: ${gate.gateCode}</div>
            <div class="card-footer">
              <div class="footer-brand">HELLO ORBIT • POWERED BY ATLABS</div>
              <p class="footer-instructions">
                Scan this QR code using the Hello Orbit Guard mobile app to log check-in sequence status.
              </p>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Checkpoint QR: ${gate.name}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center' }}>
        {/* Bordered Checkpoint QR Card - Single Source of Truth for Capture & Display */}
        <div
          ref={checkpointPrintRef}
          style={{
            width: '360px',
            padding: '32px 28px',
            backgroundColor: '#ffffff',
            border: '3px double #0f172a',
            borderRadius: '16px',
            textAlign: 'center',
            boxSizing: 'border-box',
            color: '#0f172a',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          <div
            style={{
              fontSize: '1.35rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#0f172a',
              marginBottom: '4px',
            }}
          >
            {companyName || 'HELLO ORBIT'}
          </div>

          <div
            style={{
              fontSize: '0.95rem',
              fontWeight: 600,
              color: '#475569',
              marginBottom: '20px',
            }}
          >
            {siteName || 'Monitored Site'}
          </div>

          <div
            style={{
              backgroundColor: '#ffffff',
              padding: '16px',
              display: 'inline-block',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              marginBottom: '20px',
            }}
          >
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR Code for ${gate.name}`}
                style={{ width: '220px', height: '220px', display: 'block' }}
              />
            ) : (
              <div
                style={{
                  width: '220px',
                  height: '220px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                  fontSize: '0.85rem',
                }}
              >
                Loading QR...
              </div>
            )}
          </div>

          <div
            style={{
              fontSize: '1.2rem',
              fontWeight: 700,
              color: '#0f172a',
              marginBottom: '4px',
            }}
          >
            {gate.name}
          </div>

          <div
            style={{
              display: 'inline-block',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#2563eb',
              backgroundColor: '#eff6ff',
              padding: '4px 12px',
              borderRadius: '6px',
              marginBottom: '20px',
            }}
          >
            CHECKPOINT ID: {gate.gateCode}
          </div>

          <div
            style={{
              borderTop: '1px dashed #cbd5e1',
              paddingTop: '16px',
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '0.05em',
                marginBottom: '4px',
              }}
            >
              HELLO ORBIT • POWERED BY ATLABS
            </div>
            <p
              style={{
                fontSize: '0.72rem',
                color: '#64748b',
                lineHeight: 1.4,
                margin: 0,
              }}
            >
              Scan this QR code using the Hello Orbit Guard mobile app to log check-in sequence status.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            width: '100%',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={handlePrint}
            className="btn btn-secondary"
            style={{
              flex: 1,
              minWidth: '150px',
              gap: '8px',
              justifyContent: 'center',
              padding: '10px 16px',
            }}
          >
            <Printer size={18} />
            <span>Print Checkpoint</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadJpg}
            disabled={isGeneratingJpg}
            className="btn btn-primary"
            style={{
              flex: 1,
              minWidth: '150px',
              gap: '8px',
              justifyContent: 'center',
              padding: '10px 16px',
            }}
          >
            <Download size={18} />
            <span>{isGeneratingJpg ? 'Generating JPG...' : 'Download as JPG'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
