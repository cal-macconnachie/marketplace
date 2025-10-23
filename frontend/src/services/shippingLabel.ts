import type { Organization, ShippingLabelData } from '@marketplace/types'

export function printShippingLabel(data: ShippingLabelData): void {
  const printWindow = window.open('', '_blank', 'width=600,height=400')
  if (!printWindow) {
    console.error('Failed to open print window - popup may be blocked')
    return
  }

  const html = generateShippingLabelHTML(data)

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}

function generateShippingLabelHTML(data: ShippingLabelData): string {
  const {
    orderId,
    customerName,
    customerEmail,
    customerPhone,
    shippingAddress,
    returnOrganization,
  } = data

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shipping Label - Order ${escapeHtml(orderId)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      width: 600px;
      height: 400px;
      padding: 20px;
      background: white;
    }

    .label-container {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      border: 3px solid #000;
      padding: 15px;
      overflow: hidden;
    }

    /* Return Address - Top Left, Small */
    .return-section {
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px dashed #666;
      flex-shrink: 0;
    }

    .return-label {
      font-size: 9px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
      color: #666;
    }

    .return-address {
      font-size: 11px;
      line-height: 1.3;
      color: #333;
    }

    /* Order ID - Prominent, Barcode-Ready */
    .order-section {
      margin-bottom: 10px;
      text-align: center;
      padding: 6px;
      background: #f5f5f5;
      border: 2px solid #000;
      flex-shrink: 0;
    }

    .order-label {
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }

    .order-id {
      font-size: 18px;
      font-weight: bold;
      letter-spacing: 2px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    /* Shipping Address - Large, Prominent */
    .shipping-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    .shipping-label {
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 2px solid #000;
      flex-shrink: 0;
    }

    .shipping-address {
      font-size: 16px;
      line-height: 1.25;
      font-weight: bold;
      color: #000;
      display: flex;
      flex-direction: column;
      gap: 1px;
      overflow: hidden;
    }

    .shipping-address > div {
      flex-shrink: 0;
    }

    .address-name {
      font-size: 18px;
      margin-bottom: 2px;
    }

    /* Contact Info - Bottom, Small */
    .contact-section {
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px dashed #666;
      font-size: 9px;
      color: #666;
      line-height: 1.3;
      flex-shrink: 0;
    }

    /* Print Styles */
    @media print {
      @page {
        size: 4in 6in;
        margin: 0;
      }

      body {
        width: 4in;
        height: 6in;
        padding: 0.2in;
      }

      .label-container {
        border-width: 2px;
      }
    }
  </style>
</head>
<body>
  <div class="label-container">
    ${generateReturnAddressSection(returnOrganization)}

    <div class="order-section">
      <div class="order-label">Order ID</div>
      <div class="order-id">${escapeHtml(orderId)}</div>
    </div>

    <div class="shipping-section">
      <div class="shipping-label">Ship To:</div>
      <div class="shipping-address">
        <div class="address-name">${escapeHtml(customerName)}</div>
        <div>${escapeHtml(shippingAddress.address_line1)}</div>
        ${shippingAddress.address_line2 ? `<div>${escapeHtml(shippingAddress.address_line2)}</div>` : ''}
        <div>${escapeHtml(shippingAddress.city)}, ${escapeHtml(shippingAddress.state)} ${escapeHtml(shippingAddress.postal_code)}</div>
        <div>${escapeHtml(shippingAddress.country)}</div>
      </div>
    </div>

    ${generateContactSection(customerEmail, customerPhone)}
  </div>

  <script>
    window.onload = function() {
      // Small delay to ensure styles are loaded
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`
}

function generateReturnAddressSection(org?: Organization): string {
  if (!org?.address) return ''

  const orgName = org.name || 'Seller'
  const addr = org.address

  return `
    <div class="return-section">
      <div class="return-label">From:</div>
      <div class="return-address">
        <div>${escapeHtml(orgName)}</div>
        <div>${escapeHtml(addr.line_1)}</div>
        ${addr.line_2 ? `<div>${escapeHtml(addr.line_2)}</div>` : ''}
        <div>${escapeHtml(addr.city)}, ${escapeHtml(addr.state)} ${escapeHtml(addr.postal_code)}</div>
        <div>${escapeHtml(addr.country)}</div>
        ${org.email ? `<div>${escapeHtml(org.email)}</div>` : ''}
        ${org.phone ? `<div>${escapeHtml(org.phone)}</div>` : ''}
      </div>
    </div>`
}

function generateContactSection(email?: string, phone?: string): string {
  if (!email && !phone) return ''

  const contactItems: string[] = []
  if (email) contactItems.push(`Email: ${escapeHtml(email)}`)
  if (phone) contactItems.push(`Phone: ${escapeHtml(phone)}`)

  return `
    <div class="contact-section">
      ${contactItems.join(' • ')}
    </div>`
}

/**
 * Escapes HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
