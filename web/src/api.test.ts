import { afterEach, expect, test, vi } from 'vitest';
import { ApiError, learningApi } from './api';

afterEach(() => vi.unstubAllGlobals());

test('shows a useful message when an old server still expects email', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: false,
    status: 422,
    json: async () => ({ detail: [
      { loc: ['body', 'email'], msg: 'Field required', type: 'missing' },
      { loc: ['body', 'password'], msg: 'String too short', type: 'string_too_short' },
    ] }),
  })));
  await expect(learningApi.login('learner', 'short')).rejects.toEqual(
    new ApiError(422, 'Máy chủ đang chạy bản cũ. Hãy khởi động lại dịch vụ web.'),
  );
});

test('never renders validation issue objects as text', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: false,
    status: 422,
    json: async () => ({ detail: [
      { loc: ['body', 'username'], msg: 'Invalid', type: 'string_pattern_mismatch' },
    ] }),
  })));
  await expect(learningApi.register('bad name', 'long-password')).rejects.toMatchObject({
    status: 422,
    message: expect.not.stringContaining('[object Object]'),
  });
});
