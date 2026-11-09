export type FrameUiRequest =
  | { action: 'translate'; text: string }
  | { action: 'dismiss' }
  | { action: 'ocr' };

export interface FrameSource {
  frameId: number;
  documentId: string;
}

export function forwardFrameUi(request: FrameUiRequest): boolean {
  if (!window.top || window.top === window) return false;
  void chrome.runtime.sendMessage({ type: 'FRAME_UI_REQUEST', ...request }).catch(() => {
    // The tab may navigate before the background can deliver the request.
  });
  return true;
}
