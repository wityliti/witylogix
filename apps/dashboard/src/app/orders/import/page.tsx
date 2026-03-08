'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { cn } from '../../../lib/utils';

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

  const validCount = validationResults.filter(r => r.status === 'valid').length;
  const errorCount = validationResults.filter(r => r.status === 'error').length;

  return (
    <div className="min-h-screen bg-wl-bg p-5 text-wl-text">
      <div className="mb-8">
        <div className="text-4xl font-bold mb-2">Import Orders from CSV</div>
        <div className="text-sm text-wl-muted">Bulk import orders from CSV file with validation and mapping</div>
      </div>

      {/* File Upload Section */}
      <div className="bg-wl-surface border border-wl-border rounded p-5 mb-5">
        <div className="text-base font-semibold mb-4">Upload CSV File</div>
        <label
          className="border-2 border-dashed border-wl-border rounded p-10 text-center cursor-pointer transition-all bg-wl-bg"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDragDrop}
        >
          <div className="text-5xl mb-2.5 text-wl-primary">📁</div>
          <div className="text-sm font-semibold mb-1">Drag and drop your CSV file here</div>
          <div className="text-xs text-wl-muted">or click to select from computer</div>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
        {file && (
          <div className="mt-4 p-2.5 bg-wl-bg rounded text-sm">
            File selected: <strong>{file.name}</strong>
          </div>
        )}
      </div>

      {/* CSV Preview */}
      {csvData.length > 0 && (
        <div className="bg-wl-surface border border-wl-border rounded p-5 mb-5">
          <div className="text-base font-semibold mb-4">CSV Preview (First 5 Rows)</div>
          <table className="w-full border-collapse mt-4">
            <thead>
              <tr>
                {mockCSVHeaders.map(header => (
                  <th key={header} className="bg-wl-bg border-b border-wl-border p-3 text-left text-xs font-semibold text-wl-muted">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {csvData.slice(0, 5).map((row, idx) => (
                <tr key={idx}>
                  {mockCSVHeaders.map(header => (
                    <td key={header} className="border-b border-wl-border p-3 text-sm">{row[header]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2.5 text-xs text-wl-muted">
            Total rows: {csvData.length}
          </div>
        </div>
      )}

      {/* Column Mapping */}
      {csvData.length > 0 && (
        <div className="bg-wl-surface border border-wl-border rounded p-5 mb-5">
          <div className="text-base font-semibold mb-4">Column Mapping</div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mt-4">
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
              <div key={field} className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-wl-text">{label}</label>
                <select className="w-full px-3 py-2.5 bg-wl-bg border border-wl-border rounded text-wl-text text-sm box-border" defaultValue="Customer Name">
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
        <div className="bg-wl-surface border border-wl-border rounded p-5 mb-5">
          <div className="text-base font-semibold mb-4">Validation Results</div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4 mt-4 mb-5">
            <div className="bg-wl-bg border border-wl-border rounded p-4 text-center">
              <div className="text-2xl font-bold text-wl-primary mb-1">{csvData.length}</div>
              <div className="text-xs text-wl-muted">Total Rows</div>
            </div>
            <div className="bg-wl-bg border border-wl-border rounded p-4 text-center">
              <div className="text-2xl font-bold text-green-500 mb-1">{validCount}</div>
              <div className="text-xs text-wl-muted">Valid</div>
            </div>
            <div className="bg-wl-bg border border-wl-border rounded p-4 text-center">
              <div className="text-2xl font-bold text-red-400 mb-1">{errorCount}</div>
              <div className="text-xs text-wl-muted">Errors</div>
            </div>
          </div>

          {errorCount > 0 && (
            <div className="mt-4">
              <div className="text-sm font-semibold mb-2.5">Error Details:</div>
              {validationResults.filter(r => r.status === 'error').map(result => (
                <div key={result.rowNumber} className="bg-wl-bg border border-wl-border rounded p-3 mb-2.5">
                  <div
                    className="flex justify-between items-center cursor-pointer"
                    onClick={() => toggleErrorExpanded(result.rowNumber)}
                  >
                    <div className="text-red-400 text-sm font-semibold">Row {result.rowNumber}: {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}</div>
                    <div className="text-wl-muted">
                      {expandedErrors.has(result.rowNumber) ? '▼' : '▶'}
                    </div>
                  </div>
                  {expandedErrors.has(result.rowNumber) && (
                    <div className="mt-2.5 pt-2.5 border-t border-wl-border">
                      {result.errors.map((error, idx) => (
                        <div key={idx} className="text-xs text-wl-muted mb-1">• {error}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={validateData}
            className="px-4 py-2.5 rounded bg-wl-primary text-white font-semibold text-sm transition-all mt-4"
          >
            Validate Again
          </button>
        </div>
      )}

      {/* Import Options */}
      {validationResults.length > 0 && !importComplete && (
        <div className="bg-wl-surface border border-wl-border rounded p-5 mb-5">
          <div className="text-base font-semibold mb-4">Import Options</div>
          {[
            { label: 'Skip rows with errors', key: 'skipErrors' },
            { label: 'Update existing orders', key: 'updateExisting' },
            { label: 'Create new orders only', key: 'createNewOnly' }
          ].map((opt) => (
            <label key={opt.key} className="flex items-center gap-2 text-sm mb-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={importOptions[opt.key as keyof typeof importOptions]}
                onChange={(e) => setImportOptions({ ...importOptions, [opt.key]: e.target.checked })}
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}

      {/* Import Progress */}
      {importProgress > 0 && !importComplete && (
        <div className="bg-wl-surface border border-wl-border rounded p-5 mb-5">
          <div className="text-base font-semibold mb-4">Import Progress</div>
          <div className="w-full h-2 bg-wl-bg rounded overflow-hidden">
            <div className="h-full bg-wl-primary transition-all" style={{ width: `${importProgress}%` }} />
          </div>
          <div className="mt-2.5 text-sm text-center text-wl-muted">
            {importProgress}% Complete
          </div>
        </div>
      )}

      {/* Import Results */}
      {importComplete && (
        <div className="bg-wl-surface border border-wl-border rounded p-5 mb-5">
          <div className="text-base font-semibold mb-4">Import Complete</div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4 mb-5">
            {[
              { label: 'Created', value: importResults.created, color: '#4CAF50' },
              { label: 'Updated', value: importResults.updated, color: '#6C63FF' },
              { label: 'Skipped', value: importResults.skipped, color: '#ffa500' },
              { label: 'Failed', value: importResults.failed, color: '#ff4444' }
            ].map((item) => (
              <div key={item.label} className="bg-wl-bg border border-wl-border rounded p-4 text-center">
                <div className="text-2xl font-bold mb-1" style={{ color: item.color }}>{item.value}</div>
                <div className="text-xs text-wl-muted">{item.label}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2.5">
            <button className="flex-1 px-4 py-2.5 rounded bg-wl-primary text-white font-semibold text-sm transition-all">
              Start New Import
            </button>
            <button className="flex-1 px-4 py-2.5 rounded bg-transparent text-wl-primary font-semibold text-sm border border-wl-primary transition-all">
              View Created Orders
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {validationResults.length > 0 && !importComplete && (
        <div className="flex gap-2.5 mb-5">
          <button
            onClick={handleImport}
            className="flex-1 px-4 py-2.5 rounded bg-wl-primary text-white font-semibold text-sm transition-all"
          >
            Start Import
          </button>
          <button className="flex-1 px-4 py-2.5 rounded bg-transparent text-wl-primary font-semibold text-sm border border-wl-primary transition-all">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
