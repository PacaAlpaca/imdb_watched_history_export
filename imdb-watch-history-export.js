/* ==========================================================================
   IMDb "Watch history" -> CSV exporter  (DevTools console script)

   Run on: https://www.imdb.com/list/watchhistory/?ref_=wh_nv_wtchd&view=detailed
   while logged in, with the "Detailed" view active.

   Chrome/Edge: the first time you paste into the console it may ask you to
   type  allow pasting  and press Enter. Then paste this whole file and hit Enter.

   The script auto-scrolls to load every row and harvests rows *as it goes*,
   so it also works if IMDb ever recycles / removes off-screen rows.
   ========================================================================== */
(async () => {
  'use strict';

  const CONFIG = {
    autoScroll:      true,   // false = only read what is already in the DOM
    delimiter:       ',',    // use ';' if your Excel expects semicolons
    alsoJson:        false,  // true = also download a .json copy
    stripRankPrefix: true,   // remove a leading "12. " from titles
    scrollStepMs:    1500,    // pause between scroll steps
    maxIdleRounds:   8,      // stop after N scrolls with no new rows
    maxRuntimeMs:    5 * 60 * 1000,
    filename: `imdb-watch-history-${new Date().toISOString().slice(0, 10)}`,
  };

  // ---------- helpers -------------------------------------------------------
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const txt = el => (el ? el.textContent.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim() : '');
  const ttOf = el => (el?.getAttribute('href') || '').match(/tt\d+/)?.[0] || '';

  const listRoot = () =>
    document.querySelector('[data-testid="list-page-mc-list-content"]') ||
    document.querySelector('ul.ipc-metadata-list');

  const rowNodes = () => {
    const root = listRoot();
    return root ? [...root.querySelectorAll('li.ipc-metadata-list-summary-item')] : [];
  };

  const expectedTotal = () => {
    const el = document.querySelector('[data-testid="list-page-mc-total-items"]');
    const src = el ? el.textContent : document.body.innerText.slice(0, 4000);
    const m = src.replace(/,/g, '').match(/(\d+)\s*titles?/i);
    return m ? Number(m[1]) : null;
  };

  const TYPE_RE = /^(TV\s*(Episode|Series|Mini[-\s]?Series|Movie|Special|Short)|Video Game|Video|Short|Podcast\s*(Series|Episode)|Music Video)$/i;
  const EP_RE   = /^S\d+(\.E\d+)?$/i;
  const YEAR_RE = /^\d{4}(\s*[–—-]\s*(\d{4})?)?$/;
  const TIME_RE = /^(\d+h)?\s*(\d+m)?$/;

  // ---------- per-row parser -----------------------------------------------
  function primaryTitleEl(li) {
    const scoped = li.querySelector('.dli-title .ipc-title__text, .dli-title h4');
    if (scoped) return scoped;
    const all = [...li.querySelectorAll('h4.ipc-title__text, .ipc-title__text')];
    return all.find(el => !el.closest('.dli-ep-title, .ep-title')) || all[0] || null;
  }

  function credits(li) {
    const out = { Director: [], Star: [], Creator: [], Writer: [], other: [] };
    const seen = new Set();
    li.querySelectorAll('.title-description-credit').forEach(c => {
      const group = c.parentElement;
      if (!group || seen.has(group)) return;
      seen.add(group);
      const label = txt(group.firstElementChild).toLowerCase();
      const names = [...group.querySelectorAll('.title-description-credit')].map(txt).filter(Boolean);
      if (label.startsWith('director')) out.Director = names;
      else if (label.startsWith('star')) out.Star = names;
      else if (label.startsWith('creator')) out.Creator = names;
      else if (label.startsWith('writer')) out.Writer = names;
      else if (names.length) out.other.push(`${txt(group.firstElementChild)}: ${names.join(', ')}`);
    });
    return out;
  }

  function parseRow(li) {
    // --- titles / ids
    const titleEl = primaryTitleEl(li);
    let title = txt(titleEl);
    if (CONFIG.stripRankPrefix) title = title.replace(/^\d+\.\s+/, '');

    const titleLink =
      li.querySelector('.dli-title a[href*="/title/"]') ||
      titleEl?.closest('a[href*="/title/"]') ||
      li.querySelector('a[href*="/title/"]');
    const id = ttOf(titleLink);

    const seriesEl = li.querySelector('.dli-ep-title, .ep-title');
    const seriesTitle = seriesEl ? txt(seriesEl.querySelector('.ipc-title__text, h4') || seriesEl) : '';
    const seriesId = seriesEl ? ttOf(seriesEl.querySelector('a[href*="/title/"]')) : '';

    // --- metadata chips (year / runtime / certificate / type / Sxx.Eyy)
    const chips = [...li.querySelectorAll('li.ipc-inline-list__item')]
      .filter(x => !x.querySelector('h4, .ipc-title, a[href*="/title/"]'))
      .map(txt)
      .filter(Boolean);

    let episode = '', year = '', runtime = '', certificate = '', type = '';
    for (const c of chips) {
      if (!episode && EP_RE.test(c))                       episode = c;
      else if (!year && YEAR_RE.test(c))                   year = c;
      else if (!runtime && /\d/.test(c) && TIME_RE.test(c)) runtime = c;
      else if (!type && TYPE_RE.test(c))                   type = c;
      else if (!certificate)                               certificate = c;
    }
    if (!type) type = (episode || seriesTitle) ? 'TV Episode' : 'Movie';

    // --- ratings
    const imdbEl = li.querySelector('[data-testid="ratingGroup--imdb-rating"], .ipc-rating-star--imdb');
    const imdbRating =
      txt(imdbEl?.querySelector('.ipc-rating-star--rating')) ||
      (imdbEl?.getAttribute('aria-label') || '').match(/([\d.]+)/)?.[1] || '';
    const votes = txt(imdbEl?.querySelector('.ipc-rating-star--voteCount')).replace(/[()\s]/g, '');

    const userEl = li.querySelector('.ratingGroup--user-rating, [data-testid="rate-button"]');
    let myRating = '';
    if (userEl && !userEl.querySelector('.ipc-rating-star--rate')) {
      myRating =
        (userEl.getAttribute('aria-label') || '').match(/:\s*([\d.]+)\s*$/)?.[1] ||
        txt(userEl.querySelector('.ipc-rating-star--rating'));
    }
    if (/^rate$/i.test(myRating)) myRating = '';

    // --- plot + credits
    const description = txt(li.querySelector('.title-description-plot-container'));
    const cr = credits(li);

    return {
      type, title, seriesTitle, episode, year, runtime, certificate,
      imdbRating, votes, myRating,
      directors: cr.Director, creators: cr.Creator, stars: cr.Star,
      description,
      id, seriesId,
      url: id ? `https://www.imdb.com/title/${id}/` : '',
      key: id || `${seriesTitle}|${title}|${episode}|${year}`,
    };
  }

  // ---------- collect (harvest while scrolling) -----------------------------
  const store = new Map();
  const harvest = () => {
    for (const li of rowNodes()) {
      try {
        const row = parseRow(li);
        if (row.key && !store.has(row.key)) store.set(row.key, row);
      } catch (e) { console.warn('Row skipped:', e); }
    }
    return store.size;
  };

  if (!listRoot()) {
    console.error('%cList container not found.', 'color:#e00;font-weight:bold');
    console.error('Are you on the watch history page with view=detailed?');
    return;
  }

  const total = expectedTotal();
  console.log(`Starting. ${rowNodes().length} rows in DOM${total ? `, page reports ${total} titles` : ''}.`);
  harvest();

  if (CONFIG.autoScroll) {
    const t0 = Date.now();
    let idle = 0, last = store.size;
    const startY = window.scrollY;

    while (Date.now() - t0 < CONFIG.maxRuntimeMs) {
      const more = [...document.querySelectorAll('button, span.ipc-see-more__text')]
        .find(b => /\b\d+\s+more\b/i.test(b.textContent || '') && b.offsetParent !== null);
      if (more) more.click();

      window.scrollTo(0, document.documentElement.scrollHeight);
      await sleep(CONFIG.scrollStepMs);
      const n = harvest();
      console.log(`  collected ${n}${total ? ` / ${total}` : ''}`);

      if (total && n >= total) break;
      if (n === last) { if (++idle >= CONFIG.maxIdleRounds) break; }
      else { idle = 0; last = n; }
    }
    window.scrollTo(0, startY);
  }

  const rows = [...store.values()].map((r, i) => ({ position: i + 1, ...r }));
  if (!rows.length) { console.error('Nothing collected.'); return; }

  // ---------- CSV -----------------------------------------------------------
  const COLUMNS = [
    ['position',       r => r.position],
    ['type',           r => r.type],
    ['title',          r => r.title],
    ['series_title',   r => r.seriesTitle],
    ['episode',        r => r.episode],
    ['year',           r => r.year],
    ['runtime',        r => r.runtime],
    ['certificate',    r => r.certificate],
    ['imdb_rating',    r => r.imdbRating],
    ['num_votes',      r => r.votes],
    ['my_rating',      r => r.myRating],
    ['directors',      r => r.directors.join('; ')],
    ['creators',       r => r.creators.join('; ')],
    ['stars',          r => r.stars.join('; ')],
    ['description',    r => r.description],
    ['imdb_id',        r => r.id],
    ['series_imdb_id', r => r.seriesId],
    ['url',            r => r.url],
  ];

  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv =
    '\uFEFF' +
    [COLUMNS.map(c => cell(c[0])).join(CONFIG.delimiter)]
      .concat(rows.map(r => COLUMNS.map(c => cell(c[1](r))).join(CONFIG.delimiter)))
      .join('\r\n');

  const download = (name, content, mime) => {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
  };

  download(`${CONFIG.filename}.csv`, csv, 'text/csv;charset=utf-8');
  if (CONFIG.alsoJson) download(`${CONFIG.filename}.json`, JSON.stringify(rows, null, 2), 'application/json');

  // ---------- report --------------------------------------------------------
  const movies = rows.filter(r => !/episode/i.test(r.type)).length;
  const rated  = rows.filter(r => r.myRating).length;
  const noId   = rows.filter(r => !r.id).length;

  window.__imdb = { rows, csv };
  console.log(
    `%cDone: ${rows.length} rows (${movies} non-episode, ${rows.length - movies} episodes), ` +
    `${rated} with your rating${noId ? `, ${noId} without an imdb id` : ''}.`,
    'color:#0a0;font-weight:bold'
  );
  if (total && rows.length !== total) {
    console.warn(`Page reported ${total} titles but ${rows.length} were collected — scroll to the bottom manually and re-run.`);
  }
  console.table(rows.slice(0, 5), ['type', 'title', 'series_title', 'episode', 'year', 'imdb_rating', 'my_rating']);
  console.log('Data kept in window.__imdb — if the download was blocked, run:  copy(window.__imdb.csv)');
})();