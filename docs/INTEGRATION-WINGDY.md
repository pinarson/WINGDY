# Integration Wing Dashboard into WINGDY

Branch: integration/wing-dashboard. Parent: 20611dcedbfb97fcd7a483245f947a68e7c86f55.

Imported original application, scripts, tests, documentation, data and configuration without design changes. Preserved .gitignore and combined .gitattributes with LF for Kobo shell scripts.

Validation: JavaScript 22/22; Python 14/14; Vite production build successful. All three PNGs: 600 x 800, grayscale 8-bit, non-interlaced, CRC checked and identical decoded pixels to approved baselines. Footer occupies y=715..790, with no text overflow. Required provider attributions, status notices, rounding and CC BY 4.0 notices verified. Other graphics unchanged.

References live in test/references/kobo-lite/. Tharon is unchanged; La Baule and Suscinio use the newly approved footer position. Previous references remain byte-identical in ../wing-integration-backups-20261103-170044/wing-dashboard/output/kobo-lite/. Source project is unchanged.

Reproduce PNG checks after npm run build with: node scripts/validate-kobo-references.mjs. The validator freezes historical time from the manifest and uses local Chrome, without collecting data or publishing. Generated output and dependencies stay ignored.

No push, Pages activation, deployment or Kobo modification performed.
