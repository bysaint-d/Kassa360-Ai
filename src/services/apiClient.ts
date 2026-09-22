import { User, OfflineOperation } from '../types';

const TOKEN_KEY = 'kassa360_jwt_token';
const USER_KEY = 'kassa360_auth_user';
const DEVICE_ID_KEY = 'kassa360_device_id';
const OFFLINE_QUEUE_KEY = 'kassa360_offline_queue';
const SERVER_URL_KEY = 'kassa360_server_api_url';

export const DEFAULT_PRODUCTION_SERVER_URL = 'https://ais-dev-2fs2pmsfv6pphdldss5sp7-870522842645.europe-west2.run.app';

export function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.location.protocol === 'capacitor:' ||
    (window as any).Capacitor?.isNativePlatform?.() ||
    (window.location.hostname === 'localhost' && window.location.port !== '3000' && /android/i.test(navigator.userAgent))
  );
}

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export const deviceId = getDeviceId();

export class ApiClient {
  private token: string | null = localStorage.getItem(TOKEN_KEY);
  private user: User | null = null;
  private ws: WebSocket | null = null;
  private wsListeners = new Set<(event: { type: string; payload: any }) => void>();
  private syncListeners = new Set<(isSyncing: boolean, pendingCount: number) => void>();
  private isSyncing = false;

  constructor() {
    try {
      const savedUser = localStorage.getItem(USER_KEY);
      if (savedUser) {
        this.user = JSON.parse(savedUser);
      }
    } catch (e) {
      this.user = null;
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('🌐 [Network] Device is back online. Flushing offline queue...');
        this.flushOfflineQueue();
        this.initWebSocket();
      });

      window.addEventListener('offline', () => {
        console.log('⚠️ [Network] Device is offline. Local caching active.');
        this.notifySync();
      });

