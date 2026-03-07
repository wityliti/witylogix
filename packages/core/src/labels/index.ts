// Barrel exports
export { LabelData, LabelAddress, LabelOptions, GeneratedLabel } from "./types";
export { encodeCode128B, renderBarcodeToSVG, generateBarcodeBase64PNG } from "./barcode";
export { generateZPL } from "./generators/zpl";
export { generatePDF } from "./generators/pdf";
export { generateHTML } from "./generators/html";

import { LabelData, LabelOptions, GeneratedLabel } from "./types";
import { generateZPL } from "./generators/zpl";
import { generatePDF } from "./generators/pdf";
import { generateHTML } from "./generators/html";

/**
 * Factory function to generate labels in the specified format
 */
export function generateLabel(
  label: LabelData,
  options: LabelOptions
): GeneratedLabel {
  let data: string;
  let mimeType: string;

  switch (options.format) {
    case "ZPL":
      data = generateZPL(label, options);
      mimeType = "text/plain";
      break;

    case "PDF":
      data = generatePDF(label, options);
      mimeType = "application/pdf";
      break;

    case "HTML":
      data = generateHTML(label, options);
      mimeType = "text/html";
      break;

    case "PNG":
      // PNG format would require image encoding library
      // For now, fallback to HTML which can be converted to PNG
      data = generateHTML(label, options);
      mimeType = "text/html";
      break;

    default:
      throw new Error(
        `Unsupported label format: ${options.format}. Supported formats: PDF, ZPL, HTML, PNG`
      );
  }

  return {
    data,
    format: options.format,
    mimeType,
    size: options.size,
    trackingNumber: label.trackingNumber,
  };
}

/**
 * Generate multiple labels (useful for batch printing)
 */
export function generateLabels(
  labels: LabelData[],
  options: LabelOptions
): GeneratedLabel[] {
  return labels.map((label) => generateLabel(label, options));
}

/**
 * Combine multiple ZPL labels into a single string (for batch printing)
 */
export function generateZPLBatch(
  labels: LabelData[],
  options: LabelOptions & { copies?: number }
): string {
  let zplBatch = "";
  const copies = options.copies || 1;

  for (const label of labels) {
    for (let i = 0; i < copies; i++) {
      const zpl = generateZPL(label, options);
      zplBatch += zpl;
    }
  }

  return zplBatch;
}
