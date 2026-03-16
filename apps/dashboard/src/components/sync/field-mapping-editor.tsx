'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown,
  X,
  Copy,
  ArrowUp,
  ArrowDown,
  Code2,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   FIELD MAPPING EDITOR — Visual mapping with transformers
   ═══════════════════════════════════════════════════════════ */

interface Field {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  required: boolean;
  sampleValue?: string;
}

interface Mapping {
  id: string;
  sourceFieldId: string;
  targetFieldId: string;
  transformer:
    | 'direct'
    | 'uppercase'
    | 'lowercase'
    | 'currency'
    | 'date'
    | 'custom';
  customJS?: string;
}

interface FieldMappingEditorProps {
  platformFields: Field[];
  witylogixFields: Field[];
  mappings: Mapping[];
  onAddMapping: (sourceId: string, targetId: string) => void;
  onRemoveMapping: (mappingId: string) => void;
  onUpdateTransformer: (
    mappingId: string,
    transformer: Mapping['transformer'],
    customJS?: string
  ) => void;
}

const TRANSFORMERS: Array<{
  id: Mapping['transformer'];
  name: string;
  description: string;
  icon: React.ReactNode;
}> = [
  { id: 'direct', name: 'Direct Copy', description: 'No transformation', icon: <Copy className="w-3 h-3" /> },
  { id: 'uppercase', name: 'Uppercase', description: 'Convert to uppercase', icon: <ArrowUp className="w-3 h-3" /> },
  { id: 'lowercase', name: 'Lowercase', description: 'Convert to lowercase', icon: <ArrowDown className="w-3 h-3" /> },
  { id: 'currency', name: 'Currency', description: 'Format as currency', icon: null },
  { id: 'date', name: 'Date Format', description: 'Format date', icon: null },
  { id: 'custom', name: 'Custom JS', description: 'Custom transformation', icon: <Code2 className="w-3 h-3" /> },
];

