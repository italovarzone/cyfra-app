# Cyfra 🎸

App mobile-first (PWA instalável) para buscar e tocar cifras, usando o acervo do **CifraClub**.

Minimalista, rápido e de fácil uso.

## Funcionalidades

- 🔎 **Busca** de músicas/artistas (autocomplete do CifraClub)
- 🎼 **Cifra completa** com acordes alinhados sobre a letra
- 🎚️ **Transpor tom** (± semitons) com re-alinhamento automático dos acordes
- 🅰️ **Versão simplificada** (reduz acordes complexos à tríade básica)
- 📝 **Só letra** (oculta os acordes)
- ⤵️ **Rolagem automática** com velocidade ajustável
- 🔠 **Tamanho de fonte** ajustável (salvo no dispositivo)
- 🕘 **Recentes** (histórico local)
- 📲 **Instalável** (PWA) e com cache offline básico do app

## Como a cifra é obtida

O app não depende de WebDriver. As _API routes_ do Next.js fazem, no servidor
(sem CORS):

- **Busca:** `solr.sscdn.co/cifraclub/h/?q=...`
- **Cifra:** faz o parse do HTML de `cifraclub.com.br/{artista}/{musica}/`,
  extraindo o bloco `<pre>` (acordes em `<b>`), título, artista e tom.

Transposição e simplificação são feitas no cliente (`src/lib/chords.ts`).

## Rodar

```bash
npm install
npm run dev      # http://localhost:3000
```

Produção:

```bash
npm run build
npm start
```

> Uso educacional. O conteúdo das cifras pertence ao CifraClub e aos
> respectivos autores.
