/**
 * Payment Reconciliation Page — Match bank transactions with internal records
 *
 * Features:
 * - Two-column layout: bank transactions | internal records
 * - Auto-match with confidence score
 * - Manual match via drag-and-drop
 * - Unmatched items with suggested matches
 * - Reconciliation history log
 */

'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useReconciliation } from '@/hooks/use-financial-data';
import { AlertCircle, CheckCircle, Clock, Link2, Unlink2, Search, Filter } from 'lucide-react';

interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  referenceNumber: string;
  status: 'matched' | 'unmatched' | 'partial';
}

interface InternalRecord {
  id: string;
  type: 'invoice' | 'payment';
  number: string;
  customerName: string;
  amount: number;
  dueDate: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
}

// Mock data
const mockBankTransactions: BankTransaction[] = [
  {
    id: 'trans_1',
    date: '2024-03-15',
    description: 'Deposit - ACH Transfer',
    amount: 5000,
    referenceNumber: 'ACH-001234',
    status: 'unmatched',
  },
  {
    id: 'trans_2',
    date: '2024-03-14',
    description: 'Wire Transfer In',
    amount: 3200,
    referenceNumber: 'WIRE-005678',
    status: 'unmatched',
  },
  {
    id: 'trans_3',
    date: '2024-03-13',
    description: 'Check Deposit',
    amount: 7850,
    referenceNumber: 'CHK-102030',
    status: 'matched',
  },
];

const mockInternalRecords: InternalRecord[] = [
  {
    id: 'inv_1',
    type: 'invoice',
    number: 'INV-00245',
    customerName: 'Acme Corp',
    amount: 5000,
    dueDate: '2024-03-20',
    status: 'sent',
  },
  {
    id: 'inv_2',
    type: 'invoice',
    number: 'INV-00246',
    customerName: 'TechFlow Inc',
    amount: 3200,
    dueDate: '2024-03-22',
    status: 'sent',
  },
  {
    id: 'pay_1',
    type: 'payment',
    number: 'PAY-00089',
    customerName: 'Global Services',
    amount: 7850,
    dueDate: '2024-03-14',
    status: 'paid',
  },
];

interface SuggestedMatch {
  bankTxnId: string;
  recordId: string;
  confidenceScore: number;
  reason: string;
}

