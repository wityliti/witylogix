import { formatDate, getStatusLabel } from '../lib/utils';
export function OrderSummary({ order }) {
    const createdDate = formatDate(order.createdAt);
    return (<div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}>
      <h2 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#1f2937',
            margin: '0 0 20px 0',
        }}>
        Order Details
      </h2>

      {/* Order ID */}
      <div style={{ marginBottom: '16px' }}>
        <p style={{
            fontSize: '12px',
            color: '#6b7280',
            margin: '0 0 4px 0',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
        }}>
          Order ID
        </p>
        <p style={{
            fontSize: '14px',
            fontWeight: '500',
            color: '#1f2937',
            margin: '0',
            fontFamily: 'monospace',
        }}>
          {order.id}
        </p>
      </div>

      {/* Current Status */}
      <div style={{ marginBottom: '16px' }}>
        <p style={{
            fontSize: '12px',
            color: '#6b7280',
            margin: '0 0 4px 0',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
        }}>
          Current Status
        </p>
        <div style={{
            display: 'inline-block',
            backgroundColor: order.status === 'DELIVERED' ? '#008060' : '#005bd3',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '600',
        }}>
          {getStatusLabel(order.status)}
        </div>
      </div>

      {/* Pickup Address */}
      <div style={{ marginBottom: '16px' }}>
        <p style={{
            fontSize: '12px',
            color: '#6b7280',
            margin: '0 0 4px 0',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
        }}>
          Pickup Location
        </p>
        <p style={{
            fontSize: '14px',
            color: '#1f2937',
            margin: '0',
            lineHeight: '1.5',
        }}>
          {order.pickupLocation.address}
        </p>
      </div>

      {/* Delivery Address */}
      <div style={{ marginBottom: '16px' }}>
        <p style={{
            fontSize: '12px',
            color: '#6b7280',
            margin: '0 0 4px 0',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
        }}>
          Delivery Location
        </p>
        <p style={{
            fontSize: '14px',
            color: '#1f2937',
            margin: '0',
            lineHeight: '1.5',
        }}>
          {order.deliveryLocation.address}
        </p>
      </div>

      {/* Order Date */}
      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
        <p style={{
            fontSize: '12px',
            color: '#6b7280',
            margin: '0 0 4px 0',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
        }}>
          Order Date
        </p>
        <p style={{
            fontSize: '14px',
            color: '#1f2937',
            margin: '0',
        }}>
          {createdDate}
        </p>
      </div>
    </div>);
}
//# sourceMappingURL=OrderSummary.js.map