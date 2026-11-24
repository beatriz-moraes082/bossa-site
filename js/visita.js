/* ═══════════════════════════════════════════════════════════
   BOSSA — LP de conversão (/visita)
   Atribuição, formulários (topo e fecho) e o vídeo das obras no clique.
   Segue as mesmas regras do js/main.js da LP principal: mesmo webhook,
   mesmo payload de schema fixo e o mesmo evento generate_lead, para o
   Make e o GTM tratarem os dois formulários igual.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── CONFIG ─────────────────────────────────────────────── */
  // Mesmo webhook do Make da LP principal (js/main.js, FORM_ENDPOINT).
  const FORM_ENDPOINT = 'https://hook.us2.make.com/tgfs70lqay7dee1pqqhtv5c4htucdm9e';
  const FORM_TIMEOUT = 12000;
  const FORM_ID = 'agendar_visita'; // o mesmo da LP principal: os gatilhos do GTM continuam valendo

  /* ── Camada de dados (GTM) ──────────────────────────────── */
  window.dataLayer = window.dataLayer || [];
  const dl = (event, dados) => window.dataLayer.push(Object.assign({ event }, dados || {}));

  /* ── Atribuição: first-touch por sessão, igual ao main.js ──
     Usa a mesma chave de sessionStorage: quem entra pela /visita e
     depois vai para a home (ou o contrário) mantém a mesma origem. */
  const ATTR_KEY = 'bossa_attr';
  const ATTR_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
                       'gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid', 'msclkid'];
  const molde = () => ATTR_PARAMS.reduce((o, p) => { o[p] = ''; return o; }, {});
  const qs = new URLSearchParams(location.search);

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
    if (Object.keys(daUrl).length) {
      const novo = Object.assign(molde(), daUrl, contexto);
      gravar(novo);
      return novo;
    }
    const salvo = ler();
    if (salvo) return Object.assign(molde(), salvo);
    const base = Object.assign(molde(), {
      utm_source: document.referrer ? '(referral)' : '(direct)',
      utm_medium: document.referrer ? 'referral' : '(none)'
    }, contexto);
    gravar(base);
    return base;
  })();

  dl('attribution_ready', { atribuicao: atribuicao });

  // campos ocultos de origem em todos os formulários
  document.querySelectorAll('form.form input[type=hidden]').forEach(el => {
    el.value = atribuicao[el.name] || '';
  });

  /* ── Formulários ────────────────────────────────────────── */
  const soDigitos = v => v.replace(/\D/g, '');
  const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  // máscara leve do WhatsApp: (82) 99999-9999
  function mascaraFone(input) {
    input.addEventListener('input', () => {
      let d = soDigitos(input.value);
      if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
      d = d.slice(0, 11);
      let v = d;
      if (d.length > 2) v = '(' + d.slice(0, 2) + ') ' + d.slice(2);
      if (d.length > 7) v = '(' + d.slice(0, 2) + ') ' + d.slice(2, d.length - 4) + '-' + d.slice(-4);
      input.value = v;
    });
  }

  function validar(form) {
    const regras = {
      nome: v => v.trim().length >= 2 || 'Escreva seu nome.',
      fone: v => soDigitos(v).length >= 10 || 'Informe o WhatsApp com DDD.',
      email: v => emailOk(v.trim()) || 'Informe um e-mail válido.'
    };
    const invalidos = [];
    Object.keys(regras).forEach(nome => {
      const input = form.elements[nome];
      const res = regras[nome](input.value);
      const campo = input.closest('.campo');
      const msg = campo.querySelector('.campo__msg');
      const bad = res !== true;
      campo.classList.toggle('err', bad);
      input.setAttribute('aria-invalid', String(bad));
      msg.textContent = bad ? res : '';
      if (bad) invalidos.push(nome);
    });
    if (invalidos.length) form.elements[invalidos[0]].focus();
    return invalidos;
  }

  document.querySelectorAll('form.form').forEach(form => {
    const posicao = form.dataset.posicao; // topo | fim
    const cartao = form.closest('.cartao');
    const ok = cartao.querySelector('.ok');
    const erro = form.querySelector('.form__erro');
    const botao = form.querySelector('.btn');
    const textoBotao = botao.querySelector('span') || botao;
    const rotulo = textoBotao.textContent;

    mascaraFone(form.elements.fone);

    let comecou = false;
    form.addEventListener('input', () => {
      if (comecou) return;
      comecou = true;
      dl('form_start', { form_id: FORM_ID, form_posicao: posicao, pagina_lp: 'visita' });
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const invalidos = validar(form);
      if (invalidos.length) {
        dl('form_error', { form_id: FORM_ID, form_posicao: posicao, motivo: 'validacao', campos: invalidos.join(',') });
        return;
      }

      /* Payload com as MESMAS chaves do formulário da LP principal (schema fixo):
         o Make aprendeu a estrutura pelo primeiro envio e ignoraria chaves novas.
         A diferença entre as páginas vai no campo "origem". */
      const dados = Object.assign({
        nome: form.elements.nome.value.trim(),
        fone: form.elements.fone.value.trim(),
        email: form.elements.email.value.trim(),
        interesse: '',
        interesse_label: ''
      }, atribuicao, {
        origem: 'lp-bossa-visita-' + posicao,
        enviado_em: new Date().toISOString(),
        pagina: location.href,
        user_agent: navigator.userAgent
      });

      botao.disabled = true;
      textoBotao.textContent = 'Enviando...';
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
        concluir(dados);
      } catch (err) {
        clearTimeout(relogio);
        console.error('[Bossa] Falha no envio do lead:', err);
        botao.disabled = false;
        textoBotao.textContent = rotulo;
        erro.hidden = false;
        dl('form_error', { form_id: FORM_ID, form_posicao: posicao, motivo: 'envio', detalhe: String(err && err.message || err) });
      }
    });

    /* Só chega aqui quando o webhook confirmou o recebimento.
       É este ponto, e só ele, que marca a conversão no GTM. */
    function concluir(dados) {
      form.hidden = true;
      ok.hidden = false;
      ok.classList.add('mostra');
      ok.focus({ preventScroll: true });
      dl('generate_lead', {
        form_id: FORM_ID,
        form_posicao: posicao,
        pagina_lp: 'visita',
        utm_source: dados.utm_source,
        utm_medium: dados.utm_medium,
        utm_campaign: dados.utm_campaign,
        entrega: 'webhook_ok',
        // Conversões otimizadas: o GTM faz o hash (SHA-256) antes de enviar.
        enhanced_conversion_data: {
          email: dados.email,
          phone_number: '+55' + soDigitos(dados.fone)
        }
      });
    }
  });

  document.querySelectorAll('.wa-erro').forEach(a => a.addEventListener('click', () => {
    dl('whatsapp_click', { origem_cta: 'falha_formulario', pagina_lp: 'visita' });
  }));

  /* ── Entrada dos blocos ao rolar (como o .rv da LP principal) ── */
  const reveals = document.querySelectorAll('.rv');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('on'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('on'));
  }

  /* ── Letras que se acertam no título das casas (igual à LP principal) ── */
  const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.decode').forEach(el => {
    const alvo = el.dataset.final || el.textContent.trim();
    el.setAttribute('aria-label', alvo.replace('|', ' '));
    if (reduzir) { el.innerHTML = alvo.split('|').join('<br>'); return; }
    const pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    el.innerHTML = [...alvo].map(c =>
      c === '|' ? '<br>' : `<span class="ch" aria-hidden="true" data-c="${c}">${c}</span>`).join('');
    const chars = [...el.querySelectorAll('.ch')];
    const rodar = () => chars.forEach((sp, i) => {
      const real = sp.dataset.c;
      if (real === ' ') return;
      sp.classList.add('embaralha');
      let n = 0;
      const t = setInterval(() => {
        sp.textContent = pool[Math.floor(Math.random() * pool.length)];
        if (++n > 3 + i * 0.7) { clearInterval(t); sp.textContent = real; sp.classList.remove('embaralha'); }
      }, 28);
    });
    if ('IntersectionObserver' in window) {
      const o = new IntersectionObserver(([en]) => { if (en.isIntersecting) { rodar(); o.disconnect(); } }, { threshold: 0.4 });
      o.observe(el);
    }
  });

  /* ── Vídeo das obras: só baixa no clique ────────────────── */
  const filme = document.querySelector('.filme');
  if (filme) filme.addEventListener('click', () => {
    const base = filme.dataset.video;
    const celular = matchMedia('(max-width: 900px)').matches;
    const v = document.createElement('video');
    v.controls = true;
    v.playsInline = true;
    v.preload = 'auto';
    // mesmos arquivos da LP principal: AV1 (webm) com H.264 (mp4) de reserva
    [['webm', 'video/webm; codecs="av01.0.05M.08"'], ['mp4', 'video/mp4']].forEach(([ext, tipo]) => {
      const s = document.createElement('source');
      s.src = base + (celular ? '-m.' : '.') + ext;
      s.type = tipo;
      v.appendChild(s);
    });
    filme.replaceWith(v);
    v.style.width = '100%';
    v.style.aspectRatio = '900 / 502';
    v.style.background = '#24281d';
    v.play().catch(() => {});
    dl('video_play', { video: 'obras', pagina_lp: 'visita' });
  });
})();
