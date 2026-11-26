/*************************************************************************
 * O(1) LFU Cache with LRU Tie-Breaking
 *   1. Map<string, CacheNode> (keyToNode)
 *   2. Map<number, DoublyLinkedList> (freqToList)
 * Zero whole-cache scanning in get() or put().
 *************************************************************************/

class CacheNode {
  constructor(key, valueObj) {
    this.key = key;
    this.value = valueObj;
    this.freq = 1;
    this.prev = null;
    this.next = null;
  }
}

class DoublyLinkedList {
  constructor() {
    this.head = new CacheNode(null, null); // MRU sentinel
    this.tail = new CacheNode(null, null); // LRU sentinel
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.size = 0;
  }

  addToFront(node) {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next.prev = node;
    this.head.next = node;
    this.size++;
  }

  removeNode(node) {
    if (!node || !node.prev || !node.next) return;
    node.prev.next = node.next;
    node.next.prev = node.prev;
    node.prev = null;
    node.next = null;
    this.size--;
  }

  removeLRU() {
    if (this.size === 0) return null;
    const lruNode = this.tail.prev;
    this.removeNode(lruNode);
    return lruNode;
  }

  peekLRU() {
    return this.size > 0 ? this.tail.prev : null;
  }
}

class LFUCache {
  constructor(capacity = 3) {
    this.capacity = capacity;
    this.size = 0;
    this.minFreq = 0;
    this.keyToNode = new Map();
    this.freqToList = new Map();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.onLog = null;
  }

  log(type, badge, message) {
    if (typeof this.onLog === 'function') {
      this.onLog(type, badge, message);
    }
  }

  _revokeBlob(valueObj) {
    if (valueObj && valueObj.blobUrl) {
      try { URL.revokeObjectURL(valueObj.blobUrl); } catch (_) {}
    }
  }

  _promote(node) {
    const oldFreq = node.freq;
    const oldList = this.freqToList.get(oldFreq);
    oldList.removeNode(node);

    if (oldList.size === 0) {
      this.freqToList.delete(oldFreq);
      if (this.minFreq === oldFreq) {
        this.minFreq++;
      }
    }

    node.freq = oldFreq + 1;
    let newList = this.freqToList.get(node.freq);
    if (!newList) {
      newList = new DoublyLinkedList();
      this.freqToList.set(node.freq, newList);
    }
    newList.addToFront(node);
  }

  get(key) {
    if (this.capacity === 0) {
      this.misses++;
      this.log('miss', 'GET MISS', `GET(${key}) -> MISS / NULL (cache capacity is 0).`);
      return null;
    }

    const node = this.keyToNode.get(key);
    if (!node) {
      this.misses++;
      this.log('miss', 'GET MISS', `GET(${key}) -> MISS / NULL (key not in cache; not inserted).`);
      return null;
    }

    const oldFreq = node.freq;
    this._promote(node);
    this.hits++;
    this.log(
      'hit',
      'GET HIT',
      `GET(${key}) -> Returned: "${node.value.summary}". Frequency ${oldFreq} -> ${node.freq}; moved to MRU of Freq ${node.freq}.`
    );
    return node.value;
  }

