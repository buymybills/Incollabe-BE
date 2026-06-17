// Self-contained checkout page (inline CSS + vanilla JS). Served by the backend
// at /api/checkout/:token. Same-origin with /api/bot-checkout/* so no CORS.

export interface PageLineItem {
  title: string;
  size: string;
  priceInr: number;
  qty: number;
}

export interface PageProduct {
  title: string;
  size: string;
  priceInr: number;
  // When present, the order summary shows a multi-item cart instead of one product.
  items?: PageLineItem[];
}

const SHELL = (inner: string) => `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<meta name="theme-color" content="#0b0b0f"/>
<title>The Souled Store · Checkout</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
  :root{
    --ink:#0b0b0f; --body:#1f2430; --sub:#6b7280; --faint:#9ca3af;
    --line:#eceef2; --line2:#e2e5eb; --bg:#f4f5f7; --card:#ffffff;
    --brand:#0b0b0f; --accent:#4f46e5; --accent-soft:#eef0ff;
    --ok:#16a34a; --ok-soft:#ecfdf3; --danger:#e11d48;
    --shadow:0 1px 2px rgba(16,24,40,.04),0 6px 20px rgba(16,24,40,.06);
    --shadow-lg:0 10px 40px rgba(16,24,40,.12);
    --radius:18px;
  }
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  html,body{margin:0}
  body{
    font-family:'Inter',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
    background:var(--bg);color:var(--body);
    -webkit-font-smoothing:antialiased;line-height:1.45;
  }
  .topbar{
    position:sticky;top:0;z-index:20;background:rgba(255,255,255,.85);
    backdrop-filter:saturate(180%) blur(12px);border-bottom:1px solid var(--line);
  }
  .topbar .row{max-width:480px;margin:0 auto;padding:13px 18px;display:flex;align-items:center;gap:10px}
  .logo{width:30px;height:30px;border-radius:9px;background:var(--brand);color:#fff;display:grid;place-items:center;font-weight:800;font-size:14px;letter-spacing:-.5px}
  .brand-name{font-weight:700;font-size:15px;letter-spacing:-.2px;color:var(--ink)}
  .brand-sub{font-size:11px;color:var(--faint);margin-top:-2px;font-weight:500}
  .lock{margin-left:auto;display:flex;align-items:center;gap:5px;font-size:11px;color:var(--ok);font-weight:600}

  .wrap{max-width:480px;margin:0 auto;padding:18px 16px 120px}
  .step{font-size:12px;font-weight:700;color:var(--faint);text-transform:uppercase;letter-spacing:.6px;margin:6px 2px 10px}

  .card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden}
  .card+.card{margin-top:16px}
  .pad{padding:18px}

  /* order summary */
  .order .item{display:flex;gap:14px;align-items:center}
  /* vertical space + divider between cart line items */
  #p-items{display:flex;flex-direction:column;gap:18px}
  #p-items .item + .item{padding-top:18px;border-top:1px solid var(--line2)}
  /* coupon */
  .coupon{display:flex;gap:8px;margin:14px 0 0}
  .coupon input{flex:1;padding:11px 12px;border:1.5px solid var(--line2);border-radius:11px;font-size:14px;text-transform:uppercase;font-family:inherit;color:var(--ink);outline:none}
  .coupon input:focus{border-color:var(--ink)}
  .coupon button{padding:0 16px;border:none;border-radius:11px;background:var(--ink);color:#fff;font-weight:700;font-size:13.5px;cursor:pointer}
  .coupon button:disabled{opacity:.5;cursor:default}
  .coupon-msg{font-size:12.5px;margin-top:7px;min-height:0;font-weight:600}
  .coupon-msg.ok{color:var(--ok)}
  .coupon-msg.bad{color:#d33}
  .thumb{width:54px;height:54px;border-radius:13px;background:linear-gradient(135deg,#1a1a22,#3a3a4a);color:#fff;display:grid;place-items:center;font-size:22px;flex:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)}
  .item .info{flex:1;min-width:0}
  .item .name{font-weight:700;font-size:15px;color:var(--ink);line-height:1.25}
  .item .vary{font-size:12.5px;color:var(--sub);margin-top:3px;display:flex;flex-wrap:wrap;gap:6px}
  .chip{background:var(--bg);border:1px solid var(--line2);border-radius:999px;padding:2px 9px;font-size:11.5px;font-weight:600;color:var(--body)}
  .qty{font-size:12.5px;color:var(--sub);font-weight:600}
  .price-now{font-weight:800;font-size:15px;color:var(--ink);white-space:nowrap}

  .breakdown{margin-top:16px;border-top:1px dashed var(--line2);padding-top:14px;display:grid;gap:9px}
  .ln{display:flex;justify-content:space-between;font-size:13.5px;color:var(--sub)}
  .ln b{color:var(--body);font-weight:600}
  .ln .free{color:var(--ok);font-weight:700}
  .total{display:flex;justify-content:space-between;align-items:baseline;margin-top:13px;padding-top:13px;border-top:1px solid var(--line)}
  .total .lab{font-weight:700;font-size:15px;color:var(--ink)}
  .total .amt{font-weight:800;font-size:20px;color:var(--ink);letter-spacing:-.3px}

  /* address */
  .head{display:flex;justify-content:space-between;align-items:center;margin:2px 2px 10px}
  .head h2{font-size:14px;font-weight:700;color:var(--ink);margin:0}
  .addr{display:flex;gap:12px;padding:15px;border:1.5px solid var(--line2);border-radius:15px;margin-bottom:11px;cursor:pointer;align-items:flex-start;background:var(--card);transition:border-color .18s,box-shadow .18s,background .18s;position:relative}
  .addr:hover{border-color:#c7cbd6}
  .addr.sel{border-color:var(--ink);box-shadow:0 0 0 3px rgba(11,11,15,.06)}
  .addr .tick{width:20px;height:20px;border-radius:50%;border:2px solid #cfd3dc;flex:none;margin-top:2px;display:grid;place-items:center;transition:border-color .18s,background .18s}
  .addr.sel .tick{border-color:var(--ink);background:var(--ink)}
  .addr .tick svg{opacity:0;transition:opacity .15s}
  .addr.sel .tick svg{opacity:1}
  .addr input[type=radio]{position:absolute;opacity:0;pointer-events:none}
  .addr .meta{flex:1;font-size:13.5px;min-width:0}
  .addr .meta .ttl{font-weight:700;color:var(--ink);display:flex;align-items:center;gap:7px}
  .addr .meta .who{margin-top:3px;color:var(--body);font-weight:500}
  .addr .meta .full{margin-top:2px;color:var(--sub);line-height:1.4}
  .badge{font-size:10px;background:var(--accent-soft);color:var(--accent);padding:2px 7px;border-radius:6px;font-weight:700;text-transform:uppercase;letter-spacing:.4px}
  .del{background:none;border:none;cursor:pointer;color:var(--faint);padding:4px;border-radius:8px;flex:none;transition:color .15s,background .15s}
  .del:hover{color:var(--danger);background:#fef2f2}

  /* add form */
  .addform{border:1.5px dashed var(--line2);border-radius:15px;padding:16px;margin-bottom:12px;background:#fcfcfd}
  .addform .ft{font-weight:700;margin-bottom:13px;font-size:14px;color:var(--ink)}
  .fld{position:relative;margin-bottom:10px}
  .fld label{position:absolute;left:13px;top:11px;font-size:13.5px;color:var(--faint);pointer-events:none;transition:.15s;background:#fcfcfd;padding:0 4px}
  input,textarea{width:100%;padding:13px 13px;border:1.5px solid var(--line2);border-radius:11px;font-size:14px;font-family:inherit;color:var(--ink);outline:none;background:#fff;transition:border-color .15s,box-shadow .15s}
  input::placeholder{color:var(--faint)}
  input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
  .two{display:flex;gap:10px}
  .two>*{flex:1;min-width:0}
  /* vertical rhythm between fields/rows in the add-address form */
  .addform input{margin-bottom:11px}
  .addform .two input{margin-bottom:0}
  .addform .two{margin-bottom:11px}

  /* buttons */
  button{font-family:inherit}
  .btn{background:var(--brand);color:#fff;border:none;border-radius:13px;padding:15px 16px;font-weight:700;font-size:15px;cursor:pointer;width:100%;transition:transform .08s,opacity .15s,box-shadow .15s;box-shadow:0 6px 18px rgba(11,11,15,.18)}
  .btn:active{transform:scale(.985)}
  .btn[disabled]{opacity:.45;box-shadow:none;cursor:not-allowed}
  .ghost{background:#fff;color:var(--body);border:1.5px solid var(--line2);border-radius:13px;padding:14px 16px;font-weight:600;cursor:pointer}
  .ghost:active{transform:scale(.985)}
  .link{background:none;border:none;color:var(--accent);font-weight:700;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:4px;padding:4px}

  /* sticky pay bar */
  .paybar{position:fixed;left:0;right:0;bottom:0;z-index:30;background:rgba(255,255,255,.92);backdrop-filter:saturate(180%) blur(14px);border-top:1px solid var(--line);padding:12px 16px calc(12px + env(safe-area-inset-bottom));box-shadow:0 -6px 24px rgba(16,24,40,.07)}
  .paybar .inner{max-width:480px;margin:0 auto;display:flex;align-items:center;gap:14px}
  .paybar .tot{flex:none}
  .paybar .tot .k{font-size:11px;color:var(--faint);font-weight:600;text-transform:uppercase;letter-spacing:.4px}
  .paybar .tot .v{font-size:19px;font-weight:800;color:var(--ink);letter-spacing:-.3px;line-height:1.1}
  .paybar .btn{flex:1;width:auto}
  .note{display:flex;align-items:center;justify-content:center;gap:7px;color:var(--faint);font-size:11.5px;margin-top:18px;font-weight:500}
  .note .pills{display:flex;gap:5px}
  .note .p{background:#fff;border:1px solid var(--line2);border-radius:6px;padding:2px 7px;font-weight:700;font-size:10px;color:var(--sub)}

  /* skeleton */
  .sk{border-radius:12px;background:linear-gradient(90deg,#eceef2 25%,#f5f6f8 37%,#eceef2 63%);background-size:400% 100%;animation:sh 1.3s ease-in-out infinite}
  @keyframes sh{0%{background-position:100% 0}100%{background-position:-100% 0}}
  .sk-addr{height:84px;margin-bottom:11px}

  .center{text-align:center;color:var(--sub)}
  .fade{animation:fade .35s ease both}
  @keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  .pop{animation:pop .4s cubic-bezier(.2,.9,.3,1.2) both}
  @keyframes pop{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:none}}

  /* states */
  .state{text-align:center;padding:34px 22px}
  .state .ic{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;margin:0 auto 16px;font-size:30px}
  .state .ic.ok{background:var(--ok-soft)}
  .state .ic.bad{background:#fef2f2}
  .state h2{font-size:18px;font-weight:800;color:var(--ink);margin:0 0 8px}
  .state p{color:var(--sub);font-size:14px;margin:0}
  .empty{padding:8px 4px 2px;text-align:center;color:var(--sub);font-size:13px}
</style></head>
<body>
  <div class="topbar"><div class="row">
    <div class="logo">TSS</div>
    <div><div class="brand-name">The Souled Store</div><div class="brand-sub">Secure checkout</div></div>
    <div class="lock">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      Secure
    </div>
  </div></div>
  <div class="wrap">${inner}</div>
</body></html>`;

