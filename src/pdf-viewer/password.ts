const NEED_PASSWORD = 1;
const INCORRECT_PASSWORD = 2;

export type PasswordPrompt = (wrongPassword: boolean) => Promise<string | null>;

export interface PdfPasswordResolverOptions {
  allowPrompt?: boolean;
  maxEmptyPasswordAttempts?: number;
}

export function createPdfPasswordResolver(
  promptPassword: PasswordPrompt,
  options: PdfPasswordResolverOptions = {}
) {
  const allowPrompt = options.allowPrompt ?? false;
  const maxEmptyPasswordAttempts = options.maxEmptyPasswordAttempts ?? 3;
  let emptyPasswordAttempts = 0;

  return async function resolvePdfPassword(
    updatePassword: (password: string) => void,
    reason: number
  ): Promise<boolean> {
    if (
      (reason === NEED_PASSWORD || reason === INCORRECT_PASSWORD)
      && emptyPasswordAttempts < maxEmptyPasswordAttempts
    ) {
      emptyPasswordAttempts += 1;
      updatePassword('');
      return true;
    }

    if (!allowPrompt) return false;

    const password = await promptPassword(true);
    if (password === null) return false;

    updatePassword(password);
    return true;
  };
}
