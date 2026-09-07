'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import { Download, Printer, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../../components/ui/Modal';
import { apiClient } from '../../../lib/axios';

interface GateItem {
  id: string;
  gateCode: string;
  name: string;
  description?: string | null;
  sequence: number;
  isActive: boolean;
}

interface BulkQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteId: string;
  siteName: string;
  companyName?: string;
  totalCheckpointsCount: number;
}

export default function BulkQrModal({
  isOpen,
  onClose,
  siteId,
  siteName,
  companyName = 'HELLO ORBIT',
  totalCheckpointsCount,
}: BulkQrModalProps) {
  const [paperFormat, setPaperFormat] = useState<'52x40' | '40x52'>('52x40');
  const [rangeType, setRangeType] = useState<'ALL' | 'PRESET' | 'BATCH' | 'CUSTOM'>('ALL');
  
  const [presetCount, setPresetCount] = useState<number>(10);
  const [selectedBatch, setSelectedBatch] = useState<{ from: number; to: number }>({ from: 1, to: Math.min(50, totalCheckpointsCount || 50) });
  
  const [customFrom, setCustomFrom] = useState<string>('1');
  const [customTo, setCustomTo] = useState<string>(String(totalCheckpointsCount || 10));

  // Progress & Generation states
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  // Hidden off-screen DOM ref for HTML-to-Image capture of batch QR labels
  const hiddenLabelRef = useRef<HTMLDivElement>(null);
  const [activeRenderGate, setActiveRenderGate] = useState<GateItem | null>(null);
  const [activeRenderQrUrl, setActiveRenderQrUrl] = useState<string>('');

  // Update default range if totalCheckpointsCount changes
  useEffect(() => {
    if (totalCheckpointsCount > 0) {
      setCustomTo(String(totalCheckpointsCount));
      setSelectedBatch({ from: 1, to: Math.min(50, totalCheckpointsCount) });
    }
  }, [totalCheckpointsCount]);

  // Generate dynamic 50-item batches
  const batchRanges = useMemo(() => {
    const total = totalCheckpointsCount || 0;
    if (total <= 0) return [];
    const chunkSize = 50;
    const list: { from: number; to: number }[] = [];
    for (let i = 1; i <= total; i += chunkSize) {
      const end = Math.min(i + chunkSize - 1, total);
      list.push({ from: i, to: end });
    }
    return list;
  }, [totalCheckpointsCount]);

  // Compute effective Range
  const effectiveRange = useMemo(() => {
    const total = totalCheckpointsCount || 0;
    if (rangeType === 'ALL') {
      return { from: 1, to: total, count: total };
    }
    if (rangeType === 'PRESET') {
      const to = Math.min(presetCount, total);
      return { from: 1, to, count: Math.max(0, to) };
    }
    if (rangeType === 'BATCH') {
      const count = Math.max(0, selectedBatch.to - selectedBatch.from + 1);
      return { from: selectedBatch.from, to: selectedBatch.to, count };
    }
    // CUSTOM
    const fromNum = parseInt(customFrom, 10);
    const toNum = parseInt(customTo, 10);
    if (isNaN(fromNum) || isNaN(toNum) || fromNum < 1 || toNum < fromNum) {
      return { from: 0, to: 0, count: 0, error: 'End sequence must be greater than or equal to start sequence.' };
    }
    if (toNum > total) {
      return { from: fromNum, to: toNum, count: toNum - fromNum + 1, error: `End sequence cannot exceed total site checkpoints (${total}).` };
    }
    return { from: fromNum, to: toNum, count: toNum - fromNum + 1 };
  }, [rangeType, presetCount, selectedBatch, customFrom, customTo, totalCheckpointsCount]);

  if (!isOpen) return null;

  // Helper to fetch Base64 QR Image Data URL
  const fetchQrDataBase64 = async (gateId: string): Promise<string> => {
    const rawQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(gateId)}`;
    try {
      const res = await fetch(rawQrUrl);
      const blob = await res.blob();
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string) || rawQrUrl);
        reader.onerror = () => resolve(rawQrUrl);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      return rawQrUrl;
    }
  };

  const handleGeneratePdf = async (shouldPrint = false) => {
    if (effectiveRange.error || effectiveRange.count <= 0 || isGenerating) return;

    try {
      setIsGenerating(true);
      setProgressPercent(0);
      setProgressMsg('Fetching checkpoints from server...');

      // 1. Fetch checkpoints sequence data from backend API
      const apiRes = await apiClient.get('/gates/bulk-range', {
        params: {
          siteId,
          fromSeq: rangeType === 'ALL' ? undefined : effectiveRange.from,
          toSeq: rangeType === 'ALL' ? undefined : effectiveRange.to,
        },
      });

      const items: GateItem[] = apiRes.data?.data?.items || apiRes.data?.items || [];

      if (!items || items.length === 0) {
        toast.error('No checkpoints found in the selected sequence range.');
        setIsGenerating(false);
        return;
      }

      const isLandscape = paperFormat === '52x40';
      const widthMm = isLandscape ? 52 : 40;
      const heightMm = isLandscape ? 40 : 52;
      const dimensions: [number, number] = [widthMm, heightMm];

      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: dimensions,
        compress: true,
      });

      // 2. Process each checkpoint sequentially in chunked loop
      for (let i = 0; i < items.length; i++) {
        const gate = items[i];
        const currentNum = i + 1;
        const total = items.length;

        setProgressMsg(`Generating QR ${currentNum} of ${total} (${gate.name})...`);
        setProgressPercent(Math.round((currentNum / total) * 100));

        // Fetch QR image
        const qrBase64 = await fetchQrDataBase64(gate.id);

        // Update hidden DOM template for capture
        setActiveRenderGate(gate);
        setActiveRenderQrUrl(qrBase64);

        // Yield to DOM to allow component re-render
        await new Promise((resolve) => setTimeout(resolve, 30));

        if (!hiddenLabelRef.current) {
          throw new Error('Capture template element not ready');
        }

        // Render HTML to ultra-sharp PNG (4x pixel ratio for thermal scanner accuracy)
        const imgData = await toPng(hiddenLabelRef.current, {
          quality: 1.0,
          pixelRatio: 4,
          backgroundColor: '#ffffff',
          cacheBust: true,
        });

        if (i > 0) {
          pdf.addPage(dimensions, isLandscape ? 'landscape' : 'portrait');
        }

        pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');

        // Short pause to ensure smooth event loop execution
        await new Promise((resolve) => setTimeout(resolve, 15));
      }

      const fileName = `bulk-qr-${siteName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-seq-${effectiveRange.from}-to-${effectiveRange.to}-${paperFormat}.pdf`;

      if (shouldPrint) {
        setProgressMsg('Opening print preview...');
        const blobUrl = pdf.output('bloburl');
        const printIframe = document.createElement('iframe');
        printIframe.style.position = 'fixed';
        printIframe.style.right = '0';
        printIframe.style.bottom = '0';
        printIframe.style.width = '0';
        printIframe.style.height = '0';
        printIframe.style.border = '0';
        printIframe.src = blobUrl.toString();

        document.body.appendChild(printIframe);
        printIframe.onload = () => {
          setTimeout(() => {
            printIframe.contentWindow?.focus();
            printIframe.contentWindow?.print();
          }, 200);
        };
        toast.success(`Prepared ${items.length} QR labels for print!`);
      } else {
        pdf.save(fileName);
        toast.success(`Downloaded bulk PDF with ${items.length} QR labels (${fileName})!`);
      }

      onClose();
    } catch (err: any) {
      console.error('Bulk QR Generation Error:', err);
      toast.error(err.response?.data?.message || 'Failed to generate bulk QR PDF. Please try again.');
    } finally {
      setIsGenerating(false);
      setProgressPercent(0);
      setProgressMsg('');
      setActiveRenderGate(null);
      setActiveRenderQrUrl('');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isGenerating && onClose()}
      title="Bulk Checkpoint QR Download & Print"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header Stats Banner */}
        <div
          style={{
            padding: '14px 16px',
            borderRadius: '10px',
            backgroundColor: 'var(--surface-color)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              SITE SCOPE: {siteName}
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: '2px', color: 'var(--text-primary)' }}>
              {totalCheckpointsCount} Total Registered Checkpoints
            </div>
          </div>
          <div
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              backgroundColor: 'var(--bg-secondary)',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: 'var(--primary)',
            }}
          >
            Sequence Order: 1 – {totalCheckpointsCount}
          </div>
        </div>

        {/* Media Format Selector */}
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', display: 'block', textTransform: 'uppercase' }}>
            Printer Media Size Format:
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => setPaperFormat('52x40')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: paperFormat === '52x40' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                backgroundColor: paperFormat === '52x40' ? 'var(--primary-glow)' : 'var(--surface-color)',
                color: 'var(--text-primary)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              52 × 40 mm (Box P Thermal Label)
            </button>
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => setPaperFormat('40x52')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: paperFormat === '40x52' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                backgroundColor: paperFormat === '40x52' ? 'var(--primary-glow)' : 'var(--surface-color)',
                color: 'var(--text-primary)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              40 × 52 mm (Vertical Portrait)
            </button>
          </div>
        </div>

        {/* Range Selection Tabs */}
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>
            Select Checkpoint Range:
          </label>

          {/* Quick Presets */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px' }}>Quick Presets:</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => setRangeType('ALL')}
                className="btn btn-secondary"
                style={{
                  fontSize: '0.8rem',
                  padding: '6px 12px',
                  backgroundColor: rangeType === 'ALL' ? 'var(--primary)' : undefined,
                  color: rangeType === 'ALL' ? '#ffffff' : undefined,
                }}
              >
                All Checkpoints (1–{totalCheckpointsCount})
              </button>
              {[10, 20, 50].map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={isGenerating}
                  onClick={() => {
                    setRangeType('PRESET');
                    setPresetCount(num);
                  }}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.8rem',
                    padding: '6px 12px',
                    backgroundColor: rangeType === 'PRESET' && presetCount === num ? 'var(--primary)' : undefined,
                    color: rangeType === 'PRESET' && presetCount === num ? '#ffffff' : undefined,
                  }}
                >
                  First {num} (1–{Math.min(num, totalCheckpointsCount)})
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic 50-item Print Batches */}
          {batchRanges.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px' }}>
                Print Batches (50 Checkpoints per Batch):
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', maxHeight: '120px', overflowY: 'auto', padding: '4px' }}>
                {batchRanges.map((b) => {
                  const isSelected = rangeType === 'BATCH' && selectedBatch.from === b.from && selectedBatch.to === b.to;
                  return (
                    <button
                      key={`${b.from}-${b.to}`}
                      type="button"
                      disabled={isGenerating}
                      onClick={() => {
                        setRangeType('BATCH');
                        setSelectedBatch(b);
                      }}
                      className="btn btn-secondary"
                      style={{
                        fontSize: '0.78rem',
                        padding: '4px 10px',
                        backgroundColor: isSelected ? 'var(--primary)' : undefined,
                        color: isSelected ? '#ffffff' : undefined,
                      }}
                    >
                      Seq {b.from} – {b.to} ({b.to - b.from + 1})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom Range Option */}
          <div>
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => setRangeType('CUSTOM')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                padding: 0,
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>+ Use Custom Sequence Range</span>
            </button>

            {rangeType === 'CUSTOM' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>From Sequence:</label>
                  <input
                    type="number"
                    min={1}
                    max={totalCheckpointsCount}
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.85rem', padding: '6px 10px' }}
                    disabled={isGenerating}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>To Sequence:</label>
                  <input
                    type="number"
                    min={1}
                    max={totalCheckpointsCount}
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.85rem', padding: '6px 10px' }}
                    disabled={isGenerating}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Selection Summary Box */}
        <div
          style={{
            padding: '14px',
            borderRadius: '8px',
            backgroundColor: effectiveRange.error ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-secondary)',
            border: effectiveRange.error ? '1px solid #ef4444' : '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {effectiveRange.error ? (
            <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={16} />
              <span>{effectiveRange.error}</span>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Selected Sequence Range:</span>
                <span style={{ color: 'var(--primary)' }}>Sequence {effectiveRange.from} – {effectiveRange.to}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total QR Labels to Generate:</span>
                <span style={{ color: 'var(--text-primary)' }}>{effectiveRange.count} QR Codes</span>
              </div>
            </>
          )}
        </div>

        {/* Large Export Confirmation Warning */}
        {effectiveRange.count > 100 && !effectiveRange.error && (
          <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '0.8rem', color: '#d97706', fontWeight: 600 }}>
            ⚠️ You are about to generate QR codes for {effectiveRange.count} checkpoints. This may take a few moments to compile into high-DPI printable PDF pages.
          </div>
        )}

        {/* Generation Progress Indicator */}
        {isGenerating && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
              <span>{progressMsg}</span>
              <span>{progressPercent}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  backgroundColor: 'var(--primary)',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Modal Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
          <button
            type="button"
            disabled={isGenerating}
            onClick={onClose}
            className="btn btn-secondary"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isGenerating || Boolean(effectiveRange.error) || effectiveRange.count <= 0}
            onClick={() => handleGeneratePdf(true)}
            className="btn btn-secondary"
            style={{ gap: '6px' }}
          >
            <Printer size={16} />
            <span>Print Batch ({effectiveRange.count})</span>
          </button>

          <button
            type="button"
            disabled={isGenerating || Boolean(effectiveRange.error) || effectiveRange.count <= 0}
            onClick={() => handleGeneratePdf(false)}
            className="btn btn-primary"
            style={{ gap: '6px' }}
          >
            <Download size={16} />
            <span>Download PDF Batch</span>
          </button>
        </div>
      </div>

      {/*
        OFF-SCREEN CHECKPOINT QR TEMPLATE FOR BULK CAPTURE
        Reuses the exact approved 52x40 / 40x52 layout as CheckpointQrModal
      */}
      <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', pointerEvents: 'none', zIndex: -1 }}>
        {activeRenderGate && (
          <div
            ref={hiddenLabelRef}
            style={{
              width: paperFormat === '52x40' ? '384px' : '280px',
              height: paperFormat === '52x40' ? '280px' : '384px',
              padding: '8px 10px',
              backgroundColor: '#ffffff',
              border: '2px solid #000000',
              borderRadius: '6px',
              boxSizing: 'border-box',
              color: '#000000',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              display: 'flex',
              flexDirection: paperFormat === '52x40' ? 'row' : 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
              overflow: 'hidden',
            }}
          >
            {/* Left Column / Header: Company & Site Name */}
            <div
              style={{
                display: 'flex',
                flexDirection: paperFormat === '52x40' ? 'column' : 'row',
                alignItems: 'center',
                justifyContent: 'center',
                writingMode: paperFormat === '52x40' ? 'vertical-rl' : undefined,
                transform: paperFormat === '52x40' ? 'rotate(180deg)' : undefined,
                whiteSpace: 'nowrap',
                gap: '6px',
                height: paperFormat === '52x40' ? '100%' : undefined,
                padding: '0 4px',
              }}
            >
              <div style={{ fontSize: '0.88rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#000000' }}>
                {companyName || 'HELLO ORBIT'}
              </div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#000000' }}>
                {siteName || 'Monitored Site'}
              </div>
            </div>

            {/* Center: QR Code Image */}
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
              {activeRenderQrUrl && (
                <img
                  src={activeRenderQrUrl}
                  alt={`QR Code for ${activeRenderGate.name}`}
                  style={{
                    width: paperFormat === '52x40' ? '185px' : '180px',
                    height: paperFormat === '52x40' ? '185px' : '180px',
                    display: 'block',
                    borderRadius: '6px',
                  }}
                />
              )}
            </div>

            {/* Right Column / Footer: Gate Name & Monospace Code */}
            <div
              style={{
                display: 'flex',
                flexDirection: paperFormat === '52x40' ? 'column' : 'row',
                alignItems: 'center',
                justifyContent: 'center',
                writingMode: paperFormat === '52x40' ? 'vertical-rl' : undefined,
                transform: paperFormat === '52x40' ? 'rotate(180deg)' : undefined,
                whiteSpace: 'nowrap',
                gap: '8px',
                height: paperFormat === '52x40' ? '100%' : undefined,
                padding: '0 4px',
              }}
            >
              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#000000' }}>
                {activeRenderGate.name}
              </div>

              <div
                style={{
                  display: 'inline-block',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '0.70rem',
                  fontWeight: 800,
                  color: '#000000',
                  backgroundColor: '#f1f5f9',
                  border: '1.5px solid #000000',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  letterSpacing: '0.04em',
                }}
              >
                {activeRenderGate.gateCode}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
