"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Data Mapper component
 * Visual field mapping tool for integration sync with data transformation options
 * Features: drag-drop-like field mapping, transformations, type validation, import/export
 */

export type DataType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "object"
  | "array";

export type TransformationType =
  | "uppercase"
  | "lowercase"
  | "trim"
  | "format-date"
  | "default-value";

export interface FieldMapping {
  id: string;
  sourceField: string;
  sourceType: DataType;
  targetField: string;
  targetType: DataType;
  transformation?: TransformationType;
  transformationValue?: string;
  isRequired: boolean;
}

export interface DataMapperProps {
  sourceFields: Array<{ name: string; type: DataType }>;
  targetFields: Array<{ name: string; type: DataType }>;
  mappings: FieldMapping[];
  onSave?: (mappings: FieldMapping[]) => void;
  className?: string;
}

const TYPE_COMPATIBILITY: Record<DataType, DataType[]> = {
  string: ["string", "number", "date", "boolean"],
  number: ["number", "string"],
  boolean: ["boolean", "string"],
  date: ["date", "string"],
  object: ["object", "string"],
  array: ["array", "string"],
};

export function DataMapper({
  sourceFields,
  targetFields,
  mappings,
  onSave,
  className,
}: DataMapperProps) {
  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);
  const [editingMapping, setEditingMapping] = useState<FieldMapping | null>(
    null,
  );
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  const handleAddMapping = () => {
    const newMapping: FieldMapping = {
      id: `mapping_${Date.now()}`,
      sourceField: sourceFields[0]?.name || "",
      sourceType: sourceFields[0]?.type || "string",
      targetField: targetFields[0]?.name || "",
      targetType: targetFields[0]?.type || "string",
      isRequired: false,
    };
    setEditingMapping(newMapping);
    setEditingMappingId(newMapping.id);
  };

  const handleEditMapping = (mapping: FieldMapping) => {
    setEditingMapping({ ...mapping });
    setEditingMappingId(mapping.id);
  };

  const handleSaveMapping = () => {
    if (!editingMapping) return;

    // Validate compatibility
    const sourceField = sourceFields.find(
      (f) => f.name === editingMapping.sourceField,
    );
    const targetField = targetFields.find(
      (f) => f.name === editingMapping.targetField,
    );

    if (sourceField && targetField) {
      const isCompatible = TYPE_COMPATIBILITY[sourceField.type]?.includes(
        targetField.type,
      );
      if (!isCompatible) {
        setValidationErrors({
          ...validationErrors,
          [editingMapping.id]: `Cannot map ${sourceField.type} to ${targetField.type}`,
        });
        return;
      }
    }

    const newMappings = mappings.find((m) => m.id === editingMapping.id)
      ? mappings.map((m) => (m.id === editingMapping.id ? editingMapping : m))
      : [...mappings, editingMapping];

    onSave?.(newMappings);
    setEditingMapping(null);
    setEditingMappingId(null);
    setValidationErrors({});
  };

  const handleDeleteMapping = (mappingId: string) => {
    const newMappings = mappings.filter((m) => m.id !== mappingId);
    onSave?.(newMappings);
  };

  const getTypeColor = (type: DataType): string => {
    switch (type) {
      case "string":
        return "var(--wl-primary-500)";
      case "number":
        return "var(--wl-success-500)";
      case "boolean":
        return "var(--wl-warning-500)";
      case "date":
        return "var(--wl-info-500)";
      case "object":
      case "array":
        return "var(--wl-secondary-500)";
      default:
        return "var(--wl-text-secondary)";
    }
  };

  const getTypeBadgeClass = (type: DataType): string => {
    switch (type) {
      case "string":
        return "bg-wl-primary-100 dark:bg-wl-primary-900/30 text-wl-primary-700 dark:text-wl-primary-300";
      case "number":
        return "bg-wl-success-100 dark:bg-wl-success-900/30 text-wl-success-700 dark:text-wl-success-300";
      case "boolean":
        return "bg-wl-warning-100 dark:bg-wl-warning-900/30 text-wl-warning-700 dark:text-wl-warning-300";
      case "date":
        return "bg-wl-info-100 dark:bg-wl-info-900/30 text-wl-info-700 dark:text-wl-info-300";
      default:
        return "bg-wl-surface-hover text-wl-text-secondary";
    }
  };

  const unmappedSourceFields = sourceFields.filter(
    (f) =>
      !mappings.some((m) => m.sourceField === f.name) &&
      !editingMapping?.sourceField,
  );

  const unmappedTargetFields = targetFields.filter(
    (f) =>
      !mappings.some((m) => m.targetField === f.name) &&
      !editingMapping?.targetField,
  );

  return (
    <div
      className={cn(
        "border border-wl-border-subtle rounded-lg bg-wl-bg-surface overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="bg-wl-surface-hover border-b border-wl-border-subtle p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-wl-text-primary">
            Field Mapping
          </h3>
          <button
            onClick={handleAddMapping}
            className={cn(
              "px-4 py-2 rounded-lg font-medium text-sm transition-colors",
              "bg-wl-primary-500 text-white hover:bg-wl-primary-600",
            )}
          >
            Add Mapping
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4 text-xs text-wl-text-secondary">
          <div>
            <div className="font-semibold mb-1">Source Fields</div>
            <div>{sourceFields.length} available</div>
          </div>
          <div className="text-center">
            <div className="font-semibold mb-1">Mappings</div>
            <div>{mappings.length} active</div>
          </div>
          <div className="text-right">
            <div className="font-semibold mb-1">Target Fields</div>
            <div>{targetFields.length} available</div>
          </div>
        </div>
      </div>

      {/* Mapping Visualization */}
      <div className="p-6 overflow-x-auto">
        <div className="grid grid-cols-3 gap-8 min-w-max">
          {/* Source Fields */}
          <div>
            <h4 className="text-sm font-semibold text-wl-text-primary mb-4">
              Source
            </h4>
            <div className="space-y-3">
              {sourceFields.map((field) => {
                const isMapped = mappings.some(
                  (m) => m.sourceField === field.name,
                );
                return (
                  <div
                    key={field.name}
                    className={cn(
                      "p-3 rounded-lg border-2 transition-colors",
                      isMapped
                        ? "border-wl-primary-500 bg-wl-primary-500/5"
                        : "border-wl-border-subtle bg-wl-surface-hover hover:border-wl-border-default",
                    )}
                  >
                    <div className="text-sm font-medium text-wl-text-primary mb-1">
                      {field.name}
                    </div>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium",
                        getTypeBadgeClass(field.type),
                      )}
                    >
                      {field.type}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mappings */}
          <div>
            <h4 className="text-sm font-semibold text-wl-text-primary mb-4">
              Mapping
            </h4>
            <div className="space-y-3">
              {mappings.map((mapping) => (
                <div
                  key={mapping.id}
                  className="p-3 rounded-lg bg-wl-surface-hover border border-wl-border-subtle hover:border-wl-border-default"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-mono text-wl-text-secondary truncate">
                      {mapping.sourceField} → {mapping.targetField}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditMapping(mapping)}
                        className="text-wl-primary-500 hover:text-wl-primary-600 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteMapping(mapping.id)}
                        className="text-wl-danger-500 hover:text-wl-danger-600 text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {mapping.transformation && (
                    <div className="text-xs text-wl-text-secondary">
                      Transform: {mapping.transformation}
                    </div>
                  )}
                  {mapping.isRequired && (
                    <div className="text-xs text-wl-warning-600 dark:text-wl-warning-400 mt-1">
                      Required
                    </div>
                  )}
                </div>
              ))}

              {/* Add mapping form when editing */}
              {editingMapping &&
                !mappings.some((m) => m.id === editingMapping.id) && (
                  <div className="p-3 rounded-lg bg-wl-primary-500/10 border-2 border-wl-primary-500">
                    <div className="text-xs font-semibold text-wl-primary-700 dark:text-wl-primary-300 mb-2">
                      New Mapping
                    </div>
                    <div className="text-xs text-wl-text-secondary">
                      {editingMapping.sourceField} →{" "}
                      {editingMapping.targetField}
                    </div>
                  </div>
                )}

              {mappings.length === 0 && !editingMapping && (
                <div className="p-4 text-center text-wl-text-tertiary">
                  <div className="text-sm">No mappings configured</div>
                  <div className="text-xs mt-1">
                    Add a mapping to get started
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Target Fields */}
          <div>
            <h4 className="text-sm font-semibold text-wl-text-primary mb-4">
              Target
            </h4>
            <div className="space-y-3">
              {targetFields.map((field) => {
                const isMapped = mappings.some(
                  (m) => m.targetField === field.name,
                );
                return (
                  <div
                    key={field.name}
                    className={cn(
                      "p-3 rounded-lg border-2 transition-colors",
                      isMapped
                        ? "border-wl-success-500 bg-wl-success-500/5"
                        : "border-wl-border-subtle bg-wl-surface-hover hover:border-wl-border-default",
                    )}
                  >
                    <div className="text-sm font-medium text-wl-text-primary mb-1">
                      {field.name}
                    </div>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium",
                        getTypeBadgeClass(field.type),
                      )}
                    >
                      {field.type}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Editing Panel */}
      {editingMapping && (
        <div className="border-t border-wl-border-subtle bg-wl-surface-hover p-6">
          <h4 className="text-sm font-semibold text-wl-text-primary mb-4">
            {mappings.some((m) => m.id === editingMapping.id)
              ? "Edit Mapping"
              : "Create Mapping"}
          </h4>

          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Source Field Selection */}
            <div>
              <label className="block text-xs font-semibold text-wl-text-secondary mb-2 uppercase">
                Source Field
              </label>
              <select
                value={editingMapping.sourceField}
                onChange={(e) =>
                  setEditingMapping((prev) => {
                    if (!prev) return null;
                    const sourceField = sourceFields.find(
                      (f) => f.name === e.target.value,
                    );
                    return {
                      ...prev,
                      sourceField: e.target.value,
                      sourceType: sourceField?.type || "string",
                    };
                  })
                }
                className={cn(
                  "w-full px-3 py-2 rounded-lg border border-wl-border-subtle",
                  "bg-wl-bg-surface text-wl-text-primary",
                  "focus:outline-none focus:border-wl-primary-500 focus:ring-1 focus:ring-wl-primary-500/20",
                )}
              >
                {sourceFields.map((field) => (
                  <option key={field.name} value={field.name}>
                    {field.name} ({field.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Target Field Selection */}
            <div>
              <label className="block text-xs font-semibold text-wl-text-secondary mb-2 uppercase">
                Target Field
              </label>
              <select
                value={editingMapping.targetField}
                onChange={(e) =>
                  setEditingMapping((prev) => {
                    if (!prev) return null;
                    const targetField = targetFields.find(
                      (f) => f.name === e.target.value,
                    );
                    return {
                      ...prev,
                      targetField: e.target.value,
                      targetType: targetField?.type || "string",
                    };
                  })
                }
                className={cn(
                  "w-full px-3 py-2 rounded-lg border border-wl-border-subtle",
                  "bg-wl-bg-surface text-wl-text-primary",
                  "focus:outline-none focus:border-wl-primary-500 focus:ring-1 focus:ring-wl-primary-500/20",
                )}
              >
                {targetFields.map((field) => (
                  <option key={field.name} value={field.name}>
                    {field.name} ({field.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Transformation */}
          <div className="mb-6">
            <label className="block text-xs font-semibold text-wl-text-secondary mb-2 uppercase">
              Data Transformation
            </label>
            <select
              value={editingMapping.transformation || "none"}
              onChange={(e) =>
                setEditingMapping((prev) =>
                  prev
                    ? {
                        ...prev,
                        transformation:
                          (e.target.value as TransformationType) || undefined,
                      }
                    : null,
                )
              }
              className={cn(
                "w-full px-3 py-2 rounded-lg border border-wl-border-subtle",
                "bg-wl-bg-surface text-wl-text-primary",
                "focus:outline-none focus:border-wl-primary-500 focus:ring-1 focus:ring-wl-primary-500/20",
              )}
            >
              <option value="none">None</option>
              <option value="uppercase">Uppercase</option>
              <option value="lowercase">Lowercase</option>
              <option value="trim">Trim</option>
              <option value="format-date">Format Date</option>
              <option value="default-value">Default Value</option>
            </select>
          </div>

          {/* Validation Error */}
          {validationErrors[editingMapping.id] && (
            <div className="mb-4 p-3 rounded-lg bg-wl-danger-500/10 border border-wl-danger-500/20">
              <div className="text-xs text-wl-danger-700 dark:text-wl-danger-300">
                {validationErrors[editingMapping.id]}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSaveMapping}
              className={cn(
                "flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors",
                "bg-wl-primary-500 text-white hover:bg-wl-primary-600",
              )}
            >
              Save Mapping
            </button>
            <button
              onClick={() => {
                setEditingMapping(null);
                setEditingMappingId(null);
                setValidationErrors({});
              }}
              className={cn(
                "flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors",
                "bg-wl-surface-hover text-wl-text-primary hover:bg-wl-border-subtle",
              )}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
