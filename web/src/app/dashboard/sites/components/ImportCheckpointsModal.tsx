'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Search,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../../components/ui/Modal';
import { apiClient } from '../../../lib/axios';

interface ImportCheckpointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteId: string;
  siteName: string;
  onImportSuccess?: () => void;
}

interface ImportError {
  row: number;
  checkpointName?: string;
  field: string;
  message: string;
}

interface ImportPreviewItem {
  rowIndex: number;
  checkpointCode: string;
  checkpointName: string;
  sequence: number | string;
  role: string;
  roleDisplay: string;
  taskName: string;
  status: 'VALID' | 'WARNING' | 'ERROR';
  message?: string;
}

interface ImportValidationResult {
  siteId: string;
  siteName: string;
  totalRows: number;
  validRows: number;
  errorCount: number;
  warningCount: number;
  checkpointsCount: number;
  subtasksCount: number;
  subtasksByRole: Record<string, number>;
  existingCheckpointsCount: number;
  newCheckpointsToCreate: number;
  existingSubtasksSkippedCount: number;
  newSubtasksToCreateCount: number;
  errors: ImportError[];
  preview: ImportPreviewItem[];
}

export default function ImportCheckpointsModal({
  isOpen,
  onClose,
  siteId,
  siteName,
  onImportSuccess,
}: ImportCheckpointsModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executeSummary, setExecuteSummary] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  const resetState = () => {
    setStep(1);
    setSelectedFile(null);
    setValidationResult(null);
    setIsValidating(false);
    setIsExecuting(false);
    setExecuteSummary(null);
    setSearchTerm('');
    setRoleFilter('ALL');
  };

  const handleClose = () => {
    if (isExecuting) return; // Prevent closing mid-execution
    resetState();
    onClose();
  };

  const { data: checkpointCount } = useQuery({
    queryKey: ['site-checkpoint-count', siteId],
    queryFn: async () => {
      if (!siteId) return 0;
      const res: any = await apiClient.get('/gates', {
        params: { siteId, page: 1, limit: 1 },
      });
      const total =
        res?.pagination?.total ??
        (Array.isArray(res?.data) ? res.data.length : (res?.data?.length || 0));
      return total;
    },
    enabled: isOpen && !!siteId,
  });

  const showDownloadTemplate = typeof checkpointCount === 'number' && checkpointCount > 0;

  const handleDownloadTemplate = async () => {
    try {
      setIsDownloadingTemplate(true);
      const res: any = await apiClient.get(`/sites/${siteId}/import-template`, {
        responseType: 'blob',
      });
      const blob =
        res instanceof Blob
          ? res
          : new Blob([res?.data || res], {
              type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cleanSiteName = siteName ? siteName.toLowerCase().replace(/[\s_\-]+/g, '_') : siteId;
      link.setAttribute('download', `checkpoint_export_${cleanSiteName}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Downloaded site configuration for "${siteName}"!`);
    } catch (err) {
      toast.error('Failed to download import template.');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
    }
  };

  const handleValidate = async () => {
    if (!selectedFile) {
      toast.error('Please select an Excel (.xlsx) or CSV file first.');
      return;
    }

    try {
      setIsValidating(true);
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res: any = await apiClient.post(`/sites/${siteId}/import-checkpoints/validate`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const validationData: ImportValidationResult = res?.data || res?.data?.data || res;

      if (!validationData || typeof validationData.validRows !== 'number') {
        toast.error('Invalid validation response format received from server.');
        return;
      }

      setValidationResult(validationData);

      // Automatically move to STEP 3 (PREVIEW) if validation succeeds with zero blocking errors
      if (validationData.errorCount === 0 && validationData.validRows > 0) {
        setStep(3);
      } else {
        setStep(2);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to validate import file.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!selectedFile) return;

    try {
      setStep(4);
      setIsExecuting(true);
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res: any = await apiClient.post(`/sites/${siteId}/import-checkpoints/execute`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const summary = res?.data || res?.data?.data || res;
      setExecuteSummary(summary);
      setIsExecuting(false);
      setStep(5);
      if (onImportSuccess) {
        onImportSuccess();
      }
    } catch (err: any) {
      setIsExecuting(false);
      setStep(3);
      toast.error(err.response?.data?.message || 'Failed to execute import.');
    }
  };

  const handleDownloadErrorReport = () => {
    if (!validationResult || !validationResult.errors.length) return;
    const textLines = [
      `IMPORT VALIDATION ERROR REPORT`,
      `Site: ${siteName} (${siteId})`,
      `File: ${selectedFile?.name || 'Uploaded File'}`,
      `Total Errors: ${validationResult.errors.length}`,
      `--------------------------------------------------`,
      ...validationResult.errors.map(
        (err) => `Row ${err.row}: [${err.field}] ${err.message}`
      ),
    ];
    const blob = new Blob([textLines.join('\n')], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import_error_report_${siteId}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredPreview = (validationResult?.preview || []).filter((item) => {
    const matchesSearch =
      searchTerm === '' ||
      item.checkpointName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.checkpointCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.taskName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'ALL' || item.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Bulk Import Checkpoints — ${siteName}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* WIZARD STEPPER HEADER */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '10px',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          <div style={{ color: step >= 1 ? 'var(--primary-color)' : 'var(--text-secondary)' }}>
            1. Upload File
          </div>
          <span>&rarr;</span>
          <div style={{ color: step >= 2 ? 'var(--primary-color)' : 'var(--text-secondary)' }}>
            2. Validate
          </div>
          <span>&rarr;</span>
          <div style={{ color: step >= 3 ? 'var(--primary-color)' : 'var(--text-secondary)' }}>
            3. Preview
          </div>
          <span>&rarr;</span>
          <div style={{ color: step >= 5 ? 'var(--success)' : 'var(--text-secondary)' }}>
            4. Summary
          </div>
        </div>

        {/* STEP 1: UPLOAD FILE & DOWNLOAD TEMPLATE */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {showDownloadTemplate && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-color)',
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
                    Need Existing Checkpoint Data?
                  </h4>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Export current site checkpoints & role subtasks to an Excel spreadsheet.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={isDownloadingTemplate}
                  className="btn btn-secondary"
                  style={{ gap: '6px', fontSize: '0.85rem', padding: '8px 14px' }}
                >
                  {isDownloadingTemplate ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  <span>Export Site Data</span>
                </button>
              </div>
            )}

            <div
              style={{
                border: '2px dashed var(--border-color)',
                borderRadius: '12px',
                padding: '32px 24px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-color)',
                cursor: 'pointer',
              }}
              onClick={() => document.getElementById('import-file-input')?.click()}
            >
              <FileSpreadsheet size={40} style={{ margin: '0 auto 12px', color: 'var(--primary-color)' }} />
              <h4 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 600 }}>
                {selectedFile ? selectedFile.name : 'Choose Excel (.xlsx) or CSV file'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {selectedFile
                  ? `${(selectedFile.size / 1024).toFixed(1)} KB — Click to change file`
                  : 'Drag & drop or click to browse spreadsheet file'}
              </p>
              <input
                id="import-file-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
              <button type="button" onClick={handleClose} className="btn btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleValidate}
                disabled={!selectedFile || isValidating}
                className="btn btn-primary"
                style={{ gap: '8px' }}
              >
                {isValidating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Validating File...</span>
                  </>
                ) : (
                  <>
                    <span>Validate & Preview</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: VALIDATE DATA RESULTS */}
        {step === 2 && validationResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* VALIDATION SUMMARY BANNER */}
            <div
              style={{
                padding: '16px',
                borderRadius: '10px',
                backgroundColor:
                  validationResult.errorCount > 0
                    ? 'rgba(239, 68, 68, 0.08)'
                    : 'rgba(16, 185, 129, 0.08)',
                border:
                  validationResult.errorCount > 0
                    ? '1px solid #ef4444'
                    : '1px solid #10b981',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              {validationResult.errorCount > 0 ? (
                <AlertCircle size={22} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
              ) : (
                <CheckCircle2 size={22} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
              )}

              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                  {validationResult.errorCount > 0
                    ? `Validation Failed (${validationResult.errorCount} Error${validationResult.errorCount === 1 ? '' : 's'})`
                    : 'Validation Passed Successfully!'}
                </h4>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Detected <strong>{validationResult.checkpointsCount}</strong> unique checkpoint(s) and{' '}
                  <strong>{validationResult.subtasksCount}</strong> role subtask association(s) across{' '}
                  {validationResult.totalRows} spreadsheet row(s).
                </p>
              </div>
            </div>

            {/* ERROR TABLE IF ERRORS EXIST */}
            {validationResult.errorCount > 0 && (
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ef4444' }}>
                    Row Validation Errors ({validationResult.errors.length}):
                  </span>
                  <button
                    type="button"
                    onClick={handleDownloadErrorReport}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '4px 10px', gap: '4px' }}
                  >
                    <Download size={14} />
                    <span>Download Error Log</span>
                  </button>
                </div>

                <div
                  style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-color)',
                  }}
                >
                  <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-secondary)', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px', width: '60px' }}>Row</th>
                        <th style={{ padding: '8px 12px', width: '120px' }}>Field</th>
                        <th style={{ padding: '8px 12px' }}>Error Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validationResult.errors.map((err, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{err.row}</td>
                          <td style={{ padding: '8px 12px', color: '#ef4444' }}>{err.field}</td>
                          <td style={{ padding: '8px 12px' }}>{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn btn-secondary"
                style={{ gap: '6px' }}
              >
                <ArrowLeft size={16} />
                <span>Choose Different File</span>
              </button>

              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={validationResult.validRows === 0}
                className="btn btn-primary"
                style={{ gap: '8px' }}
              >
                <span>Proceed to Preview</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: IMPORT PREVIEW & CONFIRMATION */}
        {step === 3 && validationResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* METRICS SUMMARY CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <div
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Total Checkpoints
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '2px' }}>
                  {validationResult.checkpointsCount}
                </div>
              </div>

              <div
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Total Subtasks
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '2px' }}>
                  {validationResult.subtasksCount}
                </div>
              </div>

              <div
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  New Checkpoints
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981', marginTop: '2px' }}>
                  +{validationResult.newCheckpointsToCreate}
                </div>
              </div>

              <div
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Skipped Duplicates
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f59e0b', marginTop: '2px' }}>
                  {validationResult.existingSubtasksSkippedCount}
                </div>
              </div>
            </div>

            {/* ROLE BREAKDOWN BADGES */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Role Breakdown:
              </span>
              {Object.entries(validationResult.subtasksByRole).map(([role, count]) => (
                <span
                  key={role}
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    fontWeight: 600,
                  }}
                >
                  {role === 'CLEANER' ? 'House Keeping' : role}: {count}
                </span>
              ))}
            </div>

            {/* PREVIEW SEARCH & FILTER BAR */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flex: 1,
                  padding: '6px 12px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-color)',
                }}
              >
                <Search size={14} style={{ color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  placeholder="Filter preview by checkpoint or task..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary)',
                    width: '100%',
                    fontSize: '0.8rem',
                  }}
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-color)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                }}
              >
                <option value="ALL">All Roles</option>
                <option value="SECURITY">Security</option>
                <option value="CLEANER">House Keeping</option>
                <option value="TECHNICIAN">Technician</option>
                <option value="SUPERVISOR">Supervisor</option>
                <option value="MANAGER">Manager</option>
                <option value="SERVICE_ENGINEER">Service Engineer</option>
              </select>
            </div>

            {/* PREVIEW TABLE */}
            <div
              style={{
                maxHeight: '220px',
                overflowY: 'auto',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-color)',
              }}
            >
              <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px', width: '50px' }}>Row</th>
                    <th style={{ padding: '8px 12px', width: '120px' }}>Code</th>
                    <th style={{ padding: '8px 12px' }}>Checkpoint Name</th>
                    <th style={{ padding: '8px 12px', width: '120px' }}>Role</th>
                    <th style={{ padding: '8px 12px' }}>Subtask Name</th>
                    <th style={{ padding: '8px 12px', width: '80px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPreview.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                        {item.rowIndex}
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 500 }}>{item.checkpointCode}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{item.checkpointName}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--bg-secondary)',
                            fontSize: '0.75rem',
                          }}
                        >
                          {item.roleDisplay}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>{item.taskName}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: item.status === 'VALID' ? '#10b981' : '#ef4444',
                          }}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* CONFIRM BUTTONS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="btn btn-secondary"
                style={{ gap: '6px' }}
              >
                <ArrowLeft size={16} />
                <span>Back to Validation</span>
              </button>

              <button
                type="button"
                onClick={handleExecuteImport}
                className="btn btn-primary"
                style={{ gap: '8px', backgroundColor: '#10b981', borderColor: '#10b981' }}
              >
                <CheckCircle2 size={16} />
                <span>Confirm & Import ({validationResult.checkpointsCount} Checkpoints)</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: IMPORTING PROGRESS STATE */}
        {step === 4 && (
          <div style={{ padding: '32px 16px', textAlign: 'center' }}>
            <Loader2 size={48} className="animate-spin" style={{ margin: '0 auto 16px', color: 'var(--primary-color)' }} />
            <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 600 }}>
              Importing Checkpoints & Subtasks...
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Executing transactional batch creation for site "{siteName}". Please do not close this window.
            </p>
          </div>
        )}

        {/* STEP 5: COMPLETION SUMMARY */}
        {step === 5 && executeSummary && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '12px 0' }}>
            <div
              style={{
                padding: '20px',
                borderRadius: '12px',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid #10b981',
                textAlign: 'center',
              }}
            >
              <CheckCircle2 size={44} style={{ color: '#10b981', margin: '0 auto 12px' }} />
              <h3 style={{ margin: '0 0 4px', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Import Completed Successfully!
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Site: <strong>{siteName}</strong>
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Checkpoints Created
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>
                  {executeSummary.checkpointsCreated}
                </div>
              </div>

              <div
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Subtasks Created
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>
                  {executeSummary.subtasksCreated}
                </div>
              </div>

              <div
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Duplicates Skipped
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b', marginTop: '4px' }}>
                  {executeSummary.duplicatesSkipped}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button
                type="button"
                onClick={handleClose}
                className="btn btn-primary"
                style={{ padding: '10px 24px' }}
              >
                Done / View Site Checkpoints
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
