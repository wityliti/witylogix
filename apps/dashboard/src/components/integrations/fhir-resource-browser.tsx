"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Search,
  FileJson,
  ArrowRight,
} from "lucide-react";

type ResourceType = "Patient" | "Observation" | "Procedure" | "Medication" | "Condition";

interface FhirResource {
  resourceType: ResourceType;
  id: string;
  data: Record<string, any>;
  references?: Array<{
    type: ResourceType;
    id: string;
    display: string;
  }>;
}

interface FhirResourceBrowserProps {
  resource?: FhirResource;
  onReferenceClick?: (resourceType: ResourceType, id: string) => void;
  className?: string;
}

const defaultResource: FhirResource = {
  resourceType: "Patient",
  id: "patient-12345",
  data: {
    name: [{ use: "official", given: ["John"], family: "Doe" }],
    birthDate: "1975-03-15",
    gender: "male",
    address: [
      {
        type: "physical",
        line: ["123 Main St"],
        city: "Springfield",
        state: "IL",
        postalCode: "62701",
      },
    ],
    telecom: [
      { system: "phone", value: "+1-555-123-4567", use: "home" },
      { system: "email", value: "john.doe@example.com" },
    ],
    contact: [
      {
        relationship: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0131", code: "N" }] }],
        name: { given: ["Jane"], family: "Doe" },
        telecom: [{ system: "phone", value: "+1-555-987-6543" }],
      },
    ],
    maritalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus", code: "M" }] },
    active: true,
  },
  references: [
    { type: "Observation", id: "obs-54321", display: "Blood Pressure Reading" },
    { type: "Condition", id: "cond-99999", display: "Type 2 Diabetes" },
    { type: "Procedure", id: "proc-88888", display: "Annual Physical" },
  ],
};

