/**
 * Return Refunded Email Template
 */

import { ReturnEmailData } from '../types';
import { baseLayout } from './base-layout';
import { formatCurrency } from '../template-engine';

export function returnRefundedTemplate(data: ReturnEmailData): string {
  const content = `
    <table width="100%" border="0" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <h1 style="font-size: 24px; font-weight: 700; color: #1a1a2e; margin: 0 0 10px 0;">
            Your refund has been processed!
          </h1>
          <p style="font-size: 14px; color: #666666; margin: 0 0 20px 0;">
            Hi {{customerName}}, your return #{{returnId}} has been approved and your refund is on the way.
          </p>
        </td>
      </tr>
    </table>

    <div class="section">
      <div class="section-title">Refund Details</div>

      <div class="info-box" style="background-color: #e8f5e9; border-left-color: #4caf50;">
        <div class="info-box-title">Refund Amount</div>
        <div style="font-size: 28px; font-weight: 700; color: #2e7d32; margin: 10px 0;">{{refundAmount}}</div>
      </div>

      <table class="summary-table">
        <tr>
          <td class="summary-table-label">Order Number</td>
          <td class="summary-table-value">{{orderNumber}}</td>
        </tr>
        <tr>
          <td class="summary-table-label">Return ID</td>
          <td class="summary-table-value">{{returnId}}</td>
        </tr>
        <tr>
          <td class="summary-table-label">Return Status</td>
          <td class="summary-table-value">{{returnStatus}}</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <div class="section-subtitle">Items Refunded</div>
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 15px 0;">
        <tr style="border-bottom: 1px solid #e8e8e8;">
          <th style="text-align: left; padding: 12px 0; font-weight: 600; color: #1a1a2e; font-size: 13px; border-bottom: 1px solid #e8e8e8;">Item</th>
          <th style="text-align: center; padding: 12px 0; font-weight: 600; color: #1a1a2e; font-size: 13px; border-bottom: 1px solid #e8e8e8; width: 80px;">Qty</th>
          <th style="text-align: right; padding: 12px 0; font-weight: 600; color: #1a1a2e; font-size: 13px; border-bottom: 1px solid #e8e8e8; width: 100px;">Amount</th>
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
      <div class="section-subtitle">When Will I Receive My Refund?</div>
      <p class="section-text">
        The refund of {{refundAmount}} has been issued to your original payment method. Depending on your bank or credit card issuer, it may take 3-5 business days for the funds to appear in your account.
      </p>
      <p class="section-text">
        If you don't see the refund after 5 business days, please contact your bank and reference your order number {{orderNumber}}.
      </p>
    </div>

    <div class="info-box">
      <div class="info-box-title">What's Next?</div>
      <div class="info-box-text">
        We'd love your feedback on your return experience. It helps us improve our service for you and other customers.
      </div>
    </div>

    <div class="section">
      <div style="text-align: center;">
        <a href="{{storeUrl}}/orders/{{orderNumber}}/feedback" class="cta-button">Share Your Feedback</a>
      </div>
    </div>

    <div class="section">
      <div class="section-subtitle">Shop Again?</div>
      <p class="section-text">
        We hope to see you again soon! Check out our latest arrivals and special offers.
      </p>
      <div style="text-align: center;">
        <a href="{{storeUrl}}" class="cta-button-secondary">Continue Shopping</a>
      </div>
    </div>

    <div class="info-box">
      <div class="info-box-title">Questions About Your Refund?</div>
      <div class="info-box-text">
        Our support team is happy to help. Reach out to us at <a href="mailto:{{supportEmail}}" style="color: #4361ee; text-decoration: none;">{{supportEmail}}</a>
      </div>
    </div>
  `;

  return baseLayout({
    storeName: data.storeName,
    storeUrl: '',
    supportEmail: data.supportEmail,
    content,
  });
}
