# Browser-local OCR for PDF region translation

For the first OCR Selection Mode, the extension will run OCR locally in the browser inside the PDF viewer and feed the extracted Source Text into the existing Translation Tooltip and translation providers. We choose PP-OCRv6 small as the initial OCR model tier because it balances scan-PDF accuracy with browser feasibility, while PP-OCRv6 tiny, PaddleOCR-VL, and server-side OCR are reserved for later fast-mode or document-parsing scenarios.
