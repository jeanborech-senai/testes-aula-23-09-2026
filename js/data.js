/**
 * data.js — Camada de dados com Supabase
 * Substitui o arquivo js/data.js do projeto
 *
 * Configuração:
 *   SUPABASE_URL  → URL do seu projeto (sem /rest/v1)
 *   SUPABASE_ANON → chave anon public (Settings → API → anon public)
 *   SUPERVISOR_SERVICE_KEY → service_role key (usada só para gravar mensalistas)
 */

const SUPABASE_URL = 'https://ybisicqjkklxapyrevbw.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliaXNpY3Fqa2tseGFweXJldmJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MzY5NTYsImV4cCI6MjEwMTAxMjk1Nn0.d2K2XQPB3UTpQJ8qFBOwb5iqCqtqwb4RqmK8wDmBUDg';

// A service_role key para operações de supervisor (mensalistas).
// Em produção real, isso deveria ir para um backend/edge function.
// Para uso interno/corporativo sem exposição pública, é aceitável.
const SUPABASE_SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliaXNpY3Fqa2tseGFweXJldmJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQzNjk1NiwiZXhwIjoyMTAxMDEyOTU2fQ.lc8G6nHhA4mykIskPX2BpFJdNx7wOpaboKJ0stwjiTg';

const DB = (() => {

  /* ── HTTP helpers ── */
  const headers = (useService = false) => ({
    'Content-Type': 'application/json',
    'apikey': useService ? SUPABASE_SERVICE : SUPABASE_ANON,
    'Authorization': `Bearer ${useService ? SUPABASE_SERVICE : SUPABASE_ANON}`,
    'Prefer': 'return=representation',
  });

  const rest = (path) => `${SUPABASE_URL}/rest/v1/${path}`;

  async function apiFetch(path, options = {}, useService = false) {
    const res = await fetch(rest(path), {
      ...options,
      headers: { ...headers(useService), ...(options.headers || {}) },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  }

  /* ── cache simples para mensalistas (evita refetch a cada picker) ── */
  let _mensalistas = null;

  /* ════════════════════════════════════════════════════════════
     MENSALISTAS
  ════════════════════════════════════════════════════════════ */
  async function getMensalistas() {
    if (_mensalistas) return _mensalistas;
    _mensalistas = await apiFetch('mensalistas?select=*&order=nome.asc');
    return _mensalistas;
  }

  async function addMensalista(data) {
    const result = await apiFetch('mensalistas', {
      method: 'POST',
      body: JSON.stringify(data),
    }, true); // service_role
    _mensalistas = null; // invalidate cache
    return Array.isArray(result) ? result[0] : result;
  }

  async function updateMensalista(id, data) {
    await apiFetch(`mensalistas?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, true);
    _mensalistas = null;
  }

  async function deleteMensalista(id) {
    await apiFetch(`mensalistas?id=eq.${id}`, { method: 'DELETE' }, true);
    _mensalistas = null;
  }

  async function getMensalistaById(id) {
    const all = await getMensalistas();
    return all.find(m => m.id === id) || null;
  }

  /* ════════════════════════════════════════════════════════════
     MESES
  ════════════════════════════════════════════════════════════ */
  const MONTH_NAMES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                        'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  async function getMeses() {
    const rows = await apiFetch('meses?select=*&order=mes_key.asc');
    return rows;
  }

  function getMesKey(year, month) {
    return `${year}-${String(month).padStart(2,'0')}`;
  }

  function getMesLabel(year, month) {
    return `${MONTH_NAMES[month]} ${year}`;
  }

  async function addMes(year, month) {
    const mes_key = getMesKey(year, month);
    const label   = getMesLabel(year, month);
    try {
      const result = await apiFetch('meses', {
        method: 'POST',
        body: JSON.stringify({ mes_key, label }),
        headers: { 'Prefer': 'return=representation' },
      }, true);
      return Array.isArray(result) ? result[0] : result;
    } catch (e) {
      if (e.message?.includes('duplicate') || e.message?.includes('unique')) return null;
      throw e;
    }
  }

  /* ════════════════════════════════════════════════════════════
     ATIVIDADES
  ════════════════════════════════════════════════════════════ */
  async function getAtividades(mes_key) {
    return apiFetch(
      `atividades?mes_key=eq.${encodeURIComponent(mes_key)}&select=*&order=data.asc,hora_inicio.asc`
    );
  }

  async function addAtividade(mes_key, data) {
    const result = await apiFetch('atividades', {
      method: 'POST',
      body: JSON.stringify({ mes_key, ...data }),
    });
    return Array.isArray(result) ? result[0] : result;
  }

  async function updateAtividade(mes_key, id, data) {
    await apiFetch(`atividades?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async function deleteAtividade(mes_key, id) {
    await apiFetch(`atividades?id=eq.${id}`, { method: 'DELETE' });
  }

  /* ════════════════════════════════════════════════════════════
     UTILS
  ════════════════════════════════════════════════════════════ */
  function calcTotalHoras(inicio, fim) {
    if (!inicio || !fim) return '';
    const [h1, m1] = inicio.split(':').map(Number);
    const [h2, m2] = fim.split(':').map(Number);
    let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (mins < 0) mins += 24 * 60;
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  /* ════════════════════════════════════════════════════════════
     MIGRAÇÃO: importa dados do localStorage para o Supabase
     Execute uma única vez após configurar o banco.
  ════════════════════════════════════════════════════════════ */
  async function migrateFromLocalStorage() {
    const logs = [];

    try {
      // 1. Mensalistas
      const localMens = JSON.parse(localStorage.getItem('np005_mensalistas') || '[]');
      if (localMens.length) {
        for (const m of localMens) {
          const { id: _oldId, ...rest } = m; // descarta o id local (uuid do browser)
          await apiFetch('mensalistas', {
            method: 'POST',
            body: JSON.stringify(rest),
            headers: { 'Prefer': 'resolution=ignore-duplicates,return=minimal' },
          }, true);
        }
        logs.push(`✓ ${localMens.length} mensalistas migrados`);
      }

      // 2. Meses
      const localMeses = JSON.parse(localStorage.getItem('np005_meses') || '[]');
      if (localMeses.length) {
        for (const m of localMeses) {
          const { id: _oldId, ...rest } = m;
          await apiFetch('meses', {
            method: 'POST',
            body: JSON.stringify(rest),
            headers: { 'Prefer': 'resolution=ignore-duplicates,return=minimal' },
          }, true);
        }
        logs.push(`✓ ${localMeses.length} meses migrados`);
      }

      // 3. Atividades (todas as chaves de mês)
      const localAts = JSON.parse(localStorage.getItem('np005_atividades') || '{}');
      let totalAts = 0;

      // Busca mensalistas do Supabase para mapear nome → id novo
      const mens = await getMensalistas();
      const nomeToId = {};
      mens.forEach(m => { nomeToId[m.nome.toLowerCase()] = m.id; });

      for (const [mes_key, rows] of Object.entries(localAts)) {
        for (const r of rows) {
          const { id: _oldId, created_at: _ca, ...rest } = r;
          // Remapeia colaborador_id para o novo uuid do Supabase
          if (rest.colaborador) {
            rest.colaborador_id = nomeToId[rest.colaborador.toLowerCase()] || null;
          }
          await apiFetch('atividades', {
            method: 'POST',
            body: JSON.stringify(rest),
            headers: { 'Prefer': 'resolution=ignore-duplicates,return=minimal' },
          });
          totalAts++;
        }
      }
      if (totalAts > 0) logs.push(`✓ ${totalAts} atividades migradas`);

      logs.push('🎉 Migração concluída! Você pode limpar o localStorage agora.');
    } catch (e) {
      logs.push(`✗ Erro: ${e.message}`);
    }

    return logs.join('\n');
  }

  /* ── PUBLIC API ── */
  return {
    getMensalistas,
    addMensalista,
    updateMensalista,
    deleteMensalista,
    getMensalistaById,
    getMeses,
    getMesKey,
    getMesLabel,
    addMes,
    getAtividades,
    addAtividade,
    updateAtividade,
    deleteAtividade,
    calcTotalHoras,
    formatDate,
    migrateFromLocalStorage,
  };
})();