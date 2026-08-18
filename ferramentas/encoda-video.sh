#!/bin/zsh
# Gera as QUATRO variantes de um vídeo + o poster, no padrão que a LP espera.
#
#   uso:  ferramentas/encoda-video.sh <arquivo-original> <nome> [segundo-do-poster]
#   ex.:  ferramentas/encoda-video.sh ~/Downloads/casa-nova.mov casa-nova 3
#
# Sai com: assets/video/<nome>.mp4  .webm  -m.mp4  -m.webm  +  <nome>.webp
#
# POR QUE QUATRO ARQUIVOS
#   .webm  = AV1, ~40% menos bytes na mesma qualidade. Chrome, Firefox, Android.
#   .mp4   = H.264, para quem não decodifica AV1 (boa parte dos iPhones).
#   -m     = versão de 720px para celular. O JS escolhe por largura de tela.
#   Quem escolhe é o js/main.js (função `arquivo`). Subir só um .mp4 solto
#   faz o hero quebrar no Chrome, que vai pedir um .webm que não existe.
#
# POR QUE ESTES CRFs
#   Calibrados medindo VMAF contra os originais, não no olho. Nestes valores
#   o AV1 empata ou supera o H.264 anterior com cerca de metade dos bytes.
#   O teto de bitrate (-maxrate) existe porque, sem ele, cenas complexas
#   (sobrevoos 3D) ENGORDAM em vez de encolher.
set -e
[[ -n "$1" && -n "$2" ]] || { sed -n '2,8p' "$0"; exit 1; }

SRC="$1"; NOME="$2"; POSTER_SEG="${3:-1}"
RAIZ="${0:A:h}/.."
OUT="$RAIZ/assets/video"
mkdir -p "$OUT"

echo "→ $NOME  (origem: $SRC)"

# --- vídeo -------------------------------------------------------------
ffmpeg -y -v error -i "$SRC" -vf "scale='min(1280,iw)':-2:flags=lanczos" \
  -c:v libsvtav1 -crf 50 -preset 6 -g 240 -pix_fmt yuv420p -maxrate 550k -bufsize 1100k \
  -an -movflags +faststart "$OUT/$NOME.webm"

ffmpeg -y -v error -i "$SRC" -vf "scale='min(720,iw)':-2:flags=lanczos" \
  -c:v libsvtav1 -crf 52 -preset 6 -g 240 -pix_fmt yuv420p -maxrate 280k -bufsize 560k \
  -an -movflags +faststart "$OUT/$NOME-m.webm"

ffmpeg -y -v error -i "$SRC" -vf "scale='min(1280,iw)':-2:flags=lanczos" \
  -c:v libx264 -preset slow -crf 31 -maxrate 900k -bufsize 1800k \
  -g 48 -pix_fmt yuv420p -profile:v main -an -movflags +faststart "$OUT/$NOME.mp4"

ffmpeg -y -v error -i "$SRC" -vf "scale='min(720,iw)':-2:flags=lanczos" \
  -c:v libx264 -preset slow -crf 31 -maxrate 450k -bufsize 900k \
  -g 48 -pix_fmt yuv420p -profile:v main -an -movflags +faststart "$OUT/$NOME-m.mp4"

# --- poster (é o que o lead vê antes de o vídeo carregar) --------------
ffmpeg -y -v error -ss "$POSTER_SEG" -i "$SRC" -frames:v 1 \
  -vf "scale='min(1280,iw)':-2" "$OUT/$NOME-poster.png"
cwebp -quiet -q 70 -metadata none -m 6 "$OUT/$NOME-poster.png" -o "$OUT/$NOME.webp"
rm -f "$OUT/$NOME-poster.png"

echo
for f in "$OUT/$NOME".{webm,mp4} "$OUT/$NOME-m".{webm,mp4} "$OUT/$NOME.webp"; do
  [[ -f "$f" ]] && printf "   %7.0f KB  %s\n" $(( $(stat -f %z "$f") / 1024 )) "${f:t}"
done

cat <<FIM

   No HTML, referencie SEMPRE o .mp4 grande — o JS deriva o resto:
     <video preload="none" data-src="assets/video/$NOME.mp4"
            data-poster="assets/video/$NOME.webp" muted loop playsinline></video>

   (o hero é a exceção: usa poster="" em vez de data-poster, porque
    aparece na primeira tela e não pode esperar o JS)
FIM
