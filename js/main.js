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
    numero: '5582993128362',            // Michel Cosme — Comercial Taipa Inc
    texto: 'Olá! Vim pelo site do Bossa e quero saber mais sobre as duas últimas casas.'
  };
  // Webhook do Make que recebe o lead. Vazio = só loga no console.
  const FORM_ENDPOINT = 'https://hook.us2.make.com/tgfs70lqay7dee1pqqhtv5c4htucdm9e';
  const FORM_TIMEOUT = 12000;          // ms — evita o usuário travar em "Enviando..."

  const qs = new URLSearchParams(location.search);

  /* ── Camada de dados (GTM) ──────────────────────────────── */
  window.dataLayer = window.dataLayer || [];
  const dl = (event, dados) => window.dataLayer.push(Object.assign({ event }, dados || {}));

  /* ── Atribuição: captura UTMs/click-ids e guarda na sessão ──
     Modelo first-touch por sessão: a primeira visita que chega com
     parâmetros de campanha é a que fica gravada. Assim o lead que
     navega, sai e volta pelo orgânico ainda credita a mídia paga. */
  const ATTR_KEY = 'bossa_attr';
  const ATTR_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
                       'gclid', 'fbclid', 'ttclid', 'msclkid'];

  // Schema fixo: TODAS as chaves sempre presentes, vazias quando não houver.
  // Sem isso o payload muda de formato conforme a origem do lead, e o Make
  // (que aprende a estrutura pelo primeiro bundle) ignoraria os campos que
  // não existiam no momento em que a estrutura foi determinada.
  const molde = () => ATTR_PARAMS.reduce((o, p) => { o[p] = ''; return o; }, {});

  const atribuicao = (() => {
    const ler = () => { try { return JSON.parse(sessionStorage.getItem(ATTR_KEY)) || null; } catch (e) { return null; } };
    const gravar = o => { try { sessionStorage.setItem(ATTR_KEY, JSON.stringify(o)); } catch (e) { /* modo privado */ } };

    const contexto = {
      referrer: document.referrer || '(direct)',
      landing_page: location.pathname + location.search,
      capturado_em: new Date().toISOString()
    };

    const daUrl = {};
    ATTR_PARAMS.forEach(p => { const v = qs.get(p); if (v) daUrl[p] = v; });

    // URL traz campanha → sempre vence (clique novo em anúncio)
    if (Object.keys(daUrl).length) {
      const novo = Object.assign(molde(), daUrl, contexto);
      gravar(novo);
      return novo;
    }
    // sem campanha na URL → reaproveita o que já havia na sessão
    const salvo = ler();
    if (salvo) return Object.assign(molde(), salvo);
    // primeira visita sem campanha → registra a origem orgânica/direta
    const base = Object.assign(molde(), {
      utm_source: document.referrer ? '(referral)' : '(direct)',
      utm_medium: document.referrer ? 'referral' : '(none)'
    }, contexto);
    gravar(base);
    return base;
  })();

  // publica a atribuição no dataLayer para o GTM usar em qualquer tag
  dl('attribution_ready', { atribuicao: atribuicao });

  /* ── WhatsApp ───────────────────────────────────────────── */
  const waHref = 'https://wa.me/' + WHATSAPP.numero + '?text=' + encodeURIComponent(WHATSAPP.texto);
  document.querySelectorAll('#wa-float, #wa-inline, #wa-principal, #wa-erro').forEach(a => { a.href = waHref; });

  // rastreia o clique distinguindo qual dos CTAs converteu
  const ORIGEM_WA = { 'wa-float': 'botao_flutuante', 'wa-inline': 'secao_contato', 'wa-erro': 'falha_formulario' };
  Object.keys(ORIGEM_WA).forEach(id => {
    const a = document.getElementById(id);
    if (a) a.addEventListener('click', () => dl('whatsapp_click', { origem_cta: ORIGEM_WA[id] }));
  });

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
    // os vídeos são preguiçosos (data-src): na captura, carrega todos de uma vez
    document.querySelectorAll('video[data-src]').forEach(v => {
      if (v.dataset.poster) v.poster = v.dataset.poster;
      v.src = v.dataset.src;
      v.preload = 'auto';
      v.load();
      if (!v.controls) v.play().catch(() => {});
    });
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
    // mapa vertical (mobile): quase do tamanho do viewport → threshold nunca cruza 12%.
    // Aplica .on quando qualquer parte encosta no viewport (threshold 0.01).
    const ioBig = new IntersectionObserver((entries, obs) => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('on'); obs.unobserve(en.target); }
      });
    }, { threshold: 0.01, rootMargin: '600px 0px' });
    document.querySelectorAll('.costa__map-v').forEach(el => ioBig.observe(el));
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
    // suporta quebra de linha via | no data-final (ex.: "Últimas unidades|disponíveis")
    el.innerHTML = [...alvo].map(c =>
      c === '|' ? '<br>' :
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

  /* ── Vídeos: carregam sob demanda, tocam só quando visíveis ──────
     Nenhum vídeo é baixado no load da página. Cada <video> guarda o
     caminho em data-src e só recebe o src quando chega perto da tela.
     Telas pequenas recebem a variante "-m" (720px), bem mais leve. */
  const vids = document.querySelectorAll('video[data-src]');
  const heroVideo = document.getElementById('hero-video');

  const largura = window.innerWidth || document.documentElement.clientWidth ||
                  (window.screen && screen.width) || 1280;
  const leve = largura <= 900 ||
               (navigator.connection && navigator.connection.saveData);

  const tocar = v => { if (!v.controls && v.src) v.play().catch(() => {}); };

  const carregar = v => {
    if (v.dataset.carregado) return;
    v.dataset.carregado = '1';
    if (v.dataset.poster) v.poster = v.dataset.poster;
    v.src = leve ? v.dataset.src.replace(/\.mp4$/, '-m.mp4') : v.dataset.src;
    // filme com player próprio: define o src mas não baixa nada até o lead dar play
    if (v.controls) return;
    v.preload = 'auto';
    try { v.load(); } catch (e) { /* noop */ }
    if (v.dataset.visivel) tocar(v);
  };

  if ('IntersectionObserver' in window) {
    /* baixa ~600px antes de entrar na tela, para já ter buffer no play */
    const pre = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        carregar(en.target);
        pre.unobserve(en.target);
      });
    }, { rootMargin: '600px 0px' });

    const vio = new IntersectionObserver(entries => {
      entries.forEach(en => {
        const v = en.target;
        v.dataset.visivel = en.isIntersecting ? '1' : '';
        if (en.isIntersecting) { carregar(v); tocar(v); }
        else if (!v.controls) v.pause();
      });
    }, { threshold: 0.15 });

    vids.forEach(v => { pre.observe(v); vio.observe(v); });
  } else {
    vids.forEach(carregar);
  }

  /* O hero é o único que não espera scroll — mas espera o primeiro paint,
     para não disputar banda com o CSS, as fontes e o poster. */
  if (heroVideo) {
    const iniciaHero = () => { carregar(heroVideo); tocar(heroVideo); };
    if (document.readyState === 'complete') iniciaHero();
    else window.addEventListener('load', iniciaHero, { once: true });
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
  const erro = document.getElementById('form-erro');
  if (!form) return;

  const botao = form.querySelector('.btn');
  const rotuloBotao = botao ? botao.textContent : '';

  // form_start: primeira interação real com o formulário (dispara uma vez só)
  let comecou = false;
  form.addEventListener('input', () => {
    if (comecou) return;
    comecou = true;
    dl('form_start', { form_id: 'agendar_visita' });
  }, { once: false });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    /* validação */
    const invalidos = [];
    ['nome', 'fone'].forEach(id => {
      const input = document.getElementById(id);
      const wrap = input.closest('.field');
      const bad = !input.value.trim() || (id === 'fone' && input.value.replace(/\D/g, '').length < 10);
      wrap.classList.toggle('err', bad);
      if (bad) invalidos.push(id);
    });
    if (invalidos.length) {
      dl('form_error', { form_id: 'agendar_visita', motivo: 'validacao', campos: invalidos.join(',') });
      return;
    }

    /* payload: campos do form + atribuição achatada no nível raiz,
       para o webhook mapear direto nos campos do CRM */
    const campos = Object.fromEntries(new FormData(form).entries());
    const rotulos = { ambas: 'Ambas as tipologias', brisa: 'Casa Brisa 294,85 m²', lagob: 'Casa Lago B 322 m²' };
    const dados = Object.assign({}, campos, atribuicao, {
      interesse_label: rotulos[campos.interesse] || campos.interesse,
      origem: 'lp-bossa',
      enviado_em: new Date().toISOString(),
      pagina: location.href,
      user_agent: navigator.userAgent
    });

    if (!FORM_ENDPOINT) {
      console.log('[Bossa] Lead capturado (sem endpoint configurado):', dados);
      concluir(true, dados, 'sem_endpoint');
      return;
    }

    /* envio */
    if (botao) { botao.disabled = true; botao.textContent = 'Enviando...'; }
    erro.hidden = true;

    const ctrl = new AbortController();
    const relogio = setTimeout(() => ctrl.abort(), FORM_TIMEOUT);
    try {
      const r = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
        signal: ctrl.signal,
        keepalive: true
      });
      clearTimeout(relogio);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      concluir(true, dados);
    } catch (err) {
      clearTimeout(relogio);
      console.error('[Bossa] Falha no envio do lead:', err);
      if (botao) { botao.disabled = false; botao.textContent = rotuloBotao; }
      erro.hidden = false;
      dl('form_error', { form_id: 'agendar_visita', motivo: 'envio', detalhe: String(err && err.message || err) });
    }
  });

  /* sucesso: só chega aqui quando o webhook confirmou o recebimento.
     É este ponto — e só ele — que marca a conversão no GTM. */
  function concluir(sucesso, dados, nota) {
    form.querySelectorAll('.field, .btn, .form__note').forEach(el => { el.hidden = true; });
    erro.hidden = true;
    ok.hidden = false;
    dl('generate_lead', {
      form_id: 'agendar_visita',
      interesse: dados.interesse,
      interesse_label: dados.interesse_label,
      utm_source: dados.utm_source,
      utm_medium: dados.utm_medium,
      utm_campaign: dados.utm_campaign,
      entrega: nota || 'webhook_ok'
    });
  }
})();
