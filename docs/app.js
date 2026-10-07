const platforms = [
  { id: 'uno', name: 'Uno AVR', color: '#71dbb5' },
  { id: 'esp32s3', name: 'ESP32-S3', color: '#7aa9ff' },
  { id: 'esp32dev', name: 'ESP32 Dev', color: '#e9aa70' },
  { id: 'teensy41', name: 'Teensy 4.1', color: '#c79af5' },
];
const versions = Array.from({ length: 7 }, (_, i) => `3.10.${i}`).concat('master');
const enabled = new Set(platforms.map(p => p.id));
const bytes = n => `${n.toLocaleString('en-US')} B`;
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
  document.getElementById('bloat-title').textContent = `${platform.name} · ${row.version} · fbuild bloat`;
  document.getElementById('bloat-meta').textContent = `SHA ${row.sha.slice(0, 10)} · fbuild ${row.fbuild} · flash ${bytes(row.flash)} · static RAM ${bytes(row.ram)}`;
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
    const table = document.createElement('table');
    const head = document.createElement('thead'); const tr = document.createElement('tr');
    ['Region', 'Bytes', 'Symbol', 'Object'].forEach(text => { const th = document.createElement('th'); th.textContent = text; tr.append(th); }); head.append(tr); table.append(head);
    const body = document.createElement('tbody');
    [...report.symbols].filter(s => s.size > 0).sort((a,b) => b.size-a.size).forEach(symbol => {
      const tr = document.createElement('tr');
      [symbol.region, symbol.size.toLocaleString('en-US'), symbol.demangled, symbol.object || '—'].forEach(text => { const td = document.createElement('td'); td.textContent = text; tr.append(td); }); body.append(tr);
    });
    table.append(body); container.append(table);
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
    type:'line', data:{labels:chartVersions,datasets}, options:{
      responsive:true, maintainAspectRatio:false, animation:false,
      interaction:{mode:'nearest',intersect:true},
      onHover:(event,elements) => { canvas.style.cursor = elements.length ? 'pointer' : 'default'; },
      onClick:(event,elements,chart) => { if(elements.length) { const p=elements[0]; openBloat(chart.data.datasets[p.datasetIndex].rows[p.index]); } },
      plugins:{legend:{display:false},tooltip:{backgroundColor:'#0c111c',padding:12,callbacks:{label:context=>`${context.dataset.label}: ${bytes(context.parsed.y)}`,afterLabel:context=>`SHA ${context.dataset.rows[context.dataIndex].sha.slice(0,10)} · click for bloat`}}},
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
document.getElementById('log').addEventListener('change', render);
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
