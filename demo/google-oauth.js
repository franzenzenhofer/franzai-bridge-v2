// Google OAuth UI for FranzAI Bridge Demo
// Requires window.franzai.google API

const GoogleOAuth = (function() {
  let state = { authenticated: false, email: null, scopes: [] };
  let sites = [];
  let container = null;

  const SCOPES = {
    webmasters: { url: 'https://www.googleapis.com/auth/webmasters.readonly', name: 'Search Console', desc: 'Access search analytics, sitemaps, URL inspection' },
    analytics: { url: 'https://www.googleapis.com/auth/analytics.readonly', name: 'Analytics', desc: 'Access traffic data, user metrics, reports' }
  };

  function hasScope(scopeUrl) {
    return state.scopes.some(s => s === scopeUrl || s.includes(scopeUrl.split('/').pop()));
  }

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text) e.textContent = text;
    return e;
  }

  async function refreshState() {
    if (!window.franzai?.google) return;
    try {
      const result = await window.franzai.google.getState();
      if (result) {
        state = { authenticated: result.authenticated, email: result.email, scopes: result.scopes || [] };
      }
    } catch (e) { console.error('Failed to get Google state:', e); }
  }

  async function signIn() {
    if (!window.franzai?.google) return;
    const selectedScopes = [];
    const wcCheck = document.getElementById('scope-webmasters');
    const gaCheck = document.getElementById('scope-analytics');
    if (wcCheck?.checked) selectedScopes.push(SCOPES.webmasters.url);
    if (gaCheck?.checked) selectedScopes.push(SCOPES.analytics.url);
    if (selectedScopes.length === 0) selectedScopes.push(SCOPES.webmasters.url);

    try {
      await window.franzai.google.auth(selectedScopes);
      await refreshState();
      render();
    } catch (e) { showOutput({ error: e.message }, true); }
  }

  async function signOut() {
    if (!window.franzai?.google) return;
    try {
      await window.franzai.google.logout();
      state = { authenticated: false, email: null, scopes: [] };
      sites = [];
      render();
    } catch (e) { showOutput({ error: e.message }, true); }
  }

  async function listSites() {
    if (!window.franzai?.google) return;
    try {
      const resp = await window.franzai.google.fetch('https://www.googleapis.com/webmasters/v3/sites');
      const data = await resp.json();
      sites = (data.siteEntry || []).map(s => s.siteUrl);
      updateSiteSelect();
      showOutput(data);
    } catch (e) { showOutput({ error: e.message }, true); }
  }

  async function getSearchAnalytics() {
    if (!window.franzai?.google) return;
    const siteSelect = document.getElementById('google-site-select');
    const siteUrl = siteSelect?.value;
    if (!siteUrl) { showOutput({ error: 'Select a site first' }, true); return; }

    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    try {
      const resp = await window.franzai.google.fetch(
        'https://www.googleapis.com/webmasters/v3/sites/' + encodeURIComponent(siteUrl) + '/searchAnalytics/query',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startDate, endDate, dimensions: ['query'], rowLimit: 10 })
        }
      );
      showOutput(await resp.json());
    } catch (e) { showOutput({ error: e.message }, true); }
  }

  function updateSiteSelect() {
    const select = document.getElementById('google-site-select');
    if (!select) return;
    select.textContent = '';
    const defaultOpt = el('option', null, 'Select a site...');
    defaultOpt.value = '';
    select.appendChild(defaultOpt);
    sites.forEach(url => {
      const opt = el('option', null, url);
      opt.value = url;
      select.appendChild(opt);
    });
  }

  function showOutput(data, isError) {
    const output = document.getElementById('google-output');
    if (!output) return;
    output.className = 'google-output' + (isError ? ' error' : '');
    output.textContent = '';
    const pre = el('pre', null, JSON.stringify(data, null, 2));
    output.appendChild(pre);
  }

  function createScopeCheckbox(id, name, desc, checked) {
    const label = el('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.checked = checked;
    const textDiv = el('div');
    textDiv.appendChild(el('div', 'scope-name', name));
    textDiv.appendChild(el('div', 'scope-desc', desc));
    label.appendChild(checkbox);
    label.appendChild(textDiv);
    return label;
  }

  function render() {
    if (!container) return;
    container.textContent = '';

    // Header
    const header = el('div', 'google-header');
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '2');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4');
    icon.appendChild(path);
    header.appendChild(icon);
    header.appendChild(el('span', 'title', 'Google OAuth'));
    container.appendChild(header);

    const content = el('div', 'google-content');

    // Status
    const status = el('div', 'google-status');
    const dot = el('span', state.authenticated ? 'dot connected' : 'dot');
    status.appendChild(dot);
    if (state.authenticated) {
      status.appendChild(el('span', 'email', state.email || 'Connected'));
    } else {
      status.appendChild(el('span', 'not-connected', 'Not connected'));
    }
    content.appendChild(status);

    if (!state.authenticated) {
      // Scope checkboxes
      const checkboxes = el('div', 'scope-checkboxes');
      checkboxes.appendChild(createScopeCheckbox('scope-webmasters', 'Search Console', SCOPES.webmasters.desc, true));
      checkboxes.appendChild(createScopeCheckbox('scope-analytics', 'Analytics', SCOPES.analytics.desc, false));
      content.appendChild(checkboxes);

      // Sign in button
      const btnRow = el('div', 'google-btn-row');
      const signInBtn = el('button', 'google-btn primary', 'Sign in with Google');
      signInBtn.onclick = signIn;
      btnRow.appendChild(signInBtn);
      content.appendChild(btnRow);
    } else {
      // Granted scopes
      const badges = el('div', 'scope-granted');
      Object.entries(SCOPES).forEach(function(entry) {
        const scope = entry[1];
        const badge = el('span', 'scope-badge ' + (hasScope(scope.url) ? 'granted' : 'missing'));
        badge.textContent = (hasScope(scope.url) ? '\u2713 ' : '\u2717 ') + scope.name;
        badges.appendChild(badge);
      });
      content.appendChild(badges);

      // Buttons
      const btnRow = el('div', 'google-btn-row');
      const signOutBtn = el('button', 'google-btn', 'Sign Out');
      signOutBtn.onclick = signOut;
      btnRow.appendChild(signOutBtn);
      content.appendChild(btnRow);

      // API Test section
      if (hasScope(SCOPES.webmasters.url)) {
        const apiSection = el('div', 'api-test-section');
        apiSection.appendChild(el('div', 'api-test-header', 'Search Console API'));

        const apiContent = el('div', 'api-test-content');
        const select = el('select');
        select.id = 'google-site-select';
        const defaultOpt = el('option', null, 'Select a site...');
        defaultOpt.value = '';
        select.appendChild(defaultOpt);
        apiContent.appendChild(select);

        const btnRowApi = el('div', 'btn-row');
        const listBtn = el('button', 'google-btn', 'List Sites');
        listBtn.onclick = listSites;
        const analyticsBtn = el('button', 'google-btn primary', 'Get Search Analytics');
        analyticsBtn.onclick = getSearchAnalytics;
        btnRowApi.appendChild(listBtn);
        btnRowApi.appendChild(analyticsBtn);
        apiContent.appendChild(btnRowApi);

        apiSection.appendChild(apiContent);
        content.appendChild(apiSection);
        updateSiteSelect();
      }

      // Output
      const output = el('div', 'google-output');
      output.id = 'google-output';
      output.appendChild(el('pre', null, 'API responses will appear here'));
      content.appendChild(output);
    }

    container.appendChild(content);
  }

  async function init(parentElement) {
    container = parentElement;
    await refreshState();
    render();

    // Listen for auth updates
    window.addEventListener('message', function(ev) {
      if (ev.data?.source === 'FRANZAI_BRIDGE' && ev.data?.type === 'GOOGLE_AUTH_UPDATE') {
        refreshState().then(render);
      }
    });
  }

  return { init: init, render: render, refreshState: refreshState };
})();

window.GoogleOAuth = GoogleOAuth;
