#!/bin/zsh
# Converte uma imagem para WebP no tamanho em que ela é REALMENTE exibida.
#
#   uso:  ferramentas/otimiza-imagem.sh <original> <nome> <largura-max> [qualidade]
#   ex.:  ferramentas/otimiza-imagem.sh ~/Downloads/foto.jpg praia-nova 1000 72
#
# A regra que mais economiza aqui não é qualidade, é DIMENSÃO: os emblemas
# estavam em 192px para aparecer a 30px, e as fotos em 1920px para aparecer
# a 412px no celular. Meça no navegador antes de escolher a largura.
#
# Qualidades que funcionaram nesta LP:
#   fotos de conteúdo ......... 72
#   foto atrás de véu escuro .. 58   (ninguém percebe, economiza muito)
#   logos e emblemas com alpha  82
#
# DEPOIS DE RODAR: atualize width/height no <img>. Eles não são decorativos —
# são o que mantém o CLS em zero. Sem eles a página pula enquanto carrega.
set -e
[[ -n "$1" && -n "$2" && -n "$3" ]] || { sed -n '2,20p' "$0"; exit 1; }

SRC="$1"; NOME="$2"; LARG="$3"; Q="${4:-72}"
RAIZ="${0:A:h}/.."
OUT="$RAIZ/assets/img/$NOME.webp"

cwebp -quiet -q "$Q" -resize "$LARG" 0 -metadata none -m 6 "$SRC" -o "$OUT"

python3 - "$OUT" <<'PY'
import sys, pathlib, struct
d = pathlib.Path(sys.argv[1]).read_bytes()
if d[12:16] == b'VP8X':
    w = int.from_bytes(d[24:27],'little')+1; h = int.from_bytes(d[27:30],'little')+1
elif d[12:16] == b'VP8L':
    n = int.from_bytes(d[21:25],'little'); w = (n & 0x3FFF)+1; h = ((n>>14) & 0x3FFF)+1
else:
    w = struct.unpack('<H', d[26:28])[0] & 0x3FFF; h = struct.unpack('<H', d[28:30])[0] & 0x3FFF
kb = pathlib.Path(sys.argv[1]).stat().st_size/1024
print(f"\n   {kb:.0f} KB  {w}x{h}\n")
print(f'   <img src="assets/img/{pathlib.Path(sys.argv[1]).stem}.webp" width="{w}" height="{h}"')
print(f'        loading="lazy" decoding="async" alt="DESCREVA A IMAGEM">')
PY