export function FieldMappingEditor({
  platformFields,
  witylogixFields,
  mappings,
  onAddMapping,
  onRemoveMapping,
  onUpdateTransformer,
}: FieldMappingEditorProps) {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [expandedMapping, setExpandedMapping] = useState<string | null>(null);
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      setSvgDimensions({
        width: containerRef.current.offsetWidth,
        height: Math.max(
          leftRef.current?.offsetHeight || 0,
          rightRef.current?.offsetHeight || 0
        ),
      });
    }

    const handleResize = () => {
      if (containerRef.current) {
        setSvgDimensions({
          width: containerRef.current.offsetWidth,
          height: Math.max(
            leftRef.current?.offsetHeight || 0,
            rightRef.current?.offsetHeight || 0
          ),
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mappings]);

  const handleSourceClick = (fieldId: string) => {
    if (selectedSource === fieldId) {
      setSelectedSource(null);
    } else {
      setSelectedSource(fieldId);
    }
  };

  const handleTargetClick = (fieldId: string) => {
    if (selectedSource && fieldId !== selectedSource) {
      // Check if mapping already exists
      const existing = mappings.find(
        (m) => m.sourceFieldId === selectedSource && m.targetFieldId === fieldId
      );
      if (!existing) {
        onAddMapping(selectedSource, fieldId);
      }
      setSelectedSource(null);
    } else if (!selectedSource) {
      setSelectedTarget(fieldId);
    }
  };

  const getMappingForTarget = (targetFieldId: string) => {
    return mappings.find((m) => m.targetFieldId === targetFieldId);
  };

  const getMappingForSource = (sourceFieldId: string) => {
    return mappings.find((m) => m.sourceFieldId === sourceFieldId);
  };

  const getConnectionPoints = () => {
    const points: Array<{
      sourceId: string;
      targetId: string;
      sourceY: number;
      targetY: number;
    }> = [];

    if (leftRef.current && rightRef.current) {
      mappings.forEach((mapping) => {
        const sourceEl = leftRef.current?.querySelector(
          `[data-field-id="${mapping.sourceFieldId}"]`
        ) as HTMLElement;
        const targetEl = rightRef.current?.querySelector(
          `[data-field-id="${mapping.targetFieldId}"]`
        ) as HTMLElement;

        if (sourceEl && targetEl) {
          points.push({
            sourceId: mapping.sourceFieldId,
            targetId: mapping.targetFieldId,
            sourceY: sourceEl.offsetTop + sourceEl.offsetHeight / 2,
            targetY: targetEl.offsetTop + targetEl.offsetHeight / 2,
          });
        }
      });
    }

    return points;
  };

  const connectionPoints = getConnectionPoints();
  const isMobile = svgDimensions.width < 768;

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="p-3 bg-wl-bg-surface rounded-lg border border-wl-border-subtle">
        <p className="text-sm text-wl-text-secondary">
          Click a field on the left (source) then click a field on the right (target) to create a mapping.
          Click the connection line to edit transformations.
        </p>
      </div>

      {/* Mapping Editor */}
      <div
        ref={containerRef}
        className={cn(
          'relative rounded-lg border border-wl-border-subtle bg-wl-bg-surface p-4',
          isMobile ? 'space-y-4' : ''
        )}
      >
        {!isMobile && (
          <svg
            className="absolute top-0 left-0 pointer-events-none"
            width={svgDimensions.width}
            height={svgDimensions.height}
            style={{ overflow: 'visible' }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 10 3, 0 6" fill="currentColor" className="text-wl-primary-500" />
              </marker>
            </defs>
            {connectionPoints.map((point) => {
              const x1 = leftRef.current?.offsetLeft || 0;
              const x2 = (rightRef.current?.offsetLeft || 0) - 40;
              const midX = (x1 + x2) / 2;

              return (
                <path
                  key={`${point.sourceId}-${point.targetId}`}
                  d={`M ${x1 + 150} ${point.sourceY} Q ${midX} ${point.sourceY}, ${midX} ${(point.sourceY + point.targetY) / 2} T ${x2} ${point.targetY}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-wl-primary-400 opacity-60"
                  markerEnd="url(#arrowhead)"
                  style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.1))' }}
                />
              );
            })}
          </svg>
        )}

        <div
          className={cn(
            'grid gap-4 relative z-10',
            isMobile ? 'grid-cols-1' : 'grid-cols-2'
          )}
        >
          {/* Source Fields (Platform) */}
          <div ref={leftRef}>
            <h4 className="text-sm font-semibold text-wl-text-secondary mb-3 px-2">
              {platformFields[0]?.id.includes('sf')
                ? 'Shopify'
                : platformFields[0]?.id.includes('wx')
                  ? 'Wix'
                  : 'Platform'}{' '}
              Fields
            </h4>
            <div className="space-y-2">
              {platformFields.map((field) => {
                const isMapped = getMappingForSource(field.id);
                return (
                  <button
                    key={field.id}
                    data-field-id={field.id}
                    onClick={() => handleSourceClick(field.id)}
                    className={cn(
                      'w-full text-left p-3 rounded-lg border-2 transition-all',
                      selectedSource === field.id
                        ? 'border-wl-primary-500 bg-wl-primary-500/10'
                        : isMapped
                          ? 'border-wl-success-400/30 bg-wl-success-400/5'
                          : 'border-transparent bg-wl-bg-elevated hover:border-wl-border-default'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-wl-text-primary truncate">
                          {field.name}
                        </p>
                        <p className="text-xs text-wl-text-secondary mt-1">
                          {field.type}
                          {field.required && (
                            <Badge variant="warning" className="ml-2 inline-block">
                              Required
                            </Badge>
                          )}
                        </p>
                        {field.sampleValue && (
                          <p className="text-xs text-wl-text-secondary mt-2 truncate">
                            {field.sampleValue}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Fields (Witylogix) */}
          <div ref={rightRef}>
            <h4 className="text-sm font-semibold text-wl-text-secondary mb-3 px-2">
              Witylogix Fields
            </h4>
            <div className="space-y-2">
              {witylogixFields.map((field) => {
                const mapping = getMappingForTarget(field.id);
                const sourceField = mapping
                  ? platformFields.find((f) => f.id === mapping.sourceFieldId)
                  : null;

                return (
                  <div
                    key={field.id}
                    data-field-id={field.id}
                    className={cn(
                      'rounded-lg border-2 transition-all overflow-hidden',
                      mapping
                        ? 'border-wl-success-400/30 bg-wl-success-400/5'
                        : field.required
                          ? 'border-wl-danger-400/30 bg-wl-danger-400/5'
                          : 'border-transparent bg-wl-bg-elevated hover:border-wl-border-default'
                    )}
                  >
                    <button
                      onClick={() => {
                        if (mapping) {
                          setExpandedMapping(
                            expandedMapping === mapping.id ? null : mapping.id
                          );
                        } else {
                          handleTargetClick(field.id);
                        }
                      }}
                      className={cn(
                        'w-full text-left p-3',
                        mapping && 'cursor-pointer'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-wl-text-primary truncate">
                            {field.name}
                          </p>
                          <p className="text-xs text-wl-text-secondary mt-1">
                            {field.type}
                            {field.required && (
                              <Badge variant="danger" className="ml-2 inline-block">
                                Required
                              </Badge>
                            )}
                          </p>
                          {mapping && sourceField && (
                            <p className="text-xs text-wl-success-500 mt-2 font-medium">
                              ← {sourceField.name}
                            </p>
                          )}
                        </div>

                        {mapping && (
                          <div className="flex items-center gap-1 ml-2">
                            <ChevronDown
                              className={cn(
                                'w-4 h-4 text-wl-text-secondary transition-transform',
                                expandedMapping === mapping.id && 'rotate-180'
                              )}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveMapping(mapping.id);
                              }}
                              className="p-1 hover:bg-wl-danger-500/20 rounded transition-colors"
                            >
                              <X className="w-4 h-4 text-wl-danger-500" />
                            </button>
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Transformer Config */}
                    {mapping && expandedMapping === mapping.id && (
                      <div className="border-t border-wl-border-subtle p-3 space-y-3 bg-wl-bg-surface">
                        <div>
                          <label className="text-xs font-semibold text-wl-text-secondary uppercase mb-2 block">
                            Transformation
                          </label>
                          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                            {TRANSFORMERS.map((t) => (
                              <button
                                key={t.id}
                                onClick={() =>
                                  onUpdateTransformer(mapping.id, t.id)
                                }
                                className={cn(
                                  'p-2 rounded-md border text-xs transition-all',
                                  mapping.transformer === t.id
                                    ? 'bg-wl-primary-500/20 border-wl-primary-500 text-wl-primary-600'
                                    : 'bg-wl-bg-elevated border-wl-border-subtle hover:border-wl-border-default'
                                )}
                                title={t.description}
                              >
                                <span className="flex items-center gap-1 justify-center">
                                  {t.icon}
                                  {t.name}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {mapping.transformer === 'custom' && (
                          <div>
                            <label className="text-xs font-semibold text-wl-text-secondary uppercase mb-2 block">
                              Custom JavaScript
                            </label>
                            <textarea
                              value={mapping.customJS || ''}
                              onChange={(e) =>
                                onUpdateTransformer(
                                  mapping.id,
                                  'custom',
                                  e.target.value
                                )
                              }
                              placeholder="// value is available as input parameter
// return the transformed value
return value.toUpperCase();"
                              className={cn(
                                'w-full p-2 rounded-md font-mono text-xs',
                                'bg-wl-bg-elevated border border-wl-border-subtle',
                                'text-wl-text-primary placeholder:text-wl-text-secondary',
                                'focus:outline-none focus:ring-2 focus:ring-wl-primary-500'
                              )}
                              rows={4}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Mapping Summary */}
      {mappings.length > 0 && (
        <div className="p-3 bg-wl-bg-surface rounded-lg border border-wl-border-subtle">
          <h4 className="text-sm font-semibold text-wl-text-primary mb-2">
            Active Mappings ({mappings.length})
          </h4>
          <div className="grid gap-2">
            {mappings.map((mapping) => {
              const source = platformFields.find(
                (f) => f.id === mapping.sourceFieldId
              );
              const target = witylogixFields.find(
                (f) => f.id === mapping.targetFieldId
              );
              const transformer = TRANSFORMERS.find(
                (t) => t.id === mapping.transformer
              );

              return (
                <div
                  key={mapping.id}
                  className="flex items-center justify-between text-sm p-2 bg-wl-bg-elevated rounded"
                >
                  <span className="text-wl-text-secondary">
                    {source?.name} → {target?.name}
                  </span>
                  <Badge variant="info" className="text-xs">
                    {transformer?.name}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
