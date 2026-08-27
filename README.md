# Bossa Eco Luxury Villas — landing page

Site estático servido pelo **GitHub Pages** a partir da branch `main`.
Publica em <https://bossaecoluxuryvillas.com.br> (o `CNAME` na raiz aponta o domínio).
Não há build: **o que está no repositório é o que vai ao ar**, ~1 minuto após o push.

```
index.html        página inteira
css/style.css     todo o estilo
js/main.js        interações, carregamento de mídia, atribuição e formulário
assets/           vídeo, imagem e fontes
ferramentas/      scripts para gerar assets e medir performance
```

---

## Rodar local

O servidor de desenvolvimento fica **fora deste repositório**, em `../serve.py`
(multi-thread e sem cache). Alternativa sem ele:

```bash
python3 -m http.server 5599
```

Parâmetros de QA na URL:

| | |
|---|---|
| `?static=1` | revela todas as animações e carrega os 18 vídeos de uma vez — para capturas |
| `?flat=1` | troca alturas em `svh` por px fixos (use junto com `static=1`) |
| `?shift=N` | sobe o conteúdo N px, para capturar o miolo sem rolar |

---

## Convenções de asset

> Esta é a parte que ninguém adivinha lendo o código. Leia antes de trocar mídia.

### Vídeo — são QUATRO arquivos por vídeo

| arquivo | o quê | quem recebe |
|---|---|---|
| `nome.webm` | AV1, até 1280px | Chrome, Firefox, Android |
| `nome-m.webm` | AV1, até 720px | idem, em tela ≤ 900px |
| `nome.mp4` | H.264, até 1280px | quem não decodifica AV1 (boa parte dos iPhones) |
| `nome-m.mp4` | H.264, até 720px | idem, em tela ≤ 900px |
| `nome.webp` | poster | todos |

O HTML referencia **só o `.mp4` grande**. O `js/main.js` (função `arquivo`)
deriva os outros três conforme largura de tela, `saveData` e suporte a AV1:

```html
<video preload="none" data-src="assets/video/nome.mp4"
       data-poster="assets/video/nome.webp" muted loop playsinline></video>
```

**Subir um `.mp4` solto quebra o hero no Chrome**, que vai pedir um `.webm`
inexistente. Para gerar tudo de uma vez:

```bash
ferramentas/encoda-video.sh ~/Downloads/original.mov nome-do-video 3
```

Os CRFs foram calibrados medindo **VMAF contra os originais**, não no olho.
O teto de bitrate (`-maxrate`) não é enfeite: sem ele, sobrevoos 3D longos
**engordam** em vez de encolher.

### Imagem

Tudo em **WebP**, no tamanho em que é realmente exibido. O que mais economiza
não é qualidade, é dimensão — os emblemas estavam em 192px para aparecer a 30px.

```bash
ferramentas/otimiza-imagem.sh ~/Downloads/foto.jpg nome 1000 72
```

**`width` e `height` em todo `<img>` são obrigatórios.** Não são decorativos:
são o que segura o CLS em zero. Sem eles a página pula enquanto carrega.
O script imprime a tag pronta com os valores certos.

### Fontes

WOFF2 **subsetado** para latino (1,5 MB → 257 KB). Não há ida ao Google Fonts —
as fontes são auto-hospedadas. Sitka e PT Serif têm `preload` no `<head>`.

### Emblemas (`assets/img/em/`)

São **máscaras CSS** (`mask-image`), não imagens comuns: só o canal alpha conta.
Ficam em 128px porque aparecem entre 26 e 62px. Tentativa registrada: jogar a
cor fora **não** encolhe (o peso está no alpha) — 200 KB viraram 211 KB.

---

## Carregamento de mídia

Nenhum vídeo é baixado no load. Cada `<video>` guarda o caminho em `data-src`
e só recebe `src` quando chega a ~600px da tela (`IntersectionObserver`).

O **hero** é a exceção: começa assim que o poster fica pronto, não no `load`.
Usa `preload="metadata"` para transmitir conforme toca, em vez de bufferizar
os 2min10 inteiros.

O modo `?static=1` carrega todos de uma vez — se mexer no `data-src`, confira
que as capturas de QA continuam funcionando.

---

## Rastreamento — não quebre

- **GTM** (`GTM-NTT6CC6R`) inline no `<head>`, snippet padrão.
- **`dataLayer`** é criado antes de tudo. O `main.js` publica `attribution_ready`
  com UTMs, `gclid`/`fbclid` e referrer, em modelo *first-touch por sessão*
  guardado em `sessionStorage`.
