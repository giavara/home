# Casa Borgo Veneto - sito stato lavori

Sito statico privato (password-protected) per condividere con famiglia/parenti il piano e l'avanzamento dei lavori della casa.

URL: https://giavara.github.io/home/
Password: vedi `.env` (default: `prisci`)

## Come aggiornare lo stato

1. Modifica [site-status.yaml](site-status.yaml) — cambia `stato` e `avanzamento` di fasi e lavorazioni, aggiorna `ultimo-aggiornamento`.
2. `npm run deploy` — builda, cifra, committa e pusha su GitHub. GitHub Pages aggiorna in 1-2 min.

## Workflow

```
site-status.yaml  ─┐
                   ├─→ build.mjs ─→ dist/index.html (in chiaro) ─→ encrypt.mjs ─→ dist/index.html (cifrato AES-256)
../lavorazioni/*.md ┘                                                                    │
../context/cronoprogramma.md ┘                                                           ▼
                                                                                  GitHub Pages
```

I file sorgente (lavorazioni e cronoprogramma) restano nel vault Obsidian e sono leggibili dal build script via path relativo.

## Struttura

```
site/
├── site-status.yaml      ← UNICA cosa da editare per aggiornamenti
├── scripts/
│   ├── build.mjs         ← genera dist/index.html
│   └── encrypt.mjs       ← cifra con staticrypt
├── src/
│   ├── template.html
│   ├── style.css
│   └── app.js
├── dist/                 ← output cifrato (committato per GH Pages)
├── .env                  ← password (NON committato)
└── package.json
```

## Setup iniziale (gia' fatto)

```bash
npm install
npm run build      # primo build per test
npm run encrypt    # cifra
```

## Comandi

| Comando | Cosa fa |
|---------|---------|
| `npm run build` | Genera `dist/index.html` in chiaro (per debug locale) |
| `npm run encrypt` | Cifra `dist/index.html` con staticrypt |
| `npm run deploy` | Build + encrypt + git push (in produzione) |

## Privacy

- staticrypt cifra `dist/index.html` con AES-256, password derivata via PBKDF2.
- Il repo GitHub e' pubblico (GH Pages gratuiti), ma il contenuto della pagina e' cifrato.
- Chi ha la password vede tutto, chi non ce l'ha vede solo il prompt.
- La password sta in `.env` (gitignored). Il file cifrato in `dist/` SI committa: e' il sito.

## Cambiare la password

1. Modifica `SITE_PASSWORD` in `.env`
2. `npm run deploy` ricifra con la nuova password.
