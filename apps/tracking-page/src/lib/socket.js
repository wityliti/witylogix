import { io } from 'socket.io-client';
let socket = null;
export function initializeSocket(apiUrl) {
    if (socket) {
        return socket;
    }
    socket = io(apiUrl, {
        namespace: '/tracking',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
    });
    socket.on('connect', () => {
        console.log('Connected to tracking socket');
    });
    socket.on('disconnect', () => {
        console.log('Disconnected from tracking socket');
    });
    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
    });
    return socket;
}
export function getSocket() {
    return socket;
}
export function joinTrackingRoom(orderId) {
    if (!socket) {
        console.error('Socket not initialized');
        return;
    }
    socket.emit('join:room', { orderId });
}
export function onLocationUpdate(callback) {
    if (!socket) {
        console.error('Socket not initialized');
        return;
    }
    socket.on('location:update', callback);
    return () => socket?.off('location:update', callback);
}
export function onStatusUpdate(callback) {
    if (!socket) {
        console.error('Socket not initialized');
        return;
    }
    socket.on('status:update', callback);
    return () => socket?.off('status:update', callback);
}
export function onETAUpdate(callback) {
    if (!socket) {
        console.error('Socket not initialized');
        return;
    }
    socket.on('eta:update', callback);
    return () => socket?.off('eta:update', callback);
}
export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
//# sourceMappingURL=socket.js.map