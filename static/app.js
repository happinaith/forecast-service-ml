const symbolsSelect = document.getElementById('symbols');
const horizonInput = document.getElementById('horizon');
const runBtn = document.getElementById('runBtn');
const errorBox = document.getElementById('error');
const chartsDiv = document.getElementById('charts');
const selectedHint = document.getElementById('selected');

let charts = [];

async function loadSymbols() {
  errorBox.textContent = '';
  try {
    const res = await fetch('/api/symbols');
    const data = await res.json();
    const list = data.symbols || [];
    symbolsSelect.innerHTML = '';
    for (const item of list) {
      const opt = document.createElement('option');
      if (typeof item === 'string') {
        opt.value = item;
        opt.textContent = item;
      } else {
        const value = item?.value ?? '';
        const label = item?.label ?? value;
        opt.value = value;
        opt.textContent = label || value || '[неизвестный тикер]';
      }
      symbolsSelect.appendChild(opt);
    }
  } catch (e) {
    errorBox.textContent = 'Не удалось загрузить список тикеров';
  }
}

function getSelectedTicker() {
  const opt = symbolsSelect.options[symbolsSelect.selectedIndex];
  const value = opt ? opt.value : '';
  const label = opt ? opt.textContent : '';
  selectedHint.textContent = value ? `Выбран тикер: ${label}` : '';
  return value;
}

symbolsSelect.addEventListener('change', () => {
  errorBox.textContent = '';
  getSelectedTicker();
});

function clearCharts() {
  for (const ch of charts) {
    ch.destroy();
  }
  charts = [];
  chartsDiv.innerHTML = '';
}

function makeChartCard(id, title) {
  const card = document.createElement('div');
  card.className = 'card';
  const head = document.createElement('div');
  head.style.marginBottom = '8px';
  head.innerHTML = `<span class="tag">${title}</span>`;
  const canvas = document.createElement('canvas');
  canvas.id = id;
  card.appendChild(head);
  card.appendChild(canvas);
  chartsDiv.appendChild(card);
  return canvas;
}

function toDate(str) { return new Date(str); }
function fmtShort(d) {
  // Format as YYYY.MM.DD for concise axis labels
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

function renderTickerChart(ticker, history, forecast) {
  const canvas = makeChartCard(`chart_${ticker.replace(/[^\w]/g,'_')}`, ticker);
  const ctx = canvas.getContext('2d');
  const histLabels = history.dates.map(s => fmtShort(toDate(s)));
  const fcLabels = forecast.dates.map(s => fmtShort(toDate(s)));

  // Build forecast series that touches the last history point to avoid a visual gap
  const histLen = history.prices.length;
  const forecastTouch = new Array(histLen - 1).fill(null)
    .concat([history.prices[histLen - 1]])
    .concat(forecast.prices);

  const data = {
    labels: histLabels.concat(fcLabels),
    datasets: [
      {
        label: 'История',
        data: history.prices,
        borderColor: '#0ea5e9',
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.2,
        pointRadius: 0,
      },
      {
        label: 'Прогноз',
        data: forecastTouch,
        borderColor: '#ef4444',
        backgroundColor: 'transparent',
        borderDash: [6, 4],
        fill: false,
        tension: 0.2,
        pointRadius: 0,
      }
    ]
  };

  const chart = new Chart(ctx, {
    type: 'line',
    data,
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          type: 'category',
          ticks: {
            maxRotation: 0,
            minRotation: 0,
            autoSkip: true
          }
        },
        y: { beginAtZero: false }
      }
    }
  });
  charts.push(chart);
}

async function runForecast() {
  const ticker = getSelectedTicker();
  const horizon = parseInt(horizonInput.value, 10);
  if (!ticker) {
    errorBox.textContent = 'Выберите тикер';
    return;
  }
  if (isNaN(horizon) || horizon < 3 || horizon > 30) {
    errorBox.textContent = 'Горизонт должен быть от 3 до 30';
    return;
  }

  errorBox.textContent = '';
  runBtn.disabled = true;
  clearCharts();

  try {
    const res = await fetch('/api/forecast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker, horizon })
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t);
    }
    const data = await res.json();
    renderTickerChart(data.ticker, data.history, data.forecast);
  } catch (e) {
    errorBox.textContent = 'Ошибка прогноза: ' + (e?.message || e);
  } finally {
    runBtn.disabled = false;
  }
}

runBtn.addEventListener('click', runForecast);

loadSymbols();
getSelectedTicker();
