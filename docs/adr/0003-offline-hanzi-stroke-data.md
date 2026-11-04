# Package Hanzi stroke data with the extension

Hanzi Stroke Order Animation must work without a network request. We package Hanzi Writer with per-character data from `hanzi-writer-data` and load only the characters selected in the Translation Tooltip, rather than relying on Hanzi Writer's default CDN. This adds about 31 MB and roughly 9,575 files to the extension package, but keeps stroke playback available offline; the Arphic Public License text and Hanzi Writer's MIT license and attribution are included in the package.
