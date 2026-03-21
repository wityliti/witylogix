'use client';

import { useState, useMemo } from 'react';
import { useApiList } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useCredentialManager,
  type Credential,
  type RotationSchedule,
} from '@/hooks/use-integration-health';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Calendar,
  Key,
  Lock,
  ChevronDown,
  Clock,
} from 'lucide-react';

/**
 * Credential Manager
 * Inventory, rotation schedule, vault status, history, manual rotate, scan results
 */

interface ExpandedCredential {
  [key: string]: boolean;
}

function VaultStatusCard({
  name,
  type,
  healthScore,
  connectionStatus,
}: {
  name: string;
  type: string;
  healthScore: number;
  connectionStatus: "connected" | "disconnected";
}) {
  return (
    <Card className="bg-[#12121a] border-[#1e1e2e]">
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-white">{name}</p>
              <p className="text-xs text-gray-400 mt-1">{type}</p>
            </div>
            <Badge
              variant={connectionStatus === "connected" ? "success" : "danger"}
            >
              {connectionStatus}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Health Score</span>
            <span className="text-sm font-medium text-white">
              {healthScore}%
            </span>
          </div>

          <div className="w-full bg-[#1a1a2e] rounded-full h-2">
            <div
              className={cn(
                "h-2 rounded-full transition-all",
                healthScore >= 80
                  ? "bg-emerald-500"
                  : healthScore >= 60
                    ? "bg-amber-500"
                    : "bg-red-500"
              )}
              style={{ width: `${healthScore}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RotationTimeline({ schedules }: { schedules: RotationSchedule[] }) {
  const sorted = [...schedules].sort(
    (a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
  );

  return (
    <div className="space-y-3">
      {sorted.map((schedule, idx) => {
        const isOverdue = new Date(schedule.scheduledDate) < new Date();

        return (
          <div key={schedule.credentialId} className="flex gap-3">
            <div className="relative flex flex-col items-center">
              <div
                className={cn(
                  "w-3 h-3 rounded-full",
                  schedule.status === "completed"
                    ? "bg-emerald-500"
                    : isOverdue
                      ? "bg-red-500"
                      : "bg-cyan-500"
                )}
              />
              {idx < sorted.length - 1 && (
                <div className="w-px h-12 bg-gray-700 my-2" />
              )}
            </div>
            <div className="flex-1 pt-1">
              <p className="font-medium text-white">
                {schedule.provider}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(schedule.scheduledDate).toLocaleString()}
              </p>
              <Badge
                variant={
                  schedule.status === "completed"
                    ? "success"
                    : isOverdue
                      ? "danger"
                      : "info"
                }
                className="mt-2"
              >
                {isOverdue && schedule.status === "pending"
                  ? "Overdue"
                  : schedule.status === "completed"
                    ? "Completed"
                    : "Scheduled"}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CredentialsPage() {
  const {
    credentials,
    isLoading,
    error,
    revalidate,
    rotateCredential,
    scheduleRotation,
  } = useCredentialManager();

  const [expandedCredentials, setExpandedCredentials] =
    useState<ExpandedCredential>({});
  const [showScheduleForm, setShowScheduleForm] = useState<string | null>(null);
  const [scheduleDateInput, setScheduleDateInput] = useState("");

  const toggleCredentialExpand = (credentialId: string) => {
    setExpandedCredentials((prev) => ({
      ...prev,
      [credentialId]: !prev[credentialId],
    }));
  };

  // Sort credentials by health status
  const sortedCredentials = useMemo(() => {
    if (!credentials?.credentials) return [];

    return [...credentials.credentials].sort((a, b) => {
      const statusOrder: Record<string, number> = {
        expired: 0,
        expiring_soon: 1,
        healthy: 2,
      };
      return statusOrder[a.status] - statusOrder[b.status];
    });
  }, [credentials?.credentials]);

  // Get overdue rotations
  const overdueRotations = useMemo(() => {
    if (!credentials?.rotationSchedule) return [];
    return credentials.rotationSchedule.filter(
      (r) => r.status === "pending" && new Date(r.scheduledDate) < new Date()
    );
  }, [credentials?.rotationSchedule]);

  if (error) {
    return (
      <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-white">
              Failed to load credentials
            </h3>
            <p className="text-sm text-gray-400 mt-1">{error}</p>
            <Button
              onClick={revalidate}
              variant="secondary"
              size="sm"
              className="mt-3"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Overdue Rotations Alert */}
      {overdueRotations.length > 0 && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-white">
                {overdueRotations.length} Credential Rotation{overdueRotations.length !== 1 ? "s" : ""} Overdue
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                These credentials should have been rotated. Please rotate them as soon as possible.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={revalidate}
          variant="secondary"
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          {isLoading ? "Loading..." : "Refresh"}
        </Button>
      </div>

      {/* Vault Status */}
      {credentials?.vaultStatus && credentials.vaultStatus.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Vault Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {credentials.vaultStatus.map((vault) => (
              <VaultStatusCard key={vault.name} {...vault} />
            ))}
          </div>
        </div>
      )}

      {/* Rotation Schedule Timeline */}
      {credentials?.rotationSchedule && credentials.rotationSchedule.length > 0 && (
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Rotation Schedule
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <RotationTimeline schedules={credentials.rotationSchedule} />
          </CardContent>
        </Card>
      )}

      {/* Credential Inventory */}
      <Card className="bg-[#12121a] border-[#1e1e2e]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-4 h-4" />
            Credential Inventory ({sortedCredentials.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {sortedCredentials.map((credential) => {
              const isExpired = new Date(credential.expiryDate) < new Date();
              const expiresIn = Math.floor(
                (new Date(credential.expiryDate).getTime() - new Date().getTime()) /
                  (1000 * 60 * 60 * 24)
              );

              return (
                <div
                  key={credential.id}
                  className="border border-[#1e1e2e] rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleCredentialExpand(credential.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-[#1a1a2e] transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Badge
                        variant={
                          credential.status === "healthy"
                            ? "success"
                            : credential.status === "expiring_soon"
                              ? "warning"
                              : "danger"
                        }
                      >
                        {credential.status === "healthy"
                          ? "Healthy"
                          : credential.status === "expiring_soon"
                            ? "Expiring Soon"
                            : "Expired"}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">
                          {credential.provider}
                        </p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          Type: {credential.type.replace(/_/g, " ")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right text-xs">
                        <p className="text-gray-400">Health</p>
                        <p className="font-medium text-white">
                          {credential.healthScore}%
                        </p>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-gray-400 transition-transform",
                          expandedCredentials[credential.id] && "rotate-180"
                        )}
                      />
                    </div>
                  </button>

                  {expandedCredentials[credential.id] && (
                    <div className="border-t border-[#1e1e2e] bg-[#1a1a2e] p-3 space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400 mb-1">Vault</p>
                          <p className="font-medium text-white">
                            {credential.vault}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400 mb-1">Last Rotated</p>
                          <p className="font-medium text-white">
                            {new Date(credential.lastRotated).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400 mb-1">Expires In</p>
                          <p className={cn(
                            "font-medium",
                            isExpired
                              ? "text-red-400"
                              : expiresIn <= 7
                                ? "text-amber-400"
                                : "text-emerald-400"
                          )}>
                            {isExpired ? "Expired" : `${expiresIn} days`}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400 mb-1">Expiry Date</p>
                          <p className="font-medium text-white">
                            {new Date(credential.expiryDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          onClick={() => rotateCredential(credential.id)}
                          className="flex-1"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Rotate Now
                        </Button>
                        {!showScheduleForm && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setShowScheduleForm(credential.id)}
                            className="flex-1"
                          >
                            <Clock className="w-3 h-3 mr-1" />
                            Schedule
                          </Button>
                        )}
                      </div>

                      {showScheduleForm === credential.id && (
                        <div className="mt-3 pt-3 border-t border-[#1e1e2e] space-y-2">
                          <input
                            type="datetime-local"
                            value={scheduleDateInput}
                            onChange={(e) => setScheduleDateInput(e.target.value)}
                            className="w-full px-2 py-1 text-sm rounded bg-[#12121a] border border-[#1e1e2e] text-white focus:outline-none focus:border-blue-500"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                scheduleRotation(
                                  credential.id,
                                  scheduleDateInput
                                );
                                setShowScheduleForm(null);
                                setScheduleDateInput("");
                              }}
                              className="flex-1"
                            >
                              Schedule
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setShowScheduleForm(null);
                                setScheduleDateInput("");
                              }}
                              className="flex-1"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Secret Scan Results */}
      <Card className="bg-amber-500/10 border border-amber-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            Secret Scan Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-3 bg-[#12121a] border border-[#1e1e2e] rounded-lg">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-medium text-white">
                    AWS_SECRET_ACCESS_KEY exposed in commit abc123
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Found in repository at line 45
                  </p>
                </div>
                <Badge variant="danger">Exposed</Badge>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                Remediation: Rotate this credential immediately and revoke access.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="danger" className="gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Revoke Access
                </Button>
                <Button size="sm" variant="secondary">
                  Learn More
                </Button>
              </div>
            </div>

            <div className="p-3 bg-[#12121a] border border-[#1e1e2e] rounded-lg">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-medium text-white">
                    STRIPE_API_KEY detected in .env.local
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Found in local development environment
                  </p>
                </div>
                <Badge variant="warning">Risky</Badge>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                Remediation: Move this to a secure secrets manager. Ensure .env is in .gitignore.
              </p>
              <Button size="sm" variant="secondary">
                View Details
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
