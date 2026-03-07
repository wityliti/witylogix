import { LabelData, LabelOptions } from "../types";
import { encodeCode128B } from "../barcode";

interface PDFObject {
  id: number;
  content: string;
}

/**
 * Generates a valid PDF 1.4 label from scratch without external libraries
 */
export function generatePDF(label: LabelData, options: LabelOptions): string {
  const pdf = new PDFGenerator(label, options);
  return pdf.generate();
}

class PDFGenerator {
  private label: LabelData;
  private options: LabelOptions;
  private objects: PDFObject[] = [];
  private objectOffsets: number[] = [];
  private currentId: number = 1;

  // Page dimensions in points (1 inch = 72 points)
  private pageWidth: number;
  private pageHeight: number;

  constructor(label: LabelData, options: LabelOptions) {
    this.label = label;
    this.options = options;

    // Set page dimensions
    if (options.size === "4x6") {
      this.pageWidth = 288; // 4 inches
      this.pageHeight = 432; // 6 inches
    } else if (options.size === "6x4") {
      this.pageWidth = 432;
      this.pageHeight = 288;
    } else if (options.size === "8.5x11") {
      this.pageWidth = 612;
      this.pageHeight = 792;
    } else {
      this.pageWidth = 576; // 8 inches
      this.pageHeight = 432; // 6 inches
    }
  }

  generate(): string {
    // Create PDF objects
    const catalogId = this.addObject(this.createCatalog());
    const pagesId = this.addObject(this.createPages());
    const pageId = this.addObject(
      this.createPage(pagesId, this.createContent())
    );
    const contentsId = this.addObject(this.createContents());
    const fontResourcesId = this.addObject(this.createFontResources());

    // Update page object with content and font references
    const pageObj = this.objects[pageId - 1];
    pageObj.content = pageObj.content.replace(
      "<<CONTENTS_PLACEHOLDER>>",
      "/Contents " + contentsId + " 0 R"
    );
    pageObj.content = pageObj.content.replace(
      "<<RESOURCES_PLACEHOLDER>>",
      "/Resources << /Font " + fontResourcesId + " 0 R >>"
    );

    // Update pages object with page reference
    const pagesObj = this.objects[pagesId - 1];
    pagesObj.content = pagesObj.content.replace(
      "<<PAGES_PLACEHOLDER>>",
      "/Kids [" + pageId + " 0 R] /Count 1"
    );

    // Build PDF file
    return this.buildPDF(catalogId);
  }

  private createCatalog(): string {
    return `<< /Type /Catalog /Pages ${this.currentId + 1} 0 R >>`;
  }

  private createPages(): string {
    return `<< /Type /Pages <<PAGES_PLACEHOLDER>> /MediaBox [0 0 ${this.pageWidth} ${this.pageHeight}] >>`;
  }

  private createPage(pagesId: number, content: string): string {
    return `<< /Type /Page /Parent ${pagesId} 0 R <<CONTENTS_PLACEHOLDER>> <<RESOURCES_PLACEHOLDER>> /MediaBox [0 0 ${this.pageWidth} ${this.pageHeight}] >>`;
  }

  private createFontResources(): string {
    return `<< /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >>`;
  }

  private createContents(): string {
    const contentStream = this.buildContentStream();
    const compressed = contentStream;
    return `<< /Length ${compressed.length} >> stream\n${compressed}\nendstream`;
  }