  put(key, valueObj) {
    if (this.capacity === 0) {
      this._revokeBlob(valueObj);
      this.log(
        'miss',
        'PUT IGNORED',
        `PUT(${key}, ${valueObj.summary}) -> Ignored because capacity is 0.`
      );
      return;
    }

    if (this.keyToNode.has(key)) {
      const node = this.keyToNode.get(key);
      if (node.value.blobUrl && node.value.blobUrl !== valueObj.blobUrl) {
        this._revokeBlob(node.value);
      }
      const oldFreq = node.freq;
      node.value = valueObj;
      this._promote(node);
      this.log(
        'update',
        'PUT UPDATE',
        `PUT(${key}, ${valueObj.summary}) -> Updated value & counted as access. Frequency ${oldFreq} -> ${node.freq}; moved to MRU of Freq ${node.freq}.`
      );
      return;
    }

    if (this.size >= this.capacity) {
      const minList = this.freqToList.get(this.minFreq);
      const tiedCount = minList.size;
      const evictedNode = minList.removeLRU();
      if (minList.size === 0) {
        this.freqToList.delete(this.minFreq);
      }
      this.keyToNode.delete(evictedNode.key);
      this.size--;
      this.evictions++;
      this._revokeBlob(evictedNode.value);

      const tieReason = tiedCount > 1
        ? `Tie-break among ${tiedCount} files at minFreq=${this.minFreq}: "${evictedNode.key}" was Least Recently Used (LRU).`
        : `"${evictedNode.key}" had the lowest access count (minFreq=${this.minFreq}).`;

      this.log(
        'evict',
        'EVICTION',
        `Evicted "${evictedNode.key}" (freq=${evictedNode.freq}) during PUT(${key}, ${valueObj.summary}) because cache was full (${this.capacity}/${this.capacity}). ${tieReason}`
      );
    }

    const newNode = new CacheNode(key, valueObj);
    this.keyToNode.set(key, newNode);
    let list1 = this.freqToList.get(1);
    if (!list1) {
      list1 = new DoublyLinkedList();
      this.freqToList.set(1, list1);
    }
    list1.addToFront(newNode);
    this.minFreq = 1;
    this.size++;

    this.log(
      'insert',
      'PUT INSERT',
      `PUT(${key}, ${valueObj.summary}) -> Inserted at Freq 1 (MRU position).`
    );
  }

  peekNextToEvict() {
    if (this.size === 0 || this.capacity === 0) return null;
    const minList = this.freqToList.get(this.minFreq);
    return minList ? minList.peekLRU() : null;
  }

  setCapacity(newCap) {
    const clamped = Math.max(0, Math.min(200, Math.floor(newCap)));
    const oldCap = this.capacity;
    this.capacity = clamped;

    if (clamped === oldCap) {
      this.log('info', 'CAPACITY', `Capacity remains ${clamped}.`);
      return;
    }

    this.log('info', 'CAPACITY', `Capacity set from ${oldCap} to ${clamped}.`);

    while (this.size > this.capacity) {
      while (!this.freqToList.has(this.minFreq) || this.freqToList.get(this.minFreq).size === 0) {
        this.minFreq++;
      }
      const minList = this.freqToList.get(this.minFreq);
      const tiedCount = minList.size;
      const evictedNode = minList.removeLRU();
      if (minList.size === 0) {
        this.freqToList.delete(this.minFreq);
      }
      this.keyToNode.delete(evictedNode.key);
      this.size--;
      this.evictions++;
      this._revokeBlob(evictedNode.value);

      const tieNote = tiedCount > 1 ? ` (LRU tie-break at freq=${this.minFreq})` : '';
      this.log(
        'evict',
        'RESIZE EVICT',
        `Evicted "${evictedNode.key}" (freq=${evictedNode.freq})${tieNote} due to capacity reduction to ${this.capacity}.`
      );
    }

    if (this.size === 0) {
      this.minFreq = 0;
    } else if (!this.freqToList.has(this.minFreq)) {
      this.minFreq = Math.min(...this.freqToList.keys());
    }
  }

  clear() {
    for (const node of this.keyToNode.values()) {
      this._revokeBlob(node.value);
    }
    this.keyToNode.clear();
    this.freqToList.clear();
    this.size = 0;
    this.minFreq = 0;
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }
}

/*************************************************************************
 * Helpers & High-Throughput Log Buffer (Handles up to 12,000+ ops)
 *************************************************************************/
const cache = new LFUCache(3);
const MAX_LOG_BUFFER = 12500;
const MAX_RENDERED_LOGS = 250;
let logEntries = [];
let opCounter = 0;
let batchMode = false;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, i);
  return `${val >= 10 || i === 0 ? val.toFixed(0) : val.toFixed(2)} ${units[i]}`;
}

function createTextValue(text) {
  const clean = text === '' ? '(empty)' : text;
  return { isFile: false, text: clean, summary: clean };
}

function createFileValue(file) {
  const sizeText = formatBytes(file.size);
  const typeText = file.type || 'application/octet-stream';
  const blobUrl = URL.createObjectURL(file);
  return {
    isFile: true,
    fileName: file.name,
    sizeText,
    typeText,
    blobUrl,
    summary: `${sizeText} (${typeText})`
  };
}

