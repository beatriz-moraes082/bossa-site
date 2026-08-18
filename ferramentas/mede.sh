#!/bin/zsh
# Roda o Lighthouse N vezes (mesma versão e preset do PageSpeed) e mostra a
# mediana, com quanto CADA métrica contribui para a nota.
#
#   uso:  ferramentas/mede.sh [url] [repeticoes]
#   ex.:  ferramentas/mede.sh https://bossaecoluxuryvillas.com.br/ 5
#
# POR QUE MEDIR VÁRIAS VEZES: a nota desta página oscila entre 64 e 98 sem
# nada mudar, porque o LCP é binário (~2,3s ou ~7,5s conforme os scripts de
# terceiro peguem ou não a thread na hora de pintar). Uma medição isolada não
# significa nada. Olhe sempre a mediana de 3 a 5.
set -e
cd "${0:A:h}"
[[ -d node_modules ]] || { echo "instalando dependências..."; npm install --silent; }

URL=${1:-https://bossaecoluxuryvillas.com.br/}
N=${2:-3}
export CHROME_PATH="${CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
TMP=$(mktemp -d)

for i in $(seq 1 $N); do
  printf "  medindo %d/%d...\r" $i $N
  npx --no-install lighthouse "$URL" --quiet --output=json \
    --output-path="$TMP/r-$i.json" --only-categories=performance \
    --chrome-flags="--headless=new --no-sandbox --disable-gpu" >/dev/null 2>&1
done
echo

python3 - "$TMP" "$N" "$URL" <<'PY'
import json, sys, statistics as st
d, n, url = sys.argv[1], int(sys.argv[2]), sys.argv[3]
M = [('FCP','first-contentful-paint'), ('SI','speed-index'),
     ('LCP','largest-contentful-paint'), ('TBT','total-blocking-time'),
     ('CLS','cumulative-layout-shift')]
runs = []
for i in range(1, n+1):
    try: runs.append(json.load(open(f'{d}/r-{i}.json')))
    except Exception: pass
if not runs: raise SystemExit("nenhuma medição válida")

print(f"\n{url}  —  {len(runs)} medições\n")
print(f"{'':7}" + ''.join(f"{k:>11}" for k,_ in M) + f"{'NOTA':>8}")
for i, r in enumerate(runs, 1):
    linha = f"run {i:<3}"
    for k, aid in M:
        v = r['audits'][aid]['numericValue']
        linha += f"{(f'{v:.2f}' if k=='CLS' else f'{v:.0f}'):>11}"
    linha += f"{r['categories']['performance']['score']*100:>8.0f}"
    print(linha)
print("-" * (7 + 11*len(M) + 8))
linha = f"{'MEDIANA':<7}"
for k, aid in M:
    vs = [r['audits'][aid]['numericValue'] for r in runs]
    linha += f"{(f'{st.median(vs):.2f}' if k=='CLS' else f'{st.median(vs):.0f}'):>11}"
linha += f"{st.median([r['categories']['performance']['score']*100 for r in runs]):>8.0f}"
print(linha)
print("\n  valores em ms, exceto CLS")
print("  pesos na nota: TBT 30% | LCP 25% | CLS 25% | FCP 10% | SI 10%")

import re
det = json.dumps(runs[0]['audits']['lcp-breakdown-insight'].get('details') or {}, ensure_ascii=False)
sel = re.search(r'"selector": "([^"]+)"', det)
if sel: print(f"\n  elemento do LCP na 1a rodada: {sel.group(1).split(' > ')[-1]}")
PY
rm -rf "$TMP"