  private buildContentStream(): string {
    let stream = "";

    // Set initial graphics state
    stream += "BT\n"; // Begin text

    // Carrier name (top-left)
    stream += "/F2 16 Tf\n"; // Font, size
    stream += "50 " + (this.pageHeight - 30) + " Td\n"; // Position
    stream += `(${escapePDFString(this.label.carrier.toUpperCase())}) Tj\n`; // Text

    // Service type (top-right)
    stream += "/F1 12 Tf\n";
    stream += (this.pageWidth - 100) + " " + (this.pageHeight - 30) + " Td\n";
    stream += `(${escapePDFString(this.label.service)}) Tj\n`;

    // FROM label
    stream += "/F2 12 Tf\n";
    stream += "50 " + (this.pageHeight - 70) + " Td\n";
    stream += "(FROM:) Tj\n";

    // Sender name
    stream += "/F1 10 Tf\n";
    stream += "50 " + (this.pageHeight - 90) + " Td\n";
    stream += `(${escapePDFString(this.label.sender.name)}) Tj\n`;

    // Sender address
    stream += "50 " + (this.pageHeight - 105) + " Td\n";
    stream += `(${escapePDFString(this.label.sender.street1)}) Tj\n`;

    const senderCity = `${this.label.sender.city}, ${this.label.sender.state} ${this.label.sender.postalCode}`;
    stream += "50 " + (this.pageHeight - 120) + " Td\n";
    stream += `(${escapePDFString(senderCity)}) Tj\n`;

    // TO label
    stream += "/F2 14 Tf\n";
    stream += "50 " + (this.pageHeight - 160) + " Td\n";
    stream += "(TO:) Tj\n";

    // Recipient name (large)
    stream += "/F2 18 Tf\n";
    stream += "50 " + (this.pageHeight - 195) + " Td\n";
    stream += `(${escapePDFString(this.label.recipient.name)}) Tj\n`;

    // Recipient address
    stream += "/F1 11 Tf\n";
    stream += "50 " + (this.pageHeight - 220) + " Td\n";
    stream += `(${escapePDFString(this.label.recipient.street1)}) Tj\n`;

    if (this.label.recipient.street2) {
      stream += "50 " + (this.pageHeight - 235) + " Td\n";
      stream += `(${escapePDFString(this.label.recipient.street2)}) Tj\n";
    }

    const recipientCity = `${this.label.recipient.city}, ${this.label.recipient.state} ${this.label.recipient.postalCode}`;
    stream += "50 " + (this.pageHeight - 250) + " Td\n";
    stream += `(${escapePDFString(recipientCity)}) Tj\n`;

    // Tracking number
    stream += "/F2 16 Tf\n";
    stream += "50 " + (this.pageHeight - 300) + " Td\n";
    stream += `(${escapePDFString(this.label.trackingNumber)}) Tj\n`;

    // Weight
    if (this.label.weight) {
      stream += "/F1 10 Tf\n";
      stream += "50 " + (this.pageHeight - 330) + " Td\n";
      const weightStr = `Weight: ${this.label.weight} ${this.label.weightUnit}`;
      stream += `(${escapePDFString(weightStr)}) Tj\n`;
    }

    // Sort code
    if (this.label.sortCode) {
      stream += "50 " + (this.pageHeight - 345) + " Td\n";
      stream += `(Sort Code: ${escapePDFString(this.label.sortCode)}) Tj\n`;
    }

    // Ship date
    const dateStr = this.label.shipDate.toLocaleDateString("en-US");
    stream += "50 " + (this.pageHeight - 360) + " Td\n";
    stream += `(Shipped: ${escapePDFString(dateStr)}) Tj\n`;

    // Reference info
    if (this.label.poNumber || this.label.orderNumber) {
      let refText = "";
      if (this.label.poNumber) refText += `PO: ${this.label.poNumber} `;
      if (this.label.orderNumber) refText += `Order: ${this.label.orderNumber}`;
      if (refText) {
        stream += "/F1 8 Tf\n";
        stream += "50 " + (this.pageHeight - 375) + " Td\n";
        stream += `(${escapePDFString(refText.trim())}) Tj\n`;
      }
    }

    stream += "ET\n"; // End text

    // Add barcode representation (simple box)
    stream += "q\n"; // Save graphics state
    stream += "0.5 w\n"; // Line width
    stream += `50 ${this.pageHeight - 420} 200 50 re\n`; // Rectangle
    stream += "s\n"; // Stroke
    stream += "BT\n";
    stream += "/F1 8 Tf\n";
    stream += `70 ${this.pageHeight - 395} Td\n`;
    stream += `(Barcode: ${escapePDFString(this.label.barcodeValue)}) Tj\n`;
    stream += "ET\n";
    stream += "Q\n"; // Restore graphics state

    return stream;
  }

  private addObject(content: string): number {
    this.objects.push({ id: this.currentId, content });
    return this.currentId++;
  }

  private buildPDF(catalogId: number): string {
    // Calculate object offsets (will be filled during writing)
    let pdf = "%PDF-1.4\n";
    const startOffset = pdf.length;

    // Write objects
    let currentOffset = startOffset;
    this.objectOffsets = [];

    for (const obj of this.objects) {
      this.objectOffsets.push(currentOffset);
      const objStr = `${obj.id} 0 obj\n${obj.content}\nendobj\n`;
      pdf += objStr;
      currentOffset += objStr.length;
    }

    // xref table
    const xrefOffset = pdf.length;
    pdf += "xref\n";
    pdf += `0 ${this.objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";

    for (const offset of this.objectOffsets) {
      pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    }

    // Trailer
    pdf += "trailer\n";
    pdf += `<< /Size ${this.objects.length + 1} /Root ${catalogId} 0 R >>\n`;
    pdf += "startxref\n";
    pdf += String(xrefOffset) + "\n";
    pdf += "%%EOF\n";

    return pdf;
  }
}

/**
 * Escape special characters in PDF strings
 */
function escapePDFString(text: string): string {
  const controlChars = new RegExp("[\\x00-\\x1f]", "g")
  return text
    .replace(/\\/g, "\\\\") // Escape backslash
    .replace(/\(/g, "\\(") // Escape left paren
    .replace(/\)/g, "\\)") // Escape right paren
    .replace(controlChars, " ") // Replace control characters with space
}
