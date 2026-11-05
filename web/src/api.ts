export interface Account {
  id: string;
  username: string;
}

export interface LearningFolder {
  id: string;
  name: string;
  parent_id: string | null;
}

export interface SavedLearningItem {
  id: string;
  folder_id: string;
  category: 'word' | 'sentence';
  text: string;
  meaning: string;
  pinyin: string;
  created_at: number;
  linked_item_ids: string[];
}

export interface TrashEntry {
  id: string;
  kind: 'item' | 'folder';
  name: string;
  category: 'word' | 'sentence' | null;
  folder_id: string | null;
}

interface ApiErrorBody {
  detail?: unknown;
}

function errorDetail(body: ApiErrorBody, status: number): string {
  if (typeof body.detail === 'string') return body.detail;
  if (Array.isArray(body.detail)) {
    const fields = new Set(body.detail.flatMap((issue: unknown) => {
      if (!issue || typeof issue !== 'object' || !('loc' in issue) || !Array.isArray(issue.loc)) return [];
      return issue.loc.filter((part: unknown): part is string => typeof part === 'string');
    }));
    if (fields.has('email') && !fields.has('username')) {
      return 'Máy chủ đang chạy bản cũ. Hãy khởi động lại dịch vụ web.';
    }
    if (fields.has('username') && fields.has('password')) {
      return 'Tên đăng nhập hoặc mật khẩu không hợp lệ. Hãy kiểm tra lại.';
    }
    if (fields.has('username')) {
      return 'Tên đăng nhập không hợp lệ. Dùng chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch nối.';
    }
    if (fields.has('password')) {
      return 'Vui lòng nhập mật khẩu.';
    }
    return 'Thông tin nhập không hợp lệ. Hãy kiểm tra lại.';
  }
  return status === 422 ? 'Thông tin nhập không hợp lệ. Hãy kiểm tra lại.' : 'Yêu cầu không thành công.';
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'Không kết nối được máy chủ. Hãy thử lại.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ApiErrorBody;
    throw new ApiError(response.status, errorDetail(body, response.status));
  }
  return response.status === 204 ? undefined as T : await response.json() as T;
}

export const learningApi = {
  me: (): Promise<Account> => api('/auth/me'),
  register: (username: string, password: string): Promise<Account> =>
    api('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) }),
  login: (username: string, password: string): Promise<Account> =>
    api('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: (): Promise<void> => api('/auth/logout', { method: 'POST' }),
  approveLink: (requestId: string): Promise<void> =>
    api(`/link/approve/${encodeURIComponent(requestId)}`, { method: 'POST' }),
  folders: (): Promise<LearningFolder[]> => api('/folders'),
  createFolder: (name: string, parentId: string | null): Promise<LearningFolder> =>
    api('/folders', { method: 'POST', body: JSON.stringify({ name, parent_id: parentId }) }),
  updateFolder: (id: string, change: { name?: string; parent_id?: string | null }): Promise<LearningFolder> =>
    api(`/folders/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(change) }),
  items: (): Promise<SavedLearningItem[]> => api('/items'),
  updateItem: (id: string, change: Pick<SavedLearningItem, 'folder_id' | 'category' | 'text' | 'meaning'>): Promise<SavedLearningItem> =>
    api(`/items/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(change) }),
  trash: (): Promise<TrashEntry[]> => api('/trash'),
  trashItem: (id: string): Promise<void> => api(`/items/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  trashFolder: (id: string): Promise<void> => api(`/folders/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  restoreItem: (id: string): Promise<SavedLearningItem> => api(`/trash/items/${encodeURIComponent(id)}/restore`, { method: 'POST' }),
  restoreFolder: (id: string): Promise<LearningFolder> => api(`/trash/folders/${encodeURIComponent(id)}/restore`, { method: 'POST' }),
  permanentlyDeleteItem: (id: string): Promise<void> => api(`/trash/items/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  permanentlyDeleteFolder: (id: string): Promise<void> => api(`/trash/folders/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  emptyTrash: (): Promise<void> => api('/trash', { method: 'DELETE' }),
};
