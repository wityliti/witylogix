import { LabelData, LabelOptions } from "../types";

/**
 * Generates ZPL (Zebra Programming Language) for thermal label printers
 * Optimized for 4x6 label format with standard 203 DPI
 */
export function generateZPL(label: LabelData, options: LabelOptions): string {
  const dpi = options.dpi || 203;
  const isHighDPI = dpi === 300;

  // Label dimensions in dots (203 DPI: 4x6 = 832x1224 dots)
  // 300 DPI: 4x6 = 1200x1800 dots
  const labelWidth = options.size === "4x6" ? (isHighDPI ? 1200 : 832) : 1224;
  const labelHeight = options.size === "4x6" ? (isHighDPI ? 1800 : 1224) : 832;

  let zpl = "";

  // Start ZPL session
  zpl += "^XA\n";

  // Set label dimensions and print speed
  zpl += `^PW${labelWidth}\n`;
  zpl += "^LL" + labelHeight + "\n";
  zpl += "^LH0,0\n";
  zpl += isHighDPI ? "^PR300,300,300\n" : "^PR203,203,203\n";

  // Carrier name (top-left)
  zpl += `^FO50,50\n`;
  zpl += `^AF0,25,20\n`;
  zpl += `^FD${escapeZPL(label.carrier.toUpperCase())}^FS\n`;

  // Service type (top-right)
  zpl += `^FO600,50\n`;
  zpl += `^AF0,20,15\n`;
  zpl += `^FD${escapeZPL(label.service)}^FS\n`;

  // FROM label and sender address
  zpl += `^FO50,120\n`;
  zpl += `^AF0,18,12\n`;
  zpl += `^FDFROM:^FS\n`;

  zpl += `^FO50,150\n`;
  zpl += `^AF0,16,10\n`;
  const senderName = label.sender.name;
  zpl += `^FD${escapeZPL(senderName)}^FS\n`;

  if (label.sender.company) {
    zpl += `^FO50,170\n`;
    zpl += `^AF0,14,9\n`;
    zpl += `^FD${escapeZPL(label.sender.company)}^FS\n`;
  }

  if (label.sender.street1) {
    zpl += `^FO50,175\n`;
    zpl += `^AF0,14,9\n`;
    zpl += `^FD${escapeZPL(label.sender.street1)}^FS\n`;
  }

  const senderCity = `${label.sender.city}, ${label.sender.state} ${label.sender.postalCode}`;
  zpl += `^FO50,200\n`;
  zpl += `^AF0,14,9\n`;
  zpl += `^FD${escapeZPL(senderCity)}^FS\n`;

  // TO label and recipient address (large, centered)
  zpl += `^FO50,270\n`;
  zpl += `^AF0,20,15\n`;
  zpl += `^FDTO:^FS\n`;

  zpl += `^FO70,320\n`;
  zpl += `^AF0,28,20\n`;
  const recipientName = truncateText(label.recipient.name, 20);
  zpl += `^FD${escapeZPL(recipientName)}^FS\n`;

  zpl += `^FO70,380\n`;
  zpl += `^AF0,20,15\n`;
  const street = truncateText(label.recipient.street1, 25);
  zpl += `^FD${escapeZPL(street)}^FS\n`;

  if (label.recipient.street2) {
    zpl += `^FO70,420\n`;
    zpl += `^AF0,18,13\n`;
    zpl += `^FD${escapeZPL(label.recipient.street2.substring(0, 25))}^FS\n`;
  }

  const recipientCity = `${label.recipient.city}, ${label.recipient.state} ${label.recipient.postalCode}`;
  zpl += `^FO70,460\n`;
  zpl += `^AF0,24,18\n`;
  zpl += `^FD${escapeZPL(recipientCity)}^FS\n`;

  // Tracking barcode (Code 128)
  zpl += `^FO100,600\n`;
  zpl += `^BY3,2.0,100\n`; // Bar width, ratio, height
  zpl += `^BC0,100,N,N\n`; // Code 128, height, no text
  zpl += `^FD${escapeZPL(label.barcodeValue)}^FS\n`;

  // Tracking number text below barcode
  zpl += `^FO100,750\n`;
  zpl += `^AF0,22,16\n`;
  zpl += `^FD${escapeZPL(label.trackingNumber)}^FS\n`;

  // Weight
  if (label.weight) {
    zpl += `^FO50,850\n`;
    zpl += `^AF0,18,12\n`;
    const weightStr = `Wt: ${label.weight} ${label.weightUnit}`;
    zpl += `^FD${escapeZPL(weightStr)}^FS\n`;
  }

  // Sort code / routing
  if (label.sortCode) {
    zpl += `^FO500,850\n`;
    zpl += `^AF0,16,10\n`;
    zpl += `^FDSort: ${escapeZPL(label.sortCode)}^FS\n`;
  }

  // Ship date
  const dateStr = label.shipDate.toLocaleDateString("en-US");
  zpl += `^FO50,920\n`;
  zpl += `^AF0,14,9\n`;
  zpl += `^FDShipped: ${escapeZPL(dateStr)}^FS\n`;

  // Optional reference numbers
  if (label.reference || label.poNumber || label.orderNumber) {
    let refText = "";
    if (label.poNumber) refText += `PO: ${label.poNumber} `;
    if (label.orderNumber) refText += `Order: ${label.orderNumber}`;
    if (refText) {
      zpl += `^FO50,1000\n`;
      zpl += `^AF0,12,8\n`;
      zpl += `^FD${escapeZPL(refText.trim())}^FS\n`;
    }
  }

  // End ZPL session
  zpl += "^XZ\n";

  return zpl;
}

/**
 * Escape special ZPL characters
 */
function escapeZPL(text: string): string {
  return text
    .replace(/\^/g, "^^") // Escape caret
    .replace(/~/g, "~") // Tilde is format code, keep as-is
    .replace(/\n/g, " ") // Remove newlines
    .trim();
}

/**
 * Truncate text to fit within label constraints
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}
