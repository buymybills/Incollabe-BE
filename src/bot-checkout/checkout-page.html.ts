// Self-contained checkout page (inline CSS + vanilla JS). Served by the backend
// at /api/checkout/:token. Same-origin with /api/bot-checkout/* so no CORS.

export interface PageProduct {
  title: string;
  size: string;
  priceInr: number;
}

const SHELL = (inner: string) => `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<title>The Souled Store · Checkout</title>
<style>
  :root{--ink:#111827;--sub:#6b7280;--line:#e5e7eb;--brand:#111827;--accent:#2563eb;--bg:#f9fafb}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--ink)}
  .wrap{max-width:460px;margin:0 auto;padding:24px 16px 60px}
  h1.t{font-weight:800;font-size:18px;margin:0 0 18px;text-align:center}
  .card{border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:18px;background:#fff}
  .eyebrow{font-size:12px;color:var(--sub);text-transform:uppercase;letter-spacing:.5px}
  .rowsb{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-top:6px}
  h2{font-size:15px;font-weight:700;margin:0}
  .head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
  .addr{display:flex;gap:12px;padding:14px;border:1px solid var(--line);border-radius:12px;margin-bottom:10px;cursor:pointer;align-items:flex-start;background:#fff}
  .addr.sel{border-color:var(--brand);background:#f3f4f6}
  .addr .meta{flex:1;font-size:14px}
  .badge{margin-left:8px;font-size:10px;background:#111827;color:#fff;padding:2px 6px;border-radius:6px;vertical-align:middle}
  .sub{color:var(--sub)}
  input{width:100%;padding:11px 12px;border:1px solid var(--line);border-radius:9px;font-size:14px;margin-bottom:8px;outline:none}
  .two{display:flex;gap:8px}
  .addform{border:1px dashed var(--line);border-radius:12px;padding:14px;margin-bottom:12px}
  button{font-family:inherit}
  .btn{background:var(--brand);color:#fff;border:none;border-radius:10px;padding:13px 16px;font-weight:700;font-size:15px;cursor:pointer;width:100%}
  .btn[disabled]{opacity:.5}
  .ghost{background:#fff;color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:13px 16px;font-weight:600;cursor:pointer;width:auto}
  .link{background:none;border:none;color:var(--accent);font-weight:600;cursor:pointer;font-size:13px}
  .del{background:none;border:none;cursor:pointer;font-size:16px;opacity:.6}
  .center{text-align:center;color:var(--sub)}
  .note{text-align:center;color:var(--sub);font-size:12px;margin-top:12px}
</style></head>
<body><div class="wrap"><h1 class="t">The Souled Store · Checkout</h1>${inner}</div></body></html>`;

export function renderInvalidPage(): string {
  return SHELL(
    `<div class="card"><div style="text-align:center;padding:24px 0">
      <h2>This checkout link is invalid or has expired</h2>
      <p class="sub">Please head back to Instagram and tap “Buy it” again to get a fresh link.</p>
    </div></div>`,
  );
}

