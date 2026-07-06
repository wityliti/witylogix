import { LabelData, LabelOptions } from "../types";
import { renderBarcodeToSVG } from "../barcode";

/**
 * Generates HTML label for screen/browser printing
 */
export function generateHTML(label: LabelData, options: LabelOptions): string {
  const dimensions = getLabelDimensions(options.size);

  const barcodeSVG = renderBarcodeToSVG(label.barcodeValue, 200, 100);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shipping Label - ${escapeHTML(label.trackingNumber)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      background-color: #f5f5f5;
      padding: 20px;
    }

    .label-container {
      width: ${dimensions.width}px;
      height: ${dimensions.height}px;
      background-color: white;
      border: 1px solid #ccc;
      padding: 15px;
      margin: 20px auto;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      display: grid;
      grid-template-rows: auto auto 1fr auto auto;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      overflow: hidden;
    }

    .header {
      grid-column: 1 / -1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #333;
      padding-bottom: 8px;
      margin-bottom: 5px;
    }

    .header-carrier {
      font-size: 18px;
      font-weight: bold;
      text-transform: uppercase;
      color: #000;
    }

    .header-service {
      font-size: 12px;
      color: #666;
      text-align: right;
    }

    .from-section {
      grid-column: 1;
      font-size: 11px;
      line-height: 1.4;
    }

    .from-label {
      font-weight: bold;
      font-size: 10px;
      text-transform: uppercase;
      margin-bottom: 4px;
      color: #333;
    }

    .from-content {
      font-size: 9px;
      color: #555;
    }

    .to-section {
      grid-column: 1 / -1;
      padding: 10px;
      background-color: #f9f9f9;
      border: 2px solid #333;
      border-radius: 3px;
    }

    .to-label {
      font-weight: bold;
      font-size: 11px;
      text-transform: uppercase;
      margin-bottom: 6px;
      color: #333;
    }

    .to-content {
      font-size: 16px;
      font-weight: bold;
      line-height: 1.6;
      color: #000;
    }

    .to-content-address {
      font-size: 12px;
      font-weight: normal;
      margin-top: 4px;
      color: #333;
    }

    .barcode-section {
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 10px 0;
      border-top: 1px solid #ccc;
      border-bottom: 1px solid #ccc;
    }

    .barcode-image {
      width: 200px;
      height: 100px;
      margin-bottom: 8px;
    }

    .barcode-text {
      font-size: 14px;
      font-weight: bold;
      font-family: "Courier New", monospace;
      letter-spacing: 1px;
      color: #000;
    }

    .footer {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      font-size: 9px;
      color: #666;
      padding-top: 5px;
    }

    .footer-item {
      display: flex;
      flex-direction: column;
    }

    .footer-label {
      font-weight: bold;
      color: #333;
    }

    @media print {
      body {
        background-color: white;
        padding: 0;
      }

      .label-container {
        margin: 0;
        box-shadow: none;
        border: none;
        page-break-inside: avoid;
      }

      .no-print {
        display: none;
      }
    }

    .print-controls {
      text-align: center;
      margin-bottom: 20px;
    }

    .print-controls button {
      padding: 10px 20px;
      margin: 0 5px;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }

    .print-controls button:hover {
      background-color: #0056b3;
    }
  </style>
</head>
<body>
  <div class="print-controls no-print">
    <button onclick="window.print()">Print Label</button>
    <button onclick="window.close()">Close</button>
  </div>

  <div class="label-container">
    <div class="header">
      <div class="header-carrier">${escapeHTML(label.carrier)}</div>
      <div class="header-service">${escapeHTML(label.service)}</div>
    </div>

    <div class="from-section">
      <div class="from-label">From</div>
      <div class="from-content">
        <div>${escapeHTML(label.sender.name)}</div>
        ${label.sender.street1 ? `<div>${escapeHTML(label.sender.street1)}</div>` : ""}
        <div>${escapeHTML(label.sender.city)}, ${escapeHTML(label.sender.state)} ${escapeHTML(label.sender.postalCode)}</div>
      </div>
    </div>

    <div class="to-section">
      <div class="to-label">To</div>
      <div class="to-content">
        ${escapeHTML(label.recipient.name)}
        <div class="to-content-address">
          ${label.recipient.street1 ? `<div>${escapeHTML(label.recipient.street1)}</div>` : ""}
          ${label.recipient.street2 ? `<div>${escapeHTML(label.recipient.street2)}</div>` : ""}
          <div>${escapeHTML(label.recipient.city)}, ${escapeHTML(label.recipient.state)} ${escapeHTML(label.recipient.postalCode)}</div>
        </div>
      </div>
    </div>

    <div class="barcode-section">
      <div class="barcode-image">${barcodeSVG}</div>
      <div class="barcode-text">${escapeHTML(label.trackingNumber)}</div>
    </div>

    <div class="footer">
      <div class="footer-item">
        <span class="footer-label">Weight:</span>
        <span>${label.weight} ${label.weightUnit}</span>
      </div>
      <div class="footer-item">
        <span class="footer-label">Shipped:</span>
        <span>${label.shipDate.toLocaleDateString("en-US")}</span>
      </div>
      ${label.sortCode ? `<div class="footer-item"><span class="footer-label">Sort Code:</span><span>${escapeHTML(label.sortCode)}</span></div>` : ""}
      ${label.poNumber ? `<div class="footer-item"><span class="footer-label">PO:</span><span>${escapeHTML(label.poNumber)}</span></div>` : ""}
      ${label.orderNumber ? `<div class="footer-item"><span class="footer-label">Order:</span><span>${escapeHTML(label.orderNumber)}</span></div>` : ""}
    </div>
  </div>
</body>
</html>`;

  return html;
}

/**
 * Get label dimensions in pixels for rendering
 */
function getLabelDimensions(size: "4x6" | "6x4" | "4x8" | "8.5x11"): {
  width: number;
  height: number;
} {
  const dpi = 96; // Screen DPI

  const dimensions: Record<string, { width: number; height: number }> = {
    "4x6": { width: 384, height: 576 }, // 4" x 6" at 96 DPI
    "6x4": { width: 576, height: 384 },
    "4x8": { width: 384, height: 768 },
    "8.5x11": { width: 816, height: 1056 },
  };

  return dimensions[size] || dimensions["4x6"];
}

/**
 * Escape HTML special characters
 */
function escapeHTML(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