export function FhirResourceBrowser({
  resource = defaultResource,
  onReferenceClick,
  className,
}: FhirResourceBrowserProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [showPrettyView, setShowPrettyView] = useState(true);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const togglePath = (path: string) => {
    const newPaths = new Set(expandedPaths);
    if (newPaths.has(path)) {
      newPaths.delete(path);
    } else {
      newPaths.add(path);
    }
    setExpandedPaths(newPaths);
  };

  const copyToClipboard = (text: string, path: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const renderValue = (value: any, path: string): JSX.Element => {
    if (value === null || value === undefined) {
      return <span className="text-wl-text-secondary italic">null</span>;
    }

    if (typeof value === "boolean") {
      return (
        <span className={value ? "text-wl-success-400" : "text-wl-danger-400"}>
          {value.toString()}
        </span>
      );
    }

    if (typeof value === "number") {
      return <span className="text-wl-warning-400">{value}</span>;
    }

    if (typeof value === "string") {
      return (
        <div className="flex items-center gap-1 group">
          <span className="text-wl-success-400">"{value}"</span>
          <button
            onClick={() => copyToClipboard(value, path)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            title="Copy value"
          >
            <Copy className="w-3 h-3 text-wl-text-secondary hover:text-wl-text-primary" />
          </button>
        </div>
      );
    }

    if (Array.isArray(value)) {
      return <span className="text-wl-text-secondary">[{value.length} items]</span>;
    }

    if (typeof value === "object") {
      return <span className="text-wl-text-secondary">{"{"}</span>;
    }

    return <span>{String(value)}</span>;
  };

  const renderTreeNode = (
    obj: any,
    parentPath: string = "",
    depth: number = 0
  ): JSX.Element[] => {
    const items: JSX.Element[] = [];

    const entries = Array.isArray(obj) ? obj.entries() : Object.entries(obj);

    for (const [rawKey, value] of entries) {
      const key = String(rawKey);
      const isArrayIndex = typeof rawKey === "number" || /^\d+$/.test(key);
      const displayKey = isArrayIndex ? `[${key}]` : key;
      const currentPath = parentPath ? `${parentPath}.${displayKey}` : displayKey;
      const isObject = value !== null && typeof value === "object";
      const isArray = Array.isArray(value);

      const matchesSearch = !searchQuery || currentPath.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch && isObject) continue;

      const indent = depth * 16;

      items.push(
        <div key={currentPath} className="font-mono text-sm">
          <div
            className="flex items-center gap-1 py-1 px-2 hover:bg-wl-bg-overlay rounded group"
            style={{ paddingLeft: `${indent + 8}px` }}
          >
            {isObject && (
              <button
                onClick={() => togglePath(currentPath)}
                className="flex-shrink-0 text-wl-text-secondary hover:text-wl-text-primary"
              >
                {expandedPaths.has(currentPath) ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            )}

            {!isObject && <span className="w-4" />}

            <span className="text-wl-primary-400 font-semibold">{displayKey}</span>
            <span className="text-wl-text-secondary">:</span>

            {isObject ? (
              <span className="text-wl-text-secondary">
                {isArray ? `[${(value as any).length}]` : "{"}
              </span>
            ) : (
              renderValue(value, currentPath)
            )}

            {!isObject && (
              <button
                onClick={() => copyToClipboard(JSON.stringify(value), currentPath)}
                className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0"
                title="Copy value"
              >
                <Copy className="w-3 h-3 text-wl-text-secondary hover:text-wl-text-primary" />
              </button>
            )}
          </div>

          {isObject && expandedPaths.has(currentPath) && (
            <>{renderTreeNode(value, currentPath, depth + 1)}</>
          )}
        </div>
      );
    }

    return items;
  };

  const filteredReferences = useMemo(() => {
    if (!searchQuery) return resource.references || [];
    return (resource.references || []).filter(
      (ref) =>
        ref.display.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ref.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, resource.references]);

  const jsonString = JSON.stringify(resource.data, null, 2);
  const jsonLines = jsonString.split("\n");

  return (
    <div
      className={cn(
        "flex flex-col bg-wl-bg-surface border border-wl-border-subtle rounded-lg overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-wl-border-subtle bg-wl-bg-overlay">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FileJson className="w-5 h-5 text-wl-primary-500" />
            <div>
              <h3 className="text-base font-semibold text-wl-text-primary">FHIR Resource Browser</h3>
              <p className="text-xs text-wl-text-secondary mt-1">
                {resource.resourceType} (ID: {resource.id})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={showPrettyView ? "primary" : "ghost"}
              onClick={() => setShowPrettyView(true)}
              className="flex items-center gap-1"
            >
              <Eye className="w-4 h-4" />
              Pretty
            </Button>

            <Button
              size="sm"
              variant={!showPrettyView ? "primary" : "ghost"}
              onClick={() => setShowPrettyView(false)}
              className="flex items-center gap-1"
            >
              <FileJson className="w-4 h-4" />
              Raw
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                copyToClipboard(jsonString, "full-json");
              }}
              className="flex items-center gap-1"
            >
              <Copy className="w-4 h-4" />
              {copiedPath === "full-json" ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-wl-text-secondary" />
          <input
            type="text"
            placeholder="Search fields and references..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-wl-bg-surface border border-wl-border-subtle rounded text-sm text-wl-text-primary placeholder-wl-text-secondary focus:outline-none focus:border-wl-primary-500"
          />
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {showPrettyView ? (
          <div className="p-4 space-y-1">
            {/* Resource metadata */}
            <div className="mb-4 p-3 bg-wl-bg-overlay rounded-lg border border-wl-border-subtle">
              <Badge variant="primary" className="mb-2">
                {resource.resourceType}
              </Badge>
              <p className="text-xs text-wl-text-secondary">ID: {resource.id}</p>
            </div>

            {/* Tree view */}
            <div className="space-y-0">{renderTreeNode(resource.data)}</div>
          </div>
        ) : (
          <div className="p-4 bg-wl-bg-overlay/50">
            <pre className="text-xs text-wl-text-secondary overflow-auto max-h-96 font-mono bg-wl-bg-surface p-3 rounded-lg border border-wl-border-subtle">
              {jsonString}
            </pre>
          </div>
        )}
      </div>

      {/* References section */}
      {(resource.references || []).length > 0 && (
        <div className="border-t border-wl-border-subtle bg-wl-bg-overlay p-4">
          <h4 className="text-sm font-semibold text-wl-text-primary mb-3 flex items-center gap-2">
            <ArrowRight className="w-4 h-4" />
            References ({filteredReferences.length})
          </h4>

          <div className="space-y-2 max-h-48 overflow-auto">
            {filteredReferences.map((ref) => (
              <button
                key={`${ref.type}-${ref.id}`}
                onClick={() => onReferenceClick?.(ref.type, ref.id)}
                className="w-full text-left p-2 rounded-lg border border-wl-border-subtle bg-wl-bg-surface hover:border-wl-primary-500 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Badge variant="info" className="text-xs mb-1">
                      {ref.type}
                    </Badge>
                    <p className="text-sm text-wl-text-primary font-medium">{ref.display}</p>
                    <p className="text-xs text-wl-text-secondary font-mono mt-1">ID: {ref.id}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-wl-text-secondary group-hover:text-wl-primary-500 flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
