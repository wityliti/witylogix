import { getStatusLabel, formatTime } from '../lib/utils';
const statusOrder = [
    'PENDING',
    'ACCEPTED',
    'ASSIGNED',
    'PICKED_UP',
    'OUT_FOR_DELIVERY',
    'ARRIVED',
    'DELIVERED',
];
export function StatusTimeline({ currentStatus, statusHistory, }) {
    const statusMap = new Map(statusHistory.map((s) => [s.status, s]));
    const currentStatusIndex = statusOrder.indexOf(currentStatus);
    return (<div style={{
            padding: '24px 0',
        }}>
      <h2 style={{
            fontSize: '18px',
            fontWeight: '600',
            marginBottom: '24px',
            color: '#1f2937',
        }}>
        Delivery Status
      </h2>

      <div style={{ position: 'relative', paddingLeft: '24px' }}>
        {statusOrder.map((status, index) => {
            const statusEvent = statusMap.get(status);
            const isCompleted = index <= currentStatusIndex;
            const isCurrent = status === currentStatus;
            return (<div key={status} style={{ marginBottom: index < statusOrder.length - 1 ? '24px' : '0' }}>
              {/* Timeline dot and line */}
              <div style={{
                    position: 'absolute',
                    left: '-12px',
                    top: '0',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: isCompleted ? '#008060' : '#e5e7eb',
                    border: isCurrent ? '3px solid #005bd3' : '2px solid white',
                    boxShadow: isCurrent
                        ? '0 0 0 2px #005bd3'
                        : '0 1px 3px rgba(0, 0, 0, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    color: isCompleted ? 'white' : '#9ca3af',
                    fontWeight: 'bold',
                }}>
                {isCompleted ? '✓' : ''}
              </div>

              {index < statusOrder.length - 1 && (<div style={{
                        position: 'absolute',
                        left: '-2px',
                        top: '24px',
                        width: '2px',
                        height: '24px',
                        backgroundColor: isCompleted ? '#008060' : '#e5e7eb',
                    }}/>)}

              {/* Status content */}
              <div>
                <h3 style={{
                    fontSize: '14px',
                    fontWeight: isCompleted ? '600' : '500',
                    color: isCompleted ? '#1f2937' : '#9ca3af',
                    margin: '0 0 4px 0',
                }}>
                  {getStatusLabel(status)}
                </h3>
                {statusEvent && (<p style={{
                        fontSize: '12px',
                        color: '#6b7280',
                        margin: '0',
                    }}>
                    {formatTime(statusEvent.timestamp)}
                  </p>)}
              </div>
            </div>);
        })}
      </div>
    </div>);
}
//# sourceMappingURL=StatusTimeline.js.map