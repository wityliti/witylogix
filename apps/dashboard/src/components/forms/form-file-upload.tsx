/**
 * File upload component
 * Supports drag & drop, file validation, preview, and progress tracking
 *
 * @example
 * ```tsx
 * <FormFileUpload
 *   acceptedTypes={['image/jpeg', 'image/png']}
 *   maxSizeBytes={5 * 1024 * 1024}
 *   onFilesSelected={handleFiles}
 * />
 * ```
 */

"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, X, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FormFileUploadProps {
  /** Accepted MIME types */
  acceptedTypes?: string[];
  /** Maximum file size in bytes */
  maxSizeBytes?: number;
  /** Allow multiple files */
  multiple?: boolean;
  /** Callback when files are selected */
  onFilesSelected?: (files: File[]) => void;
  /** Callback for upload progress */
  onProgress?: (progress: number) => void;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Whether field has error */
  hasError?: boolean;
  /** Error message */
  errorMessage?: string;
  /** Show image preview */
  showPreview?: boolean;
}

interface FileWithPreview extends File {
  preview?: string;
  progress?: number;
  error?: string;
}

/**
 * File upload component with drag & drop and validation
 */
export function FormFileUpload({
  acceptedTypes = ["*/*"],
  maxSizeBytes = 10 * 1024 * 1024,
  multiple = false,
  onFilesSelected,
  onProgress,
  disabled = false,
  hasError = false,
  errorMessage,
  showPreview = true,
}: FormFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {},
  );

  /**
   * Validate file
   */
  const validateFile = useCallback(
    (file: File): string | null => {
      // Check file type
      if (
        acceptedTypes.length > 0 &&
        acceptedTypes[0] !== "*/*" &&
        !acceptedTypes.includes(file.type)
      ) {
        return `File type not accepted. Allowed: ${acceptedTypes.join(", ")}`;
      }

      // Check file size
      if (file.size > maxSizeBytes) {
        const maxSizeMB = (maxSizeBytes / 1024 / 1024).toFixed(2);
        return `File size exceeds ${maxSizeMB}MB limit`;
      }

      return null;
    },
    [acceptedTypes, maxSizeBytes],
  );

  /**
   * Create preview for image files
   */
  const createPreview = useCallback(
    (file: File): string | undefined => {
      if (!showPreview || !file.type.startsWith("image/")) {
        return undefined;
      }
      return URL.createObjectURL(file);
    },
    [showPreview],
  );

  /**
   * Handle file selection
   */
  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;

      const newFiles: FileWithPreview[] = [];
      const filesToProcess = multiple ? Array.from(fileList) : [fileList[0]];

      filesToProcess.forEach((file) => {
        const error = validateFile(file);
        const fileWithPreview: FileWithPreview = file;

        if (!error) {
          fileWithPreview.preview = createPreview(file);
          newFiles.push(fileWithPreview);
        } else {
          fileWithPreview.error = error;
          newFiles.push(fileWithPreview);
        }
      });

      if (multiple) {
        setFiles([...files, ...newFiles]);
      } else {
        setFiles(newFiles);
      }

      const validFiles = newFiles.filter((f) => !f.error);
      if (validFiles.length > 0) {
        onFilesSelected?.(validFiles);
      }
    },
    [multiple, files, validateFile, createPreview, onFilesSelected],
  );

  /**
   * Handle drag over
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  /**
   * Handle drag leave
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  /**
   * Handle drop
   */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  /**
   * Handle click to select files
   */
  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Handle input change
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
    },
    [handleFiles],
  );

  /**
   * Remove file
   */
  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const newFiles = prev.filter((_, i) => i !== index);
      const file = prev[index];
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return newFiles;
    });
  }, []);

  /**
   * Format file size
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const acceptAttr = acceptedTypes.includes("*/*")
    ? ""
    : acceptedTypes.join(",");

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={!disabled ? handleClick : undefined}
        className={cn(
          "relative p-8 rounded-lg border-2 border-dashed",
          "transition-all duration-fast ease-default",
          "flex flex-col items-center justify-center gap-3",
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
          isDragging
            ? "border-wl-primary-500 bg-wl-primary-500/10"
            : hasError
              ? "border-wl-danger-400 bg-wl-danger-bg"
              : "border-wl-border-default hover:border-wl-primary-400 bg-wl-bg-overlay",
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={acceptAttr}
          onChange={handleInputChange}
          disabled={disabled}
          className="hidden"
          aria-label="Upload files"
        />

        <Upload
          size={32}
          className={cn(
            "transition-colors",
            isDragging ? "text-wl-primary-500" : "text-wl-text-secondary",
          )}
        />

        <div className="text-center">
          <p className="text-sm font-semibold text-wl-text-primary">
            Drop files here or click to upload
          </p>
          <p className="text-xs text-wl-text-tertiary mt-1">
            Max size: {formatFileSize(maxSizeBytes)}
            {acceptedTypes.length > 0 && acceptedTypes[0] !== "*/*" && (
              <>
                <br />
                Accepted: {acceptedTypes.join(", ")}
              </>
            )}
          </p>
        </div>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-wl-danger-bg text-wl-danger-400 text-sm">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className={cn(
                "flex items-center gap-3 p-3 rounded-md",
                "bg-wl-bg-overlay border border-wl-border-default",
                file.error && "border-wl-danger-400 bg-wl-danger-bg/20",
              )}
            >
              {/* Preview */}
              {file.preview && (
                <img
                  src={file.preview}
                  alt={file.name}
                  className="w-10 h-10 object-cover rounded"
                />
              )}

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium truncate",
                    file.error ? "text-wl-danger-400" : "text-wl-text-primary",
                  )}
                >
                  {file.name}
                </p>
                <p className="text-xs text-wl-text-tertiary">
                  {file.error ? file.error : formatFileSize(file.size)}
                </p>

                {/* Progress bar */}
                {uploadProgress[file.name] !== undefined && (
                  <div className="w-full h-1.5 bg-wl-bg-surface rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-wl-primary-500 transition-all duration-fast"
                      style={{ width: `${uploadProgress[file.name]}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Status icon */}
              {file.error ? (
                <AlertCircle
                  size={20}
                  className="text-wl-danger-400 flex-shrink-0"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="p-1 hover:text-wl-danger-400 transition-colors flex-shrink-0"
                  aria-label="Remove file"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
