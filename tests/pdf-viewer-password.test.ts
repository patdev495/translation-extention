import { describe, expect, test, vi } from 'vitest';
import { createPdfPasswordResolver } from '../src/pdf-viewer/password';

describe('PDF viewer password handling', () => {
  test('tries an empty password without showing the prompt on the first password request', async () => {
    const updatePassword = vi.fn();
    const promptPassword = vi.fn();
    const resolvePdfPassword = createPdfPasswordResolver(promptPassword);

    const resolved = await resolvePdfPassword(updatePassword, 1);

    expect(resolved).toBe(true);
    expect(updatePassword).toHaveBeenCalledWith('');
    expect(promptPassword).not.toHaveBeenCalled();
  });

  test('retries an empty password once before showing the prompt', async () => {
    const updatePassword = vi.fn();
    const promptPassword = vi.fn();
    const resolvePdfPassword = createPdfPasswordResolver(promptPassword);

    await resolvePdfPassword(updatePassword, 1);
    const resolved = await resolvePdfPassword(updatePassword, 2);

    expect(resolved).toBe(true);
    expect(updatePassword).toHaveBeenCalledTimes(2);
    expect(updatePassword).toHaveBeenLastCalledWith('');
    expect(promptPassword).not.toHaveBeenCalled();
  });

  test('does not show the prompt by default after empty password retries fail', async () => {
    const updatePassword = vi.fn();
    const promptPassword = vi.fn(async () => 'secret');
    const resolvePdfPassword = createPdfPasswordResolver(promptPassword);

    await resolvePdfPassword(updatePassword, 1);
    await resolvePdfPassword(updatePassword, 2);
    await resolvePdfPassword(updatePassword, 2);
    const resolved = await resolvePdfPassword(updatePassword, 2);

    expect(resolved).toBe(false);
    expect(promptPassword).not.toHaveBeenCalled();
  });

  test('can show the prompt after empty password retries fail when explicitly enabled', async () => {
    const updatePassword = vi.fn();
    const promptPassword = vi.fn(async () => 'secret');
    const resolvePdfPassword = createPdfPasswordResolver(promptPassword, { allowPrompt: true });

    await resolvePdfPassword(updatePassword, 1);
    await resolvePdfPassword(updatePassword, 2);
    await resolvePdfPassword(updatePassword, 2);
    const resolved = await resolvePdfPassword(updatePassword, 2);

    expect(resolved).toBe(true);
    expect(promptPassword).toHaveBeenCalledWith(true);
    expect(updatePassword).toHaveBeenCalledWith('secret');
  });
});
