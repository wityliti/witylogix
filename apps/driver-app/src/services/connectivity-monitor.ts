import * as Network from 'expo-network';

type ConnectivityListener = (isOnline: boolean) => void;

class ConnectivityMonitor {
  private isOnline: boolean = true;
  private listeners: Set<ConnectivityListener> = new Set();
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private readonly POLL_INTERVAL_MS = 5000;

  async start(): Promise<void> {
    const state = await Network.getNetworkStateAsync();
    this.isOnline = !!(state.isConnected && state.isInternetReachable);

    this.pollInterval = setInterval(async () => {
      try {
        const newState = await Network.getNetworkStateAsync();
        const nowOnline = !!(newState.isConnected && newState.isInternetReachable);
        if (nowOnline !== this.isOnline) {
          this.isOnline = nowOnline;
          this.notifyListeners(nowOnline);
        }
      } catch {
        // Network check failed — assume offline
        if (this.isOnline) {
          this.isOnline = false;
          this.notifyListeners(false);
        }
      }
    }, this.POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  isCurrentlyOnline(): boolean {
    return this.isOnline;
  }

  subscribe(listener: ConnectivityListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(isOnline: boolean): void {
    this.listeners.forEach((l) => l(isOnline));
  }
}

export const connectivityMonitor = new ConnectivityMonitor();