export function renderInvalidPage(): string {
  return SHELL(
    `<div class="card fade"><div class="state">
      <div class="ic bad">⚠️</div>
      <h2>This checkout link has expired</h2>
      <p>Head back to Instagram and tap “Buy it” again to get a fresh, secure link.</p>
    </div></div>`,
  );
}

export function renderCheckoutPage(token: string, product: PageProduct): string {
  const data = JSON.stringify({ token, product }).replace(/</g, '\\u003c');
  const inner = `
  <div class="step">Order summary</div>
  <div class="card order fade"><div class="pad">
    <div id="p-items"></div>
    <div class="coupon">
      <input id="couponInput" type="text" placeholder="Coupon code" autocomplete="off" autocapitalize="characters" />
      <button id="couponBtn" type="button">Apply</button>
    </div>
    <div id="couponMsg" class="coupon-msg"></div>
    <div class="breakdown">
      <div class="ln"><span>Subtotal</span><b id="p-sub"></b></div>
      <div class="ln" id="p-disc-row" style="display:none"><span id="p-disc-lab">Discount</span><b id="p-disc" class="free"></b></div>
      <div class="ln"><span>Delivery</span><span class="free">FREE</span></div>
    </div>
    <div class="total"><span class="lab">Total</span><span class="amt" id="p-total"></span></div>
  </div></div>

  <div class="step">Delivery details</div>
  <div class="head"><h2>Delivery address</h2><button class="link" id="addNewBtn" style="display:none">+ Add new</button></div>
  <div id="addrList"></div>
  <div id="addForm"></div>

  <p class="note">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
    Secured by Razorpay
    <span class="pills"><span class="p">UPI</span><span class="p">Cards</span><span class="p">Netbanking</span></span>
  </p>

  <div class="paybar"><div class="inner">
    <div class="tot"><div class="k">Total</div><div class="v" id="bar-total"></div></div>
    <button class="btn" id="payBtn" disabled>Pay</button>
  </div></div>

  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
  (function(){
    var BOOT = ${data};
    var TOKEN = BOOT.token, PRODUCT = BOOT.product;
    var fmt = function(n){ return '₹' + Number(n||0).toLocaleString('en-IN'); };
    var state = { addresses: [], selectedId: null, adding: false, contact: {name:'',email:'',mobile:''}, loading: true };
    var $ = function(id){ return document.getElementById(id); };
    var TICK = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

    // Cart checkout shows every line; single-item checkout shows one row.
    var LINES = (PRODUCT.items && PRODUCT.items.length)
      ? PRODUCT.items
      : [{ title: PRODUCT.title, size: PRODUCT.size, priceInr: PRODUCT.priceInr, qty: 1 }];
    var TOTAL = LINES.reduce(function(s, it){ return s + Number(it.priceInr||0) * Math.max(1, Number(it.qty||1)); }, 0);

    $('p-items').innerHTML = LINES.map(function(it){
      var qty = Math.max(1, Number(it.qty||1));
      var lineTotal = Number(it.priceInr||0) * qty;
      return '<div class="item">'+
        '<div class="thumb">🛍️</div>'+
        '<div class="info">'+
          '<div class="name">'+esc(it.title||'Your order')+'</div>'+
          '<div class="vary">'+(it.size ? '<span class="chip">Size '+esc(it.size)+'</span>' : '')+'<span class="qty">Qty '+qty+'</span></div>'+
        '</div>'+
        '<div class="price-now">'+fmt(lineTotal)+'</div>'+
      '</div>';
    }).join('');
    // Coupon state — discount is recomputed server-side at /order and /verify;
    // this is just the display.
    var couponCode = null, discount = 0;
    function netTotal(){ return Math.max(0, TOTAL - discount); }
    function renderTotals(){
      $('p-sub').textContent = fmt(TOTAL);
      if (discount > 0) {
        $('p-disc-row').style.display = 'flex';
        $('p-disc-lab').textContent = 'Discount' + (couponCode ? ' (' + couponCode + ')' : '');
        $('p-disc').textContent = '− ' + fmt(discount);
      } else {
        $('p-disc-row').style.display = 'none';
      }
      $('p-total').textContent = fmt(netTotal());
      $('bar-total').textContent = fmt(netTotal());
      $('payBtn').textContent = 'Pay ' + fmt(netTotal());
    }
    renderTotals();

    $('couponBtn').addEventListener('click', function(){
      var code = ($('couponInput').value || '').trim().toUpperCase();
      var msg = $('couponMsg');
      if (!code) { msg.className = 'coupon-msg'; msg.textContent = ''; return; }
      $('couponBtn').disabled = true; $('couponBtn').textContent = '…';
      api('/apply-coupon', { method:'POST', body: JSON.stringify({ token: TOKEN, code: code }) })
        .then(function(r){
          if (r && r.valid) {
            couponCode = r.code || code; discount = Number(r.discountInr) || 0;
            msg.className = 'coupon-msg ok'; msg.textContent = (r.label || 'Applied') + ' — you save ' + fmt(discount);
          } else {
            couponCode = null; discount = 0;
            msg.className = 'coupon-msg bad'; msg.textContent = (r && r.reason) || 'Invalid code';
          }
          renderTotals();
        })
        .catch(function(){ couponCode = null; discount = 0; msg.className = 'coupon-msg bad'; msg.textContent = 'Could not apply code'; renderTotals(); })
        .then(function(){ $('couponBtn').disabled = false; $('couponBtn').textContent = 'Apply'; });
    });

    function api(path, init){
      return fetch('/api/bot-checkout' + path, Object.assign({ headers:{'Content-Type':'application/json'} }, init||{}))
        .then(function(r){
          return r.json().catch(function(){return {};}).then(function(j){ return { ok: r.ok, status: r.status, body: j }; });
        })
        .then(function(res){
          var j = res.body;
          var data = (j && typeof j==='object' && 'data' in j) ? j.data : j;
          // Propagate auth / validation errors so callers can react
          if (!res.ok || (data && data.error)) {
            var err = new Error((data && (data.error || data.message)) || 'request_failed');
            err.status = res.status;
            throw err;
          }
          return data;
        });
    }

    function showExpired(){
      document.querySelector('.paybar') && document.querySelector('.paybar').remove();
      document.querySelector('.wrap').innerHTML =
        '<div class="card fade"><div class="state">'+
        '<div class="ic bad">⚠️</div>'+
        '<h2>This checkout link has expired</h2>'+
        '<p>Head back to Instagram and tap "Buy it" again to get a fresh, secure link.</p>'+
        '</div></div>';
    }
    function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

    function skeleton(){
      $('addrList').innerHTML = '<div class="sk sk-addr"></div><div class="sk sk-addr"></div>';
    }

    function renderAddresses(){
      var L = $('addrList'); L.innerHTML = '';
      if(state.loading){ skeleton(); return; }
      if(!state.addresses.length && !state.adding){
        L.innerHTML = '<div class="empty">No saved addresses yet — add one to continue.</div>';
        return;
      }
      state.addresses.forEach(function(a){
        var sel = state.selectedId === a.id;
        var d = document.createElement('label');
        d.className = 'addr fade' + (sel ? ' sel' : '');
        d.innerHTML =
          '<input type="radio" name="addr" '+(sel?'checked':'')+'/>'+
          '<span class="tick">'+TICK+'</span>'+
          '<div class="meta"><div class="ttl">'+esc(a.label||'Address')+(a.isDefault?'<span class="badge">Default</span>':'')+'</div>'+
          '<div class="who">'+esc(a.name||'')+(a.mobile?' · '+esc(a.mobile):'')+'</div>'+
          '<div class="full">'+esc(a.line1)+(a.line2?', '+esc(a.line2):'')+', '+esc(a.city)+', '+esc(a.state)+' '+esc(a.pincode)+'</div></div>'+
          '<button class="del" title="Delete" aria-label="Delete address"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
        d.querySelector('input').addEventListener('change', function(){ state.selectedId = a.id; sync(); });
        d.querySelector('.del').addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); removeAddress(a.id); });
        L.appendChild(d);
      });
    }

    function renderAddForm(){
      var F = $('addForm');
      if(!state.adding){ F.innerHTML=''; return; }
      var c = state.contact;
      F.innerHTML =
        '<div class="addform fade"><div class="ft">Add a delivery address</div>'+
        '<div class="two"><input id="f-name" placeholder="Full name" value="'+esc(c.name)+'"/><input id="f-mobile" placeholder="Mobile number" inputmode="numeric" value="'+esc(c.mobile)+'"/></div>'+
        '<input id="f-email" placeholder="Email (optional)" inputmode="email" value="'+esc(c.email)+'"/>'+
        '<input id="f-line1" placeholder="Flat / House no, Building, Street"/>'+
        '<input id="f-line2" placeholder="Area, Landmark (optional)"/>'+
        '<div class="two"><input id="f-city" placeholder="City"/><input id="f-state" placeholder="State"/></div>'+
        '<div class="two"><input id="f-pincode" placeholder="Pincode" inputmode="numeric"/><input id="f-label" placeholder="Label (Home/Office)" value="Home"/></div>'+
        '<div style="display:flex;gap:10px;margin-top:8px">'+
        '<button class="btn" id="saveBtn" style="flex:1">Save address</button>'+
        (state.addresses.length ? '<button class="ghost" id="cancelBtn">Cancel</button>' : '')+
        '</div></div>';
      $('saveBtn').addEventListener('click', saveAddress);
      var cb = $('cancelBtn'); if(cb) cb.addEventListener('click', function(){ state.adding=false; sync(); });
    }

    function sync(){
      renderAddresses(); renderAddForm();
      $('addNewBtn').style.display = (!state.loading && state.addresses.length && !state.adding) ? '' : 'none';
      $('payBtn').disabled = !state.selectedId;
    }

    function load(){
      state.loading = true; sync();
      api('/customer?token=' + encodeURIComponent(TOKEN)).then(function(d){
        state.loading = false;
        state.addresses = (d && d.addresses) || [];
        var def = state.addresses.filter(function(a){return a.isDefault;})[0] || state.addresses[0];
        state.selectedId = def ? def.id : null;
        state.adding = state.addresses.length === 0;
        if(d && d.customer){ state.contact = {name:d.customer.name||'',email:d.customer.email||'',mobile:d.customer.mobile||''}; }
        sync();
      }).catch(function(err){
        state.loading = false;
        if(err && (err.status === 401 || (err.message && err.message.indexOf('invalid_token') !== -1))){
          showExpired();
        } else {
          state.adding = true; sync();
        }
      });
    }

    function saveAddress(){
      var g = function(id){ return ($(id)||{}).value || ''; };
      var addr = { label:g('f-label')||'Home', name:g('f-name'), mobile:g('f-mobile'),
        line1:g('f-line1'), line2:g('f-line2'), city:g('f-city'), state:g('f-state'), pincode:g('f-pincode') };
      state.contact = { name:g('f-name'), email:g('f-email'), mobile:g('f-mobile') };
      if(!addr.line1||!addr.city||!addr.state||!addr.pincode){ alert('Please fill address line, city, state and pincode.'); return; }
      if(!addr.name||!addr.mobile){ alert('Please add your name and mobile number.'); return; }
      $('saveBtn').disabled = true; $('saveBtn').textContent = 'Saving…';
      api('/address', { method:'POST', body: JSON.stringify({ token:TOKEN, contact:state.contact, address:addr }) }).then(function(j){
        if(j && j.address){ state.addresses.unshift(j.address); state.addresses.forEach(function(a){ if(a.id!==j.address.id) a.isDefault=false; });
          state.selectedId = j.address.id; state.adding = false; sync(); }
        else { alert('Couldn\\'t save that address. Please try again.'); var b=$('saveBtn'); if(b){b.disabled=false;b.textContent='Save address';} }
      });
    }

    function removeAddress(id){
      if(!confirm('Delete this address?')) return;
      api('/address/' + id, { method:'DELETE', body: JSON.stringify({ token:TOKEN }) }).then(function(j){
        if(j && j.deleted){ state.addresses = state.addresses.filter(function(a){return a.id!==id;});
          if(state.selectedId===id) state.selectedId = state.addresses[0] ? state.addresses[0].id : null;
          if(!state.addresses.length) state.adding = true; sync(); }
      });
    }

    function pay(){
      if(!state.selectedId){ alert('Please select or add a delivery address first.'); return; }
      if(!window.Razorpay){ alert('Payment is still loading, one moment…'); return; }
      $('payBtn').disabled = true; $('payBtn').textContent = 'Please wait…';
      api('/order', { method:'POST', body: JSON.stringify({ token:TOKEN, code: couponCode }) }).then(function(o){
        if(!o || !o.orderId){ alert('Couldn\\'t start the payment. Please try again.'); reset(); return; }
        var sel = state.addresses.filter(function(a){return a.id===state.selectedId;})[0] || {};
        var rzp = new window.Razorpay({
          key:o.keyId, order_id:o.orderId, amount:o.amount, currency:'INR',
          name:'The Souled Store', description: PRODUCT.title + (PRODUCT.size?(' · '+PRODUCT.size):''),
          prefill:{ name: sel.name||state.contact.name||'', email: state.contact.email||'', contact: sel.mobile||state.contact.mobile||'' },
          theme:{ color:'#0b0b0f' },
          handler: function(resp){
            api('/verify', { method:'POST', body: JSON.stringify(Object.assign({ token:TOKEN, addressId:state.selectedId, code: couponCode }, resp)) }).then(function(vj){
              if(vj && vj.ok) success(); else { alert('We couldn\\'t verify the payment. If money was deducted, our team will reach out.'); reset(); }
            });
          },
          modal:{ ondismiss: reset }
        });
        rzp.open();
      });
    }
    function reset(){ $('payBtn').disabled=false; $('payBtn').textContent='Pay '+fmt(netTotal()); }
    function success(){
      var bar = document.querySelector('.paybar'); if(bar) bar.remove();
      document.querySelector('.wrap').innerHTML =
        '<div class="card pop"><div class="state">'+
        '<div class="ic ok">✅</div>'+
        '<h2>Order confirmed!</h2>'+
        '<p>Payment of <b>'+fmt(netTotal())+'</b> for <b>'+esc(PRODUCT.title)+'</b> received.</p>'+
        '<p style="margin-top:10px">We\\'ve sent a confirmation to your Instagram. You can safely close this tab.</p>'+
        '</div></div>';
    }

    $('addNewBtn').addEventListener('click', function(){ state.adding = true; sync(); });
    $('payBtn').addEventListener('click', pay);
    load();
  })();
  </script>`;
  return SHELL(inner);
}
