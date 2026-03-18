/**
 * Out for Delivery Email Template
 */

import { DeliveryEmailData } from '../types';
import { baseLayout } from './base-layout';

export function outForDeliveryTemplate(data: DeliveryEmailData): string {
  const content = `
    <table width="100%" border="0" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <h1 style="font-size: 24px; font-weight: 700; color: #1a1a2e; margin: 0 0 10px 0;">
            Your order is out for delivery today!
          </h1>
          <p style="font-size: 14px; color: #666666; margin: 0 0 20px 0;">
            Hi {{customerName}}, your package is on the delivery truck and will arrive shortly.
          </p>
        </td>
      </tr>
    </table>

    <div class="section">
      <div class="section-title">Delivery Status</div>

      <div class="info-box">
        <div class="info-box-title">Estimated Arrival Time</div>
        <div class="info-box-text">Today - {{estimatedDelivery}}</div>
      </div>

      <div class="info-box">
        <div class="info-box-title">Driver</div>
        <div class="info-box-text">{{driverName}}</div>
      </div>

      <div class="info-box">
        <div class="info-box-title">Tracking Number</div>
        <div class="info-box-text">
          <strong>{{trackingNumber}}</strong><br>
          <a href="{{trackingUrl}}" style="color: #4361ee; text-decoration: none;">View live tracking</a>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-subtitle">Be Ready for Delivery</div>
      <p class="section-text">
        Make sure someone is available to receive your package. The driver may require a signature depending on the carrier's policies.
      </p>
      <p class="section-text">
        We recommend tracking your package in real-time to know exactly when to expect delivery.
      </p>
      <div style="text-align: center;">
        <a href="{{trackingUrl}}" class="cta-button">Track Live</a>
      </div>
    </div>

    <div class="info-box">
      <div class="info-box-title">Need Help?</div>
      <div class="info-box-text">
        Reach out to our support team at <a href="mailto:{{supportEmail}}" style="color: #4361ee; text-decoration: none;">{{supportEmail}}</a>
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
