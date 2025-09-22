/*
  Arduino Code Manager – Core JS
  - Auto-detects GitHub owner/repo (with manual override via window.APP_CONFIG)
  - Fetches default branch, lists Arduino files, renders cards + QR codes
  - File preview with Prism highlighting, copy and download
  - Dark/light theme toggle with persisted preference
*/

(function () {
  const state = {
    owner: null,
    repo: null,
    branch: null, // default branch
    basePath: '/', // site base path (e.g., /repo/ on GitHub Pages project sites)
    page: null, // 'index' or 'file'
  };

  // ---------- Utilities ----------
  function $(sel, root = document) {
    return root.querySelector(sel);
  }
  function $all(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }
  function escapeHtml(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  function decodeQuery(str) {
    try { return decodeURIComponent(str); } catch { return str; }
  }
  function encodeForUrlPath(path) {
    // Encode only characters needing encoding but preserve slashes
    return path.split('/').map(encodeURIComponent).join('/');
  }

  function setStatus(msg) {
    const el = $('#status');
    if (el) el.textContent = msg || '';
  }

  function setPrismTheme(isDark) {
    const link = $('#prism-theme');
    if (!link) return;
    const base = 'https://cdn.jsdelivr.net/npm/prismjs@1/themes/';
    link.href = isDark ? base + 'prism-okaidia.min.css' : base + 'prism.min.css';
  }

  function isGitHubPagesHost() {
    return location.hostname.endsWith('github.io');
  }

  function detectBasePath() {
    // On project pages: https://<user>.github.io/<repo>/...
    const segs = location.pathname.split('/').filter(Boolean);
    if (isGitHubPagesHost()) {
      if (segs.length > 0) {
        return '/' + segs[0] + '/';
      }
    }
    // Root or custom domain – assume root
    return '/';
  }

  function detectRepoFromLocation() {
    if (!isGitHubPagesHost()) return { owner: null, repo: null };
    const owner = location.hostname.split('.')[0];
    const segs = location.pathname.split('/').filter(Boolean);
    const repo = segs.length > 0 ? segs[0] : null;
    return { owner, repo };
  }

  function getConfig() {
    const cfg = (window.APP_CONFIG || {});
    const auto = detectRepoFromLocation();
    state.owner = cfg.owner || auto.owner;
    state.repo = cfg.repo || auto.repo;
    state.branch = cfg.branch || null;
    state.basePath = detectBasePath();
  }

  function getPreviewUrl(path, ref) {
    const p = encodeURIComponent(path);
    const r = encodeURIComponent(ref || state.branch || 'main');
    return `${location.origin}${state.basePath}file.html?path=${p}&ref=${r}`;
  }

  async function fetchJSON(url) {
    const res = await fetch(url, { headers: { 'Accept': 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  }

  async function getDefaultBranch(owner, repo) {
    const meta = await fetchJSON(`https://api.github.com/repos/${owner}/${repo}`);
    return meta.default_branch || 'main';
  }

  const TREE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  async function getRepoTree(owner, repo, branch) {
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
    const cacheKey = `gh_tree:${owner}/${repo}@${branch}`;
    const cachedRaw = localStorage.getItem(cacheKey);
    let cached = null;
    try { cached = cachedRaw ? JSON.parse(cachedRaw) : null; } catch {}

    // If cached and fresh, return immediately without any API call
    if (cached && typeof cached === 'object' && cached.data && cached.timestamp && (Date.now() - cached.timestamp) < TREE_CACHE_TTL_MS) {
      setStatus('Using cached file list.');
      return cached.data;
    }

    const headers = { 'Accept': 'application/vnd.github+json' };
    if (cached && cached.etag) headers['If-None-Match'] = cached.etag;

    const res = await fetch(url, { headers });

    // If not modified, refresh timestamp and return cached data
    if (res.status === 304 && cached && cached.data) {
      localStorage.setItem(cacheKey, JSON.stringify({ ...cached, timestamp: Date.now() }));
      setStatus('Using cached file list (not modified).');
      return cached.data;
    }

    if (!res.ok) {
      // Friendly handling for rate limit with cached fallback
      if (res.status === 403 && cached && cached.data) {
        setStatus('GitHub API rate limit reached. Showing cached file list.');
        return cached.data;
      }
      const errText = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} for ${url}${errText ? ' — ' + errText : ''}`);
    }

    const data = await res.json();
    const etag = res.headers.get('etag');
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ etag, timestamp: Date.now(), data }));
    } catch {}
    return data;
  }

  async function fetchManifest() {
    // Prefer a static files.json served from the site to avoid API rate limits
    const url = `${location.origin}${state.basePath}files.json`;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status} for manifest`);
      const data = await res.json();
      return data;
    } catch (e) {
      return null;
    }
  }

  function filesFromManifest(manifest) {
    if (!manifest) return [];
    const arr = Array.isArray(manifest.files) ? manifest.files : [];
    // Allow both string paths and {path: "..."} entries
    return arr.map((item) => (typeof item === 'string' ? { path: item } : { path: item.path }))
      .filter((f) => f && f.path && isArduinoFile(f.path));
  }

  function isArduinoFile(path) {
    return /\.(ino|cpp|h)$/i.test(path);
  }

  function langFromPath(path) {
    const lower = path.toLowerCase();
    if (lower.endsWith('.ino')) return 'cpp';
    if (lower.endsWith('.cpp')) return 'cpp';
    if (lower.endsWith('.h')) return 'cpp';
    return 'cpp';
  }

  function shortName(path) {
    return path.split('/').pop();
  }

  function setupSearchFiltering() {
    const input = $('#searchInput');
    if (!input) return;
    function applyFilter() {
      const q = input.value.trim().toLowerCase();
      const cards = $all('[data-filecard]');
      let visibleCount = 0;
      for (const card of cards) {
        const path = card.getAttribute('data-path') || '';
        const show = !q || path.toLowerCase().includes(q);
        card.classList.toggle('hidden', !show);
        if (show) visibleCount++;
      }
      $('#emptyState')?.classList.toggle('hidden', visibleCount !== 0);
    }
    input.addEventListener('input', applyFilter);
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== input) {
        e.preventDefault();
        input.focus();
      }
    });
  }

  function setupThemeToggle() {
    const btn = $('#themeToggle');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const saved = localStorage.getItem('theme');
    const isDarkInit = saved ? saved === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', isDarkInit);
    setPrismTheme(isDarkInit);
    if (btn) {
      btn.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        setPrismTheme(isDark);
      });
    }
  }

  function renderRepoBadge(owner, repo, branch) {
    const el = $('#repoBadge');
    if (!el) return;
    el.textContent = owner && repo ? `${owner}/${repo}${branch ? ' @ ' + branch : ''}` : '';
    el.classList.toggle('hidden', !(owner && repo));
  }

  function renderCards(files, ref) {
    const container = $('#cards');
    if (!container) return;
    container.innerHTML = '';

    if (!files.length) {
      $('#emptyState')?.classList.remove('hidden');
      return;
    }
    $('#emptyState')?.classList.add('hidden');

    for (const file of files) {
      const card = document.createElement('div');
      card.setAttribute('data-filecard', '');
      card.setAttribute('data-path', file.path);
      card.className = 'rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between';

      const title = document.createElement('div');
      title.className = 'mb-3 min-h-[2.5rem]';
      title.innerHTML = `
        <div class="truncate text-sm text-slate-500 dark:text-slate-400">${escapeHtml(file.path)}</div>
        <div class="truncate text-base font-semibold">${escapeHtml(shortName(file.path))}</div>
      `;

      const actions = document.createElement('div');
      actions.className = 'mt-3 flex items-center justify-between gap-3';

      const btn = document.createElement('a');
      btn.className = 'rounded-md border border-slate-300 px-3 py-1.5 text-sm shadow-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800';
      const previewUrl = getPreviewUrl(file.path, ref);
      btn.href = previewUrl;
      btn.textContent = 'View Code';

      const qrWrap = document.createElement('div');
      qrWrap.className = 'flex items-center justify-center';
      const qrEl = document.createElement('div');
      qrEl.className = 'qr w-[96px] h-[96px]';
      qrWrap.appendChild(qrEl);

      actions.appendChild(btn);
      actions.appendChild(qrWrap);

      card.appendChild(title);
      card.appendChild(actions);

      container.appendChild(card);

      // Generate the QR after attach
      try {
        new QRCode(qrEl, {
          text: previewUrl,
          width: 96,
          height: 96,
          correctLevel: QRCode.CorrectLevel.M,
        });
      } catch (e) {
        // ignore QR errors
      }
    }
  }

  async function initIndex() {
    state.page = 'index';
    setStatus('Detecting repository context…');
    getConfig();
    setupThemeToggle();
    setupSearchFiltering();

    if (!state.owner || !state.repo) {
      setStatus('Could not auto-detect owner/repo. Please set window.APP_CONFIG in index.html.');
      return;
    }

    try {
      if (!state.branch) {
        setStatus('Fetching repository metadata…');
        state.branch = await getDefaultBranch(state.owner, state.repo);
      }
      renderRepoBadge(state.owner, state.repo, state.branch);

      // Attempt to use a static manifest first
      setStatus('Loading file manifest…');
      const manifest = await fetchManifest();
      if (manifest) {
        if (manifest.branch) state.branch = manifest.branch;
        const files = filesFromManifest(manifest);
        files.sort((a, b) => a.path.localeCompare(b.path));
        renderCards(files, state.branch);
        setStatus(`Found ${files.length} Arduino file${files.length === 1 ? '' : 's'} (via manifest).`);
        return;
      }

      // Fallback to GitHub API if manifest missing
      setStatus('Fetching file list…');
      const tree = await getRepoTree(state.owner, state.repo, state.branch);
      const files = (tree.tree || []).filter((t) => t.type === 'blob' && isArduinoFile(t.path))
        .map(({ path, sha, size, url }) => ({ path, sha, size, url }));

      files.sort((a, b) => a.path.localeCompare(b.path));
      renderCards(files, state.branch);
      setStatus(`Found ${files.length} Arduino file${files.length === 1 ? '' : 's'}.`);
    } catch (err) {
      console.error(err);
      setStatus('Failed to load files. ' + (err?.message || ''));
    }
  }

  async function fetchRaw(owner, repo, ref, path) {
    // Use raw.githubusercontent for direct text
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(ref)}/${encodeForUrlPath(path)}`;
    const res = await fetch(rawUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status} for raw file`);
    return res.text();
  }

  function setCodeLanguageClass(codeEl, lang) {
    const cls = `language-${lang}`;
    // Remove previous language-* classes
    codeEl.className = codeEl.className
      .split(/\s+/)
      .filter((c) => !c.startsWith('language-'))
      .concat(cls)
      .join(' ');
  }

  function makeDownload(filename, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  }

  async function initFile() {
    state.page = 'file';
    setStatus('Parsing URL…');
    getConfig();
    setupThemeToggle();

    const params = new URLSearchParams(location.search);
    const path = decodeQuery(params.get('path') || '');
    const ref = decodeQuery(params.get('ref') || '') || state.branch;

    if (!state.owner || !state.repo) {
      setStatus('Could not auto-detect owner/repo. Please set window.APP_CONFIG in file.html.');
      return;
    }

    const title = $('#fileTitle');
    const meta = $('#fileMeta');
    const shareUrlEl = $('#shareUrl');
    const codeEl = $('#codeBlock');

    title.textContent = path || '(no file)';
    meta.textContent = `${state.owner}/${state.repo}${ref ? ' @ ' + ref : ''}`;

    if (!ref) {
      setStatus('Fetching default branch…');
      state.branch = await getDefaultBranch(state.owner, state.repo);
    } else {
      state.branch = ref;
    }

    const shareUrl = getPreviewUrl(path, state.branch);
    shareUrlEl.textContent = shareUrl;

    // Back link should keep basePath
    const back = $('#backLink');
    if (back) back.href = `${state.basePath}index.html`;

    // Generate QR for this page
    try {
      new QRCode($('#qr'), {
        text: shareUrl,
        width: 160,
        height: 160,
        correctLevel: QRCode.CorrectLevel.M,
      });
    } catch {}

    if (!path) {
      setStatus('Missing file path in URL.');
      return;
    }

    try {
      setStatus('Fetching file…');
      const content = await fetchRaw(state.owner, state.repo, state.branch, path);
      const lang = langFromPath(path);
      setCodeLanguageClass(codeEl, lang);
      codeEl.textContent = content;
      if (window.Prism && window.Prism.highlightElement) {
        Prism.highlightElement(codeEl);
      }
      setStatus('');

      // Copy
      $('#copyBtn')?.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(content);
          setStatus('Copied to clipboard.');
          setTimeout(() => setStatus(''), 1500);
        } catch (e) {
          setStatus('Copy failed.');
        }
      });

      // Download
      $('#downloadBtn')?.addEventListener('click', () => {
        makeDownload(shortName(path), content);
      });

    } catch (err) {
      console.error(err);
      setStatus('Failed to load file. ' + (err?.message || ''));
      codeEl.textContent = '// Failed to fetch file.';
    }
  }

  // ---------- Boot ----------
  document.addEventListener('DOMContentLoaded', () => {
    const isFilePage = /\/file\.html$/i.test(location.pathname) || (new URLSearchParams(location.search).has('path'));
    if (isFilePage) {
      initFile();
    } else {
      initIndex();
    }
  });
})();
