// Shared code for every page: API calls, sidebar/top bar, helpers, animations.
const App = (() => {
  const API = '../api/';

  const icons = {
    home: '<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    userplus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    swap: '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    chart: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
    db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.7-4 3-9 3s-9-1.3-9-3M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/>',
    key: '<path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>'
  };
  const ic = n => `<svg class="i" viewBox="0 0 24 24">${icons[n]}</svg>`;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => Number(n || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

  // GET if no data is given, otherwise POST JSON. Returns parsed JSON or throws Error(message).
  async function api(path, data) {
    const opt = data ? {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)} : {};
    const res = await fetch(API + path, opt);
    let json = {};
    try { json = await res.json(); } catch (e) {}
    if (res.status === 401 && !location.pathname.endsWith('login.html')) {
      location.href = 'login.html';
      throw new Error('auth');
    }
    if (!res.ok || json.ok === false) throw new Error(json.error || 'Something went wrong. Please try again.');
    return json;
  }

  function alertBox(el, type, html) {
    el.innerHTML = `<div class="alert ${type === 'ok' ? 'ok' : 'err'}">${html}</div>`;
  }

  function onError(e) {
    if (e && e.message === 'auth') return;
    const page = document.getElementById('page');
    if (page) page.insertAdjacentHTML('afterbegin', `<div class="alert err">${esc(e.message)}</div>`);
    console.error(e);
  }

  function animate() {
    document.querySelectorAll('tbody tr').forEach((r, i) => r.style.animationDelay = Math.min(i * .04, .8) + 's');
    document.querySelectorAll('.tile,.stat').forEach((e, i) => e.style.animationDelay = i * .07 + 's');
    document.querySelectorAll('[data-count]').forEach(e => {
      const t = +e.dataset.count, d = e.dataset.dec ? 2 : 0, s = t / 40;
      let n = 0;
      const f = () => {
        n = Math.min(n + s, t);
        e.textContent = n.toLocaleString(undefined, {minimumFractionDigits: d, maximumFractionDigits: d});
        if (n < t) requestAnimationFrame(f);
      };
      f();
    });
  }

  function buildShell(user, title) {
    const here = location.pathname.split('/').pop();
    const links = [
      ['dashboard.html', 'Dashboard', 'home'],
      ['register_customer.html', 'New Customer', 'userplus'],
      ['customers.html', 'Customers', 'users'],
      ['transaction.html', 'Deposit / Withdraw', 'swap'],
      ['transactions.html', 'Transaction History', 'file']
    ];
    if (user.role !== 'teller') links.push(['reports.html', 'Reports', 'chart']);
    if (user.role === 'admin') links.push(['add_staff.html', 'Manage Staff', 'shield'], ['backup.html', 'Backup', 'db']);
    const nl = ([f, label, icon]) => `<a href="${f}"${here === f ? ' class="active"' : ''}>${ic(icon)}${label}</a>`;

    document.body.insertAdjacentHTML('afterbegin', `
<div class="shell">
  <div class="ov" id="ov"></div>
  <aside class="side">
    <div class="brand"><img src="logo.svg" alt="CRE BANK">CRE BANK</div>
    ${links.map(nl).join('')}
    <div class="sp"></div>
    ${nl(['change_password.html', 'Change Password', 'key'])}
    <a href="#" id="logout">${ic('logout')}Logout</a>
  </aside>
  <main class="main">
    <header class="top">
      <div class="menu" id="menu">${ic('menu')}</div><span class="pt">${esc(title)}</span>
      <div class="who"><div>${esc(user.full_name)}<small>${esc(user.role)}</small></div><div class="av">${esc(user.full_name.charAt(0).toUpperCase())}</div></div>
    </header>
    <div class="content"></div>
  </main>
</div>`);
    document.querySelector('.content').appendChild(document.getElementById('page'));
    document.getElementById('ov').onclick = () => document.body.classList.remove('open');
    document.getElementById('menu').onclick = () => document.body.classList.toggle('open');
    document.getElementById('logout').onclick = async e => {
      e.preventDefault();
      try { await api('logout.php'); } catch (err) {}
      location.href = 'login.html';
    };
    document.body.classList.add('ready');
  }

  // opts: {title, access}  access = 'manager' (admin+manager) | 'admin' | undefined (any staff)
  async function init(opts) {
    const {user} = await api('me.php');
    if ((opts.access === 'manager' && user.role === 'teller') || (opts.access === 'admin' && user.role !== 'admin')) {
      location.href = 'dashboard.html';
      throw new Error('auth');
    }
    document.title = opts.title + ' | CRE BANK';
    buildShell(user, opts.title);
    return user;
  }

  return {api, init, esc, money, ic, animate, alertBox, onError};
})();
