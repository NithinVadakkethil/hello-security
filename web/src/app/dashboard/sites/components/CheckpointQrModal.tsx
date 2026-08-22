'use client';

import { toJpeg, toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Download, FileText, Printer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [paperFormat, setPaperFormat] = useState<'52x40' | '40x52'>('52x40');
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

  const fileBaseName = `checkpoint-${sanitizedGateName ? sanitizedGateName + '-' : ''}${gate.gateCode}`;
  const downloadJpgFilename = `${fileBaseName}.jpg`;
  const downloadPdfFilename = `${fileBaseName}-${paperFormat}.pdf`;

  // Helper to generate a jsPDF document based on selected paper size format
  const createPdf = async (): Promise<jsPDF> => {
    if (!checkpointPrintRef.current) {
      throw new Error('Print container reference not ready');
    }

    const isLandscape = paperFormat === '52x40';
    const dimensions: [number, number] = isLandscape ? [52, 40] : [40, 52];

    // High resolution capture (4x pixel ratio for sharp thermal scanning)
    const imgData = await toPng(checkpointPrintRef.current, {
      quality: 1.0,
      pixelRatio: 4,
      backgroundColor: '#ffffff',
      cacheBust: true,
    });

    const pdf = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: dimensions,
      compress: true,
    });

    // Render captured image to cover full page with 0 margins
    pdf.addImage(
      imgData,
      'PNG',
      0,
      0,
      dimensions[0],
      dimensions[1],
      undefined,
      'FAST',
    );
    return pdf;
  };

  const handleDownloadJpg = async () => {
    if (!checkpointPrintRef.current || isGeneratingJpg) return;

    try {
      setIsGeneratingJpg(true);

      const dataUrl = await toJpeg(checkpointPrintRef.current, {
        quality: 0.98,
        pixelRatio: 4, // High resolution rendering for sharp QR scanning
        backgroundColor: '#ffffff',
        cacheBust: true,
      });

      const link = document.createElement('a');
      link.download = downloadJpgFilename;
      link.href = dataUrl;
      link.click();

      toast.success(`Downloaded ${downloadJpgFilename}`);
    } catch (err: any) {
      console.error('Failed to generate JPG:', err);
      toast.error('Failed to generate JPG image. Please try again.');
    } finally {
      setIsGeneratingJpg(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!checkpointPrintRef.current || isGeneratingPdf) return;

    try {
      setIsGeneratingPdf(true);
      toast.loading(
        `Generating ${paperFormat === '52x40' ? '52mm × 40mm' : '40mm × 52mm'} PDF...`,
        { id: 'qr-pdf' },
      );

      const pdf = await createPdf();
      pdf.save(downloadPdfFilename);

      toast.dismiss('qr-pdf');
      toast.success(`Downloaded ${downloadPdfFilename}`);
    } catch (err: any) {
      console.error('Failed to generate PDF:', err);
      toast.dismiss('qr-pdf');
      toast.error('Failed to generate PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = async () => {
    if (!gate || !checkpointPrintRef.current || isGeneratingPdf) return;

    try {
      setIsGeneratingPdf(true);
      toast.loading('Preparing label for printer...', { id: 'qr-print' });

      // Generate ultra high DPI PNG data URL (pixelRatio: 4 for crisp thermal QR scanning)
      const imgDataUrl = await toPng(checkpointPrintRef.current, {
        quality: 1.0,
        pixelRatio: 4,
        backgroundColor: '#ffffff',
        cacheBust: true,
      });

      toast.dismiss('qr-print');

      const isLandscape = paperFormat === '52x40';
      const widthMm = isLandscape ? '52mm' : '40mm';
      const heightMm = isLandscape ? '40mm' : '52mm';

      // Create cross-platform compatible hidden iframe for printing
      // Overrides Windows default print margins with @page { margin: 0 !important; }
      const printIframe = document.createElement('iframe');
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = '0';
      printIframe.style.visibility = 'hidden';

      document.body.appendChild(printIframe);

      const iframeDoc = printIframe.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error('Failed to open iframe document');
      }

      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Checkpoint QR - ${gate.gateCode}</title>
            <style>
              @page {
                size: ${widthMm} ${heightMm};
                margin: 0 !important;
              }
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
              }
              html, body {
                width: ${widthMm};
                height: ${heightMm};
                overflow: hidden;
                background: #ffffff;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .label-img {
                width: ${widthMm};
                height: ${heightMm};
                display: block;
                object-fit: contain;
              }
            </style>
          </head>
          <body>
            <img class="label-img" src="${imgDataUrl}" alt="QR Label" />
          </body>
        </html>
      `);
      iframeDoc.close();

      const img = iframeDoc.querySelector('img');
      const triggerPrint = () => {
        setTimeout(() => {
          try {
            printIframe.contentWindow?.focus();
            printIframe.contentWindow?.print();
          } catch (e) {
            console.error('Print trigger error:', e);
          } finally {
            setTimeout(() => {
              if (document.body.contains(printIframe)) {
                document.body.removeChild(printIframe);
              }
            }, 2000);
          }
        }, 150);
      };

      if (img?.complete) {
        triggerPrint();
      } else if (img) {
        img.onload = triggerPrint;
        img.onerror = () => {
          if (document.body.contains(printIframe)) {
            document.body.removeChild(printIframe);
          }
          toast.error('Failed to load print image');
        };
      }
    } catch (err: any) {
      console.error('Failed to print label:', err);
      toast.dismiss('qr-print');
      toast.error('Failed to prepare label for printing.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Checkpoint QR: ${gate.name}`}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          alignItems: 'center',
        }}
      >
        {/* Paper Size / Format Selector */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--surface-color)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '4px 8px',
            fontSize: '0.78rem',
          }}
        >
          <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>
            Printer Media Size:
          </span>
          <button
            type="button"
            onClick={() => setPaperFormat('52x40')}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border:
                paperFormat === '52x40'
                  ? '1px solid #000000'
                  : '1px solid transparent',
              backgroundColor:
                paperFormat === '52x40' ? '#f1f5f9' : 'transparent',
              color: '#000000',
              fontWeight: 800,
              cursor: 'pointer',
              fontSize: '0.78rem',
            }}
          >
            52 × 40 mm (2.05" × 1.57") [Box P]
          </button>
          <button
            type="button"
            onClick={() => setPaperFormat('40x52')}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border:
                paperFormat === '40x52'
                  ? '1px solid #000000'
                  : '1px solid transparent',
              backgroundColor:
                paperFormat === '40x52' ? '#f1f5f9' : 'transparent',
              color: '#000000',
              fontWeight: 800,
              cursor: 'pointer',
              fontSize: '0.78rem',
            }}
          >
            40 × 52 mm (1.57" × 2.05")
          </button>
        </div>

        {/*
          Bordered Checkpoint QR Card - Single Source of Truth for Capture & Display
          Format 52x40: 364px Width x 280px Height (Optimized 185px QR size for clean text alignment)
          Format 40x52: 280px Width x 364px Height (Vertical / Portrait)
        */}
        {paperFormat === '52x40' ? (
          <div
            ref={checkpointPrintRef}
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
                whiteSpace: 'nowrap',
                gap: '6px',
                height: '100%',
                padding: '0 4px',
              }}
            >
              <div
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: '#000000',
                }}
              >
                {companyName || 'HELLO ORBIT'}
              </div>
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#000000',
                }}
              >
                {siteName || 'Monitored Site'}
              </div>
            </div>

            {/* Center Column: Perfectly Proportioned Square QR Code (185px) */}
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
              }}
            >
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR Code for ${gate.name}`}
                  style={{
                    width: '185px',
                    height: '185px',
                    display: 'block',
                    borderRadius: '6px',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '185px',
                    height: '185px',
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
                whiteSpace: 'nowrap',
                gap: '8px',
                height: '100%',
                padding: '0 4px',
              }}
            >
              <div
                style={{
                  fontSize: '0.86rem',
                  fontWeight: 800,
                  color: '#000000',
                }}
              >
                {gate.name}
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
                }}
              >
                CHECKPOINT ID: {gate.gateCode}
              </div>
            </div>

            {/* Vertical Dashed Line Divider */}
            <div
              style={{
                height: '100%',
                borderLeft: '1.5px dashed #000000',
                margin: '0 3px',
              }}
            />

            {/* Far-Right Column: Footer Brand & Instructions */}
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
              {/* <p
                style={{
                  fontSize: '0.52rem',
                  fontWeight: 700,
                  color: '#000000',
                  lineHeight: 1.15,
                  margin: 0,
                }}
              >
                Scan this QR code using the Hello Orbit Guard mobile app to log
                check-in sequence status.
              </p> */}
            </div>
          </div>
        ) : (
          <div
            ref={checkpointPrintRef}
            style={{
              width: '280px',
              height: '364px',
              padding: '8px 10px',
              backgroundColor: '#ffffff',
              border: '2px solid #000000',
              borderRadius: '6px',
              textAlign: 'center',
              boxSizing: 'border-box',
              color: '#000000',
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'center',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ width: '100%', marginTop: '4px' }}>
              <div
                style={{
                  fontSize: '0.92rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: '#000000',
                  lineHeight: 1.15,
                  marginBottom: '1px',
                }}
              >
                {companyName || 'HELLO ORBIT'}
              </div>

              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#000000',
                  lineHeight: 1.15,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {siteName || 'Monitored Site'}
              </div>
            </div>

            {/* QR Code Container */}
            <div
              style={{
                backgroundColor: '#ffffff',
                padding: '6px',
                display: 'inline-block',
                borderRadius: '8px',
                border: '1.5px solid #000000',
                margin: '8px 0',
              }}
            >
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR Code for ${gate.name}`}
                  style={{ width: '165px', height: '165px', display: 'block' }}
                />
              ) : (
                <div
                  style={{
                    width: '165px',
                    height: '165px',
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

            {/* Checkpoint Name & ID */}
            <div style={{ width: '100%' }}>
              <div
                style={{
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  color: '#000000',
                  lineHeight: 1.2,
                  marginBottom: '3px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {gate.name}
              </div>

              <div
                style={{
                  display: 'inline-block',
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: '#000000',
                  backgroundColor: '#f1f5f9',
                  border: '1.5px solid #000000',
                  padding: '2px 8px',
                  borderRadius: '4px',
                }}
              >
                CHECKPOINT ID: {gate.gateCode}
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                borderTop: '1.5px dashed #000000',
                paddingTop: '5px',
                width: '100%',
                marginTop: '6px',
              }}
            >
              <div
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  color: '#000000',
                  letterSpacing: '0.03em',
                  marginBottom: '2px',
                }}
              >
                HELLO ORBIT • POWERED BY ATLABS
              </div>
              <p
                style={{
                  fontSize: '0.58rem',
                  fontWeight: 700,
                  color: '#000000',
                  lineHeight: 1.2,
                  margin: 0,
                }}
              >
                Scan this QR code using the Hello Orbit Guard mobile app to log
                check-in sequence status.
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            width: '100%',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={handlePrint}
            disabled={isGeneratingPdf}
            className="btn btn-primary"
            style={{
              flex: 1,
              minWidth: '130px',
              gap: '6px',
              justifyContent: 'center',
              padding: '10px 14px',
              fontSize: '0.85rem',
            }}
          >
            <Printer size={16} />
            <span>
              {isGeneratingPdf ? 'Preparing...' : 'Print Check Point'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="btn btn-secondary"
            style={{
              flex: 1,
              minWidth: '130px',
              gap: '6px',
              justifyContent: 'center',
              padding: '10px 14px',
              fontSize: '0.85rem',
            }}
          >
            <FileText size={16} />
            <span>Download PDF</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadJpg}
            disabled={isGeneratingJpg}
            className="btn btn-secondary"
            style={{
              flex: 1,
              minWidth: '130px',
              gap: '6px',
              justifyContent: 'center',
              padding: '10px 14px',
              fontSize: '0.85rem',
            }}
          >
            <Download size={16} />
            <span>{isGeneratingJpg ? 'Saving JPG...' : 'Download as JPG'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
