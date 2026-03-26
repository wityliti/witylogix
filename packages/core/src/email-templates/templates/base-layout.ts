/**
 * Base email layout template - responsive, email-client compatible
 */

export interface BaseLayoutProps {
  storeName: string;
  storeUrl: string;
  supportEmail: string;
  content: string;
}

export function baseLayout(props: BaseLayoutProps): string {
  const { storeName, storeUrl, supportEmail, content } = props;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transactional Email</title>
  <style type="text/css">
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f8f9fa;
    }

    table {
      border-collapse: collapse;
      width: 100%;
    }

    td {
      padding: 0;
    }

    .email-wrapper {
      background-color: #f8f9fa;
      padding: 20px 0;
    }

    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .email-header {
      background-color: #1a1a2e;
      padding: 30px 20px;
      text-align: center;
      border-bottom: 4px solid #4361ee;
    }

    .email-header-logo {
      display: block;
      font-size: 24px;
      font-weight: 700;
      color: #ffffff;
      text-decoration: none;
      margin-bottom: 8px;
    }

    .email-header-subtext {
      font-size: 13px;
      color: #b0b0b0;
    }

    .email-content {
      padding: 40px 30px;
    }

    .email-footer {
      background-color: #f8f9fa;
      padding: 30px 20px;
      text-align: center;
      border-top: 1px solid #e8e8e8;
      font-size: 12px;
      color: #666666;
    }

    .footer-links {
      margin-bottom: 15px;
    }

    .footer-links a {
      color: #4361ee;
      text-decoration: none;
      margin: 0 10px;
      font-size: 12px;
    }

    .footer-links a:hover {
      text-decoration: underline;
    }

    .footer-divider {
      width: 40px;
      height: 1px;
      background-color: #e8e8e8;
      margin: 15px auto;
    }

    .footer-text {
      font-size: 11px;
      color: #999999;
      line-height: 1.8;
    }

    /* Button styles */
    .cta-button {
      display: inline-block;
      padding: 12px 32px;
      margin: 20px 0;
      background-color: #4361ee;
      color: #ffffff;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 600;
      font-size: 14px;
      text-align: center;
    }

    .cta-button:hover {
      background-color: #3650d9;
      text-decoration: none;
    }

    .cta-button-secondary {
      display: inline-block;
      padding: 12px 32px;
      margin: 20px 0;
      background-color: #f0f0f0;
      color: #1a1a2e;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 600;
      font-size: 14px;
      text-align: center;
      border: 1px solid #e0e0e0;
    }

    .cta-button-secondary:hover {
      background-color: #e5e5e5;
      text-decoration: none;
    }

    /* Section styles */
    .section {
      margin-bottom: 30px;
    }

    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 15px;
      border-bottom: 2px solid #4361ee;
      padding-bottom: 10px;
    }

    .section-subtitle {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a2e;
      margin-bottom: 12px;
      margin-top: 15px;
    }

    .section-text {
      font-size: 14px;
      color: #333333;
      line-height: 1.8;
      margin-bottom: 12px;
    }

    /* Info box */
    .info-box {
      background-color: #f0f4ff;
      border-left: 4px solid #4361ee;
      padding: 15px;
      margin: 15px 0;
      border-radius: 2px;
    }

    .info-box-title {
      font-weight: 600;
      color: #1a1a2e;
      margin-bottom: 5px;
      font-size: 13px;
    }

    .info-box-text {
      font-size: 13px;
      color: #333333;
    }

    /* Table styles */
    .summary-table {
      width: 100%;
      margin: 20px 0;
    }

    .summary-table td {
      padding: 10px 0;
      border-bottom: 1px solid #f0f0f0;
      font-size: 14px;
    }

    .summary-table-label {
      color: #666666;
      text-align: left;
    }

    .summary-table-value {
      color: #333333;
      text-align: right;
      font-weight: 600;
    }

    .summary-table-total td {
      padding-top: 15px;
      border-top: 2px solid #1a1a2e;
      border-bottom: none;
      font-size: 16px;
      font-weight: 700;
      color: #1a1a2e;
    }

    /* Responsive styles */
    @media (max-width: 600px) {
      .email-container {
        max-width: 100% !important;
      }

      .email-content {
        padding: 20px 15px !important;
      }

      .email-header {
        padding: 20px 15px !important;
      }

      .email-footer {
        padding: 20px 15px !important;
      }

      .section-title {
        font-size: 16px;
      }

      .cta-button,
      .cta-button-secondary {
        display: block;
        width: 100%;
        padding: 14px 16px;
        margin: 15px 0;
      }
    }
  </style>
</head>
<body>
  <table class="email-wrapper">
    <tr>
      <td align="center">
        <table class="email-container">
          <!-- Header -->
          <tr>
            <td>
              <table class="email-header" width="100%">
                <tr>
                  <td align="center">
                    <a href="{{storeUrl}}" class="email-header-logo">{{storeName}}</a>
                    <div class="email-header-subtext">Order Updates & Notifications</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="email-content">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td>
              <table class="email-footer" width="100%">
                <tr>
                  <td align="center">
                    <div class="footer-links">
                      <a href="{{storeUrl}}">Home</a>
                      <a href="{{storeUrl}}/orders">Orders</a>
                      <a href="{{storeUrl}}/help">Help</a>
                    </div>
                    <div class="footer-divider"></div>
                    <div class="footer-text">
                      {{storeName}}<br>
                      <a href="mailto:{{supportEmail}}">Contact Support: {{supportEmail}}</a><br>
                      <br>
                      <a href="{{storeUrl}}/unsubscribe">Unsubscribe from notifications</a><br>
                      <br>
                      This is an automated message, please do not reply directly to this email.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
