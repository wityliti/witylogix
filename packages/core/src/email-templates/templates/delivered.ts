/**
 * Delivered Email Template
 */

import { DeliveryEmailData } from "../types";
import { baseLayout } from "./base-layout";

export function deliveredTemplate(data: DeliveryEmailData): string {
  const content = `
    <table width="100%" border="0" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <h1 style="font-size: 24px; font-weight: 700; color: #1a1a2e; margin: 0 0 10px 0;">
            Your order has been delivered! 🎉
          </h1>
          <p style="font-size: 14px; color: #666666; margin: 0 0 20px 0;">
            Hi {{customerName}}, your order #{{orderNumber}} was successfully delivered.
          </p>
        </td>
      </tr>
    </table>

    <div class="section">
      <div class="section-title">Delivery Confirmation</div>

      <div class="info-box">
        <div class="info-box-title">Delivered At</div>
        <div class="info-box-text">{{deliveredAt}}</div>
      </div>

      <div class="info-box">
        <div class="info-box-title">Delivered By</div>
        <div class="info-box-text">{{driverName}}</div>
      </div>

      <div class="info-box">
        <div class="info-box-title">Tracking Number</div>
        <div class="info-box-text">{{trackingNumber}}</div>
      </div>

      <div class="info-box">
        <div class="info-box-title">Proof of Delivery</div>
        <div class="info-box-text">
          <a href="{{proofOfDeliveryUrl}}" style="color: #4361ee; text-decoration: none;">View proof of delivery</a>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-subtitle">What's Next?</div>
      <p class="section-text">
        We hope you love your items! If you have any questions or concerns, please don't hesitate to reach out to our support team.
      </p>
      <p class="section-text">
        Your feedback is important to us. We'd love to hear about your delivery experience.
      </p>
      <div style="text-align: center;">
        <a href="{{storeUrl}}/orders/{{orderNumber}}/rate" class="cta-button">Rate Your Delivery</a>
      </div>
    </div>

    <div class="section">
      <div class="section-subtitle">Return or Exchange?</div>
      <p class="section-text">
        If you need to return or exchange any items, we make it easy. Visit your order page to start the return process anytime within 30 days.
      </p>
      <div style="text-align: center;">
        <a href="{{storeUrl}}/orders/{{orderNumber}}/return" class="cta-button-secondary">Start a Return</a>
      </div>
    </div>

    <div class="info-box">
      <div class="info-box-title">Questions?</div>
      <div class="info-box-text">
        Contact us at <a href="mailto:{{supportEmail}}" style="color: #4361ee; text-decoration: none;">{{supportEmail}}</a>
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
