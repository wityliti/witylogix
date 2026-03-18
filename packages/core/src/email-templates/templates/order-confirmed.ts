/**
 * Order Confirmed Email Template
 */

import { OrderEmailData } from '../types';
import { baseLayout } from './base-layout';
import { formatCurrency } from '../template-engine';

export function orderConfirmedTemplate(data: OrderEmailData): string {
  const content = `
    <table width="100%" border="0" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <h1 style="font-size: 24px; font-weight: 700; color: #1a1a2e; margin: 0 0 10px 0;">
            Your order #{{orderNumber}} is confirmed!
          </h1>
          <p style="font-size: 14px; color: #666666; margin: 0 0 20px 0;">
            Hi {{customerName}}, thank you for your order. We've received it and are getting it ready to ship.
          </p>
        </td>
      </tr>
    </table>

    <div class="section">
      <div class="section-title">Order Details</div>
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
      <table class="summary-table">
        <tr>
          <td class="summary-table-label">Subtotal</td>
          <td class="summary-table-value">{{subtotal}}</td>
        </tr>
        <tr>
          <td class="summary-table-label">Shipping</td>
          <td class="summary-table-value">{{shipping}}</td>
        </tr>
        <tr>
          <td class="summary-table-label">Tax</td>
          <td class="summary-table-value">{{tax}}</td>
        </tr>
        <tr class="summary-table-total">
          <td class="summary-table-label">Total</td>
          <td class="summary-table-value">{{total}}</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <div class="section-subtitle">What's Next?</div>
      <p class="section-text">
        We're preparing your order for shipment. You'll receive a tracking number and shipping confirmation email as soon as it ships, typically within 1-2 business days.
      </p>
      <p class="section-text">
        In the meantime, you can view your order status anytime by clicking the button below.
      </p>
      <div style="text-align: center;">
        <a href="{{storeUrl}}/orders/{{orderNumber}}" class="cta-button">View Your Order</a>
      </div>
    </div>

    <div class="info-box">
      <div class="info-box-title">Need Help?</div>
      <div class="info-box-text">
        If you have any questions about your order, our support team is here to help. Contact us at <a href="mailto:{{supportEmail}}" style="color: #4361ee; text-decoration: none;">{{supportEmail}}</a>
      </div>
    </div>
  `;

  return baseLayout({
    storeName: data.storeName,
    storeUrl: data.storeUrl,
    supportEmail: data.supportEmail,
    content,
  });
}