export function renderCheckoutPage(token: string, product: PageProduct): string {
  const data = JSON.stringify({ token, product }).replace(/</g, '\\u003c');
  const inner = `
  <div class="card">
    <div class="eyebrow">Your order</div>
    <div class="rowsb">
      <div style="font-weight:600" id="p-title"></div>
      <div style="font-weight:700;white-space:nowrap" id="p-price"></div>
    </div>
  </div>
  <div class="head"><h2>Delivery address</h2><button class="link" id="addNewBtn" style="display:none">+ Add new</button></div>
  <div id="addrList"></div>
  <div id="addForm"></div>
  <button class="btn" id="payBtn" disabled>Pay</button>
  <p class="note">Secured by Razorpay · UPI, Cards, Netbanking</p>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
  (function(){
    var BOOT = ${data};
    var TOKEN = BOOT.token, PRODUCT = BOOT.product;
    var fmt = function(n){ return '₹' + Number(n||0).toLocaleString('en-IN'); };
    var state = { addresses: [], selectedId: null, adding: false, contact: {name:'',email:'',mobile:''} };
    var $ = function(id){ return document.getElementById(id); };
    $('p-title').textContent = PRODUCT.title + (PRODUCT.size ? ' · Size ' + PRODUCT.size : '');
    $('p-price').textContent = fmt(PRODUCT.priceInr);
    $('payBtn').textContent = 'Pay ' + fmt(PRODUCT.priceInr);

    function api(path, init){
      return fetch('/api/bot-checkout' + path, Object.assign({ headers:{'Content-Type':'application/json'} }, init||{}))
        .then(function(r){ return r.json().catch(function(){return {};}); })
        .then(function(j){ return (j && typeof j==='object' && 'data' in j) ? j.data : j; });
    }
    function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

    function renderAddresses(){
      var L = $('addrList'); L.innerHTML = '';
      state.addresses.forEach(function(a){
        var sel = state.selectedId === a.id;
        var d = document.createElement('label');
        d.className = 'addr' + (sel ? ' sel' : '');
        d.innerHTML =
          '<input type="radio" name="addr" '+(sel?'checked':'')+' style="margin-top:3px"/>'+
          '<div class="meta"><div style="font-weight:600">'+esc(a.label||'Address')+(a.isDefault?'<span class="badge">Default</span>':'')+'</div>'+
          '<div>'+esc(a.name||'')+(a.mobile?' · '+esc(a.mobile):'')+'</div>'+
          '<div class="sub">'+esc(a.line1)+(a.line2?', '+esc(a.line2):'')+', '+esc(a.city)+', '+esc(a.state)+' '+esc(a.pincode)+'</div></div>'+
          '<button class="del" title="Delete">🗑</button>';
        d.querySelector('input').addEventListener('change', function(){ state.selectedId = a.id; sync(); });
        d.querySelector('.del').addEventListener('click', function(e){ e.preventDefault(); removeAddress(a.id); });
        L.appendChild(d);
      });
    }

    function renderAddForm(){
      var F = $('addForm');
      if(!state.adding){ F.innerHTML=''; return; }
      var c = state.contact;
      F.innerHTML =
        '<div class="addform"><div style="font-weight:600;margin-bottom:10px;font-size:14px">Add a new address</div>'+
        '<div class="two"><input id="f-name" placeholder="Full name" value="'+esc(c.name)+'"/><input id="f-mobile" placeholder="Mobile number" value="'+esc(c.mobile)+'"/></div>'+
        '<input id="f-email" placeholder="Email (optional)" value="'+esc(c.email)+'"/>'+
        '<input id="f-line1" placeholder="Flat / House no, Building, Street"/>'+
        '<input id="f-line2" placeholder="Area, Landmark (optional)"/>'+
        '<div class="two"><input id="f-city" placeholder="City"/><input id="f-state" placeholder="State"/></div>'+
        '<div class="two"><input id="f-pincode" placeholder="Pincode"/><input id="f-label" placeholder="Label (Home/Office)" value="Home"/></div>'+
        '<div style="display:flex;gap:10px;margin-top:6px">'+
        '<button class="btn" id="saveBtn" style="flex:1">Save address</button>'+
        (state.addresses.length ? '<button class="ghost" id="cancelBtn">Cancel</button>' : '')+
        '</div></div>';
      $('saveBtn').addEventListener('click', saveAddress);
      var cb = $('cancelBtn'); if(cb) cb.addEventListener('click', function(){ state.adding=false; sync(); });
    }

    function sync(){
      renderAddresses(); renderAddForm();
      $('addNewBtn').style.display = (state.addresses.length && !state.adding) ? '' : 'none';
      $('payBtn').disabled = !state.selectedId;
    }

    function load(){
      api('/customer?token=' + encodeURIComponent(TOKEN)).then(function(d){
        state.addresses = (d && d.addresses) || [];
        var def = state.addresses.filter(function(a){return a.isDefault;})[0] || state.addresses[0];
        state.selectedId = def ? def.id : null;
        state.adding = state.addresses.length === 0;
        if(d && d.customer){ state.contact = {name:d.customer.name||'',email:d.customer.email||'',mobile:d.customer.mobile||''}; }
        sync();
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
      api('/order', { method:'POST', body: JSON.stringify({ token:TOKEN }) }).then(function(o){
        if(!o || !o.orderId){ alert('Couldn\\'t start the payment. Please try again.'); reset(); return; }
        var sel = state.addresses.filter(function(a){return a.id===state.selectedId;})[0] || {};
        var rzp = new window.Razorpay({
          key:o.keyId, order_id:o.orderId, amount:o.amount, currency:'INR',
          name:'The Souled Store', description: PRODUCT.title + (PRODUCT.size?(' · '+PRODUCT.size):''),
          prefill:{ name: sel.name||state.contact.name||'', email: state.contact.email||'', contact: sel.mobile||state.contact.mobile||'' },
          theme:{ color:'#111827' },
          handler: function(resp){
            api('/verify', { method:'POST', body: JSON.stringify(Object.assign({ token:TOKEN, addressId:state.selectedId }, resp)) }).then(function(vj){
              if(vj && vj.ok) success(); else { alert('We couldn\\'t verify the payment. If money was deducted, our team will reach out.'); reset(); }
            });
          },
          modal:{ ondismiss: reset }
        });
        rzp.open();
      });
    }
    function reset(){ $('payBtn').disabled=false; $('payBtn').textContent='Pay '+fmt(PRODUCT.priceInr); }
    function success(){
      document.querySelector('.wrap').innerHTML =
        '<h1 class="t">The Souled Store · Checkout</h1><div class="card"><div style="text-align:center;padding:32px 0">'+
        '<div style="font-size:48px">✅</div><h2 style="margin:12px 0 6px">Order confirmed!</h2>'+
        '<p class="sub">Payment of '+fmt(PRODUCT.priceInr)+' for <b>'+esc(PRODUCT.title)+'</b> received.</p>'+
        '<p class="sub" style="margin-top:8px">We\\'ve sent a confirmation to your Instagram. You can close this tab.</p></div></div>';
    }

    $('addNewBtn').addEventListener('click', function(){ state.adding = true; sync(); });
    $('payBtn').addEventListener('click', pay);
    load();
  })();
  </script>`;
  return SHELL(inner);
}
