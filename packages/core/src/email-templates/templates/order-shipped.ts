/**
 * Order Shipped Email Template
 */

import { ShippingEmailData } from "../types";
import { baseLayout } from "./base-layout";
import { renderTemplate } from "../template-engine";

export function orderShippedTemplate(data: ShippingEmailData): string {
  const content = `
    <table width="100%" border="0" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <h1 style="font-size: 24px; font-weight: 700; color: #1a1a2e; margin: 0 0 10px 0;">
            Your order #{{orderNumber}} is on its way!
          </h1>
          <p style="font-size: 14px; color: #666666; margin: 0 0 20px 0;">
            Hi {{customerName}}, great news! Your order has been shipped and is headed to you.
          </p>
        </td>
      </tr>
    </table>

    <div class="section">
      <div class="section-title">Shipping Information</div>

      <div class="info-box">
        <div class="info-box-title">Carrier</div>
        <div class="info-box-text">{{carrierName}}</div>
      </div>

      <div class="info-box">
        <div class="info-box-title">Tracking Number</div>
        <div class="info-box-text">
          <strong>{{trackingNumber}}</strong><br>
          <a href="{{trackingUrl}}" style="color: #4361ee; text-decoration: none;">Click here to track your package</a>
        </div>
      </div>

      <div class="info-box">
        <div class="info-box-title">Estimated Delivery</div>
        <div class="info-box-text">{{estimatedDelivery}}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-subtitle">What's in Your Order?</div>
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 15px 0;">
        <tr style="border-bottom: 1px solid #e8e8e8;">
          <th style="text-align: left; padding: 12px 0; font-weight: 600; color: #1a1a2e; font-size: 13px; border-bottom: 1px solid #e8e8e8;">Item</th>
          <th style="text-align: center; padding: 12px 0; font-weight: 600; color: #1a1a2e; font-size: 13px; border-bottom: 1px solid #e8e8e8; width: 80px;">Qty</th>
          <th style="text-align: right; padding: 12px 0; font-weight: 600; color: #1a1a2e; font-size: 13px; border-bottom: 1px solid #e8e8e8; width: 100px;">Price</th>
        </tr>
        {{#each items}}
        <tr style="border-bottom: 1px solid #f0f0f0;">
          <td style="padding: 12px 0; font-size: 14px; color: #333333;">{{name}}</td>
          <td style="padding: 12px 0; text-align: center; font-size: 14px; color: #333333;">{{quantity}}</td>
          <td style="padding: 12px 0; text-align: right; font-size: 14px; color: #333333; font-weight: 600;">{{price}}</td>
        </tr>
        {{/each}}
      </table>
    </div>

    <div class="section">
      <div class="section-subtitle">Track Your Package</div>
      <p class="section-text">
        You can monitor your shipment in real-time using the tracking number above. Most carriers provide estimated delivery times and may offer notifications at each stage of the journey.
      </p>
      <div style="text-align: center;">
        <a href="{{trackingUrl}}" class="cta-button">Track Your Package</a>
      </div>
    </div>

    <div class="info-box">
      <div class="info-box-title">Questions?</div>
      <div class="info-box-text">
        If you need assistance, contact our support team at <a href="mailto:{{supportEmail}}" style="color: #4361ee; text-decoration: none;">{{supportEmail}}</a>
      </div>
    </div>
  `;

  const html = baseLayout({
    storeName: data.storeName,
    storeUrl: data.storeUrl,
    supportEmail: data.supportEmail,
    content,
  });

  return renderTemplate(html, data as unknown as Record<string, any>);
}
