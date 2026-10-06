# Reading fonts (bundled)

All fonts here are **SIL Open Font License 1.1** — free to bundle and redistribute
with the app. Files are woff2 subsets (thai + latin) fetched from Fontsource's
CDN mirror of the Google Fonts originals.

| Family             | Style / weights      | Source project                         | License |
| ------------------ | -------------------- | -------------------------------------- | ------- |
| Sarabun            | 400, 700, italic 400 | https://github.com/googlefonts/sarabun | OFL 1.1 |
| IBM Plex Sans Thai | 400, 600             | https://github.com/IBM/plex            | OFL 1.1 |
| Mitr               | 400, 600             | https://github.com/googlefonts/mitr    | OFL 1.1 |

Download pattern (re-fetch after a fresh clone if ever needed):

```
https://cdn.jsdelivr.net/fontsource/fonts/<family>@latest/<subset>-<weight>-<style>.woff2
```

The player picks between these in ตั้งค่า → การแสดงผล; `system`, `Tahoma`,
and `Angsana New` options use locally-installed Windows fonts and need no files.