- O payload do formulário usa **schema fixo**: todas as chaves sempre presentes,
  vazias quando não houver. Sem isso o Make ignora campos que não existiam no
  primeiro bundle.
- Webhook do formulário e número do WhatsApp ficam no topo do `main.js`,
  em `FORM_ENDPOINT` e `WHATSAPP`.

**Já testado: adiar o carregamento do GTM não entrega.** Veja o registro abaixo.

---

## Medir

```bash
ferramentas/mede.sh https://bossaecoluxuryvillas.com.br/ 5   # Lighthouse, mediana de 5
ferramentas/mede-inp.mjs                                     # resposta ao toque
```

**Sempre olhe a mediana de 3 a 5 rodadas.** A nota desta página oscila entre
64 e 98 sem nada mudar, porque o LCP é binário: ~2,3s ou ~7,5s, conforme os
scripts de terceiro peguem ou não a thread na hora de pintar a primeira tela.
Uma medição isolada não significa nada — nem a boa, nem a ruim.

O que decide de verdade é o campo, no Search Console em *Core Web Vitals*
(janela móvel de 28 dias, usuários reais).

---

## Registro de decisões

Coisas testadas com número na mão. **Não refaça sem ler.**

| tentativa | resultado | conclusão |
|---|---|---|
| `fetchpriority=high` + tirar `lazy` da imagem do LCP, como o Lighthouse recomenda | LCP 6673 → **8586 ms** | O conselho pressupõe LCP acima da dobra. Aquela figura começa no limite exato da tela; priorizá-la rouba banda de quem aparece antes. **Revertido.** |
| Adiar o GTM para depois do LCP | mediana 95 → **90**, cauda ruim intacta, TBT parado | Adiar meio segundo não chega perto de não carregar. Só sairia da janela segurando 8-10s, e aí perde PageView de quem não interage. **Revertido.** |
| Achatar a cor dos emblemas (são máscaras) | 200 KB → **211 KB** | O peso está no canal alpha, não na cor. Ganho tem que vir de dimensão. |
| Desligar o vídeo do hero | LCP igual (4051 ms) | O filme **não** é o gargalo do LCP. Afeta o Speed Index (2425 → 1652). |
| Bloquear terceiros e medir INP | 384 → **376 ms** | Não são eles. |
| Bloquear o vídeo e medir INP | **392 ms** | Também não. |

**Diagnóstico que sobrou, sólido:** o LCP oscila por causa do GTM e do pixel da
Meta ocupando a thread. Bloqueados, o LCP fica em 2,5–2,9s em *todas* as rodadas
e o TBT zera (66–217 ms → 0–6 ms). Nos nossos handlers o processamento dá **0 ms** —
o problema nunca foi o nosso código.

**Aberto, depende de infraestrutura:**

- **TTFB de 1,3s** (bom é até 0,8s) — é o GitHub Pages. Um CDN na frente do
  domínio corta isso e resolve junto o cache que o Pages não deixa configurar.
  Atinge LCP, FCP e INP de uma vez, sem tocar no site.
- **Tagueamento server-side** (GTM server-side + Meta CAPI) — tira o custo do
  rastreamento do navegador sem perder evento.

**Decidido pelo cliente:** o filme do hero (2min10, com narração) fica como está.

---

## Edição pelo portal da Taipa

Esta LP é administrada pelo **portal** que vive em `../portal` — fora deste
repositório, de propósito: assim nada de painel vai junto para o ar quando
o site publica.

O que este repositório precisa fornecer:

| | |
|---|---|
| `index.html` | com os atributos `data-ed` gravados. São **aditivos** — o arquivo é o original mais eles, byte a byte. Custo: **+0,70 KB depois do gzip**. |
| `ferramentas/otimiza-imagem.sh` | sem ele, o portal não deixa trocar foto |
| `ferramentas/encoda-video.sh` | sem ele, o portal não deixa trocar vídeo |

O conteúdo editável e o histórico de versões ficam em `portal/dados/bossa/`,
**não aqui**. Este repositório continua sendo só o site.

```bash
python3 portal/servidor.py     # http://127.0.0.1:5600
```

**Não remova os `data-ed` do `index.html`.** É por eles que o portal encontra
cada trecho. Se algum sumir, aquele trecho simplesmente deixa de ser editável
— sem erro, sem aviso. Detalhes em `portal/README.md`.
