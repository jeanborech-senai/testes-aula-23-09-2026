/**
 * app.js — Lógica principal (versão Supabase / async)
 * Substitui o arquivo js/app.js do projeto
 */

const App = (() => {

  /* ===== STATE ===== */
  let currentMesKey = null;
  let supervisorUnlocked = false;
  const SUPERVISOR_PASS = 'supervisor123'; // altere conforme necessário
  let editingActivityId = null;
  let editingMensalistaId = null;
  let selectedColaborador = null;

  const $ = (id) => document.getElementById(id);

  /* ── loading overlay ── */
  function setLoading(on) {
    let el = document.getElementById('global-loading');
    if (!el) {
      el = document.createElement('div');
      el.id = 'global-loading';
      el.style.cssText = `
        position:fixed;inset:0;background:rgba(15,20,30,.45);z-index:9999;
        display:flex;align-items:center;justify-content:center;
        font-family:var(--font-body);color:#fff;font-size:.9rem;gap:10px;
        backdrop-filter:blur(2px);transition:opacity .15s;
      `;
      el.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          style="animation:spin .8s linear infinite">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg> Carregando…
        <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
      document.body.appendChild(el);
    }
    el.style.display = on ? 'flex' : 'none';
  }

  /* ===== MONTH TABS ===== */
  async function renderMonthTabs() {
    const container = $('tab-months');
    const meses = await DB.getMeses();
    container.innerHTML = '';

    meses.forEach(m => {
      const btn = document.createElement('button');
      btn.className = 'tab-item' + (m.mes_key === currentMesKey ? ' active' : '');
      btn.dataset.tab = m.mes_key;
      btn.textContent = m.label;
      btn.addEventListener('click', () => switchMonth(m.mes_key));
      container.appendChild(btn);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'tab-add-month';
    addBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    addBtn.title = 'Adicionar mês';
    addBtn.addEventListener('click', () => UI.openModal('modal-month'));
    container.appendChild(addBtn);
  }

  async function switchMonth(mes_key) {
    currentMesKey = mes_key;
    setLoading(true);
    try {
      const meses = await DB.getMeses();
      const mes = meses.find(m => m.mes_key === mes_key);
      $('view-month-title').textContent = mes ? mes.label : '';
      const [y, mo] = mes_key.split('-');
      $('view-period-label').textContent = `01/${mo}/${y} a ${lastDay(+y, +mo)}/${mo}/${y}`;
      await renderMonthTabs();
      await renderActivities();
      UI.setActiveTab('activities');
    } finally {
      setLoading(false);
    }
  }

  function lastDay(y, m) { return new Date(y, m, 0).getDate(); }

  /* ===== ACTIVITIES TABLE ===== */
  async function renderActivities() {
    const body = $('activities-body');
    const foot = $('activities-foot');
    const rows = await DB.getAtividades(currentMesKey);

    if (!rows.length) {
      body.innerHTML = `
        <tr class="empty-row"><td colspan="9">
          <div class="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <p>Nenhuma atividade registrada neste mês.</p>
            <button class="btn btn-primary btn-sm" onclick="App.openAddActivity()">Adicionar primeira atividade</button>
          </div>
        </td></tr>`;
      foot.innerHTML = '';
      return;
    }

    body.innerHTML = rows.map((r, i) => `
      <tr>
        <td class="row-num">${i + 1}</td>
        <td>${escHtml(r.tipo || '')}</td>
        <td class="cell-mono">${escHtml(r.matricula || '')}</td>
        <td>${escHtml(r.colaborador || '')}</td>
        <td class="cell-mono">${DB.formatDate(r.data)}</td>
        <td class="cell-mono">${escHtml(r.hora_inicio || '')}</td>
        <td class="cell-mono">${escHtml(r.hora_fim || '')}</td>
        <td class="total-hours-cell">${escHtml(r.total_horas || '')}</td>
        <td class="col-actions">
          <button class="btn-icon" title="Editar" onclick="App.editActivity('${r.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon danger" title="Excluir" onclick="App.deleteActivity('${r.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </td>
      </tr>`).join('');

    // Total de horas do mês
    const totalMinutes = rows.reduce((acc, r) => {
      if (r.total_horas) {
        const [h, m] = r.total_horas.split(':').map(Number);
        return acc + h * 60 + m;
      }
      return acc;
    }, 0);
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const mm = String(totalMinutes % 60).padStart(2, '0');
    foot.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:right;color:var(--clr-text-3);font-size:.75rem;font-weight:400;">TOTAL GERAL DO MÊS</td>
        <td class="total-hours-cell">${hh}:${mm}</td>
        <td></td>
      </tr>`;
  }

  /* ===== ACTIVITY FORM ===== */
  function openAddActivity() {
    editingActivityId = null;
    selectedColaborador = null;
    $('modal-activity-title').textContent = 'Nova Atividade';
    $('form-activity').reset();
    $('act-id').value = '';
    $('act-matricula-display').value = '';
    $('collab-display-text').textContent = 'Selecionar colaborador…';
    $('collab-display-text').classList.remove('selected');
    $('act-colaborador-id').value = '';
    $('act-matricula').value = '';
    $('total-hours-display').textContent = '—';
    $('act-data').value = new Date().toISOString().slice(0, 10);
    UI.openModal('modal-activity');
  }

  async function editActivity(id) {
    setLoading(true);
    try {
      const rows = await DB.getAtividades(currentMesKey);
      const r = rows.find(x => x.id === id);
      if (!r) return;
      editingActivityId = id;
      $('modal-activity-title').textContent = 'Editar Atividade';
      $('act-id').value = r.id;
      $('act-tipo').value = r.tipo || '';
      $('act-data').value = r.data || '';
      $('act-inicio').value = r.hora_inicio || '';
      $('act-fim').value = r.hora_fim || '';
      $('total-hours-display').textContent = r.total_horas || '—';
      selectedColaborador = { id: r.colaborador_id, nome: r.colaborador, matricula: r.matricula };
      $('act-colaborador-id').value = r.colaborador_id || '';
      $('act-matricula').value = r.matricula || '';
      $('act-matricula-display').value = r.matricula || '';
      const dt = $('collab-display-text');
      dt.textContent = r.colaborador || 'Selecionar colaborador…';
      dt.classList.toggle('selected', !!r.colaborador);
      UI.openModal('modal-activity');
    } finally {
      setLoading(false);
    }
  }

  async function deleteActivity(id) {
    if (!UI.confirm('Excluir esta atividade?')) return;
    setLoading(true);
    try {
      await DB.deleteAtividade(currentMesKey, id);
      await renderActivities();
      UI.toast('Atividade excluída.');
    } catch (e) {
      UI.toast('Erro ao excluir: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  $('form-activity').addEventListener('submit', async e => {
    e.preventDefault();
    const tipo   = $('act-tipo');
    const data   = $('act-data');
    const inicio = $('act-inicio');
    const fim    = $('act-fim');
    const valid  = UI.validateRequired(tipo, data, inicio, fim);
    if (!selectedColaborador) {
      UI.toast('Selecione um colaborador', 'error');
      return;
    }
    if (!valid) { UI.toast('Preencha os campos obrigatórios', 'error'); return; }

    const total = DB.calcTotalHoras(inicio.value, fim.value);
    const payload = {
      tipo: tipo.value.trim(),
      colaborador_id: selectedColaborador.id,
      colaborador: selectedColaborador.nome,
      matricula: selectedColaborador.matricula,
      data: data.value,
      hora_inicio: inicio.value,
      hora_fim: fim.value,
      total_horas: total,
    };

    setLoading(true);
    try {
      if (editingActivityId) {
        await DB.updateAtividade(currentMesKey, editingActivityId, payload);
        UI.toast('Atividade atualizada!');
      } else {
        await DB.addAtividade(currentMesKey, payload);
        UI.toast('Atividade adicionada!');
      }
      UI.closeModal('modal-activity');
      await renderActivities();
    } catch (e) {
      UI.toast('Erro: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  });

  ['act-inicio', 'act-fim'].forEach(id => {
    $(id).addEventListener('change', () => {
      const total = DB.calcTotalHoras($('act-inicio').value, $('act-fim').value);
      $('total-hours-display').textContent = total || '—';
    });
  });

  /* ===== COLLAB PICKER ===== */
  $('collab-display').addEventListener('click', openCollabPicker);
  $('collab-display').setAttribute('tabindex', '0');
  $('collab-display').addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') openCollabPicker();
  });

  async function openCollabPicker() {
    $('collab-search').value = '';
    $('collab-list').innerHTML = '<li class="collab-empty">Carregando…</li>';
    UI.openModal('modal-collab');
    setTimeout(() => $('collab-search').focus(), 100);
    await renderCollabList('');
  }

  async function renderCollabList(query) {
    const list = $('collab-list');
    const all = await DB.getMensalistas();
    const active = all.filter(m => m.status === 'ativo');
    const q = query.toLowerCase();
    const filtered = q
      ? active.filter(m => m.nome.toLowerCase().includes(q) || m.matricula.includes(q))
      : active;

    if (!filtered.length) {
      list.innerHTML = `<li class="collab-empty">Nenhum colaborador encontrado.</li>`;
      return;
    }
    list.innerHTML = filtered.map(m => `
      <li data-id="${m.id}" data-nome="${escAttr(m.nome)}" data-mat="${escAttr(m.matricula)}">
        <span class="collab-name">${escHtml(m.nome)}</span>
        <span class="collab-mat">${escHtml(m.matricula)}</span>
      </li>`).join('');

    list.querySelectorAll('li[data-id]').forEach(li => {
      li.addEventListener('click', () => selectColaborador(li.dataset.id, li.dataset.nome, li.dataset.mat));
    });
  }

  $('collab-search').addEventListener('input', e => renderCollabList(e.target.value));

  function selectColaborador(id, nome, matricula) {
    selectedColaborador = { id, nome, matricula };
    $('act-colaborador-id').value = id;
    $('act-matricula').value = matricula;
    $('act-matricula-display').value = matricula;
    const dt = $('collab-display-text');
    dt.textContent = nome;
    dt.classList.add('selected');
    UI.closeModal('modal-collab');
  }

  /* ===== MENSALISTAS TABLE ===== */
  async function renderMensalistas() {
    const body = $('mensalistas-body');
    body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--clr-text-3)">Carregando…</td></tr>`;
    const all = await DB.getMensalistas();

    if (!all.length) {
      body.innerHTML = `<tr class="empty-row"><td colspan="5"><div class="empty-state"><p>Nenhum colaborador cadastrado.</p></div></td></tr>`;
      return;
    }

    body.innerHTML = all.map(m => `
      <tr>
        <td class="cell-mono">${escHtml(m.matricula)}</td>
        <td>${escHtml(m.nome)}</td>
        <td>${escHtml(m.cargo || '—')}</td>
        <td>
          <span class="badge-status ${m.status === 'ativo' ? 'badge-ativo' : 'badge-inativo'}">
            ${m.status === 'ativo' ? '● Ativo' : '○ Inativo'}
          </span>
        </td>
        <td class="col-actions">
          <button class="btn-icon" title="Editar" onclick="App.editMensalista('${m.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon danger" title="Excluir" onclick="App.deleteMensalista('${m.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </td>
      </tr>`).join('');
  }

  function openAddMensalista() {
    editingMensalistaId = null;
    $('modal-mensalista-title').textContent = 'Novo Colaborador';
    $('form-mensalista').reset();
    $('mens-id').value = '';
    UI.openModal('modal-mensalista');
  }

  async function editMensalista(id) {
    const m = await DB.getMensalistaById(id);
    if (!m) return;
    editingMensalistaId = id;
    $('modal-mensalista-title').textContent = 'Editar Colaborador';
    $('mens-id').value = m.id;
    $('mens-matricula').value = m.matricula;
    $('mens-nome').value = m.nome;
    $('mens-cargo').value = m.cargo || '';
    $('mens-status').value = m.status;
    UI.openModal('modal-mensalista');
  }

  async function deleteMensalista(id) {
    if (!UI.confirm('Excluir este colaborador?')) return;
    setLoading(true);
    try {
      await DB.deleteMensalista(id);
      await renderMensalistas();
      UI.toast('Colaborador removido.');
    } catch (e) {
      UI.toast('Erro: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  $('form-mensalista').addEventListener('submit', async e => {
    e.preventDefault();
    const mat  = $('mens-matricula');
    const nome = $('mens-nome');
    if (!UI.validateRequired(mat, nome)) { UI.toast('Preencha os campos obrigatórios', 'error'); return; }

    const payload = {
      matricula: mat.value.trim(),
      nome: nome.value.trim(),
      cargo: $('mens-cargo').value.trim(),
      status: $('mens-status').value,
    };

    setLoading(true);
    try {
      if (editingMensalistaId) {
        await DB.updateMensalista(editingMensalistaId, payload);
        UI.toast('Colaborador atualizado!');
      } else {
        await DB.addMensalista(payload);
        UI.toast('Colaborador adicionado!');
      }
      UI.closeModal('modal-mensalista');
      await renderMensalistas();
    } catch (e) {
      UI.toast('Erro: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  });

  /* ===== SUPERVISOR LOGIN ===== */
  $('tab-mensalistas-btn').addEventListener('click', () => {
    if (supervisorUnlocked) {
      showMensalistasView();
    } else {
      $('login-senha').value = '';
      $('login-error').classList.add('hidden');
      UI.openModal('modal-login');
    }
  });

  $('form-login').addEventListener('submit', e => {
    e.preventDefault();
    if ($('login-senha').value === SUPERVISOR_PASS) {
      supervisorUnlocked = true;
      UI.closeModal('modal-login');
      showMensalistasView();
      UI.toast('Acesso liberado!');
    } else {
      $('login-error').classList.remove('hidden');
      $('login-senha').value = '';
      $('login-senha').focus();
    }
  });

  async function showMensalistasView() {
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    $('tab-mensalistas-btn').classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    $('view-mensalistas').classList.add('active');
    setLoading(true);
    try { await renderMensalistas(); }
    finally { setLoading(false); }
  }

  /* ===== ADD MONTH ===== */
  $('form-month').addEventListener('submit', async e => {
    e.preventDefault();
    const month  = parseInt($('month-select').value);
    const year   = parseInt($('year-select').value);
    setLoading(true);
    try {
      const result = await DB.addMes(year, month);
      if (!result) { UI.toast('Este mês já existe!', 'warning'); return; }
      UI.closeModal('modal-month');
      await switchMonth(result.mes_key);
      UI.toast(`${result.label} adicionado!`);
    } catch (e) {
      UI.toast('Erro: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  });

  /* ===== EXPORTS ===== */
  $('btn-export-pdf').addEventListener('click', async () => {
    setLoading(true);
    try {
      const rows = await DB.getAtividades(currentMesKey);
      const meses = await DB.getMeses();
      const mes = meses.find(m => m.mes_key === currentMesKey);
      const [y, mo] = currentMesKey.split('-');
      UI.exportPDF(mes?.label || '', `01/${mo}/${y} a ${lastDay(+y,+mo)}/${mo}/${y}`, rows);
    } finally { setLoading(false); }
  });

  $('btn-export-doc').addEventListener('click', async () => {
    setLoading(true);
    try {
      const rows = await DB.getAtividades(currentMesKey);
      const meses = await DB.getMeses();
      const mes = meses.find(m => m.mes_key === currentMesKey);
      const [y, mo] = currentMesKey.split('-');
      UI.exportDOC(mes?.label || '', `01/${mo}/${y} a ${lastDay(+y,+mo)}/${mo}/${y}`, rows);
      UI.toast('Arquivo DOC gerado!');
    } finally { setLoading(false); }
  });

  /* ===== QUICK-ADD ===== */
  $('btn-add-activity').addEventListener('click', openAddActivity);
  document.addEventListener('click', e => { if (e.target.id === 'btn-add-first') openAddActivity(); });
  $('btn-add-mensalista').addEventListener('click', openAddMensalista);

  /* ===== ESCAPE ===== */
  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function escAttr(str) { return escHtml(str); }

  /* ===== INIT ===== */
  async function init() {
    setLoading(true);
    try {
      const meses = await DB.getMeses();
      if (meses.length) {
        currentMesKey = meses[meses.length - 1].mes_key;
        await renderMonthTabs();
        await switchMonth(currentMesKey);
      } else {
        await renderMonthTabs();
      }
    } catch (e) {
      UI.toast('Erro ao conectar com o banco: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  init();

  return { openAddActivity, editActivity, deleteActivity, editMensalista, deleteMensalista };

})();