function calculateSuggestedMatches(
  transactions: BankTransaction[],
  records: InternalRecord[]
): SuggestedMatch[] {
  const matches: SuggestedMatch[] = [];

  for (const txn of transactions) {
    if (txn.status === 'matched') continue;

    for (const record of records) {
      if (Math.abs(txn.amount - record.amount) < 0.01) {
        // Exact match
        const dateDiff = Math.abs(
          new Date(txn.date).getTime() - new Date(record.dueDate).getTime()
        ) / (1000 * 60 * 60 * 24);

        let confidenceScore = 0.95;
        let reason = 'Amount and date match';

        if (dateDiff > 7) {
          confidenceScore -= 0.1;
          reason = `Amount matches, date differs by ${Math.round(dateDiff)} days`;
        }

        matches.push({
          bankTxnId: txn.id,
          recordId: record.id,
          confidenceScore,
          reason,
        });
      }
    }
  }

  return matches.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

interface MatchedPair {
  bankTxnId: string;
  recordId: string;
  matchedAt: Date;
}

export default function ReconciliationPage() {
  const [bankTransactions, setBankTransactions] = useState(mockBankTransactions);
  const [internalRecords, setInternalRecords] = useState(mockInternalRecords);
  const [matchedPairs, setMatchedPairs] = useState<MatchedPair[]>([
    { bankTxnId: 'trans_3', recordId: 'pay_1', matchedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
  ]);
  const [searchBankQuery, setSearchBankQuery] = useState('');
  const [searchRecordQuery, setSearchRecordQuery] = useState('');

  const reconciliation = useReconciliation();

  // Calculate suggested matches
  const suggestedMatches = useMemo(() => {
    const unmatchedTransactions = bankTransactions.filter((t) =>
      !matchedPairs.some((m) => m.bankTxnId === t.id)
    );
    const unmatchedRecords = internalRecords.filter((r) =>
      !matchedPairs.some((m) => m.recordId === r.id)
    );
    return calculateSuggestedMatches(unmatchedTransactions, unmatchedRecords);
  }, [bankTransactions, internalRecords, matchedPairs]);

  // Filter transactions
  const filteredTransactions = bankTransactions.filter((t) =>
    t.description.toLowerCase().includes(searchBankQuery.toLowerCase()) ||
    t.referenceNumber.toLowerCase().includes(searchBankQuery.toLowerCase())
  );

  // Filter records
  const filteredRecords = internalRecords.filter((r) =>
    r.number.toLowerCase().includes(searchRecordQuery.toLowerCase()) ||
    r.customerName.toLowerCase().includes(searchRecordQuery.toLowerCase())
  );

  // Calculate statistics
  const stats = useMemo(() => {
    const totalBankAmount = bankTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalRecordAmount = internalRecords.reduce((sum, r) => sum + r.amount, 0);
    const matchedAmount = matchedPairs.reduce((sum, m) => {
      const txn = bankTransactions.find((t) => t.id === m.bankTxnId);
      return sum + (txn?.amount || 0);
    }, 0);

    const unmatchedTransactions = bankTransactions.filter((t) =>
      !matchedPairs.some((m) => m.bankTxnId === t.id)
    );
    const unmatchedRecords = internalRecords.filter((r) =>
      !matchedPairs.some((m) => m.recordId === r.id)
    );

    const unmatchedBankAmount = unmatchedTransactions.reduce((sum, t) => sum + t.amount, 0);
    const unmatchedRecordAmount = unmatchedRecords.reduce((sum, r) => sum + r.amount, 0);

    return {
      totalBankAmount,
      totalRecordAmount,
      matchedAmount,
      matchedCount: matchedPairs.length,
      unmatchedBankCount: unmatchedTransactions.length,
      unmatchedRecordCount: unmatchedRecords.length,
      unmatchedBankAmount,
      unmatchedRecordAmount,
      isReconciled: unmatchedBankAmount === 0 && unmatchedRecordAmount === 0,
    };
  }, [bankTransactions, internalRecords, matchedPairs]);

  const handleAutoReconcile = async () => {
    // Auto-match top confidence suggestions
    const newMatches = suggestedMatches
      .filter((m) => m.confidenceScore >= 0.9)
      .map((m) => ({
        bankTxnId: m.bankTxnId,
        recordId: m.recordId,
        matchedAt: new Date(),
      }));

    setMatchedPairs((prev) => [...prev, ...newMatches]);

    // Update transaction statuses
    setBankTransactions((prev) =>
      prev.map((t) =>
        newMatches.some((m) => m.bankTxnId === t.id) ? { ...t, status: 'matched' } : t
      )
    );
  };

  const handleManualMatch = (bankTxnId: string, recordId: string) => {
    if (matchedPairs.some((m) => m.bankTxnId === bankTxnId && m.recordId === recordId)) {
      // Unmatch
      setMatchedPairs((prev) =>
        prev.filter((m) => !(m.bankTxnId === bankTxnId && m.recordId === recordId))
      );
    } else {
      // Match
      setMatchedPairs((prev) => [...prev, { bankTxnId, recordId, matchedAt: new Date() }]);
    }

    // Update transaction status
    setBankTransactions((prev) =>
      prev.map((t) =>
        t.id === bankTxnId
          ? {
              ...t,
              status: matchedPairs.some((m) => m.bankTxnId === bankTxnId && m.recordId === recordId)
                ? 'unmatched'
                : 'matched',
            }
          : t
      )
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-wl-bg-primary to-wl-bg-secondary">
      {/* Header */}
      <div className="px-6 py-8 border-b border-wl-border-subtle bg-wl-bg-elevated/40">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-wl-text-primary mb-2">Payment Reconciliation</h1>
          <p className="text-wl-text-secondary">Match bank transactions with internal records</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border border-wl-border-subtle">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-wl-text-secondary mb-1">Matched</p>
                  <p className="text-2xl font-bold text-wl-success-400">{stats.matchedCount}</p>
                  <p className="text-xs text-wl-text-tertiary mt-2">
                    ${stats.matchedAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <CheckCircle className="w-5 h-5 text-wl-success-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-wl-border-subtle">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-wl-text-secondary mb-1">Unmatched (Bank)</p>
                  <p className="text-2xl font-bold text-wl-warning-400">{stats.unmatchedBankCount}</p>
                  <p className="text-xs text-wl-text-tertiary mt-2">
                    ${stats.unmatchedBankAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <AlertCircle className="w-5 h-5 text-wl-warning-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-wl-border-subtle">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-wl-text-secondary mb-1">Unmatched (Records)</p>
                  <p className="text-2xl font-bold text-wl-warning-400">{stats.unmatchedRecordCount}</p>
                  <p className="text-xs text-wl-text-tertiary mt-2">
                    ${stats.unmatchedRecordAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <Clock className="w-5 h-5 text-wl-warning-400" />
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn(
              'border',
              stats.isReconciled ? 'border-wl-success-500/30 bg-wl-success-500/5' : 'border-wl-border-subtle'
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-wl-text-secondary mb-1">Status</p>
                  <p className={cn('text-lg font-bold', stats.isReconciled ? 'text-wl-success-400' : 'text-wl-warning-400')}>
                    {stats.isReconciled ? 'Reconciled' : 'Pending'}
                  </p>
                </div>
                {stats.isReconciled ? (
                  <CheckCircle className="w-5 h-5 text-wl-success-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-wl-warning-400" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Suggested Matches */}
        {suggestedMatches.length > 0 && (
          <Card className="border border-wl-info-500/30 bg-wl-info-500/5">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-wl-info-400" />
                  Suggested Matches ({suggestedMatches.length})
                </CardTitle>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleAutoReconcile}
                  disabled={reconciliation.isLoading}
                >
                  Apply High Confidence
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {suggestedMatches.map((match) => {
                  const txn = bankTransactions.find((t) => t.id === match.bankTxnId);
                  const record = internalRecords.find((r) => r.id === match.recordId);

                  if (!txn || !record) return null;

                  return (
                    <div
                      key={`${match.bankTxnId}-${match.recordId}`}
                      className="p-3 bg-wl-bg-surface rounded-lg border border-wl-border-subtle flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-wl-text-primary">
                          {txn.description} ↔ {record.number}
                        </p>
                        <p className="text-xs text-wl-text-secondary mt-1">{match.reason}</p>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <Badge
                          variant={match.confidenceScore >= 0.95 ? 'success' : 'info'}
                        >
                          {(match.confidenceScore * 100).toFixed(0)}%
                        </Badge>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleManualMatch(txn.id, record.id)}
                        >
                          Match
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Bank Transactions */}
          <Card className="border border-wl-border-subtle">
            <CardHeader className="pb-4">
              <CardTitle>Bank Transactions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-wl-text-tertiary" />
                <Input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchBankQuery}
                  onChange={(e) => setSearchBankQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredTransactions.map((txn) => {
                  const matchedRecord = matchedPairs.find((m) => m.bankTxnId === txn.id);
                  const matchedRecordObj = matchedRecord
                    ? internalRecords.find((r) => r.id === matchedRecord.recordId)
                    : null;

                  return (
                    <div
                      key={txn.id}
                      className={cn(
                        'p-3 rounded-lg border transition-colors duration-fast',
                        matchedRecord
                          ? 'border-wl-success-500/30 bg-wl-success-500/5'
                          : 'border-wl-border-subtle hover:bg-wl-bg-overlay'
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-wl-text-primary">{txn.description}</p>
                          <p className="text-xs text-wl-text-secondary mt-1">
                            {new Date(txn.date).toLocaleDateString()} • Ref: {txn.referenceNumber}
                          </p>
                        </div>
                        <div className="text-right ml-2">
                          <p className="text-sm font-semibold text-wl-text-primary">
                            ${txn.amount.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {matchedRecordObj && (
                        <div className="p-2 bg-wl-success-500/10 rounded border border-wl-success-500/20 text-xs text-wl-success-400 mb-2 flex items-center justify-between">
                          <span>Matched: {matchedRecordObj.number}</span>
                          <button
                            onClick={() => handleManualMatch(txn.id, matchedRecordObj.id)}
                            className="hover:underline"
                          >
                            Unmatch
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Internal Records */}
          <Card className="border border-wl-border-subtle">
            <CardHeader className="pb-4">
              <CardTitle>Internal Records</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-wl-text-tertiary" />
                <Input
                  type="text"
                  placeholder="Search records..."
                  value={searchRecordQuery}
                  onChange={(e) => setSearchRecordQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredRecords.map((record) => {
                  const matchedTxn = matchedPairs.find((m) => m.recordId === record.id);
                  const matchedTxnObj = matchedTxn ? bankTransactions.find((t) => t.id === matchedTxn.bankTxnId) : null;

                  return (
                    <div
                      key={record.id}
                      className={cn(
                        'p-3 rounded-lg border transition-colors duration-fast',
                        matchedTxn
                          ? 'border-wl-success-500/30 bg-wl-success-500/5'
                          : 'border-wl-border-subtle hover:bg-wl-bg-overlay'
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-wl-text-primary">{record.number}</p>
                            <Badge variant={record.status === 'paid' ? 'success' : 'info'} className="text-xs">
                              {record.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-wl-text-secondary">
                            {record.customerName} • Due: {new Date(record.dueDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right ml-2">
                          <p className="text-sm font-semibold text-wl-text-primary">
                            ${record.amount.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {matchedTxnObj && (
                        <div className="p-2 bg-wl-success-500/10 rounded border border-wl-success-500/20 text-xs text-wl-success-400 mb-2 flex items-center justify-between">
                          <span>Matched: {matchedTxnObj.description}</span>
                          <button
                            onClick={() => handleManualMatch(matchedTxnObj.id, record.id)}
                            className="hover:underline"
                          >
                            Unmatch
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reconciliation History */}
        <Card className="border border-wl-border-subtle">
          <CardHeader className="pb-4">
            <CardTitle>Reconciliation History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {matchedPairs.map((match, index) => {
                const txn = bankTransactions.find((t) => t.id === match.bankTxnId);
                const record = internalRecords.find((r) => r.id === match.recordId);

                if (!txn || !record) return null;

                return (
                  <div key={index} className="p-3 rounded-lg border border-wl-border-subtle flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-wl-text-primary">
                        {txn.description} ↔ {record.number}
                      </p>
                      <p className="text-xs text-wl-text-secondary mt-1">
                        Matched on {match.matchedAt.toLocaleDateString()} at {match.matchedAt.toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <p className="text-sm font-semibold text-wl-text-primary">
                        ${txn.amount.toLocaleString()}
                      </p>
                      <CheckCircle className="w-4 h-4 text-wl-success-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