cache.onLog = (type, badge, message) => {
  opCounter++;
  logEntries.unshift({
    id: opCounter,
    type,
    badge,
    message,
    time: new Date().toLocaleTimeString()
  });
  if (logEntries.length > MAX_LOG_BUFFER) {
    logEntries.pop();
  }
  if (!batchMode) {
    renderLogs();
  }
};

/*************************************************************************
 * UI Rendering Functions
 *************************************************************************/
function renderStats() {
  document.getElementById('statCapacity').textContent = cache.capacity;
  document.getElementById('statSize').textContent = `${cache.size} / ${cache.capacity}`;
  document.getElementById('statMinFreq').textContent = cache.size > 0 ? cache.minFreq : '—';

  const totalLookups = cache.hits + cache.misses;
  const hitRate = totalLookups > 0 ? Math.round((cache.hits / totalLookups) * 100) : 0;
  document.getElementById('statHitsMisses').textContent = `${cache.hits} / ${cache.misses} (${hitRate}%)`;
  document.getElementById('statEvictions').textContent = cache.evictions;
}

function renderVisualCache() {
  const container = document.getElementById('visualCacheContainer');
  if (cache.size === 0) {
    container.innerHTML = `<div class="cache-empty">Cache is currently empty (Capacity: ${cache.capacity}). Use PUT, Browse Computer, Run Sequence, or a Built-in Test.</div>`;
    return;
  }

  const nextEvictNode = cache.peekNextToEvict();
  const sortedFreqs = Array.from(cache.freqToList.keys()).sort((a, b) => a - b);

  let html = '<div class="freq-list">';
  for (const freq of sortedFreqs) {
    const list = cache.freqToList.get(freq);
    const isMin = freq === cache.minFreq;

    html += `
      <div class="freq-bucket ${isMin ? 'is-min-freq' : ''}">
        <div class="freq-bucket-header">
          <span>Frequency = ${freq} (${list.size} ${list.size === 1 ? 'file' : 'files'}) ${isMin ? '• Lowest Frequency (minFreq)' : ''}</span>
          <span class="order-hint">MRU (Left) → LRU (Right)</span>
        </div>
        <div class="dll-row">
    `;

    let curr = list.head.next;
    let index = 0;
    while (curr !== list.tail) {
      const isMRU = index === 0;
      const isLRU = index === list.size - 1;
      const isNextEvict = nextEvictNode && curr.key === nextEvictNode.key;

      const valueMarkup = curr.value.isFile
        ? `${escapeHtml(curr.value.sizeText)} • ${escapeHtml(curr.value.typeText)}<br><a href="${curr.value.blobUrl}" download="${escapeHtml(curr.key)}">⬇ Download File</a>`
        : escapeHtml(curr.value.text);

      html += `
        <div class="cache-node-card ${isNextEvict ? 'next-evict' : ''}">
          <div class="node-badges">
            ${isMRU ? '<span class="badge badge-mru">MRU</span>' : ''}
            ${isLRU ? '<span class="badge badge-lru">LRU</span>' : ''}
            ${isNextEvict ? '<span class="badge badge-evict">Next Evict</span>' : ''}
          </div>
          <div class="node-key">${escapeHtml(curr.key)}</div>
          <div class="node-val">${valueMarkup}</div>
        </div>
      `;

      if (curr.next !== list.tail) {
        html += `<div class="dll-arrow">↔</div>`;
      }
      curr = curr.next;
      index++;
    }

    html += `</div></div>`;
  }
  html += '</div>';
  container.innerHTML = html;
}

function renderLogs() {
  const logContainer = document.getElementById('logContainer');
  const countLabel = document.getElementById('logCountLabel');
  countLabel.textContent = `${logEntries.length} ${logEntries.length === 1 ? 'entry' : 'entries'}${logEntries.length > MAX_RENDERED_LOGS ? ` (showing latest ${MAX_RENDERED_LOGS})` : ''}`;

  const visible = logEntries.slice(0, MAX_RENDERED_LOGS);
  logContainer.innerHTML = visible.map(entry => `
    <div class="log-entry type-${entry.type}">
      <div class="log-meta">
        <span>#${entry.id} • ${escapeHtml(entry.badge)}</span>
        <span>${escapeHtml(entry.time)}</span>
      </div>
      <div class="log-msg">${escapeHtml(entry.message)}</div>
    </div>
  `).join('');
}

