export interface InputReplacementSelection {
  text: string;
  isCurrent(): boolean;
  replace(translation: string): void;
}

export interface InputTranslationStatus {
  hide(): void;
  error(message: string): void;
}

export interface InputReplacementAdapter {
  captureSelection(): InputReplacementSelection | null;
  translate(text: string): Promise<string>;
  showStatus(selection: InputReplacementSelection): InputTranslationStatus;
}

/** Coordinates an Input Replacement Translation without exposing DOM details. */
export class InputReplacementController {
  constructor(private readonly adapter: InputReplacementAdapter) {}

  /** Starts a translation synchronously and returns false when no selection exists. */
  trigger(): boolean {
    const selection = this.adapter.captureSelection();
    if (!selection) return false;
    void this.translate(selection);
    return true;
  }

  async translateSelection(): Promise<void> {
    const selection = this.adapter.captureSelection();
    if (!selection) return;

    await this.translate(selection);
  }

  private async translate(selection: InputReplacementSelection): Promise<void> {
    const status = this.adapter.showStatus(selection);
    try {
      const translation = await this.adapter.translate(selection.text);
      if (selection.isCurrent()) {
        selection.replace(translation);
      }
      status.hide();
    } catch (error) {
      if (selection.isCurrent()) {
        status.error(error instanceof Error ? error.message : 'Translation failed.');
      } else {
        status.hide();
      }
    }
  }
}
