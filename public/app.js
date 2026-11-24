(() => {
  const state = {
    settings: null,
    entries: [],
    filterType: 'all',
    filterCategory: 'all',
    sortBy: 'votes',
    votedIds: new Set(JSON.parse(localStorage.getItem('picnic_voted_ids') || '[]')),
    adminPin: null,
    lightboxEntryId: null
  };

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function saveVoted() {
    localStorage.setItem('picnic_voted_ids', JSON.stringify(Array.from(state.votedIds)));
  }

  function openModal(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('open');
      el.setAttribute('aria-hidden', 'false');
    }
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('open');
      el.setAttribute('aria-hidden', 'true');
      if (id === 'lightboxModal') {
        const media = document.getElementById('lbMedia');
        if (media) media.innerHTML = '';
      }
    }
  }

  async function fetchState() {
    const res = await fetch('/api/state');
    const data = await res.json();
    state.settings = data.settings;
    state.entries = data.entries || [];
    renderAll();
  }

  function renderAll() {
    renderHeroAndPrizes();
    renderAdBanners();
    renderOfficialWinner();
    renderLeaderboard();
    renderGallery();
  }

  function renderHeroAndPrizes() {
    const s = state.settings;
    if (!s) return;
    document.getElementById('contestTitle').textContent = s.title;
    document.getElementById('contestSubtitle').textContent = s.subtitle;
    document.getElementById('heroDateBadge').textContent = `${s.eventDate || '2026'} • Contest Live`;
    document.getElementById('prizeFirst').textContent = s.prizes?.first || '₹5,000';
    document.getElementById('prizeSecond').textContent = s.prizes?.second || '₹2,500';
    document.getElementById('prizeThird').textContent = s.prizes?.third || '₹1,000';
  }

  function renderAdBannerHtml(sponsor, adsenseId) {
    const safeUrl = sponsor.url && sponsor.url.startsWith('http') ? sponsor.url : '#';
    const targetAttr = safeUrl.startsWith('http') ? 'target="_blank" rel="noopener noreferrer"' : '';
    const adsenseNote = adsenseId
      ? `<div class="adsense-badge">Google AdSense Connected: <code>${escapeHtml(adsenseId)}</code></div>`
      : '';

    return `
      <div class="ad-banner">
        <div class="ad-info">
          <span class="ad-badge">${escapeHtml(sponsor.badge || 'Sponsored')}</span>
          <strong>${escapeHtml(sponsor.name)}</strong>
          <p>${escapeHtml(sponsor.tagline)}</p>
          ${adsenseNote}
        </div>
        <a class="ad-cta" href="${escapeHtml(safeUrl)}" ${targetAttr}>${escapeHtml(sponsor.cta || 'Learn More')}</a>
      </div>
    `;
  }

  function maybeLoadAdsense(clientId) {
    if (!clientId || !clientId.startsWith('ca-pub-')) return;
    if (document.getElementById('adsense-auto-script')) return;
    const sc = document.createElement('script');
    sc.id = 'adsense-auto-script';
    sc.async = true;
    sc.crossOrigin = 'anonymous';
    sc.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
    document.head.appendChild(sc);
  }

  function renderAdBanners() {
    const topSlot = document.getElementById('topAdSlot');
    const bottomSlot = document.getElementById('bottomAdSlot');
    const s = state.settings;
    if (!s || !s.adsEnabled || !s.sponsors || s.sponsors.length === 0) {
      topSlot.innerHTML = '';
      bottomSlot.innerHTML = '';
      return;
    }
    maybeLoadAdsense(s.adsenseClientId);
    topSlot.innerHTML = renderAdBannerHtml(s.sponsors[0], s.adsenseClientId);
    const secondSponsor = s.sponsors[1] || s.sponsors[0];
    bottomSlot.innerHTML = renderAdBannerHtml(secondSponsor, s.adsenseClientId);
  }

  function renderOfficialWinner() {
    const sec = document.getElementById('officialWinnerSection');
    const winnerId = state.settings?.winnerId;
    const winner = winnerId ? state.entries.find((e) => e.id === winnerId) : null;
    if (!winner) {
      sec.style.display = 'none';
      sec.innerHTML = '';
      return;
    }
    const thumb =
      winner.mediaType === 'video'
        ? `<video class="winner-thumb" src="${escapeHtml(winner.mediaUrl)}" muted></video>`
        : `<img class="winner-thumb" src="${escapeHtml(winner.mediaUrl)}" alt="${escapeHtml(winner.title)}" />`;

    sec.style.display = 'block';
    sec.innerHTML = `
      <div class="winner-spotlight">
        ${thumb}
        <div style="flex:1; min-width: 220px;">
          <div class="ad-badge">🏆 Official Contest Winner</div>
          <h3 style="margin-top:6px;">${escapeHtml(winner.title)}</h3>
          <p class="muted-text">Winner: <strong>${escapeHtml(winner.name)}</strong> • ${winner.votes} Votes • Prize: <strong>${escapeHtml(state.settings.prizes?.first || '₹5,000')}</strong></p>
        </div>
        <button type="button" class="btn btn-primary" data-lightbox="${escapeHtml(winner.id)}">View Winning Entry</button>
      </div>
    `;
  }

  function renderLeaderboard() {
    const grid = document.getElementById('leadersGrid');
    const top3 = [...state.entries].sort((a, b) => (b.votes || 0) - (a.votes || 0)).slice(0, 3);
    const medals = ['🥇', '🥈', '🥉'];
    const prizes = [
      state.settings?.prizes?.first || '₹5,000',
      state.settings?.prizes?.second || '₹2,500',
      state.settings?.prizes?.third || '₹1,000'
    ];

    if (top3.length === 0) {
      grid.innerHTML = '<p class="muted-text">No entries yet. Be the first to upload!</p>';
      return;
    }

    grid.innerHTML = top3
      .map((entry, idx) => {
        const mediaThumb =
          entry.mediaType === 'video'
            ? `<video class="leader-thumb" src="${escapeHtml(entry.mediaUrl)}" muted></video>`
            : `<img class="leader-thumb" src="${escapeHtml(entry.mediaUrl)}" alt="${escapeHtml(entry.title)}" />`;
        return `
          <div class="leader-card" data-lightbox="${escapeHtml(entry.id)}">
            <div class="leader-rank">${medals[idx]}</div>
            ${mediaThumb}
            <div class="leader-info">
              <h4>${escapeHtml(entry.title)}</h4>
              <span>${escapeHtml(entry.name)} • Prize ${escapeHtml(prizes[idx])}</span>
            </div>
            <div class="leader-votes">❤️ ${entry.votes || 0}</div>
          </div>
        `;
      })
      .join('');
  }

  function getFilteredEntries() {
    let list = [...state.entries];
    if (state.filterType !== 'all') {
      list = list.filter((e) => e.mediaType === state.filterType);
    }
    if (state.filterCategory !== 'all') {
      list = list.filter((e) => e.category === state.filterCategory);
    }
    if (state.sortBy === 'votes') {
      list.sort((a, b) => (b.votes || 0) - (a.votes || 0));
    } else {
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return list;
  }

  function renderGallery() {
    const grid = document.getElementById('galleryGrid');
    const countLabel = document.getElementById('entryCountLabel');
    const items = getFilteredEntries();
    countLabel.textContent = `Showing ${items.length} picnic ${items.length === 1 ? 'entry' : 'entries'}`;

    if (items.length === 0) {
      grid.innerHTML = '<p class="muted-text">No photos or videos match this filter yet. Upload one now!</p>';
      return;
    }

    const s = state.settings;
    const htmlParts = [];

    items.forEach((entry, index) => {
      const hasVoted = state.votedIds.has(entry.id);
      const isWinner = s?.winnerId === entry.id;
      const mediaTag =
        entry.mediaType === 'video'
          ? `<video src="${escapeHtml(entry.mediaUrl)}" controls preload="metadata" onclick="event.stopPropagation()"></video>`
          : `<img src="${escapeHtml(entry.mediaUrl)}" alt="${escapeHtml(entry.title)}" loading="lazy" />`;

      htmlParts.push(`
        <article class="entry-card">
          <div class="entry-media" data-lightbox="${escapeHtml(entry.id)}">
            ${mediaTag}
            <span class="media-pill">${entry.mediaType === 'video' ? '🎥 Video' : '📷 Photo'}</span>
            ${isWinner ? '<span class="winner-pill">🏆 Winner</span>' : ''}
          </div>
          <div class="entry-body">
            <span class="entry-cat">${escapeHtml(entry.category)}</span>
            <h3 class="entry-title">${escapeHtml(entry.title)}</h3>
            <div class="entry-footer">
              <span class="entry-author">By ${escapeHtml(entry.name)}</span>
              <button type="button" class="vote-btn ${hasVoted ? 'voted' : ''}" data-vote="${escapeHtml(entry.id)}">
                ${hasVoted ? '❤️' : '🤍'} <span>${entry.votes || 0}</span>
              </button>
            </div>
          </div>
        </article>
      `);

      // Inject a Native Sponsor / Ad Card after the 2nd item if Ads are enabled
      if (index === 1 && s?.adsEnabled && s?.sponsors?.length) {
        const sp = s.sponsors[1] || s.sponsors[0];
        const safeUrl = sp.url && sp.url.startsWith('http') ? sp.url : '#';
        const targetAttr = safeUrl.startsWith('http') ? 'target="_blank" rel="noopener noreferrer"' : '';
        htmlParts.push(`
          <aside class="native-ad-card">
            <div>
              <span class="ad-badge">${escapeHtml(sp.badge || 'Sponsored')}</span>
              <h3 style="margin-top:10px;">${escapeHtml(sp.name)}</h3>
              <p style="margin-top:6px;">${escapeHtml(sp.tagline)}</p>
            </div>
            <div>
              <a class="ad-cta" style="display:inline-block;" href="${escapeHtml(safeUrl)}" ${targetAttr}>${escapeHtml(sp.cta || 'Visit Sponsor')}</a>
              <p class="adsense-badge" style="margin-top:8px;">Native In-Feed Ad Slot (Editable in Admin)</p>
            </div>
          </aside>
        `);
      }
    });

    grid.innerHTML = htmlParts.join('');
  }

  async function toggleVote(entryId) {
    const alreadyVoted = state.votedIds.has(entryId);
    const action = alreadyVoted ? 'down' : 'up';
    const res = await fetch(`/api/entries/${encodeURIComponent(entryId)}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    if (!res.ok) return;
    const data = await res.json();
    if (alreadyVoted) {
      state.votedIds.delete(entryId);
    } else {
      state.votedIds.add(entryId);
    }
    saveVoted();

    const target = state.entries.find((e) => e.id === entryId);
    if (target) target.votes = data.votes;

    renderLeaderboard();
    renderGallery();
    if (state.lightboxEntryId === entryId) {
      openLightbox(entryId);
    }
  }

  function openLightbox(entryId) {
    const entry = state.entries.find((e) => e.id === entryId);
    if (!entry) return;
    state.lightboxEntryId = entryId;
    document.getElementById('lbTitle').textContent = entry.title;
    document.getElementById('lbMeta').textContent = `Uploaded by ${entry.name}`;
    document.getElementById('lbCategory').textContent = entry.category;
    document.getElementById('lbVotes').textContent = entry.votes || 0;

    const lbMedia = document.getElementById('lbMedia');
    lbMedia.innerHTML =
      entry.mediaType === 'video'
        ? `<video src="${escapeHtml(entry.mediaUrl)}" controls autoplay></video>`
        : `<img src="${escapeHtml(entry.mediaUrl)}" alt="${escapeHtml(entry.title)}" />`;

    openModal('lightboxModal');
  }

  // Event delegation for gallery votes & lightbox
  document.addEventListener('click', (e) => {
    const closeTarget = e.target.closest('[data-close]');
    if (closeTarget) {
      closeModal(closeTarget.getAttribute('data-close'));
      return;
    }

    if (e.target.classList.contains('modal-backdrop')) {
      closeModal(e.target.id);
      return;
    }

    const voteBtn = e.target.closest('[data-vote]');
    if (voteBtn) {
      e.stopPropagation();
      toggleVote(voteBtn.getAttribute('data-vote'));
      return;
    }

    const lbTrigger = e.target.closest('[data-lightbox]');
    if (lbTrigger) {
      openLightbox(lbTrigger.getAttribute('data-lightbox'));
    }
  });

  document.getElementById('lbVoteBtn').addEventListener('click', () => {
    if (state.lightboxEntryId) toggleVote(state.lightboxEntryId);
  });

  // Filters
  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.filterType = btn.getAttribute('data-type');
      renderGallery();
    });
  });

  document.getElementById('categoryFilter').addEventListener('change', (e) => {
    state.filterCategory = e.target.value;
    renderGallery();
  });

  document.getElementById('sortFilter').addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderGallery();
  });

  // Modal openers
  ['btnOpenUpload', 'btnHeroUpload'].forEach((id) => {
    document.getElementById(id).addEventListener('click', () => openModal('uploadModal'));
  });
  ['btnOpenEarnGuide', 'btnFooterEarn'].forEach((id) => {
    document.getElementById(id).addEventListener('click', () => openModal('earnModal'));
  });
  ['btnOpenAdmin', 'btnFooterAdmin'].forEach((id) => {
    document.getElementById(id).addEventListener('click', () => openModal('adminModal'));
  });
  document.getElementById('btnGuideToAdmin').addEventListener('click', () => {
    closeModal('earnModal');
    openModal('adminModal');
  });

  // Upload preview
  const mediaInput = document.getElementById('mediaInput');
  const uploadPreview = document.getElementById('uploadPreview');
  const dropzonePrompt = document.getElementById('dropzonePrompt');

  mediaInput.addEventListener('change', () => {
    const file = mediaInput.files && mediaInput.files[0];
    if (!file) {
      uploadPreview.style.display = 'none';
      dropzonePrompt.style.display = 'flex';
      return;
    }
    const url = URL.createObjectURL(file);
    dropzonePrompt.style.display = 'none';
    uploadPreview.style.display = 'block';
    if (file.type.startsWith('video/')) {
      uploadPreview.innerHTML = `<video src="${url}" controls muted></video>`;
    } else {
      uploadPreview.innerHTML = `<img src="${url}" alt="Preview" />`;
    }
  });

  // Submit upload
  document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = document.getElementById('uploadError');
    const submitBtn = document.getElementById('btnSubmitUpload');
    errBox.style.display = 'none';

    const form = e.target;
    const formData = new FormData(form);
    formData.set('consent', document.getElementById('consentCheck').checked ? 'true' : 'false');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading...';

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }
      form.reset();
      uploadPreview.style.display = 'none';
      uploadPreview.innerHTML = '';
      dropzonePrompt.style.display = 'flex';
      closeModal('uploadModal');
      await fetchState();
    } catch (err) {
      errBox.textContent = err.message;
      errBox.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit to Contest';
    }
  });

  // Admin Logic
  async function loadAdminDashboard() {
    const res = await fetch('/api/admin/entries', {
      headers: { 'x-admin-pin': state.adminPin }
    });
    if (!res.ok) return;
    const data = await res.json();
    renderAdminEntries(data.entries, data.settings.winnerId);
    fillAdminSettings(data.settings);
  }

  function renderAdminEntries(entries, winnerId) {
    const tbody = document.getElementById('adminEntriesBody');
    tbody.innerHTML = entries
      .map((entry) => {
        const thumb =
          entry.mediaType === 'video'
            ? `<video class="admin-thumb" src="${escapeHtml(entry.mediaUrl)}" muted></video>`
            : `<img class="admin-thumb" src="${escapeHtml(entry.mediaUrl)}" alt="" />`;
        const isWin = winnerId === entry.id;
        return `
          <tr>
            <td>${thumb}</td>
            <td>
              <strong>${escapeHtml(entry.title)}</strong><br/>
              <span class="muted-text">${escapeHtml(entry.category)} • ${escapeHtml(entry.mediaType)}</span>
            </td>
            <td>
              <strong>${escapeHtml(entry.name)}</strong><br/>
              <span class="muted-text">📞 ${escapeHtml(entry.phone || 'Not provided')}</span>
            </td>
            <td><strong>${entry.votes || 0}</strong></td>
            <td>
              <div class="admin-actions">
                <a class="btn btn-sm btn-outline" href="${escapeHtml(entry.mediaUrl)}" download>Download</a>
                <button type="button" class="btn btn-sm ${isWin ? 'btn-soft' : 'btn-primary'}" data-admin-winner="${escapeHtml(entry.id)}">
                  ${isWin ? '🏆 Winner' : 'Pick Winner'}
                </button>
                <button type="button" class="btn btn-sm btn-danger" data-admin-delete="${escapeHtml(entry.id)}">Delete</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  function fillAdminSettings(s) {
    document.getElementById('setTitle').value = s.title || '';
    document.getElementById('setSubtitle').value = s.subtitle || '';
    document.getElementById('setDate').value = s.eventDate || '';
    document.getElementById('setPrize1').value = s.prizes?.first || '';
    document.getElementById('setPrize2').value = s.prizes?.second || '';
    document.getElementById('setPrize3').value = s.prizes?.third || '';

    document.getElementById('setAdsEnabled').checked = Boolean(s.adsEnabled);
    document.getElementById('setAdsenseId').value = s.adsenseClientId || '';

    const sp1 = s.sponsors?.[0] || {};
    const sp2 = s.sponsors?.[1] || {};
    document.getElementById('sp1Name').value = sp1.name || '';
    document.getElementById('sp1Url').value = sp1.url || '';
    document.getElementById('sp1Tagline').value = sp1.tagline || '';
    document.getElementById('sp1Cta').value = sp1.cta || '';

    document.getElementById('sp2Name').value = sp2.name || '';
    document.getElementById('sp2Url').value = sp2.url || '';
    document.getElementById('sp2Tagline').value = sp2.tagline || '';
    document.getElementById('sp2Cta').value = sp2.cta || '';
  }

  document.getElementById('btnAdminLogin').addEventListener('click', async () => {
    const pin = document.getElementById('adminPinInput').value.trim();
    const errEl = document.getElementById('adminLoginError');
    errEl.style.display = 'none';

    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    if (!res.ok) {
      errEl.textContent = 'Incorrect PIN. Default PIN is 1234.';
      errEl.style.display = 'block';
      return;
    }
    state.adminPin = pin;
    document.getElementById('adminLoginBox').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';
    await loadAdminDashboard();
  });

  document.querySelectorAll('.admin-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.getAttribute('data-tab');
      document.querySelectorAll('.admin-panel').forEach((p) => {
        p.style.display = p.id === `tab-${target}` ? 'block' : 'none';
      });
    });
  });

  document.getElementById('adminEntriesBody').addEventListener('click', async (e) => {
    const winBtn = e.target.closest('[data-admin-winner]');
    if (winBtn) {
      const id = winBtn.getAttribute('data-admin-winner');
      const nextWinner = state.settings?.winnerId === id ? null : id;
      await fetch('/api/admin/winner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': state.adminPin },
        body: JSON.stringify({ winnerId: nextWinner })
      });
      await fetchState();
      await loadAdminDashboard();
      return;
    }

    const delBtn = e.target.closest('[data-admin-delete]');
    if (delBtn) {
      const id = delBtn.getAttribute('data-admin-delete');
      await fetch(`/api/admin/entries/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'x-admin-pin': state.adminPin }
      });
      await fetchState();
      await loadAdminDashboard();
    }
  });

  document.getElementById('adminSettingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPin = document.getElementById('setNewPin').value.trim();
    const payload = {
      title: document.getElementById('setTitle').value,
      subtitle: document.getElementById('setSubtitle').value,
      eventDate: document.getElementById('setDate').value,
      prizes: {
        first: document.getElementById('setPrize1').value,
        second: document.getElementById('setPrize2').value,
        third: document.getElementById('setPrize3').value
      }
    };
    if (newPin.length >= 4) payload.newPin = newPin;

    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-pin': state.adminPin },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      if (newPin.length >= 4) state.adminPin = newPin;
      document.getElementById('setNewPin').value = '';
      const msg = document.getElementById('settingsSavedMsg');
      msg.style.display = 'block';
      setTimeout(() => (msg.style.display = 'none'), 2500);
      await fetchState();
    }
  });

  document.getElementById('adminAdsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      adsEnabled: document.getElementById('setAdsEnabled').checked,
      adsenseClientId: document.getElementById('setAdsenseId').value.trim(),
      sponsors: [
        {
          id: 'sp-1',
          name: document.getElementById('sp1Name').value,
          url: document.getElementById('sp1Url').value,
          tagline: document.getElementById('sp1Tagline').value,
          cta: document.getElementById('sp1Cta').value,
          badge: 'Sponsored'
        },
        {
          id: 'sp-2',
          name: document.getElementById('sp2Name').value,
          url: document.getElementById('sp2Url').value,
          tagline: document.getElementById('sp2Tagline').value,
          cta: document.getElementById('sp2Cta').value,
          badge: 'Local Ad'
        }
      ]
    };
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-pin': state.adminPin },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const msg = document.getElementById('adsSavedMsg');
      msg.style.display = 'block';
      setTimeout(() => (msg.style.display = 'none'), 2500);
      await fetchState();
    }
  });

  fetchState();
})();
