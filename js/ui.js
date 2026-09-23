/**
 * ui.js — Utilitários de interface
 */

const UI = (() => {

  /* ===== MODALS ===== */
  const openModal = (id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
  };

  const closeModal = (id) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  };

  // Close on overlay click or [data-close] buttons
  document.addEventListener('click', e => {
    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn) {
      closeModal(closeBtn.dataset.close);
      return;
    }
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('open');
    }
  });

  // ESC key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
  });

  /* ===== TOAST ===== */
  const toast = (msg, type = 'success', duration = 3000) => {
    const container = document.getElementById('toast-container');
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠'
    };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span>${icons[type] || '•'}</span> ${msg}`;
    container.appendChild(t);
    setTimeout(() => {
      t.style.animation = 'fadeOut .25s ease forwards';
      setTimeout(() => t.remove(), 300);
    }, duration);
  };

  /* ===== CONFIRM DIALOG ===== */
  const confirm = (msg) => window.confirm(msg);

  /* ===== FORM VALIDATION ===== */
  const markInvalid = (input) => input.classList.add('invalid');
  const clearInvalid = (input) => input.classList.remove('invalid');

  const validateRequired = (...inputs) => {
    let valid = true;
    inputs.forEach(inp => {
      if (!inp) return;
      if (!inp.value.trim()) {
        markInvalid(inp);
        valid = false;
      } else {
        clearInvalid(inp);
      }
    });
    return valid;
  };

  // Clear invalid on input
  document.addEventListener('input', e => {
    if (e.target.classList.contains('invalid')) clearInvalid(e.target);
  });

  /* ===== TABS ===== */
  const setActiveTab = (tabId) => {
    document.querySelectorAll('.tab-item').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabId || t.id === `tab-${tabId}-btn`);
    });
    document.querySelectorAll('.view').forEach(v => {
      v.classList.toggle('active', v.id === `view-${tabId}`);
    });
  };

  /* ===== PDF EXPORT ===== */
 const exportPDF = (title, period, rows) => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape', 'pt', 'a4');

  // Título
  doc.setFontSize(18);
  doc.text(`Atividades - ${title}`, 40, 50);
  doc.setFontSize(12);
  doc.text(`Período: ${period}`, 40, 75);

  // Dados da tabela
  const headers = ['#', 'Tipo', 'Matrícula', 'Colaborador', 'Data', 'Início', 'Fim', 'Total'];
  const data = rows.map((r, i) => [
    i + 1,
    r.tipo || '',
    r.matricula || '',
    r.colaborador || '',
    DB.formatDate(r.data) || '',
    r.hora_inicio || '',
    r.hora_fim || '',
    r.total_horas || ''
  ]);

  // Cria a tabela
  doc.autoTable({
    head: [headers],
    body: data,
    startY: 95,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [26, 32, 44], textColor: 255, fontSize: 11, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 30, halign: 'center' },
      1: { cellWidth: 70 },
      2: { cellWidth: 70 },
      3: { cellWidth: 110 },
      4: { cellWidth: 70 },
      5: { cellWidth: 50, halign: 'center' },
      6: { cellWidth: 50, halign: 'center' },
      7: { cellWidth: 55, halign: 'center' }
    }
  });

  // Total geral (opcional)
  const totalMinutes = rows.reduce((acc, r) => {
    if (r.total_horas) {
      const [h, m] = r.total_horas.split(':').map(Number);
      return acc + h * 60 + (m || 0);
    }
    return acc;
  }, 0);
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const mm = String(totalMinutes % 60).padStart(2, '0');
  const finalY = doc.lastAutoTable.finalY + 12;
  doc.setFontSize(11);
  doc.text(`Total geral do mês: ${hh}:${mm}`, 40, finalY);

  // Rodapé
  doc.setFontSize(9);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} · NP005`, 40, finalY + 20);

  // Download automático
  doc.save(`Atividades_${title.replace(/\s/g, '_')}.pdf`);
};

  /* ===== DOC EXPORT ===== */
  const exportDOC = (title, period, rows) => {
    const tableRows = rows.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.tipo || ''}</td>
        <td>${r.matricula || ''}</td>
        <td>${r.colaborador || ''}</td>
        <td>${DB.formatDate(r.data)}</td>
        <td>${r.hora_inicio || ''}</td>
        <td>${r.hora_fim || ''}</td>
        <td><b>${r.total_horas || ''}</b></td>
      </tr>
    `).join('');

    const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<title>${title}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; }
  h1 { font-size: 13pt; margin-bottom: 4pt; }
  p { font-size: 9pt; color: #555; }
  table { border-collapse: collapse; width: 100%; margin-top: 12pt; }
  th { background: #1A202C; color: white; padding: 6pt; font-size: 9pt; text-align: left; }
  td { padding: 5pt; border: 1pt solid #ccc; font-size: 10pt; }
</style>
</head>
<body>
<h1>LISTA ATIVIDADES COMPLEMENTARES NP005 — ${title}</h1>
<p>RATEIO MENSALISTAS · ${period}</p>
<table>
  <thead>
    <tr>
      <th>#</th><th>Tipo de Atividade</th><th>Matrícula</th><th>Colaborador</th>
      <th>Data</th><th>Hora Início</th><th>Hora Término</th><th>Total Horas</th>
    </tr>
  </thead>
  <tbody>${tableRows}</tbody>
</table>
</body></html>`;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atividades_${title.replace(/\s+/g,'_')}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return { openModal, closeModal, toast, confirm, validateRequired, setActiveTab, exportPDF, exportDOC };
})();
