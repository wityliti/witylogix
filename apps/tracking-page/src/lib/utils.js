export function maskPhoneNumber(phone) {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) {
        return phone;
    }
    return `***-***-${cleaned.slice(-4)}`;
}
export function formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}
export function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}
export function getStatusLabel(status) {
    const labels = {
        PENDING: 'Pending',
        ACCEPTED: 'Accepted',
        ASSIGNED: 'Driver Assigned',
        PICKED_UP: 'Picked Up',
        OUT_FOR_DELIVERY: 'Out for Delivery',
        ARRIVED: 'Arrived',
        DELIVERED: 'Delivered',
    };
    return labels[status] || status;
}
export function calculateETA(etaTimestamp) {
    const now = Date.now();
    const remaining = Math.max(0, etaTimestamp - now);
    const minutes = Math.floor(remaining / 60000);
    const hours = Math.floor(minutes / 60);
    let formatted = '';
    if (hours > 0) {
        formatted = `${hours}h ${minutes % 60}m`;
    }
    else {
        formatted = `${minutes}m`;
    }
    return {
        remaining,
        formatted,
        isOverdue: remaining === 0 && etaTimestamp < now,
    };
}
export function getVehicleIcon(vehicleType) {
    const type = vehicleType.toLowerCase();
    if (type.includes('van'))
        return '🚐';
    if (type.includes('truck'))
        return '🚚';
    if (type.includes('bike') || type.includes('motorcycle'))
        return '🏍️';
    if (type.includes('car'))
        return '🚗';
    return '🚙';
}
//# sourceMappingURL=utils.js.map