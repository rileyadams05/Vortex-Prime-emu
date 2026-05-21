import goldhenSupport from './data/goldhen-support.json' assert { type: 'json' };

const state = {
  input: document.querySelector('[data-firmware-input]'),
  form: document.querySelector('[data-search-form]'),
  results: document.querySelector('[data-results]'),
  emptyState: document.querySelector('[data-empty-state]'),
  submit: document.querySelector('[data-search-submit]')
};

const badgeLabels = {
  newest: 'NEWEST',
  old: 'OLD',
  beta: 'BETA',
  stable: 'STABLE',
  recommended: 'RECOMMENDED'
};

const stabilityBadge = {
  recommended: 'recommended',
  'newest-beta': 'beta',
  beta: 'beta',
  'old-stable': 'stable',
  old: 'old'
};

function init() {
  if (!state.form || !state.input || !state.results) {
    return;
  }

  state.form.addEventListener('submit', handleSubmit);
}

function handleSubmit(event) {
  event.preventDefault();
  if (!state.input) {
    return;
  }

  const normalised = normaliseFirmware(state.input.value);
  if (!normalised) {
    renderUnsupported('Enter a valid firmware version (for example 5.05 or 11.00).');
    return;
  }

  const options = getGoldHENOptions(normalised);
  renderResults(options);
}

function normaliseFirmware(value) {
  if (!value) {
    return '';
  }

  const cleaned = String(value)
    .trim()
    .replace(/[^0-9.]/g, '')
    .replace(/\.+/g, '.')
    .replace(/^\./, '')
    .replace(/\.$/, '');

  if (!cleaned) {
    return '';
  }

  if (/^\d{3}$/.test(cleaned)) {
    const first = cleaned.slice(0, cleaned.length - 2);
    const rest = cleaned.slice(-2);
    return `${parseInt(first, 10)}.${rest}`;
  }

  if (/^\d$/.test(cleaned)) {
    return `${cleaned}.00`;
  }

  const parts = cleaned.split('.').filter(Boolean);
  if (parts.length === 1) {
    return `${parts[0]}.00`;
  }

  if (parts.length >= 2) {
    const major = parts[0];
    const minor = parts[1].padEnd(2, '0').slice(0, 2);
    const final = `${major}.${minor}`;
    return normaliseGroupedFirmware(final);
  }

  return '';
}

function normaliseGroupedFirmware(value) {
  if (value === '12.00' || value === '12.02') {
    return '12.02';
  }

  return value;
}

function compareGoldhenVersion(a, b) {
  const tokenize = (version) => version.split(/[.a-zA-Z]+/).filter(Boolean).map(Number);
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);

  const length = Math.max(aTokens.length, bTokens.length);
  for (let index = 0; index < length; index += 1) {
    const aValue = aTokens[index] ?? 0;
    const bValue = bTokens[index] ?? 0;

    if (aValue !== bValue) {
      return aValue - bValue;
    }
  }
  return 0;
}

function getGoldHENOptions(inputFirmware) {
  const matches = goldhenSupport
    .filter((item) => item.firmware.includes(inputFirmware))
    .sort((a, b) => compareGoldhenVersion(b.release, a.release));

  if (!matches.length) {
    return {
      firmware: inputFirmware,
      supported: false,
      message: 'No known public GoldHEN support found for this firmware.'
    };
  }

  const newestRelease = matches[0].release;

  return {
    firmware: inputFirmware,
    supported: true,
    options: matches.map((item) => ({
      ...item,
      badges: buildBadges(item, newestRelease)
    }))
  };
}

function buildBadges(item, newestRelease) {
  const badges = [];
  if (item.release === newestRelease) {
    badges.push({ label: badgeLabels.newest, className: 'badge-newest' });
  } else if (item.release && compareGoldhenVersion(item.release, newestRelease) < 0) {
    badges.push({ label: badgeLabels.old, className: 'badge-old' });
  }

  if (item.stability) {
    const badgeKey = stabilityBadge[item.stability] ?? item.stability;
    switch (badgeKey) {
      case 'recommended':
        badges.push({ label: badgeLabels.recommended, className: 'badge-recommended' });
        break;
      case 'beta':
      case 'newest-beta':
        badges.push({ label: badgeLabels.beta, className: 'badge-beta' });
        break;
      case 'stable':
      case 'old-stable':
        badges.push({ label: badgeLabels.stable, className: 'badge-stable' });
        break;
      case 'old':
        badges.push({ label: badgeLabels.old, className: 'badge-old' });
        break;
      default:
        break;
    }
  }

  return badges;
}

function renderResults(payload) {
  if (!state.results) {
    return;
  }

  if (state.emptyState) {
    state.emptyState.hidden = true;
  }

  state.results.innerHTML = '';

  if (!payload.supported) {
    const container = document.createElement('div');
    container.className = 'result-header';
    container.innerHTML = `
      <h2>Firmware ${payload.firmware}</h2>
      <p class="alert">${payload.message}</p>
    `;
    state.results.appendChild(container);
    return;
  }

  const header = document.createElement('div');
  header.className = 'result-header';
  header.innerHTML = `
    <h2>Firmware ${payload.firmware}</h2>
    <p>Showing ${payload.options.length} compatible GoldHEN release${payload.options.length > 1 ? 's' : ''}, newest first.</p>
  `;
  state.results.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'options-grid';

  payload.options.forEach((item) => {
    grid.appendChild(renderOptionCard(item));
  });

  state.results.appendChild(grid);
}

function renderOptionCard(item) {
  const card = document.createElement('article');
  card.className = 'option-card';

  const title = document.createElement('div');
  title.className = 'option-title';
  title.innerHTML = `
    <h3>${item.name}</h3>
    <span>Release ${item.release}</span>
  `;
  card.appendChild(title);

  if (item.badges && item.badges.length > 0) {
    const badgeRow = document.createElement('div');
    badgeRow.className = 'badge-row';

    item.badges.forEach((badge) => {
      const badgeEl = document.createElement('span');
      badgeEl.className = `badge ${badge.className ?? ''}`.trim();
      badgeEl.textContent = badge.label;
      badgeRow.appendChild(badgeEl);
    });

    card.appendChild(badgeRow);
  }

  if (item.notes) {
    const notes = document.createElement('p');
    notes.className = 'option-notes';
    notes.textContent = item.notes;
    card.appendChild(notes);
  }

  const meta = document.createElement('div');
  meta.className = 'meta-row';
  meta.innerHTML = `
    <span>${renderStatusLabel(item.status)}</span>
    <span>${item.firmware.length} firmware${item.firmware.length === 1 ? '' : 's'} supported</span>
  `;
  card.appendChild(meta);

  return card;
}

function renderStatusLabel(status) {
  switch (status) {
    case 'official-github':
      return 'Official release';
    case 'ko-fi-beta':
      return 'Community beta build';
    default:
      return status;
  }
}

function renderUnsupported(message) {
  if (!state.results) {
    return;
  }

  if (state.emptyState) {
    state.emptyState.hidden = true;
  }
  state.results.innerHTML = '';

  const alert = document.createElement('p');
  alert.className = 'alert';
  alert.textContent = message;

  state.results.appendChild(alert);
}

init();
