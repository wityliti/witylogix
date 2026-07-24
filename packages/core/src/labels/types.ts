export interface LabelData {
  trackingNumber: string;
  carrier: string;
  service: string;

  // Addresses
  sender: LabelAddress;
  recipient: LabelAddress;
  returnAddress?: LabelAddress;

  // Package
  weight: number;
  weightUnit: "kg" | "lb" | "g" | "oz";
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: "cm" | "in";
  };

  // Shipment
  shipDate: Date;
  reference?: string;
  poNumber?: string;
  orderNumber?: string;

  // Barcode
  barcodeType: "code128" | "qr" | "datamatrix";
  barcodeValue: string;

  // Routing
  sortCode?: string;
  routingCode?: string;
  serviceIcon?: string;
}

export interface LabelAddress {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface LabelOptions {
  format: "PDF" | "ZPL" | "PNG" | "HTML";
  size: "4x6" | "6x4" | "4x8" | "8.5x11";
  dpi?: number;
  copies?: number;
  returnLabel?: boolean;
}

export interface GeneratedLabel {
  data: string; // base64 for PDF/PNG, raw text for ZPL, HTML string for HTML
  format: string;
  mimeType: string;
  size: string;
  trackingNumber: string;
}
