/**
 * useSocket — Socket.io connection manager for real-time updates.
 *
 * Connects to the Witylogix API WebSocket server and provides
 * a typed event subscription API. Used for:
 *   - Activity timeline on Dashboard
 *   - Driver location updates on Drivers map
 *   - Route optimization results
 *   - Order status changes
 */
import type { Socket } from "socket.io-client";
interface UseSocketOptions {
    /** Socket.io namespace (e.g., "/admin", "/tracking"). */
    namespace?: string;
    /** Authentication token to send on connect. */
    token?: string;
    /** Room to join after connecting. */
    room?: string;
    /** Auto-connect on mount. Default: true. */
    autoConnect?: boolean;
}
interface UseSocketResult {
    isConnected: boolean;
    socket: Socket | null;
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    off: (event: string, handler: (...args: unknown[]) => void) => void;
    emit: (event: string, ...args: unknown[]) => void;
}
export declare function useSocket(options?: UseSocketOptions): UseSocketResult;
export {};
//# sourceMappingURL=useSocket.d.ts.map