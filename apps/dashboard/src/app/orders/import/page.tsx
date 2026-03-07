'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';

interface CSVRow {
  [key: string]: string;
}

interface ValidationResult {
  rowNumber: number;
  status: 'valid' | 'error';
  errors: string[];
}

export default function ImportOrdersPage() {
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCSVData] = useState<CSVRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [importOptions, setImportOptions] = useState({
    skipErrors: false,
    updateExisting: false,
    createNewOnly: false
  });
  const [importProgress, setImportProgress] = useState(0);
  const [importComplete, setImportComplete] = useState(false);
  const [importResults, setImportResults] = useState({ created: 0, updated: 0, skipped: 0, failed: 0 });
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());

  const mockCSVHeaders = ['Customer Name', 'Email', 'Phone', 'Street', 'City', 'State', 'Zip', 'Product', 'Quantity', 'Price'];
  const mockCSVData: CSVRow[] = [
    { 'Customer Name': 'Rajesh Kumar', 'Email': 'rajesh@email.com', 'Phone': '+91-9876543210', 'Street': '123 MG Road', 'City': 'Bangalore', 'State': 'Karnataka', 'Zip': '560001', 'Product': 'Speaker', 'Quantity': '2', 'Price': '2499' },
    { 'Customer Name': 'Priya Singh', 'Email': 'priya@email.com', 'Phone': '+91-9876543211', 'Street': '', 'City': 'Mumbai', 'State': 'Maharashtra', 'Zip': '400001', 'Product': 'Mouse', 'Quantity': '1', 'Price': '1299' },
    { 'Customer Name': 'Amit Patel', 'Email': 'amit.patel@email.com', 'Phone': '+91-9876543212', 'Street': '45 Park Avenue', 'City': 'Delhi', 'State': 'Delhi', 'Zip': '110001', 'Product': 'Cable', 'Quantity': '5', 'Price': '499' },
    { 'Customer Name': 'Sneha Reddy', 'Email': 'sneha@email.com', 'Phone': '+91-9876543213', 'Street': '78 Jubilee Street', 'City': 'Hyderabad', 'State': 'Telangana', 'Zip': '500001', 'Product': 'Stand', 'Quantity': '1', 'Price': '1999' },
    { 'Customer Name': 'Vikram Kumar', 'Email': 'vikram@email.com', 'Phone': '+91-9876543214', 'Street': '200 Fort Road', 'City': 'Pune', 'State': 'Maharashtra', 'Zip': '411001', 'Product': 'Speaker', 'Quantity': '1', 'Price': '2499' }
  ];

  const requiredFields = ['customerName', 'email', 'city', 'state', 'zip', 'product', 'quantity', 'price'];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Simulate CSV parsing
      setCSVData(mockCSVData);
      setValidationResults([]);
      setImportComplete(false);
      setImportProgress(0);
    }
  };

  const handleDragDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setCSVData(mockCSVData);
      setValidationResults([]);
      setImportComplete(false);
      setImportProgress(0);
    }
  };

  const validateData = () => {
    const results: ValidationResult[] = [];
    let validCount = 0;
    let errorCount = 0;

    csvData.forEach((row, index) => {
      const rowErrors: string[] = [];

      // Validate required fields
      if (!row['Customer Name']?.trim()) {
        rowErrors.push('Customer name is required');
      }
      if (!row['Email']?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row['Email'])) {
        rowErrors.push('Valid email is required');
      }
      if (!row['City']?.trim()) {
        rowErrors.push('City is required');
      }
      if (!row['Zip']?.trim()) {
        rowErrors.push('Zip code is required');
      }
      if (!row['Product']?.trim()) {
        rowErrors.push('Product is required');
      }
      if (!row['Quantity'] || isNaN(parseInt(row['Quantity']))) {
        rowErrors.push('Valid quantity is required');
      }
      if (!row['Price'] || isNaN(parseFloat(row['Price']))) {
        rowErrors.push('Valid price is required');
      }

      if (rowErrors.length === 0) {
        validCount++;
        results.push({ rowNumber: index + 2, status: 'valid', errors: [] });
      } else {
        errorCount++;
        results.push({ rowNumber: index + 2, status: 'error', errors: rowErrors });
      }
    });

    setValidationResults(results);
  };

  const handleImport = () => {
    setImportProgress(0);
    const interval = setInterval(() => {
      setImportProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setImportComplete(true);
          setImportResults({ created: 4, updated: 0, skipped: 1, failed: 0 });
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const toggleErrorExpanded = (rowNumber: number) => {
    const newExpanded = new Set(expandedErrors);
    if (newExpanded.has(rowNumber)) {
      newExpanded.delete(rowNumber);
    } else {
      newExpanded.add(rowNumber);
    }
    setExpandedErrors(newExpanded);
  };

  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: 'var(--wl-bg)',
      padding: '20px',
      color: 'var(--wl-text)'
    } as React.CSSProperties,
    header: {
      marginBottom: '30px'
    } as React.CSSProperties,
    title: {
      fontSize: '32px',
      fontWeight: '700',
      marginBottom: '8px'
    } as React.CSSProperties,
    subtitle: {
      fontSize: '14px',
      color: 'var(--wl-muted)'
    } as React.CSSProperties,
    card: {
      backgroundColor: 'var(--wl-surface)',
      border: '1px solid var(--wl-border)',
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '20px'
    } as React.CSSProperties,
    sectionTitle: {
      fontSize: '16px',
      fontWeight: '600',
      marginBottom: '15px',
      color: 'var(--wl-text)'
    } as React.CSSProperties,
    dropZone: {
      border: '2px dashed var(--wl-border)',
      borderRadius: '8px',
      padding: '40px',
      textAlign: 'center' as const,
      cursor: 'pointer',
      transition: 'all 0.2s',
      backgroundColor: 'var(--wl-bg)'
    } as React.CSSProperties,
    dropZoneActive: {
      borderColor: 'var(--wl-primary)',
      backgroundColor: 'var(--wl-bg)'
    } as React.CSSProperties,
    dropIcon: {
      fontSize: '48px',
      marginBottom: '10px',
      color: 'var(--wl-primary)'
    } as React.CSSProperties,
    dropText: {
      fontSize: '14px',
      fontWeight: '600',
      marginBottom: '4px'
    } as React.CSSProperties,
    dropSubtext: {
      fontSize: '12px',
      color: 'var(--wl-muted)'
    } as React.CSSProperties,
    hiddenInput: {
      display: 'none' as const
    } as React.CSSProperties,
    button: {
      padding: '10px 16px',
      borderRadius: '6px',
      border: 'none',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '600',
      transition: 'all 0.2s'
    } as React.CSSProperties,
    primaryButton: {
      backgroundColor: 'var(--wl-primary)',
      color: '#ffffff'
    } as React.CSSProperties,
    secondaryButton: {
      backgroundColor: 'transparent',
      color: 'var(--wl-primary)',
      border: '1px solid var(--wl-primary)'
    } as React.CSSProperties,
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      marginTop: '15px'
    } as React.CSSProperties,
    tableHeader: {
      backgroundColor: 'var(--wl-bg)',
      borderBottom: '1px solid var(--wl-border)',
      padding: '12px',
      textAlign: 'left' as const,
      fontSize: '12px',
      fontWeight: '600',
      color: 'var(--wl-muted)'
    } as React.CSSProperties,
    tableCell: {
      padding: '12px',
      borderBottom: '1px solid var(--wl-border)',
      fontSize: '13px'
    } as React.CSSProperties,
    columnMapping: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '15px',
      marginTop: '15px'
    } as React.CSSProperties,
    mappingGroup: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '6px'
    } as React.CSSProperties,
    label: {
      fontSize: '13px',
      fontWeight: '500',
      color: 'var(--wl-text)'
    } as React.CSSProperties,
    select: {
      width: '100%',
      padding: '10px 12px',
      backgroundColor: 'var(--wl-bg)',
      border: '1px solid var(--wl-border)',
      borderRadius: '6px',
      color: 'var(--wl-text)',
      fontSize: '13px',
      boxSizing: 'border-box'
    } as React.CSSProperties,
    validationStats: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: '15px',
      marginTop: '15px'
    } as React.CSSProperties,
    statBox: {
      backgroundColor: 'var(--wl-bg)',
      border: '1px solid var(--wl-border)',
      borderRadius: '6px',
      padding: '15px',
      textAlign: 'center' as const
    } as React.CSSProperties,
    statValue: {
      fontSize: '24px',
      fontWeight: '700',
      color: 'var(--wl-primary)',
      marginBottom: '4px'
    } as React.CSSProperties,
    statLabel: {
      fontSize: '12px',
      color: 'var(--wl-muted)'
    } as React.CSSProperties,
    errorList: {
      marginTop: '15px'
    } as React.CSSProperties,
    errorItem: {
      backgroundColor: 'var(--wl-bg)',
      border: '1px solid var(--wl-border)',
      borderRadius: '6px',
      padding: '12px',
      marginBottom: '10px'
    } as React.CSSProperties,
    errorHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      cursor: 'pointer'
    } as React.CSSProperties,
    errorRow: {
      fontSize: '13px',
      fontWeight: '600',
      color: '#ff4444'
    } as React.CSSProperties,
    errorDetails: {
      marginTop: '10px',
      paddingTop: '10px',
      borderTop: '1px solid var(--wl-border)'
    } as React.CSSProperties,
    errorMessage: {
      fontSize: '12px',
      color: 'var(--wl-muted)',
      marginBottom: '4px'
    } as React.CSSProperties,
    progressBar: {
      width: '100%',
      height: '8px',
      backgroundColor: 'var(--wl-bg)',
      borderRadius: '4px',
      overflow: 'hidden',
      marginTop: '15px'
    } as React.CSSProperties,
    progressFill: {
      height: '100%',
      backgroundColor: 'var(--wl-primary)',
      transition: 'width 0.3s'
    } as React.CSSProperties,
    resultBox: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: '15px',
      marginTop: '15px'
    } as React.CSSProperties,
    checkboxLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '13px',
      marginBottom: '10px',
      cursor: 'pointer'
    } as React.CSSProperties
  };

  const validCount = validationResults.filter(r => r.status === 'valid').length;
  const errorCount = validationResults.filter(r => r.status === 'error').length;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Import Orders from CSV</div>
        <div style={styles.subtitle}>Bulk import orders from CSV file with validation and mapping</div>
      </div>

      {/* File Upload Section */}
      <div style={styles.card}>
        <div style={styles.sectionTitle}>Upload CSV File</div>
        <label
          style={styles.dropZone}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDragDrop}
        >
          <div style={styles.dropIcon}>📁</div>
          <div style={styles.dropText}>Drag and drop your CSV file here</div>
          <div style={styles.dropSubtext}>or click to select from computer</div>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            style={styles.hiddenInput}
          />
        </label>
        {file && (
          <div style={{ marginTop: '15px', padding: '10px', backgroundColor: 'var(--wl-bg)', borderRadius: '6px', fontSize: '13px' }}>
            File selected: <strong>{file.name}</strong>
          </div>
        )}
      </div>

      {/* CSV Preview */}
      {csvData.length > 0 && (
        <div style={styles.card}>
          <div style={styles.sectionTitle}>CSV Preview (First 5 Rows)</div>
          <table style={styles.table}>
            <thead>
              <tr>
                {mockCSVHeaders.map(header => (
                  <th key={header} style={styles.tableHeader}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {csvData.slice(0, 5).map((row, idx) => (
                <tr key={idx}>
                  {mockCSVHeaders.map(header => (
                    <td key={header} style={styles.tableCell}>{row[header]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--wl-muted)' }}>
            Total rows: {csvData.length}
          </div>
        </div>
      )}

      {/* Column Mapping */}
      {csvData.length > 0 && (
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Column Mapping</div>
          <div style={styles.columnMapping}>
            {[
              { label: 'Customer Name', field: 'customerName' },
              { label: 'Email', field: 'email' },
              { label: 'Phone', field: 'phone' },
              { label: 'Street Address', field: 'street' },
              { label: 'City', field: 'city' },
              { label: 'State', field: 'state' },
              { label: 'Zip Code', field: 'zip' },
              { label: 'Product', field: 'product' },
              { label: 'Quantity', field: 'quantity' },
              { label: 'Price', field: 'price' }
            ].map(({ label, field }) => (
              <div key={field} style={styles.mappingGroup}>
                <label style={styles.label}>{label}</label>
                <select style={styles.select} defaultValue="Customer Name">
                  <option value="">-- Select Column --</option>
                  {mockCSVHeaders.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation */}
      {csvData.length > 0 && (
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Validation Results</div>
          <div style={styles.validationStats}>
            <div style={styles.statBox}>
              <div style={styles.statValue}>{csvData.length}</div>
              <div style={styles.statLabel}>Total Rows</div>
            </div>
            <div style={styles.statBox}>
              <div style={{ ...styles.statValue, color: '#4CAF50' }}>{validCount}</div>
              <div style={styles.statLabel}>Valid</div>
            </div>
            <div style={styles.statBox}>
              <div style={{ ...styles.statValue, color: '#ff4444' }}>{errorCount}</div>
              <div style={styles.statLabel}>Errors</div>
            </div>
          </div>

          {errorCount > 0 && (
            <div style={styles.errorList}>
              <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px' }}>Error Details:</div>
              {validationResults.filter(r => r.status === 'error').map(result => (
                <div key={result.rowNumber} style={styles.errorItem}>
                  <div
                    style={styles.errorHeader}
                    onClick={() => toggleErrorExpanded(result.rowNumber)}
                  >
                    <div style={styles.errorRow}>Row {result.rowNumber}: {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}</div>
                    <div style={{ color: 'var(--wl-muted)' }}>
                      {expandedErrors.has(result.rowNumber) ? '▼' : '▶'}
                    </div>
                  </div>
                  {expandedErrors.has(result.rowNumber) && (
                    <div style={styles.errorDetails}>
                      {result.errors.map((error, idx) => (
                        <div key={idx} style={styles.errorMessage}>• {error}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={validateData}
            style={{ ...styles.button, ...styles.primaryButton, marginTop: '15px' }}
          >
            Validate Again
          </button>
        </div>
      )}

      {/* Import Options */}
      {validationResults.length > 0 && !importComplete && (
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Import Options</div>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={importOptions.skipErrors}
              onChange={(e) => setImportOptions({ ...importOptions, skipErrors: e.target.checked })}
            />
            Skip rows with errors
          </label>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={importOptions.updateExisting}
              onChange={(e) => setImportOptions({ ...importOptions, updateExisting: e.target.checked })}
            />
            Update existing orders
          </label>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={importOptions.createNewOnly}
              onChange={(e) => setImportOptions({ ...importOptions, createNewOnly: e.target.checked })}
            />
            Create new orders only
          </label>
        </div>
      )}

      {/* Import Progress */}
      {importProgress > 0 && !importComplete && (
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Import Progress</div>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${importProgress}%` }} />
          </div>
          <div style={{ marginTop: '10px', fontSize: '13px', textAlign: 'center' }}>
            {importProgress}% Complete
          </div>
        </div>
      )}

      {/* Import Results */}
      {importComplete && (
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Import Complete</div>
          <div style={styles.resultBox}>
            <div style={styles.statBox}>
              <div style={{ ...styles.statValue, color: '#4CAF50' }}>{importResults.created}</div>
              <div style={styles.statLabel}>Created</div>
            </div>
            <div style={styles.statBox}>
              <div style={{ ...styles.statValue, color: '#6C63FF' }}>{importResults.updated}</div>
              <div style={styles.statLabel}>Updated</div>
            </div>
            <div style={styles.statBox}>
              <div style={{ ...styles.statValue, color: '#ffa500' }}>{importResults.skipped}</div>
              <div style={styles.statLabel}>Skipped</div>
            </div>
            <div style={styles.statBox}>
              <div style={{ ...styles.statValue, color: '#ff4444' }}>{importResults.failed}</div>
              <div style={styles.statLabel}>Failed</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button style={{ ...styles.button, ...styles.primaryButton, flex: 1 }}>
              Start New Import
            </button>
            <button style={{ ...styles.button, ...styles.secondaryButton, flex: 1 }}>
              View Created Orders
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {validationResults.length > 0 && !importComplete && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={handleImport}
            style={{ ...styles.button, ...styles.primaryButton, flex: 1 }}
          >
            Start Import
          </button>
          <button style={{ ...styles.button, ...styles.secondaryButton, flex: 1 }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