      // Init WebSocket if in browser
      setTimeout(() => this.initWebSocket(), 500);
    }
  }

  public getBaseUrl(): string {
    if (typeof window === 'undefined') return '';

    // 1. Manually configured URL in LocalStorage
    const custom = localStorage.getItem(SERVER_URL_KEY);
    if (custom && custom.trim().length > 0) {
      return custom.trim().replace(/\/+$/, '');
    }

    // 2. Build-time environment variable
    const envUrl = (import.meta as any).env?.VITE_API_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
      return envUrl.trim().replace(/\/+$/, '');
    }

    // 3. Android APK / Capacitor native environment fallback to real production backend
    if (isNativePlatform()) {
      return DEFAULT_PRODUCTION_SERVER_URL;
    }

    // 4. Default: empty string for browser running on the same server (relative paths)
    return '';
  }

  public setServerUrl(url: string | null): void {
    if (!url || !url.trim()) {
      localStorage.removeItem(SERVER_URL_KEY);
    } else {
      localStorage.setItem(SERVER_URL_KEY, url.trim().replace(/\/+$/, ''));
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.initWebSocket();
  }

  public async testConnection(targetUrl?: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = performance.now();
    try {
      const baseUrl = targetUrl ? targetUrl.trim().replace(/\/+$/, '') : this.getBaseUrl();
      const testUrl = `${baseUrl}/api/health`;
      const res = await fetch(testUrl, { method: 'GET', signal: AbortSignal.timeout(5000) });
      const latencyMs = Math.round(performance.now() - start);
      if (res.ok) {
        return { ok: true, latencyMs };
      }
      return { ok: false, latencyMs, error: `HTTP ${res.status}` };
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - start);
      return { ok: false, latencyMs, error: err.message || 'Bağlantı xətası' };
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  public getCurrentUser(): User | null {
    return this.user;
  }

  public setAuth(token: string, user: User) {
    this.token = token;
    this.user = user;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  public clearAuth() {
    this.token = null;
    this.user = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-device-id': deviceId,
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  public async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = { ...this.getHeaders(), ...(options.headers as Record<string, string>) };
    const baseUrl = this.getBaseUrl();
    const fullUrl = endpoint.startsWith('http://') || endpoint.startsWith('https://')
      ? endpoint
      : `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const response = await fetch(fullUrl, { ...options, headers });

    if (!response.ok) {
      let errMsg = `Server Error (${response.status})`;
      try {
        const errJson = await response.json();
        errMsg = errJson.error || errJson.message || errMsg;
      } catch (e) {
        // ignore
      }
      throw new Error(errMsg);
    }

    return response.json();
  }

  // --- Auth API ---
  public async login(username: string, password: string): Promise<{ token: string; user: User }> {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setAuth(data.token, data.user);
    return data;
  }

  // --- Real-time WebSocket ---
  public onWsMessage(listener: (event: { type: string; payload: any }) => void) {
    this.wsListeners.add(listener);
    return () => this.wsListeners.delete(listener);
  }

  public onSyncChange(listener: (isSyncing: boolean, pendingCount: number) => void) {
    this.syncListeners.add(listener);
    listener(this.isSyncing, this.getOfflineQueue().length);
    return () => this.syncListeners.delete(listener);
  }

  private notifySync() {
    const count = this.getOfflineQueue().length;
    for (const l of this.syncListeners) {
      l(this.isSyncing, count);
    }
  }

  public initWebSocket() {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const baseUrl = this.getBaseUrl();
      let wsUrl: string;

      if (baseUrl) {
        try {
          const parsed = new URL(baseUrl);
          const proto = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
          wsUrl = `${proto}//${parsed.host}/ws`;
        } catch {
          const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          wsUrl = `${proto}//${window.location.host}/ws`;
        }
      } else {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${proto}//${window.location.host}/ws`;
      }

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('⚡ [RealTime] Connected to Kassa360 WebSocket server');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Don't process our own echoed broadcasts if deviceId matches
          if (data.sourceDeviceId && data.sourceDeviceId === deviceId) {
            return;
          }
          for (const listener of this.wsListeners) {
            listener(data);
          }
        } catch (e) {
          console.warn('WS message parse error:', e);
        }
      };

      this.ws.onclose = () => {
        // Reconnect after 3 seconds
        setTimeout(() => this.initWebSocket(), 3000);
      };

      this.ws.onerror = () => {
        // Silent error handling
      };
    } catch (e) {
      console.warn('Failed to initialize WebSocket:', e);
    }
  }

  // --- Offline Queue Management ---
  public getOfflineQueue(): OfflineOperation[] {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  public enqueueOperation(type: 'SALE_CREATE' | 'SALE_UPDATE' | 'SALE_RETURN', payload: any): string {
    const queue = this.getOfflineQueue();
    const clientUuid = payload.clientUuid || `uuid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    payload.clientUuid = clientUuid;

    const op: OfflineOperation = {
      id: `op_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      clientUuid,
      deviceId,
      type,
      payload,
      createdAt: new Date().toISOString(),
      status: 'PENDING_SYNC',
    };

    queue.push(op);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    this.notifySync();

    // Attempt instant flush if online
    if (navigator.onLine) {
      this.flushOfflineQueue();
    }

    return clientUuid;
  }

  public async flushOfflineQueue(): Promise<void> {
    const queue = this.getOfflineQueue();
    if (queue.length === 0 || this.isSyncing) return;

    this.isSyncing = true;
    this.notifySync();

    try {
      const pending = queue.filter((q) => q.status === 'PENDING_SYNC');
      if (pending.length === 0) {
        this.isSyncing = false;
        this.notifySync();
        return;
      }

      console.log(`🚀 [Sync] Flushing ${pending.length} offline operations to server...`);
      const response = await this.request('/api/sync/push', {
        method: 'POST',
        body: JSON.stringify({ operations: pending }),
      });

      const results: Array<{ clientUuid: string; status: string }> = response.results || [];
      const resultMap = new Map<string, string>();
      for (const r of results) {
        resultMap.set(r.clientUuid, r.status);
      }

      // Filter out successfully processed or duplicate operations
      const remaining = queue.filter((q) => {
        const st = resultMap.get(q.clientUuid);
        return st !== 'SUCCESS' && st !== 'DUPLICATE';
      });

      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
      console.log(`✅ [Sync] Flush complete. Remaining pending: ${remaining.length}`);
    } catch (err) {
      console.warn('⚠️ [Sync] Flush failed, will retry on next connection:', err);
    } finally {
      this.isSyncing = false;
      this.notifySync();
    }
  }

  // --- Data APIs ---
  public async fetchProducts(): Promise<any[]> {
    const res = await this.request('/api/products');
    return res.products || [];
  }

  public async fetchSales(): Promise<any[]> {
    const res = await this.request('/api/sales');
    return res.sales || [];
  }

  public async createSale(saleData: any): Promise<any> {
    const clientUuid = saleData.clientUuid || `uuid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const payload = { ...saleData, clientUuid, deviceId };

    if (!navigator.onLine) {
      this.enqueueOperation('SALE_CREATE', payload);
      return {
        ...payload,
        id: payload.id || `offline_${Date.now()}`,
        syncStatus: 'PENDING_SYNC',
      };
    }

    try {
      const res = await this.request('/api/sales', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.sale;
    } catch (err) {
      console.warn('Sale API failed, queuing offline:', err);
      this.enqueueOperation('SALE_CREATE', payload);
      return {
        ...payload,
        id: payload.id || `offline_${Date.now()}`,
        syncStatus: 'PENDING_SYNC',
      };
    }
  }

  public async updateSale(saleId: string | number, params: any): Promise<any> {
    return this.request(`/api/sales/${saleId}`, {
      method: 'PUT',
      body: JSON.stringify(params),
    });
  }

  public async returnSale(saleId: string | number): Promise<any> {
    return this.request(`/api/sales/${saleId}/return`, {
      method: 'POST',
    });
  }

  public async deleteSale(saleId: string | number, restoreStock: boolean = true): Promise<any> {
    return this.request(`/api/sales/${saleId}?restoreStock=${restoreStock}`, {
      method: 'DELETE',
    });
  }

  public async addDebtPayment(saleId: string | number, paymentData: any): Promise<any> {
    return this.request(`/api/sales/${saleId}/payments`, {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  }

  public async adjustStock(productId: string | number, change: number, notes?: string): Promise<any> {
    return this.request('/api/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify({ productId, quantityChange: change, notes }),
    });
  }

  public async bootstrapData(payload: any): Promise<any> {
    return this.request('/api/sync/bootstrap', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async fetchSettings(): Promise<any> {
    const res = await this.request('/api/settings');
    return res.settings || {};
  }

  public async updateSettings(settings: any): Promise<any> {
    return this.request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }
}

export const apiClient = new ApiClient();
