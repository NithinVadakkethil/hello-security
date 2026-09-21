'use client';

import { toJpeg, toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Download, FileText, Printer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../../../components/ui/Modal';
import CheckpointQrSticker from './CheckpointQrSticker';

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
  const downloadPdfFilename = `${fileBaseName}-52x40.pdf`;

  // Helper to generate a jsPDF document based on 52x40 mm Box P paper size
  const createPdf = async (): Promise<jsPDF> => {
    if (!checkpointPrintRef.current) {
      throw new Error('Print container reference not ready');
    }

    const dimensions: [number, number] = [52, 40];

    // High resolution capture (4x pixel ratio for sharp thermal scanning)
    const imgData = await toPng(checkpointPrintRef.current, {
      quality: 1.0,
      pixelRatio: 4,
      backgroundColor: '#ffffff',
      cacheBust: true,
    });

    const pdf = new jsPDF({
      orientation: 'landscape',
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
      toast.loading('Generating 52mm × 40mm [Box P] PDF...', { id: 'qr-pdf' });

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

      const widthMm = '52mm';
      const heightMm = '40mm';

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
                justify.content: center;
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
        {/* Paper Size / Format Indicator */}
        {/* <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--surface-color)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '0.78rem',
          }}
        >
          <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>
            Printer Media Size:
          </span>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid #000000',
              backgroundColor: '#f1f5f9',
              color: '#000000',
              fontWeight: 800,
              fontSize: '0.78rem',
            }}
          >
            52 × 40 mm (2.05" × 1.57") [Box P]
          </span>
        </div> */}

        {/*
          Bordered Checkpoint QR Sticker Component - Shared Single Source of Truth
          Format 52x40 mm (Box P): 384px Width x 280px Height (Landscape)
        */}
        <CheckpointQrSticker
          ref={checkpointPrintRef}
          companyName={companyName}
          siteName={siteName}
          gateName={gate.name}
          gateCode={gate.gateCode}
          qrDataUrl={qrDataUrl}
        />

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
