(() => {
  const CATEGORIAS = ['Moradia','Energia','Água','Internet','Alimentação','Transporte','Saúde','Educação','Lazer','Cartão','Outros'];
  const CHAVE = 'controle-financeiro:contas';
  const $ = id => document.getElementById(id);
  const brl = v => v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  const hoje = () => new Date().toISOString().slice(0,10);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  let contas = [];
  try { contas = JSON.parse(localStorage.getItem(CHAVE)) || []; } catch { contas = []; }
  const salvar = () => localStorage.setItem(CHAVE, JSON.stringify(contas));

  /* ---------- Tema ---------- */
  function aplicarTema(t) {
    document.documentElement.dataset.tema = t;
    $('btnTema').textContent = t === 'escuro' ? '☀' : '☾';
    $('btnTema').title = t === 'escuro' ? 'Mudar para tema claro' : 'Mudar para tema escuro';
    document.querySelector('meta[name=theme-color]').content = t === 'escuro' ? '#09090b' : '#f6f7fb';
    localStorage.setItem('controle-financeiro:tema', t);
  }
  aplicarTema(localStorage.getItem('controle-financeiro:tema') ||
    (matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'escuro'));
  $('btnTema').onclick = () => aplicarTema(document.documentElement.dataset.tema === 'escuro' ? 'claro' : 'escuro');

  /* ---------- Selects ---------- */
  CATEGORIAS.forEach(c => {
    $('fCategoria').add(new Option(c, c));
    $('fCat').add(new Option(c, c));
  });
  $('fCategoria').value = 'Outros';

  /* ---------- Regras ---------- */
  const situacao = c => c.status === 'paga' ? 'paga' : (c.venc < hoje() ? 'vencida' : 'pendente');
  const mesAtual = () => hoje().slice(0,7);

  // Gera as contas recorrentes do mês atual, se ainda não existirem
  function gerarRecorrentes() {
    const mes = mesAtual();
    const base = {};
    contas.filter(c => c.rec && c.venc.slice(0,7) < mes).forEach(c => {
      if (!base[c.nome] || c.venc > base[c.nome].venc) base[c.nome] = c;
    });
    Object.values(base).forEach(c => {
      if (contas.some(x => x.nome === c.nome && x.venc.slice(0,7) === mes)) return;
      const dia = c.venc.slice(8);
      const ultimo = new Date(+mes.slice(0,4), +mes.slice(5), 0).getDate();
      contas.push({ ...c, id: crypto.randomUUID(), status:'pendente', venc: `${mes}-${String(Math.min(+dia, ultimo)).padStart(2,'0')}` });
    });
    salvar();
  }

  /* ---------- Render ---------- */
  function render() {
    const mes = mesAtual();
    const doMes = contas.filter(c => c.venc.slice(0,7) === mes);
    const soma = a => a.reduce((t,c) => t + c.valor, 0);
    const pagas = doMes.filter(c => situacao(c) === 'paga');
    const pend = doMes.filter(c => situacao(c) === 'pendente');
    const venc = contas.filter(c => situacao(c) === 'vencida');

    $('vTotal').textContent = brl(soma(doMes)); $('cTotal').textContent = `${doMes.length} conta(s)`;
    $('vPagas').textContent = brl(soma(pagas)); $('cPagas').textContent = `${pagas.length} conta(s)`;
    $('vPend').textContent = brl(soma(pend)); $('cPend').textContent = `${pend.length} conta(s)`;
    $('vVenc').textContent = brl(soma(venc)); $('cVenc').textContent = `${venc.length} conta(s)`;
    const pct = doMes.length ? Math.round(pagas.length / doMes.length * 100) : 0;
    $('pPct').textContent = pct + '%'; $('pBarra').style.width = pct + '%';

    const q = $('busca').value.trim().toLowerCase(), fs = $('fStatus').value, fc = $('fCat').value;
    const vis = contas.filter(c => (!q || c.nome.toLowerCase().includes(q)) && (!fs || situacao(c) === fs) && (!fc || c.categoria === fc))
      .sort((a,b) => a.venc.localeCompare(b.venc));

    $('lista').innerHTML = vis.length ? vis.map(c => {
      const s = situacao(c), [y,m,d] = c.venc.split('-');
      return `<div class="item" data-id="${c.id}">
        <div class="info"><h3>${esc(c.nome)}<span class="tag ${s}">${s[0].toUpperCase() + s.slice(1)}</span></h3>
        <p>${esc(c.categoria)} • vence ${d}/${m}/${y}${c.rec ? ' • mensal' : ''}${c.obs ? ' • ' + esc(c.obs) : ''}</p></div>
        <span class="valor">${brl(c.valor)}</span>
        <div class="acoes">
          <button data-a="pagar" title="${c.status === 'paga' ? 'Marcar como pendente' : 'Marcar como paga'}" aria-label="Alternar pagamento">${c.status === 'paga' ? '↺' : '✓'}</button>
          <button data-a="editar" title="Editar" aria-label="Editar">✎</button>
          <button data-a="excluir" title="Excluir" aria-label="Excluir">🗑</button>
        </div></div>`;
    }).join('') : '<p class="vazio">Nenhuma conta encontrada. Toque em “Nova” para adicionar.</p>';
  }

  /* ---------- Modal ---------- */
  function abrir(c) {
    $('form').reset();
    $('fId').value = c ? c.id : '';
    $('mTitulo').textContent = c ? 'Editar Conta' : 'Nova Conta';
    $('btnSalvar').textContent = c ? 'Salvar' : 'Adicionar';
    if (c) {
      $('fNome').value = c.nome; $('fCategoria').value = c.categoria; $('fValor').value = c.valor;
      $('fVenc').value = c.venc; $('fSt').value = c.status; $('fRec').checked = c.rec; $('fObs').value = c.obs || '';
    } else { $('fCategoria').value = 'Outros'; }
    $('modal').hidden = false;
    $('fNome').focus();
  }
  const fechar = () => { $('modal').hidden = true; };
  $('btnNova').onclick = () => abrir();
  $('btnFechar').onclick = $('btnCancelar').onclick = fechar;
  $('modal').onclick = e => { if (e.target === $('modal')) fechar(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fechar(); });

  $('form').onsubmit = e => {
    e.preventDefault();
    const dados = {
      nome: $('fNome').value.trim(), categoria: $('fCategoria').value, valor: parseFloat($('fValor').value) || 0,
      venc: $('fVenc').value, status: $('fSt').value, rec: $('fRec').checked, obs: $('fObs').value.trim()
    };
    const id = $('fId').value;
    if (id) Object.assign(contas.find(c => c.id === id), dados);
    else contas.push({ id: crypto.randomUUID(), ...dados });
    salvar(); fechar(); render();
  };

  /* ---------- Ações da lista ---------- */
  $('lista').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const id = b.closest('.item').dataset.id, c = contas.find(x => x.id === id);
    if (b.dataset.a === 'pagar') c.status = c.status === 'paga' ? 'pendente' : 'paga';
    else if (b.dataset.a === 'editar') return abrir(c);
    else if (b.dataset.a === 'excluir') { if (!confirm(`Excluir "${c.nome}"?`)) return; contas = contas.filter(x => x.id !== id); }
    salvar(); render();
  };

  ['busca','fStatus','fCat'].forEach(id => $(id).addEventListener('input', render));

  gerarRecorrentes();
  render();

})();
