"use client";

import { forwardRef, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Upload, X, File, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export interface FileUploadProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  accept?: string;
  maxSize?: number;
  multiple?: boolean;
  onUpload?: (files: File[]) => void;
  onFilesSelected?: (files: File[]) => void;
  disabled?: boolean;
  children?: ReactNode;
}

const FileUpload = forwardRef<HTMLInputElement, FileUploadProps>(
  (
    {
      accept,
      maxSize = 5 * 1024 * 1024,
      multiple = false,
      onUpload,
      onFilesSelected,
      disabled = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string>("");

    const validateFiles = (files: File[]): boolean => {
      for (const file of files) {
        if (maxSize && file.size > maxSize) {
          setError(`File "${file.name}" exceeds maximum size of ${(maxSize / 1024 / 1024).toFixed(1)}MB`);
          return false;
        }
      }
      setError("");
      return true;
    };

    const handleFiles = (files: File[]) => {
      if (disabled) return;

      const validFiles = Array.from(files);
      if (!validateFiles(validFiles)) return;

      if (!multiple) {
        setUploadedFiles([validFiles[0]]);
        onUpload?.([validFiles[0]]);
        onFilesSelected?.([validFiles[0]]);
      } else {
        const newFiles = [...uploadedFiles, ...validFiles];
        setUploadedFiles(newFiles);
        onUpload?.(newFiles);
        onFilesSelected?.(newFiles);
      }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      handleFiles(files);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.currentTarget.files || []);
      handleFiles(files);
    };

    const removeFile = (index: number) => {
      const newFiles = uploadedFiles.filter((_, i) => i !== index);
      setUploadedFiles(newFiles);
      onUpload?.(newFiles);
    };

    const getFileIcon = (file: File) => {
      if (file.type.startsWith("image/")) {
        return <ImageIcon className="w-4 h-4 text-wl-primary-400" />;
      }
      return <File className="w-4 h-4 text-wl-text-secondary" />;
    };

    const getPreview = (file: File) => {
      if (file.type.startsWith("image/")) {
        return (
          <img
            src={URL.createObjectURL(file)}
            alt={file.name}
            className="w-16 h-16 object-cover rounded border border-wl-border-default"
          />
        );
      }
      return null;
    };

    return (
      <div className="flex flex-col gap-4">
        <input
          ref={ref || inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={handleInputChange}
          className="hidden"
          {...props}
        />

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          className={cn(
            "w-full p-8 rounded-lg border-2 border-dashed",
            "flex flex-col items-center justify-center gap-3",
            "transition-all duration-fast ease-default",
            "cursor-pointer",
            disabled ? "opacity-50 cursor-not-allowed bg-wl-bg-surface" : "bg-wl-bg-overlay hover:border-wl-primary-400",
            isDragging && !disabled
              ? "border-wl-primary-500 bg-wl-primary-500/5"
              : "border-wl-border-default"
          )}
        >
          <Upload className="w-6 h-6 text-wl-text-secondary" />
          <div className="text-center">
            <p className="text-sm font-semibold text-wl-text-primary">
              {children || "Drag & drop files here"}
            </p>
            <p className="text-xs text-wl-text-tertiary mt-1">
              or click to browse
            </p>
            {maxSize && (
              <p className="text-xs text-wl-text-tertiary mt-1">
                Max size: {(maxSize / 1024 / 1024).toFixed(1)}MB
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-md bg-wl-danger-500/10 border border-wl-danger-500/20">
            <p className="text-xs text-wl-danger-400">{error}</p>
          </div>
        )}

        {uploadedFiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-wl-text-secondary">
              {uploadedFiles.length} file(s) selected
            </p>
            <div className="space-y-2">
              {uploadedFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between p-3 rounded-md bg-wl-bg-surface border border-wl-border-default"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {getPreview(file) || getFileIcon(file)}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-wl-text-primary truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-wl-text-tertiary">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    disabled={uploading}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

FileUpload.displayName = "FileUpload";

export { FileUpload };
