declare const __LEARNING_API_BASE__: string;

const API_BASE = (typeof __LEARNING_API_BASE__ === 'string' ? __LEARNING_API_BASE__ : 'http://127.0.0.1:8000').replace(/\/$/, '');
const ALARM_NAME = 'polytranslate-learning-link-poll';
const PUBLIC_STATUS_KEY = 'learningAccountStatus';

interface Account {
  id: string;
  username: string;
}

interface PendingLink {
  state: 'pending';
  requestId: string;
  pollSecret: string;
  approveUrl: string;
  expiresAt: number;
}

interface LinkedAccount {
  state: 'linked';
  token: string;
  account: Account;
}

type PrivateLinkState = PendingLink | LinkedAccount;

export interface PublicLinkStatus {
  state: 'unlinked' | 'pending' | 'linked' | 'error';
  username?: string;
  message?: string;
}

function accountUsername(account: Account): string | undefined {
  return account.username ?? (account as Account & { email?: string }).email;
}

function openLinkDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('polytranslate-learning-account', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('link');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readPrivateState(): Promise<PrivateLinkState | null> {
  const database = await openLinkDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('link', 'readonly');
    const request = transaction.objectStore('link').get('current');
    request.onsuccess = () => resolve((request.result as PrivateLinkState | undefined) ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

async function writePrivateState(value: PrivateLinkState | null): Promise<void> {
  const database = await openLinkDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('link', 'readwrite');
    const store = transaction.objectStore('link');
    if (value) store.put(value, 'current');
    else store.delete('current');
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

async function publishStatus(status: PublicLinkStatus): Promise<PublicLinkStatus> {
  await chrome.storage.local.set({ [PUBLIC_STATUS_KEY]: status });
  return status;
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  if (!response.ok) throw new Error(response.status === 410 ? 'Yêu cầu liên kết đã hết hạn.' : `Máy chủ trả lỗi ${response.status}.`);
  return response.status === 204 ? undefined as T : await response.json() as T;
}

export async function startAccountLink(): Promise<PublicLinkStatus> {
  const current = await readPrivateState();
  if (current?.state === 'linked') {
    return getAccountLinkStatus();
  }
  let pending: PendingLink;
  if (current?.state === 'pending' && current.expiresAt * 1000 > Date.now()) {
    pending = current;
  } else {
    const started = await api<{
      request_id: string; poll_secret: string; approve_url: string; expires_at: number;
    }>('/api/link/start', { method: 'POST' });
    pending = {
      state: 'pending', requestId: started.request_id, pollSecret: started.poll_secret,
      approveUrl: started.approve_url, expiresAt: started.expires_at,
    };
    await writePrivateState(pending);
  }
  await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 0.5 });
  await chrome.tabs.create({ url: pending.approveUrl });
  return publishStatus({ state: 'pending', message: 'Đang chờ xác nhận trên web.' });
}

export async function pollAccountLink(): Promise<void> {
  const pending = await readPrivateState();
  if (pending?.state !== 'pending') {
    await chrome.alarms.clear(ALARM_NAME);
    return;
  }
  if (pending.expiresAt * 1000 <= Date.now()) {
    await writePrivateState(null);
    await chrome.alarms.clear(ALARM_NAME);
    await publishStatus({ state: 'error', message: 'Yêu cầu liên kết hết hạn. Hãy thử lại.' });
    return;
  }
  try {
    const result = await api<{
      state: 'pending' | 'linked'; token?: string; account?: Account;
    }>('/api/link/poll', {
      method: 'POST',
      body: JSON.stringify({ request_id: pending.requestId, poll_secret: pending.pollSecret }),
    });
    if (result.state === 'pending') return;
    if (!result.token || !result.account) throw new Error('Phản hồi liên kết không hợp lệ.');
    await writePrivateState({ state: 'linked', token: result.token, account: result.account });
    await chrome.alarms.clear(ALARM_NAME);
    await publishStatus({ state: 'linked', username: result.account.username });
  } catch (error) {
    if (error instanceof Error && error.message.includes('hết hạn')) {
      await writePrivateState(null);
      await chrome.alarms.clear(ALARM_NAME);
      await publishStatus({ state: 'error', message: error.message });
    }
  }
}

export async function getAccountLinkStatus(): Promise<PublicLinkStatus> {
  const current = await readPrivateState();
  if (current?.state === 'pending') {
    return publishStatus({ state: 'pending', message: 'Đang chờ xác nhận trên web.' });
  }
  if (current?.state === 'linked') {
    try {
      const account = await api<Account>('/api/extension/me', {
        headers: { Authorization: `Bearer ${current.token}` },
      });
      await writePrivateState({ ...current, account });
      return publishStatus({ state: 'linked', username: account.username });
    } catch (error) {
      if (error instanceof Error && error.message.includes('401')) {
        await writePrivateState(null);
        return publishStatus({ state: 'unlinked', message: 'Liên kết đã hết hạn hoặc bị thu hồi.' });
      }
    }
    return publishStatus({ state: 'linked', username: accountUsername(current.account) });
  }
  const stored = await chrome.storage.local.get(PUBLIC_STATUS_KEY);
  const previous = stored[PUBLIC_STATUS_KEY] as PublicLinkStatus | undefined;
  return previous?.state === 'error' ? previous : publishStatus({ state: 'unlinked' });
}

export async function unlinkAccount(): Promise<PublicLinkStatus> {
  const current = await readPrivateState();
  if (current?.state === 'linked') {
    await api<void>('/api/extension/revoke', {
      method: 'POST', headers: { Authorization: `Bearer ${current.token}` },
    });
  }
  await writePrivateState(null);
  await chrome.alarms.clear(ALARM_NAME);
  return publishStatus({ state: 'unlinked' });
}

chrome.alarms?.onAlarm?.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) void pollAccountLink();
});

chrome.runtime.onStartup?.addListener(() => {
  void readPrivateState().then((state) => {
    if (state?.state === 'pending') {
      void chrome.alarms.create(ALARM_NAME, { periodInMinutes: 0.5 });
    }
  });
});
