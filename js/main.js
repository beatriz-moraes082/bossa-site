/* ═══════════════════════════════════════════════════════════
   BOSSA — interações
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // marca que o JS está rodando: só então o CSS esconde o que será animado
  document.documentElement.classList.add('js-on');

  /* ── Palavra gigante do hero: mede e dimensiona para preencher ~96% da
     largura, independente das métricas da fonte (não clipa B/A em tela nenhuma) ── */
  // (a palavra gigante do hero agora é SVG com textLength — preenche a largura
  //  do container por construção, sem precisar de medição/JS)

  /* ── CONFIG — João, trocar aqui ─────────────────────────── */
  const WHATSAPP = {
    numero: '5582000000000',            // TODO: número real da Taipa (DDI+DDD, só dígitos)
    texto: 'Olá! Vim pelo site do Bossa e quero saber mais sobre as duas últimas casas.'
  };
  const FORM_ENDPOINT = '';            // TODO: URL do Kommo/RD/webhook. Vazio = só loga no console.

  /* ── WhatsApp ───────────────────────────────────────────── */
  const waHref = 'https://wa.me/' + WHATSAPP.numero + '?text=' + encodeURIComponent(WHATSAPP.texto);
  document.querySelectorAll('#wa-float, #wa-inline, #wa-principal').forEach(a => { a.href = waHref; });

  /* ── Menu cheio ─────────────────────────────────────────── */
  const burger = document.getElementById('burger');
  const menu = document.getElementById('menu');
  const root = document.documentElement;

  function setMenu(open) {
    root.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
  }
  burger.addEventListener('click', () => setMenu(!root.classList.contains('is-open')));
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && root.classList.contains('is-open')) setMenu(false);
  });

  /* ── Nav sólida depois do hero ──────────────────────────── */
  const nav = document.getElementById('nav');
  const hero = document.querySelector('.hero');
  const waBtn = document.getElementById('flutua');

  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      nav.classList.toggle('is-solid', !e.isIntersecting);
      waBtn.classList.toggle('on', !e.isIntersecting);
    }, { rootMargin: '-72px 0px 0px 0px' }).observe(hero);
  }

  /* ── Som do vídeo do hero ───────────────────────────────────
     Navegadores só permitem autoplay mudo; o som é ligado por um
     gesto do usuário (clique no botão). */
  const heroVid = document.getElementById('hero-video');
  const somBtn = document.getElementById('hero-som');
  if (heroVid && somBtn) {
    const syncSom = () => {
      const on = !heroVid.muted;
      somBtn.classList.toggle('is-on', on);
      somBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      somBtn.setAttribute('aria-label', on ? 'Desativar som' : 'Ativar som');
      const txt = somBtn.querySelector('.hero__som-txt');
      if (txt) txt.textContent = on ? 'Som ligado' : 'Ativar som';
    };
    somBtn.addEventListener('click', () => {
      heroVid.muted = !heroVid.muted;
      if (!heroVid.muted) heroVid.play().catch(() => {});
      syncSom();
    });
    // ao sair do hero (rolar a página), volta a mudo pra não ficar tocando narração
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        if (!e.isIntersecting && !heroVid.muted) { heroVid.muted = true; syncSom(); }
      }, { threshold: 0.35 }).observe(heroVid);
    }
    syncSom();
  }

  /* ── Reveal on scroll ───────────────────────────────────── */
  const qs = new URLSearchParams(location.search);
  // ?shift=N sobe o conteúdo N px — permite capturar o miolo da página sem rolar
  const shiftPx = +qs.get('shift') || 0;
  if (shiftPx) document.body.style.marginTop = '-' + shiftPx + 'px';

  // ?static=1 revela tudo na hora — usado só para captura/QA
  if (qs.get('static') === '1') {
    document.querySelectorAll('.rv,.strings').forEach(el => el.classList.add('on'));
    document.querySelectorAll('.maquina').forEach(el => el.classList.add('pronto'));
    document.querySelectorAll('.cp__c[data-p]').forEach(el => el.classList.add('aceso'));
    // ?flat=1 troca alturas em svh por px fixos, para capturar a página inteira de uma vez
    if (qs.get('flat') === '1') {
      const s = document.createElement('style');
      s.textContent = '.hero{min-height:900px}.casa-full{min-height:900px}.pin__media{height:900px;position:relative}' +
        '.pin__scroll{margin-top:0}.pin__step{min-height:720px}.vida__side{position:static}';
      document.head.appendChild(s);
    }
    return;
  }

  const reveals = document.querySelectorAll('.rv');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('on'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('on'));
  }

  /* ── Vídeo de fundo troca conforme a etapa do scroll fixado ── */
  const pinVids = [...document.querySelectorAll('.pin__vid')];
  const pinSteps = [...document.querySelectorAll('.pin__step')];
  if (pinVids.length > 1 && pinSteps.length) {
    // via scroll, não IntersectionObserver: a etapa "ativa" é a que cruza o meio da tela
    const mostrar = (i) => {
      let alvo = pinVids[0];
      pinVids.forEach(v => { if (+v.dataset.from <= i) alvo = v; });
      pinVids.forEach(v => v.classList.toggle('is-on', v === alvo));
    };
    let agendado = false;
    const atualizar = () => {
      agendado = false;
      const meio = window.innerHeight / 2;
      let atual = 0;
      pinSteps.forEach((s, i) => {
        const r = s.getBoundingClientRect();
        if (r.top <= meio && r.bottom > meio) atual = i;
      });
      mostrar(atual);
    };
    addEventListener('scroll', () => {
      if (!agendado) { agendado = true; requestAnimationFrame(atualizar); }
    }, { passive: true });
    atualizar();
  }

  /* ── Máquina de escrever: frases da seção 01 ────────────── */
  document.querySelectorAll('.maquina').forEach(el => {
    const texto = el.textContent.trim();
    el.textContent = '';
    const alvo = document.createTextNode('');
    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    el.append(alvo, cursor);
    let rodou = false;
    const digitar = () => {
      if (rodou) return;
      rodou = true;
      el.classList.add('digitando');
      let i = 0;
      const t = setInterval(() => {
        alvo.nodeValue = texto.slice(0, ++i);
        if (i >= texto.length) {
          clearInterval(t);
          el.classList.add('pronto');
        }
      }, 26);
    };
    const checar = () => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.7 && r.bottom > 0) {
        digitar(); removeEventListener('scroll', checar);
      }
    };
    addEventListener('scroll', checar, { passive: true });
    checar();
  });

  /* ── Decodificação: revela a frase da escassez letra a letra ── */
  document.querySelectorAll('.decode').forEach(el => {
    const alvo = el.dataset.final || el.textContent.trim();
    const pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    el.innerHTML = [...alvo].map(c =>
      `<span class="ch" data-c="${c}">${c === ' ' ? ' ' : c}</span>`).join('');
    const chars = [...el.querySelectorAll('.ch')];
    let rodou = false;
    const rodar = () => {
      if (rodou) return;
      rodou = true;
      chars.forEach((sp, i) => {
        const real = sp.dataset.c;
        if (real === ' ') return;
        sp.classList.add('embaralha');
        let n = 0;
        const t = setInterval(() => {
          sp.textContent = pool[Math.floor(Math.random() * pool.length)];
          if (++n > 3 + i * 0.7) {
            clearInterval(t);
            sp.textContent = real;
            sp.classList.remove('embaralha');
          }
        }, 28);
      });
    };
    // dispara por scroll (não por IntersectionObserver) para ser testável
    const checar = () => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.82 && r.bottom > 0) { rodar(); removeEventListener('scroll', checar); }
    };
    addEventListener('scroll', checar, { passive: true });
    checar();
  });

  /* ── Cordas: dedilha ao entrar em cena ──────────────────── */
  document.querySelectorAll('.strings').forEach(s => {
    if (!('IntersectionObserver' in window)) { s.classList.add('on'); return; }
    new IntersectionObserver(([e], obs) => {
      if (e.isIntersecting) { s.classList.add('on'); obs.disconnect(); }
    }, { threshold: 0.5 }).observe(s);
  });

  /* ── Vídeos: só tocam quando visíveis (economia de bateria) ── */
  const vids = document.querySelectorAll('video');
  if ('IntersectionObserver' in window) {
    const vio = new IntersectionObserver(entries => {
      entries.forEach(en => {
        const v = en.target;
        if (en.isIntersecting) { v.play().catch(() => {}); }
        else { v.pause(); }
      });
    }, { threshold: 0.15 });
    vids.forEach(v => vio.observe(v));
  }

  /* ── Caça-palavras: acende cultura, artesanato, pescaria e festa ── */
  const cp = document.getElementById('cp');
  if (cp) {
    const ordem = ['CULTURA', 'ARTESANATO', 'PESCARIA', 'FESTA'];
    let rodou = false;
    const acender = () => {
      if (rodou) return;
      rodou = true;
      ordem.forEach((p, i) => {
        setTimeout(() => {
          cp.querySelectorAll(`.cp__c[data-p="${p}"]`).forEach((c, j) => {
            setTimeout(() => c.classList.add('aceso'), j * 55);
          });
        }, i * 780);
      });
    };
    const checar = () => {
      const r = cp.getBoundingClientRect();
      if (r.top < innerHeight * 0.75 && r.bottom > 0) { acender(); removeEventListener('scroll', checar); }
    };
    addEventListener('scroll', checar, { passive: true });
    checar();
  }

  /* ── Formulário ─────────────────────────────────────────── */
  const form = document.getElementById('form');
  const ok = document.getElementById('form-ok');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let valid = true;

    ['nome', 'fone'].forEach(id => {
      const input = document.getElementById(id);
      const wrap = input.closest('.field');
      const bad = !input.value.trim() || (id === 'fone' && input.value.replace(/\D/g, '').length < 10);
      wrap.classList.toggle('err', bad);
      if (bad) valid = false;
    });
    if (!valid) return;

    const dados = Object.fromEntries(new FormData(form).entries());
    dados.origem = 'lp-bossa';
    dados.enviado_em = new Date().toISOString();

    if (FORM_ENDPOINT) {
      try {
        await fetch(FORM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dados)
        });
      } catch (err) {
        console.error('Falha no envio:', err);
      }
    } else {
      console.log('[Bossa] Lead capturado (sem endpoint configurado):', dados);
    }

    form.querySelectorAll('.field, .btn, .form__note').forEach(el => { el.hidden = true; });
    ok.hidden = false;
  });
})();
