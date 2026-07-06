/**
 * Return Initiated Email Template
 */

import { ReturnEmailData } from "../types";
import { baseLayout } from "./base-layout";
import { renderTemplate } from "../template-engine";

export function returnInitiatedTemplate(data: ReturnEmailData): string {
  const content = `
    <table width="100%" border="0" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <h1 style="font-size: 24px; font-weight: 700; color: #1a1a2e; margin: 0 0 10px 0;">
            Your return request #{{returnId}} has been received
          </h1>
          <p style="font-size: 14px; color: #666666; margin: 0 0 20px 0;">
            Hi {{customerName}}, we've received your return request for order #{{orderNumber}}. Here's what happens next.
          </p>
        </td>
      </tr>
    </table>

    <div class="section">
      <div class="section-title">Items Being Returned</div>
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 15px 0;">
        <tr style="border-bottom: 1px solid #e8e8e8;">
          <th style="text-align: left; padding: 12px 0; font-weight: 600; color: #1a1a2e; font-size: 13px; border-bottom: 1px solid #e8e8e8;">Item</th>
          <th style="text-align: center; padding: 12px 0; font-weight: 600; color: #1a1a2e; font-size: 13px; border-bottom: 1px solid #e8e8e8; width: 80px;">Qty</th>
          <th style="text-align: right; padding: 12px 0; font-weight: 600; color: #1a1a2e; font-size: 13px; border-bottom: 1px solid #e8e8e8; width: 100px;">Refund</th>
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
      <div class="section-title">Return Shipping</div>

      <div class="info-box">
        <div class="info-box-title">Return Label</div>
        <div class="info-box-text">
          <a href="{{returnLabelUrl}}" style="color: #4361ee; text-decoration: none;">Download your return shipping label</a><br>
          <span style="font-size: 12px; color: #999999;">Print the label and affix it to your return package.</span>
        </div>
      </div>

      <p class="section-text">
        Your prepaid return label is ready. Simply print it out and attach it to your return package. Drop it off at any authorized carrier location.
      </p>
    </div>

    <div class="section">
      <div class="section-subtitle">Next Steps</div>
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 15px 0;">
        <tr>
          <td style="padding: 12px 0; vertical-align: top;">
            <div style="display: inline-block; width: 30px; height: 30px; background-color: #4361ee; color: white; text-align: center; line-height: 30px; border-radius: 50%; font-weight: 700; margin-right: 15px; vertical-align: middle;">1</div>
          </td>
          <td style="padding: 12px 0; font-size: 14px; color: #333333;">
            <strong>Print the return label</strong> from the link above
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; vertical-align: top;">
            <div style="display: inline-block; width: 30px; height: 30px; background-color: #4361ee; color: white; text-align: center; line-height: 30px; border-radius: 50%; font-weight: 700; margin-right: 15px; vertical-align: middle;">2</div>
          </td>
          <td style="padding: 12px 0; font-size: 14px; color: #333333;">
            <strong>Package your items</strong> securely and attach the label
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; vertical-align: top;">
            <div style="display: inline-block; width: 30px; height: 30px; background-color: #4361ee; color: white; text-align: center; line-height: 30px; border-radius: 50%; font-weight: 700; margin-right: 15px; vertical-align: middle;">3</div>
          </td>
          <td style="padding: 12px 0; font-size: 14px; color: #333333;">
            <strong>Drop off at carrier</strong> and keep your receipt
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; vertical-align: top;">
            <div style="display: inline-block; width: 30px; height: 30px; background-color: #4361ee; color: white; text-align: center; line-height: 30px; border-radius: 50%; font-weight: 700; margin-right: 15px; vertical-align: middle;">4</div>
          </td>
          <td style="padding: 12px 0; font-size: 14px; color: #333333;">
            <strong>Receive your refund</strong> once we receive and inspect the items
          </td>
        </tr>
      </table>
    </div>

    <div class="info-box">
      <div class="info-box-title">Refund Timeline</div>
      <div class="info-box-text">
        Once we receive your return, we'll inspect the items and process your refund within 5-7 business days. The refund will be credited to your original payment method.
      </div>
    </div>

    <div class="section">
      <div style="text-align: center;">
        <a href="{{returnLabelUrl}}" class="cta-button">Download Return Label</a>
      </div>
    </div>

    <div class="info-box">
      <div class="info-box-title">Questions?</div>
      <div class="info-box-text">
        If you need help with your return, contact us at <a href="mailto:{{supportEmail}}" style="color: #4361ee; text-decoration: none;">{{supportEmail}}</a>
      </div>
    </div>
  `;

  const html = baseLayout({
    storeName: data.storeName,
    storeUrl: "",
    supportEmail: data.supportEmail,
    content,
  });

  return renderTemplate(html, data as unknown as Record<string, any>);
}
