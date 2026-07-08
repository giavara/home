# Casa Borgo Veneto — sito stato lavori

Sito statico privato (password-protected) per condividere con famiglia/parenti il piano lavori: card espandibili per macro-attività con task, decisioni aperte e materiale da procurare.

URL: https://giavara.github.io/home/
Password: vedi `.env` (default: `prisci`)

## Da dove vengono i dati

**I task NON si scrivono qui.** Il build legge le sezioni di `../tasks.md` (il file del vault, formato Obsidian Tasks) e le mappa sulle card:

```
../tasks.md (sezioni ## → task per card)  ─┐
                                            ├─→ build.mjs ─→ docs/index.html ─→ encrypt.mjs (AES-256)
site-data.yaml (card, roadmap, agenda)    ─┘                                        │
                                                                                    ▼
                                                                              GitHub Pages
```

In `site-data.yaml` stanno solo: metadati card (emoji, titolo, stato, sintesi in linguaggio semplice, decisioni aperte, materiali), le fasi della roadmap e gli appuntamenti.

## Come aggiornare

1. Aggiorna `../tasks.md` come sempre (spunta task, aggiungine) — è la fonte di verità
2. Se cambia altro (stato card, appuntamenti, decisioni, materiali): edita `site-data.yaml` e aggiorna `ultimo-aggiornamento`
3. `npm run deploy` — builda, cifra, committa e pusha. GitHub Pages aggiorna in 1-2 min

Il parser dei task capisce: `[ ]`/`[x]`, 📅 scadenza, ✅ data completamento, 🔺⏫🔽 priorità, prefisso `Aspetto:`/tag `#aspetto` → "in attesa". La proprietà `sezione` di ogni card in `site-data.yaml` deve matchare (substring, case-insensitive) il titolo di sezione in `tasks.md`.

## Comandi

| Comando | Cosa fa |
|---------|---------|
| `npm run build` | Genera `docs/index.html` in chiaro (per debug locale) |
| `npm run encrypt` | Cifra `docs/index.html` con staticrypt |
| `npm run deploy` | Build + encrypt + git push (produzione) |

## Struttura

```
site/
├── site-data.yaml        ← card, roadmap, agenda (gitignored: resta in locale)
├── scripts/
│   ├── build.mjs         ← parser tasks.md + generatore docs/index.html
│   └── encrypt.mjs       ← cifra con staticrypt
├── src/
│   ├── template.html
│   ├── style.css         ← stile "luxury": avorio, carbone, ottone
│   └── app.js            ← render card, filtri, apri/chiudi tutto
├── docs/                 ← output cifrato (committato: è il sito su GH Pages)
└── .env                  ← password (gitignored)
```

## Privacy

- staticrypt cifra `docs/index.html` con AES-256, password derivata via PBKDF2
- Il repo è pubblico ma il contenuto è cifrato; `site-data.yaml` e `.env` sono gitignored
- Chi ha la password vede tutto, chi non ce l'ha vede solo il prompt

## Cambiare la password

1. Modifica `SITE_PASSWORD` in `.env`
2. `npm run deploy` ricifra con la nuova password
