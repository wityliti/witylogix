"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Template Manager component
 * Message/email/document template management with preview and variable support
 * Features: template editor, variable placeholders, provider assignment, preview with sample data
 */

export interface Template {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'document';
  content: string;
  providers: string[];
  usageCount: number;
  lastModified: Date;
}

export interface TemplateManagerProps {
  templates: Template[];
  onSave?: (template: Template) => void;
  onDelete?: (templateId: string) => void;
  className?: string;
}

const TEMPLATE_PREVIEW_VALUES = {
  name: 'John Doe',
  company: 'Acme Corporation',
  email: 'john@acme.com',
  date: new Date().toLocaleDateString(),
  amount: '$1,234.56',
};

const AVAILABLE_VARIABLES = ['{{name}}', '{{company}}', '{{email}}', '{{date}}', '{{amount}}'];

function renderTemplate(content: string, data: Record<string, string>): string {
  let result = content;
  Object.entries(data).forEach(([key, value]) => {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  });
  return result;
}

export function TemplateManager({ templates, onSave, onDelete, className }: TemplateManagerProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(templates[0]?.id || null);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const handleEdit = (template: Template) => {
    setEditingTemplate({ ...template });
  };

  const handleSave = () => {
    if (editingTemplate) {
      onSave?.(editingTemplate);
      setEditingTemplate(null);
    }
  };

  const handleCancel = () => {
    setEditingTemplate(null);
  };

  const handleDelete = (templateId: string) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      onDelete?.(templateId);
    }
  };

  const current = editingTemplate || selectedTemplate;

  return (
    <div
      className={cn(
        'border border-wl-border-subtle rounded-lg bg-wl-bg-surface overflow-hidden grid grid-cols-3 gap-0',
        className
      )}
      style={{ height: '700px' }}
    >
      {/* Template List */}
      <div className="border-r border-wl-border-subtle flex flex-col overflow-hidden">
        <div className="bg-wl-surface-hover border-b border-wl-border-subtle p-4">
          <h3 className="font-semibold text-wl-text-primary text-sm">Templates</h3>
          <p className="text-xs text-wl-text-secondary mt-1">{templates.length} total</p>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-wl-border-subtle">
          {templates.length === 0 ? (
            <div className="p-4 text-center text-wl-text-tertiary">
              <div className="text-xs">No templates yet</div>
            </div>
          ) : (
            templates.map((template) => (
              <button
                key={template.id}
                onClick={() => {
                  setSelectedTemplateId(template.id);
                  setEditingTemplate(null);
                }}
                className={cn(
                  'w-full text-left p-3 hover:bg-wl-surface-hover transition-colors',
                  selectedTemplateId === template.id && 'bg-wl-primary-500/10 border-l-2 border-wl-primary-500'
                )}
              >
                <div className="text-sm font-medium text-wl-text-primary truncate">{template.name}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded text-xs font-medium',
                      template.type === 'email' && 'bg-wl-primary-100 dark:bg-wl-primary-900/30 text-wl-primary-700 dark:text-wl-primary-300',
                      template.type === 'sms' && 'bg-wl-info-100 dark:bg-wl-info-900/30 text-wl-info-700 dark:text-wl-info-300',
                      template.type === 'document' && 'bg-wl-success-100 dark:bg-wl-success-900/30 text-wl-success-700 dark:text-wl-success-300'
                    )}
                  >
                    {template.type}
                  </span>
                  <span className="text-xs text-wl-text-tertiary">{template.usageCount} uses</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Template Editor/Viewer */}
      {current ? (
        <div className="col-span-2 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="border-b border-wl-border-subtle bg-wl-surface-hover p-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-wl-text-primary">{current.name}</h3>
              <p className="text-xs text-wl-text-secondary mt-1">
                Last modified: {current.lastModified.toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className={cn(
                  'px-3 py-2 rounded text-sm font-medium transition-colors',
                  previewMode
                    ? 'bg-wl-primary-100 text-wl-primary-700 dark:bg-wl-primary-900/30 dark:text-wl-primary-300'
                    : 'bg-wl-surface-hover text-wl-text-primary hover:bg-wl-border-subtle'
                )}
              >
                {previewMode ? 'Preview' : 'Edit'}
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4">
            {previewMode ? (
              <>
                {/* Preview Mode */}
                <div className="mb-6">
                  <div className="text-xs font-semibold text-wl-text-secondary mb-3 uppercase">Preview</div>
                  <div className="p-4 rounded-lg bg-wl-surface-hover border border-wl-border-subtle text-sm text-wl-text-primary whitespace-pre-wrap font-mono">
                    {renderTemplate(current.content, TEMPLATE_PREVIEW_VALUES)}
                  </div>
                </div>

                {/* Sample Data Reference */}
                <div className="mb-6">
                  <div className="text-xs font-semibold text-wl-text-secondary mb-3 uppercase">Sample Data</div>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(TEMPLATE_PREVIEW_VALUES).map(([key, value]) => (
                      <div key={key} className="p-2 bg-wl-surface-hover rounded border border-wl-border-subtle text-xs">
                        <div className="font-mono text-wl-text-secondary">{`{${key}}`}</div>
                        <div className="text-wl-text-primary mt-1">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Edit Mode */}
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-wl-text-secondary mb-2 uppercase">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={editingTemplate?.name || current.name}
                    onChange={(e) => {
                      if (!editingTemplate) setEditingTemplate({ ...current });
                      setEditingTemplate((prev) => (prev ? { ...prev, name: e.target.value } : null));
                    }}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg border border-wl-border-subtle',
                      'bg-wl-bg-surface text-wl-text-primary',
                      'focus:outline-none focus:border-wl-primary-500 focus:ring-1 focus:ring-wl-primary-500/20'
                    )}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-semibold text-wl-text-secondary mb-2 uppercase">
                    Template Content
                  </label>
                  <textarea
                    value={editingTemplate?.content || current.content}
                    onChange={(e) => {
                      if (!editingTemplate) setEditingTemplate({ ...current });
                      setEditingTemplate((prev) => (prev ? { ...prev, content: e.target.value } : null));
                    }}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg border border-wl-border-subtle',
                      'bg-wl-bg-surface text-wl-text-primary font-mono text-sm',
                      'focus:outline-none focus:border-wl-primary-500 focus:ring-1 focus:ring-wl-primary-500/20',
                      'resize-none'
                    )}
                    rows={6}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-semibold text-wl-text-secondary mb-2 uppercase">
                    Available Variables
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_VARIABLES.map((variable) => (
                      <button
                        key={variable}
                        onClick={() => {
                          if (!editingTemplate) setEditingTemplate({ ...current });
                          const elem = document.querySelector('textarea');
                          if (elem) {
                            const start = elem.selectionStart;
                            const end = elem.selectionEnd;
                            const newContent =
                              (editingTemplate?.content || current.content).substring(0, start) +
                              variable +
                              (editingTemplate?.content || current.content).substring(end);
                            setEditingTemplate((prev) => (prev ? { ...prev, content: newContent } : null));
                          }
                        }}
                        className={cn(
                          'px-2 py-1 rounded text-xs font-medium transition-colors',
                          'bg-wl-primary-100 text-wl-primary-700 hover:bg-wl-primary-200',
                          'dark:bg-wl-primary-900/30 dark:text-wl-primary-300 dark:hover:bg-wl-primary-900/50'
                        )}
                      >
                        {variable}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer Actions */}
          <div className="border-t border-wl-border-subtle bg-wl-surface-hover p-4 flex gap-3">
            {editingTemplate ? (
              <>
                <button
                  onClick={handleSave}
                  className={cn(
                    'flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors',
                    'bg-wl-primary-500 text-white hover:bg-wl-primary-600'
                  )}
                >
                  Save Changes
                </button>
                <button
                  onClick={handleCancel}
                  className={cn(
                    'flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors',
                    'bg-wl-surface-hover text-wl-text-primary hover:bg-wl-border-subtle'
                  )}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleEdit(current)}
                  className={cn(
                    'flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors',
                    'bg-wl-primary-100 text-wl-primary-700 hover:bg-wl-primary-200',
                    'dark:bg-wl-primary-900/30 dark:text-wl-primary-300 dark:hover:bg-wl-primary-900/50'
                  )}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(current.id)}
                  className={cn(
                    'flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors',
                    'bg-wl-danger-100 text-wl-danger-700 hover:bg-wl-danger-200',
                    'dark:bg-wl-danger-900/30 dark:text-wl-danger-300 dark:hover:bg-wl-danger-900/50'
                  )}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="col-span-2 flex items-center justify-center">
          <div className="text-center text-wl-text-tertiary">
            <div className="text-sm">No template selected</div>
            <div className="text-xs mt-1">Select a template from the list</div>
          </div>
        </div>
      )}
    </div>
  );
}