function renderStateReport() {
  const metaEl = document.getElementById('stateReportMeta');
  const wrapEl = document.getElementById('stateTableWrap');

  metaEl.textContent = `Snapshot at ${new Date().toLocaleTimeString()} | Size: ${cache.size}/${cache.capacity} | minFreq: ${cache.size > 0 ? cache.minFreq : 'N/A'}`;

  if (cache.size === 0) {
    wrapEl.innerHTML = `<div style="padding:14px; color:var(--muted);">No files currently cached.</div>`;
    return;
  }

  const rows = [];
  const sortedFreqs = Array.from(cache.freqToList.keys()).sort((a, b) => b - a);
  for (const freq of sortedFreqs) {
    const list = cache.freqToList.get(freq);
    let curr = list.head.next;
    let rank = 1;
    while (curr !== list.tail) {
      rows.push({
        key: curr.key,
        value: curr.value,
        freq: curr.freq,
        recency: rank === 1 ? 'MRU' : (rank === list.size ? 'LRU' : `#${rank}`)
      });
      curr = curr.next;
      rank++;
    }
  }

  wrapEl.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Key (File Name)</th>
          <th>Value / File Metadata</th>
          <th>Access Count (Freq)</th>
          <th>Bucket Position</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td><strong>${escapeHtml(r.key)}</strong></td>
            <td>${r.value.isFile ? `${escapeHtml(r.value.summary)} — <a href="${r.value.blobUrl}" download="${escapeHtml(r.key)}">Download</a>` : escapeHtml(r.value.text)}</td>
            <td><span class="freq-pill">${r.freq}</span></td>
            <td>${r.recency}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function refreshAll() {
  renderStats();
  renderVisualCache();
  renderLogs();
  if (!document.getElementById('stateReportSection').classList.contains('hidden')) {
    renderStateReport();
  }
}

function showStateReport() {
  const section = document.getElementById('stateReportSection');
  const hideBtn = document.getElementById('hideStateBtn');
  section.classList.remove('hidden');
  hideBtn.classList.remove('hidden');
  renderStateReport();
}

/*************************************************************************
 * Command Sequence Parser (Supports Capacity, PUT, GET, STATE)
 *************************************************************************/
function runSequenceText(rawText) {
  const tokens = rawText
    .split(/[\n;]+|(?<=\))\s*,\s*/)
    .map(t => t.trim())
    .filter(Boolean);

  if (tokens.length === 0) return;

  batchMode = true;
  let shouldShowState = false;

  for (const token of tokens) {
    const capMatch = token.match(/^capacity\s*[:=]?\s*(\d+)$/i);
    if (capMatch) {
      const newCap = parseInt(capMatch[1], 10);
      document.getElementById('capacityInput').value = Math.min(200, newCap);
      cache.setCapacity(newCap);
      continue;
    }

    const putMatch = token.match(/^put\s*\(\s*([^,]+?)\s*,\s*(.+?)\s*\)$/i);
    if (putMatch) {
      const k = putMatch[1].replace(/^["']|["']$/g, '').trim();
      const v = putMatch[2].replace(/^["']|["']$/g, '').trim();
      if (k) cache.put(k, createTextValue(v));
      continue;
    }

    const getMatch = token.match(/^get\s*\(\s*([^)]+?)\s*\)$/i);
    if (getMatch) {
      const k = getMatch[1].replace(/^["']|["']$/g, '').trim();
      if (k) {
        const res = cache.get(k);
        document.getElementById('lastGetBanner').textContent =
          `Last GET(${k}) Result: ${res ? res.summary : 'MISS (null)'}`;
      }
      continue;
    }

    if (/^state(\(\))?$/i.test(token)) {
      cache.log('info', 'STATE', 'STATE report requested via sequence.');
      shouldShowState = true;
    }
  }

  batchMode = false;
  refreshAll();
  if (shouldShowState) {
    showStateReport();
  }
}

/*************************************************************************
 * Event Listeners & Built-in Edge-Case Tests
 *************************************************************************/
document.getElementById('setCapacityBtn').addEventListener('click', () => {
  const input = document.getElementById('capacityInput');
  const val = parseInt(input.value, 10);
  if (Number.isNaN(val)) return;
  const clamped = Math.max(0, Math.min(200, val));
  input.value = clamped;
  cache.setCapacity(clamped);
  refreshAll();
});

document.getElementById('putBtn').addEventListener('click', () => {
  const key = document.getElementById('keyInput').value.trim();
  const val = document.getElementById('valueInput').value.trim();
  if (!key) {
    alert('Please enter a File Key before clicking PUT.');
    return;
  }
  cache.put(key, createTextValue(val));
  refreshAll();
});

document.getElementById('getBtn').addEventListener('click', () => {
  const key = document.getElementById('keyInput').value.trim();
  if (!key) {
    alert('Please enter a File Key before clicking GET.');
    return;
  }
  const res = cache.get(key);
  document.getElementById('lastGetBanner').textContent =
    `Last GET(${key}) Result: ${res ? res.summary : 'MISS (null)'}`;
  refreshAll();
});

document.getElementById('filePicker').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  document.getElementById('keyInput').value = file.name;
  document.getElementById('valueInput').value = `${formatBytes(file.size)} (${file.type || 'file'})`;
  cache.put(file.name, createFileValue(file));
  e.target.value = '';
  refreshAll();
});

document.getElementById('runSequenceBtn').addEventListener('click', () => {
  runSequenceText(document.getElementById('sequenceInput').value);
});

document.getElementById('loadSampleSeqBtn').addEventListener('click', () => {
  document.getElementById('sequenceInput').value =
    'Capacity 3; PUT(syllabus.pdf, 420KB); PUT(notes1.docx, 1.1MB); PUT(slides.pptx, 3.5MB); GET(syllabus.pdf); PUT(notes1.docx, 1.2MB); PUT(lab_code.zip, 890KB); STATE';
});

document.getElementById('showStateBtn').addEventListener('click', () => {
  cache.log('info', 'STATE', 'STATE report generated on demand.');
  showStateReport();
  renderLogs();
});

document.getElementById('hideStateBtn').addEventListener('click', () => {
  document.getElementById('stateReportSection').classList.add('hidden');
  document.getElementById('hideStateBtn').classList.add('hidden');
});

document.getElementById('clearLogBtn').addEventListener('click', () => {
  logEntries = [];
  renderLogs();
});

document.getElementById('resetCacheBtn').addEventListener('click', () => {
  cache.clear();
  logEntries = [];
  opCounter = 0;
  document.getElementById('lastGetBanner').textContent = 'Last GET Result: —';
  cache.log('info', 'RESET', `Cache cleared. Current capacity: ${cache.capacity}.`);
  refreshAll();
});

// Built-in Test Suites
function startFreshTest(cap, title) {
  cache.clear();
  logEntries = [];
  opCounter = 0;
  document.getElementById('capacityInput').value = cap;
  cache.capacity = cap;
  cache.log('info', 'TEST START', `${title} (Capacity = ${cap})`);
}

document.getElementById('testZeroBtn').addEventListener('click', () => {
  startFreshTest(0, 'Zero Capacity Edge-Case Test');
  runSequenceText('PUT(fileA, 100); GET(fileA); STATE');
});

document.getElementById('testTiesBtn').addEventListener('click', () => {
  startFreshTest(2, 'Frequency Tie-Break (LRU) Test');
  runSequenceText('PUT(doc1, v1); PUT(doc2, v1); PUT(doc3, v1); STATE');
});

document.getElementById('testUpdatesBtn').addEventListener('click', () => {
  startFreshTest(2, 'Repeated PUT Updates Test');
  runSequenceText('PUT(config.json, v1); PUT(config.json, v2); PUT(readme.md, v1); PUT(extra.txt, v1); STATE');
});

document.getElementById('testMissedBtn').addEventListener('click', () => {
  startFreshTest(2, 'Missed GET Requests Test');
  runSequenceText('PUT(A, 10); GET(MISSING_FILE); PUT(B, 20); GET(UNKNOWN); PUT(C, 30); STATE');
});

document.getElementById('testExampleBtn').addEventListener('click', () => {
  startFreshTest(2, 'Problem Statement Illustrative Example');
  runSequenceText('PUT(A, 10); PUT(B, 20); GET(A); PUT(C, 30); STATE');
});

// Initialize initial display
cache.log('info', 'READY', 'Simulator initialized with capacity 3.');
refreshAll();