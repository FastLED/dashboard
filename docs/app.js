const platforms = [
  { id: 'uno', name: 'Uno AVR', color: '#71dbb5' },
  { id: 'esp32s3', name: 'ESP32-S3', color: '#7aa9ff' },
  { id: 'esp32dev', name: 'ESP32 Dev', color: '#e9aa70' },
  { id: 'teensy41', name: 'Teensy 4.1', color: '#c79af5' },
];
const versions = Array.from({ length: 7 }, (_, i) => `3.10.${i}`).concat('master');
const enabled = new Set(platforms.map(p => p.id));
const bytes = n => `${n.toLocaleString('en-US')} B`;
const localDate = timestamp => {
  const date = new Date(timestamp);
  if (!timestamp || Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};
const localTimestamp = timestamp => timestamp && !Number.isNaN(new Date(timestamp).getTime()) ? new Date(timestamp).toLocaleString(undefined, { timeZoneName: 'short' }) : 'Date unavailable';
function versionLabel(element, row) {
  element.textContent = row.version;
  if (row.version === 'master') {
    const date = document.createElement('span'); date.className = 'measurement-date'; date.textContent = localDate(row.measured_at); date.title = localTimestamp(row.measured_at); element.append(date);
  }
}
let results = [];
let chartVersions = [...versions];
const charts = {};
const modal = document.getElementById('bloat-modal');
let reportRequest = 0;
document.getElementById('close-modal').addEventListener('click', () => modal.close());
modal.addEventListener('click', event => { if (event.target === modal) modal.close(); });
async function openBloat(row) {
  if (!row?.bloat_report) return;
  const request = ++reportRequest;
  const platform = platforms.find(p => p.id === row.board);
  const title = document.getElementById('bloat-title'); title.textContent = `${platform.name} · ${row.version} · fbuild bloat`;
  if (row.version === 'master') { const date = document.createElement('span'); date.className = 'measurement-date'; date.textContent = localDate(row.measured_at); title.append(date); }
  document.getElementById('bloat-meta').textContent = `SHA ${row.sha.slice(0, 10)} · fbuild ${row.fbuild} · flash ${bytes(row.flash)} · static RAM ${bytes(row.ram)} · measured ${localTimestamp(row.measured_at)}`;
  const container = document.getElementById('bloat-report'); container.textContent = 'Loading symbol report…';
  if (!modal.open) modal.showModal();
  try {
    const response = await fetch(row.bloat_report);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const report = await response.json();
    if (request !== reportRequest) return;
    container.replaceChildren();
    const summary = document.createElement('p');
    summary.textContent = `Allocated image: ${bytes(report.image_flash)} · attributed flash: ${bytes(report.total_flash)} · attributed RAM: ${bytes(report.total_ram)}. Attributed totals may overlap and differ from board totals.`;
    container.append(summary);
    const download = document.createElement('a'); download.href = row.bloat_report; download.textContent = 'Download full fbuild bloat JSON ↗'; container.append(download);
    for (const [region, title] of [['flash', 'Flash'], ['ram', 'RAM']]) {
      const symbols = report.symbols.filter(s => s.size > 0 && s.region === region).sort((a,b) => b.size-a.size);
      const section = document.createElement('section'); section.className = 'bloat-section';
      const heading = document.createElement('h3'); heading.textContent = `${title} · ${symbols.length.toLocaleString('en-US')} symbols`; section.append(heading);
      const note = document.createElement('p'); note.className = 'note'; note.textContent = symbols.length ? 'Largest symbols first. Showing the top five.' : 'No attributed symbols in this region.'; section.append(note);
      const table = document.createElement('table'); table.id = `bloat-${region}-symbols`;
      const caption = document.createElement('caption'); caption.className = 'sr-only'; caption.textContent = `${title} symbols sorted by size`; table.append(caption);
      const head = document.createElement('thead'); const tr = document.createElement('tr');
      ['Region', 'Bytes', 'Symbol', 'Object'].forEach(text => { const th = document.createElement('th'); th.textContent = text; tr.append(th); }); head.append(tr); table.append(head);
      const body = document.createElement('tbody');
      symbols.forEach((symbol, index) => {
        const tr = document.createElement('tr');
        tr.hidden = index >= 5;
        [symbol.region, symbol.size.toLocaleString('en-US'), symbol.demangled, symbol.object || '—'].forEach(text => { const td = document.createElement('td'); td.textContent = text; tr.append(td); }); body.append(tr);
      });
      table.append(body); if (symbols.length) section.append(table);
      if (symbols.length > 5) {
        const more = document.createElement('button'); more.className = 'bloat-more'; more.textContent = `More (${(symbols.length - 5).toLocaleString('en-US')} remaining)`; more.setAttribute('aria-expanded', 'false'); more.setAttribute('aria-controls', table.id);
        more.addEventListener('click', () => {
          const expanded = more.getAttribute('aria-expanded') !== 'true';
          [...body.rows].forEach((row, index) => { row.hidden = !expanded && index >= 5; });
          more.setAttribute('aria-expanded', String(expanded)); more.textContent = expanded ? 'Show top five' : `More (${(symbols.length - 5).toLocaleString('en-US')} remaining)`;
          note.textContent = expanded ? 'Largest symbols first. Showing all symbols.' : 'Largest symbols first. Showing the top five.';
        });
        section.append(more);
      }
      container.append(section);
    }
  } catch (error) { if (request === reportRequest) container.textContent = `Report unavailable: ${error.message}`; }
}
function chart(metric) {
  charts[metric]?.destroy();
  const container = document.getElementById(metric); container.replaceChildren();
  const canvas = document.createElement('canvas'); canvas.id = `${metric}-canvas`; canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${metric === 'flash' ? 'Flash consumption' : 'RAM usage'} line chart; point reports are also available in the measurement table`); container.append(canvas);
  const log = document.getElementById('log').checked;
  const datasets = platforms.filter(p => enabled.has(p.id)).map(platform => {
    const rows = chartVersions.map(version => results.find(r => r.board === platform.id && r.version === version && r.status === 'ok'));
    return {label:platform.name, borderColor:platform.color, backgroundColor:platform.color, pointRadius:5, pointHoverRadius:8, pointHitRadius:12, borderWidth:2.5, spanGaps:false, rows, data:rows.map(row => row && Number.isFinite(row[metric]) && (!log || row[metric]>0) ? row[metric] : null)};
  });
  charts[metric] = new Chart(canvas, {
    type:'line', data:{labels:chartVersions.map(version => version === 'master' ? ['master', ...new Set(results.filter(row => row.version === 'master' && enabled.has(row.board)).map(row => localDate(row.measured_at)))] : version),datasets}, options:{
      responsive:true, maintainAspectRatio:false, animation:false,
      interaction:{mode:'nearest',intersect:true},
      onHover:(event,elements) => { canvas.style.cursor = elements.length ? 'pointer' : 'default'; },
      onClick:(event,elements,chart) => { if(elements.length) { const p=elements[0]; openBloat(chart.data.datasets[p.datasetIndex].rows[p.index]); } },
      plugins:{legend:{display:false},tooltip:{backgroundColor:'#0c111c',padding:12,callbacks:{label:context=>`${context.dataset.label}: ${bytes(context.parsed.y)}`,afterLabel:context=> { const row = context.dataset.rows[context.dataIndex]; return [`Measured ${localTimestamp(row.measured_at)}`, `SHA ${row.sha.slice(0,10)} · click for bloat`]; }}}},
      scales:{x:{grid:{display:false},ticks:{color:'#8594aa'}},y:{type:log?'logarithmic':'linear',beginAtZero:!log,grid:{color:'#263143'},ticks:{color:'#8594aa',callback:value=>Number(value).toLocaleString('en-US')}}}
    }
  });
}
function render() {
  chart('flash'); chart('ram');
  const tbody = document.querySelector('#results tbody'); tbody.replaceChildren();
  chartVersions.forEach(version => platforms.filter(p => enabled.has(p.id)).forEach(platform => {
    const row = results.find(r => r.board === platform.id && r.version === version);
    const tr = document.createElement('tr');
    [version, platform.name, row?.status === 'ok' ? bytes(row.flash) : '—', row?.status === 'ok' ? bytes(row.ram) : '—'].forEach(value => { const td = document.createElement('td'); td.textContent = value; tr.append(td); });
    if (version === 'master') versionLabel(tr.firstElementChild, row || { version });
    const source = document.createElement('td');
    if (row?.sha) { const link = document.createElement('a'); link.href = `https://github.com/FastLED/FastLED/commit/${row.sha}`; link.textContent = row.sha.slice(0, 10); source.append(link); } else source.textContent = '—';
    tr.append(source);
    const status = document.createElement('td'); status.textContent = row?.status === 'ok' ? (row.serial_symbols?.length ? 'Measured · library Serial dependency' : 'Measured') : row?.status === 'error' ? 'Build failed' : 'Pending';
    if (row?.status === 'error') { status.className = 'error'; status.title = row.error; }
    tr.append(status); const action = document.createElement('td'); if (row?.bloat_report) { const button = document.createElement('button'); button.textContent = 'View'; button.addEventListener('click', () => openBloat(row)); action.append(button); } else action.textContent = '—'; tr.append(action); tbody.append(tr);
  }));
}
platforms.forEach(platform => {
  const label = document.createElement('label');
  const input = document.createElement('input'); input.type = 'checkbox'; input.checked = true;
  input.addEventListener('change', () => { input.checked ? enabled.add(platform.id) : enabled.delete(platform.id); render(); });
  const key = document.createElement('span'); key.className = 'platform-key'; key.style.setProperty('--color', platform.color);
  label.append(input, key, document.createTextNode(platform.name)); document.getElementById('platforms').append(label);
});
document.getElementById('log').addEventListener('change', () => {
  const log = document.getElementById('log').checked;
  for (const [metric, chart] of Object.entries(charts)) {
    chart.options.animation = { duration: 650, easing: 'easeInOutCubic' };
    chart.options.scales.y.type = log ? 'logarithmic' : 'linear';
    chart.options.scales.y.beginAtZero = !log;
    for (const dataset of chart.data.datasets) {
      dataset.data = dataset.rows.map(row => row && Number.isFinite(row[metric]) && (!log || row[metric] > 0) ? row[metric] : null);
    }
    chart.update();
  }
});
try {
  const response = await fetch('data/latest.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.results)) throw new Error('Invalid benchmark data');
  results = data.results;
  if (Array.isArray(data.versions)) chartVersions = data.versions;
  const count = results.filter(r => r.status === 'ok').length;
  document.getElementById('updated').textContent = data.updated_at ? `Updated ${new Date(data.updated_at).toLocaleString()} · ${count}/32 measurements` : 'Awaiting first daily benchmark';
} catch (error) {
  document.getElementById('updated').textContent = `Results unavailable: ${error.message}`;
}
render();
