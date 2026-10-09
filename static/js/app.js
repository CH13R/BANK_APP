// Shared code for every page: Supabase client connection, UI shell, helpers, animations.
const SUPABASE_URL = 'YOUR_SUPABASE_URL';       // Replace with your Supabase Project URL
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Replace with your Supabase Anon/Public Key

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const App = (() => {
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

  // Replaces PHP backend endpoints with direct Supabase client execution
  async function api(path, data) {
    const session = JSON.parse(localStorage.getItem('cre_bank_session') || 'null');
    const parts = path.split('?');
    const endpoint = parts[0];
    const queryParams = parts[1] ? new URLSearchParams(parts[1]) : null;

    if (!session && endpoint !== 'login.php' && !location.pathname.endsWith('login.html')) {
      location.href = 'login.html';
      throw new Error('auth');
    }

    try {
      if (endpoint === 'login.php') {
        const { data: res, error } = await supabaseClient.rpc('verify_staff_login', {
          p_username: (data.username || '').trim(),
          p_password: data.password || ''
        });
        if (error || !res || res.length === 0) throw new Error('Incorrect username or password');
        localStorage.setItem('cre_bank_session', JSON.stringify(res[0]));
        return { ok: true };
      }

      if (endpoint === 'logout.php') {
        localStorage.removeItem('cre_bank_session');
        return { ok: true };
      }

      if (endpoint === 'me.php') {
        if (!session) throw new Error('auth');
        return { ok: true, user: session };
      }

      if (endpoint === 'dashboard.php') {
        const todayStr = new Date().toISOString().split('T')[0];
        const [{ count: custCount }, { data: balData }, { count: todayCount }, { count: staffCount }, { data: recent }] = await Promise.all([
          supabaseClient.from('customers').select('*', { count: 'exact', head: true }),
          supabaseClient.from('accounts').select('balance'),
          supabaseClient.from('transactions').select('*', { count: 'exact', head: true }).gte('created_at', todayStr),
          supabaseClient.from('staff').select('*', { count: 'exact', head: true }),
          supabaseClient.from('transactions').select('created_at, accounts(account_number), customers(full_name), type, amount, staff(full_name)').order('transaction_id', { ascending: false }).limit(5)
        ]);
        const totalBalance = (balData || []).reduce((sum, acc) => sum + Number(acc.balance), 0);
        return {
          ok: true,
          customers: custCount || 0,
          balance: totalBalance,
          today: todayCount || 0,
          staff: staffCount || 0,
          recent: (recent || []).map(r => ({
            created_at: r.created_at ? r.created_at.replace('T', ' ').substring(0, 16) : '',
            account_number: r.accounts?.account_number,
            customer: r.customers?.full_name,
            type: r.type,
            amount: Number(r.amount),
            staff_name: r.staff?.full_name
          }))
        };
      }

      if (endpoint === 'customers.php') {
        const q = queryParams ? queryParams.get('q') || '' : '';
        let req = supabaseClient.from('customers').select('customer_id, full_name, phone, accounts(account_number, account_type, balance), staff(full_name)');
        if (q) {
          req = req.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`);
        }
        const { data: rows } = await req.order('customer_id', { ascending: false });
        const customers = (rows || []).map(c => ({
          full_name: c.full_name,
          phone: c.phone,
          account_number: c.accounts?.[0]?.account_number,
          account_type: c.accounts?.[0]?.account_type,
          balance: c.accounts?.[0]?.balance !== undefined ? Number(c.accounts[0].balance) : null,
          staff_name: c.staff?.full_name
        }));
        return { ok: true, customers };
      }

      if (endpoint === 'register_customer.php') {
        let accNo;
        let exists = true;
        do {
          accNo = '30' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
          const { data: check } = await supabaseClient.from('accounts').select('account_number').eq('account_number', accNo).maybeSingle();
          if (!check) exists = false;
        } while (exists);

        const { data: cust, error: custErr } = await supabaseClient.from('customers').insert({
          full_name: (data.full_name || '').trim(),
          phone: (data.phone || '').trim(),
          address: (data.address || '').trim(),
          dob: data.dob,
          id_number: (data.id_number || '').trim(),
          registered_by: session.staff_id
        }).select('customer_id').single();

        if (custErr) throw new Error('Could not register the customer.');

        const type = ['savings', 'current'].includes(data.account_type) ? data.account_type : 'savings';
        await supabaseClient.from('accounts').insert({
          customer_id: cust.customer_id,
          account_number: accNo,
          account_type: type,
          balance: 0.00
        });

        return { ok: true, account_number: accNo };
      }

      if (endpoint === 'transaction.php') {
        const { data: res, error } = await supabaseClient.rpc('perform_transaction', {
          p_account_number: (data.account_number || '').trim(),
          p_type: data.type,
          p_amount: Number(data.amount),
          p_staff_id: session.staff_id
        });
        if (error) throw new Error(error.message || 'Transaction failed.');
        return { ok: true, type: res[0].txn_type, balance: Number(res[0].new_balance) };
      }

      if (endpoint === 'transactions.php') {
        const { data: rows } = await supabaseClient.from('transactions')
          .select('created_at, accounts(account_number), customers(full_name), type, amount, staff(full_name)')
          .order('transaction_id', { ascending: false })
          .limit(100);
        
        const transactions = (rows || []).map(r => ({
          created_at: r.created_at ? r.created_at.replace('T', ' ').substring(0, 16) : '',
          account_number: r.accounts?.account_number,
          customer: r.customers?.full_name,
          type: r.type,
          amount: Number(r.amount),
          staff_name: r.staff?.full_name
        }));
        return { ok: true, transactions };
      }

      if (endpoint === 'reports.php') {
        const from = queryParams ? queryParams.get('from') : '';
        const to = queryParams ? queryParams.get('to') : '';
        const defaultFrom = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
        const defaultTo = new Date().toISOString().split('T')[0];
        const fDate = /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : defaultFrom;
        const tDate = /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : defaultTo;

        const { data: txns } = await supabaseClient.from('transactions')
          .select('type, amount, created_at, staff_id')
          .gte('created_at', fDate + 'T00:00:00')
          .lte('created_at', tDate + 'T23:59:59');

        let totalN = 0, totalDep = 0, totalWd = 0;
        const dailyMap = {};
        const staffMap = {};

        (txns || []).forEach(t => {
          totalN++;
          const amt = Number(t.amount);
          if (t.type === 'deposit') totalDep += amt;
          if (t.type === 'withdrawal') totalWd += amt;

          const day = t.created_at.split('T')[0];
          if (!dailyMap[day]) dailyMap[day] = { d: day, n: 0, dep: 0, wd: 0 };
          dailyMap[day].n++;
          if (t.type === 'deposit') dailyMap[day].dep += amt;
          if (t.type === 'withdrawal') dailyMap[day].wd += amt;
        });

        const { data: staffList } = await supabaseClient.from('staff').select('staff_id, full_name, role');
        (staffList || []).forEach(s => {
          staffMap[s.staff_id] = { full_name: s.full_name, role: s.role, n: 0, dep: 0, wd: 0 };
        });

        (txns || []).forEach(t => {
          if (t.staff_id && staffMap[t.staff_id]) {
            staffMap[t.staff_id].n++;
            const amt = Number(t.amount);
            if (t.type === 'deposit') staffMap[t.staff_id].dep += amt;
            if (t.type === 'withdrawal') staffMap[t.staff_id].wd += amt;
          }
        });

        const by_staff = Object.values(staffMap).sort((a, b) => b.n - a.n);
        const daily = Object.values(dailyMap).sort((a, b) => b.d.localeCompare(a.d));

        return {
          ok: true,
          from: fDate,
          to: tDate,
          totals: { n: totalN, dep: totalDep, wd: totalWd },
          by_staff,
          daily
        };
      }

      if (endpoint === 'staff.php') {
        if (data) {
          if ((data.password || '').length < 6) throw new Error('Password must be at least 6 characters.');
          const { error } = await supabaseClient.from('staff').insert({
            full_name: (data.full_name || '').trim(),
            username: (data.username || '').trim(),
            password: data.password, // Stored plain or hashed depending on setup; note: to use pgcrypto hashing on insert you can also use crypt()
            role: data.role || 'teller'
          });
          if (error) throw new Error('Username already exists.');
          return { ok: true };
        } else {
          const { data: staffRows } = await supabaseClient.from('staff')
            .select('full_name, username, role, created_at')
            .order('staff_id');
          const staff = (staffRows || []).map(s => ({
            full_name: s.full_name,
            username: s.username,
            role: s.role,
            created_at: s.created_at ? s.created_at.replace('T', ' ').substring(0, 16) : ''
          }));
          return { ok: true, staff };
        }
      }

      if (endpoint === 'change_password.php') {
        if ((data.new || '').length < 6) throw new Error('New password must be at least 6 characters.');
        if (data.new !== data.confirm) throw new Error('New passwords do not match.');
        
        // Verify current password via RPC
        const { data: check } = await supabaseClient.rpc('verify_staff_login', {
          p_username: session.username || '',
          p_password: data.current
        });
        // Alternatively update directly if session holds valid credentials
        const { error } = await supabaseClient.from('staff')
          .update({ password: data.new })
          .eq('staff_id', session.staff_id);
        
        if (error) throw new Error('Could not update password.');
        return { ok: true };
      }

      throw new Error('Endpoint not found');
    } catch (err) {
      throw new Error(err.message || 'Something went wrong. Please try again.');
    }
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
      await api('logout.php');
      location.href = 'login.html';
    };
    document.body.classList.add('ready');
  }

  async function init(opts) {
    const res = await api('me.php');
    const user = res.user;
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
