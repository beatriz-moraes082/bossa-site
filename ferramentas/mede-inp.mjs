/* Mede INP (resposta ao toque) emulando o celular do lead: tela pequena,
   toque, CPU 4x mais lenta e 4G. Executa interações reais e mede quanto cada
   uma leva até a próxima pintura. INP ≈ a pior interação.

     node ferramentas/mede-inp.mjs [url] [--espera=800] [--sem-terceiros] [--sem-video]

   --espera=N  quando tocar, em ms após iniciar o carregamento. É o parâmetro
               que mais importa: a página só é lenta para responder nos
               primeiros ~600-800ms (parse de HTML/CSS e primeira pintura).
               Depois disso o INP fica entre 96 e 192ms, no verde.
               Medido: 400ms->584ms | 800ms->192ms | 2500ms->96ms

   JÁ TESTADO, NÃO REFAÇA: bloquear os terceiros (384->376ms) e bloquear o
   vídeo (392ms) NÃO mudam o INP. O processamento dos nossos handlers dá 0ms
   em todas as medições — o atraso é de entrada, thread ocupada com o setup
   inicial da página. A alavanca real é o TTFB, não o código.                */
import puppeteer from 'puppeteer-core';

const URL_ALVO = process.argv[2]?.startsWith('http') ? process.argv[2]
               : 'https://bossaecoluxuryvillas.com.br/';
const SEM_TERCEIROS = process.argv.includes('--sem-terceiros');
const SEM_VIDEO     = process.argv.includes('--sem-video');
const ESPERA = +(process.argv.find(a => a.startsWith('--espera=')) || '--espera=800').split('=')[1];
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const nav = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
                                     args: ['--no-sandbox', '--disable-gpu'] });
const pag = await nav.newPage();

await pag.emulate({                                    // Moto G Power, igual ao Lighthouse
  viewport: { width: 412, height: 823, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true },
  userAgent: 'Mozilla/5.0 (Linux; Android 11; moto g power) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Mobile Safari/537.36',
});
const cdp = await pag.target().createCDPSession();
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', {
  offline: false, latency: 150, downloadThroughput: 1638400 / 8, uploadThroughput: 675000 / 8 });

if (SEM_TERCEIROS || SEM_VIDEO) {
  await pag.setRequestInterception(true);
  pag.on('request', r => {
    const u = r.url();
    const terceiro = /googletagmanager|facebook\.(net|com)|birch\.click|google-analytics/.test(u);
    const video    = /\.(webm|mp4)(\?|$)/.test(u);
    if ((SEM_TERCEIROS && terceiro) || (SEM_VIDEO && video)) r.abort(); else r.continue();
  });
}

await pag.evaluateOnNewDocument(() => {
  window.__ev = [];
  new PerformanceObserver(l => l.getEntries().forEach(e => window.__ev.push({
    nome: e.name,
    total: Math.round(e.duration),
    entrada: Math.round(e.processingStart - e.startTime),
    processamento: Math.round(e.processingEnd - e.processingStart),
    quadro: Math.round(e.startTime + e.duration - e.processingEnd),
    alvo: e.target ? (e.target.id ? '#' + e.target.id : e.target.className || e.target.tagName) : '?',
  }))).observe({ type: 'event', durationThreshold: 16, buffered: true });
});

const espera = ms => new Promise(r => setTimeout(r, ms));
pag.goto(URL_ALVO, { waitUntil: 'load', timeout: 120000 }).catch(() => {});
await espera(ESPERA);

async function tocar(sel) {
  const el = await pag.$(sel); if (!el) return;
  const c = await el.boundingBox(); if (!c) return;
  await pag.touchscreen.tap(c.x + c.width / 2, c.y + c.height / 2);
  await espera(900);
}
await tocar('#burger'); await tocar('#burger');
await tocar('#hero-som'); await tocar('#hero-som');
for (let i = 0; i < 4; i++) {
  await pag.touchscreen.tap(206, 700).catch(() => {});
  await pag.evaluate(() => scrollBy({ top: 900, behavior: 'instant' }));
  await espera(700);
}
await tocar('#burger');
await espera(1500);

const ev = await pag.evaluate(() => window.__ev);
await nav.close();

const pior = new Map();
for (const e of ev) {
  const k = e.nome + ' ' + e.alvo;
  if (!pior.has(k) || pior.get(k).total < e.total) pior.set(k, e);
}
const ord = [...pior.values()].sort((a, b) => b.total - a.total);

const ctx = [SEM_TERCEIROS && 'sem terceiros', SEM_VIDEO && 'sem vídeo'].filter(Boolean).join(' | ') || 'página completa';
console.log(`\n${URL_ALVO}\n${ctx} | toque aos ${ESPERA}ms | ${ev.length} interações\n`);
console.log('   total  entrada  process.  quadro   interação');
for (const e of ord.slice(0, 8))
  console.log(`  ${String(e.total).padStart(5)}ms ${String(e.entrada).padStart(7)}ms ${String(e.processamento).padStart(8)}ms ${String(e.quadro).padStart(6)}ms   ${e.nome} em ${e.alvo}`);
const inp = ord.length ? ord[0].total : 0;
console.log(`\n  INP: ${inp} ms  ${inp <= 200 ? '✓ bom' : inp <= 500 ? '~ precisa melhorar' : '✗ ruim'}`);
console.log('  (entrada = thread ocupada quando o toque chegou; process. = os nossos handlers)');
