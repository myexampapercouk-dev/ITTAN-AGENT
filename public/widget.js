/* ITTAN AI chat widget. Embed on any page:
 *   <script src="https://YOUR-AGENT-HOST/widget.js" defer></script>
 * Renders inside a Shadow DOM so the site's theme CSS cannot break it. */
(function () {
  if (window.__ittanChat) return;
  window.__ittanChat = true;

  var script = document.currentScript || document.querySelector('script[src*="widget.js"]');
  var API = new URL(script.src).origin;
  var STORE_KEY = 'ittan_chat_v1';

  function readState() {
    try { return JSON.parse(sessionStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  }
  function writeState() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage blocked */ }
  }
  var state = readState();
  state.log = state.log || [];

  var cfg = { assistantName: 'Assistant', welcomeMessage: 'Hi! How can I help you?', accentColor: '#b8860b', whatsappPhone: '' };

  var host = document.createElement('div');
  host.style.cssText = 'position:fixed;z-index:2147483000;bottom:0;right:0;';
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: 'open' });

  root.innerHTML =
    '<style>' +
    ':host{all:initial}' +
    '*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans",sans-serif}' +
    '.fab{position:fixed;right:20px;bottom:20px;width:60px;height:60px;border-radius:50%;border:0;cursor:pointer;background:var(--accent);color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;transition:transform .15s}' +
    '.fab:hover{transform:scale(1.06)}.fab svg{width:28px;height:28px}' +
    '.panel{position:fixed;right:20px;bottom:92px;width:380px;max-width:calc(100vw - 32px);height:600px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden;color:#1f1f1f}' +
    '.panel.open{display:flex}' +
    '.head{background:var(--accent);color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px}' +
    '.head .t{flex:1;min-width:0}.head b{display:block;font-size:15px}.head span{font-size:12px;opacity:.9}' +
    '.head button{background:rgba(255,255,255,.18);border:0;color:#fff;border-radius:8px;padding:6px 8px;cursor:pointer;font-size:12px}' +
    '.msgs{flex:1;overflow-y:auto;padding:14px;background:#faf7f2;display:flex;flex-direction:column;gap:10px}' +
    '.msgs>*{flex-shrink:0}' +
    '.m{max-width:85%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}' +
    '.m.bot{background:#fff;border:1px solid #eee3d3;align-self:flex-start;border-bottom-left-radius:4px}' +
    '.m.user{background:var(--accent);color:#fff;align-self:flex-end;border-bottom-right-radius:4px}' +
    '.m.err{background:#fdecea;color:#8a1c12;align-self:flex-start}' +
    '.m a{color:inherit;text-decoration:underline}' +
    '.typing{align-self:flex-start;color:#8a7a62;font-size:13px;padding:4px 6px}' +
    '.cards{display:flex;flex-direction:column;gap:8px;align-self:stretch}' +
    '.card{display:flex;gap:10px;background:#fff;border:1px solid #eee3d3;border-radius:12px;overflow:hidden;padding:8px}' +
    '.card img{flex:0 0 92px;width:92px;height:92px;object-fit:cover;background:#f3ede4;border-radius:8px;display:block;cursor:zoom-in}' +
    '.card .b{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}' +
    '.card .n{font-size:13.5px;font-weight:600;line-height:1.3}' +
    '.card .meta{font-size:11.5px;color:#7a6c58}' +
    '.card .p{font-size:14.5px;font-weight:700;color:#1f1f1f}.card .p s{font-weight:400;color:#9a8f80;font-size:12px;margin-left:5px}' +
    '.card a.wa{margin-top:auto;align-self:flex-start;background:#25d366;color:#fff;text-decoration:none;font-size:12px;font-weight:600;padding:5px 10px;border-radius:7px}' +
    '.more{align-self:stretch;border:1px solid var(--accent);background:#fff;color:var(--accent);border-radius:10px;padding:9px;font-size:13.5px;font-weight:600;cursor:pointer}' +
    '.more:disabled{opacity:.6;cursor:default}' +
    '.end{text-align:center;font-size:12.5px;color:#8a7a62;padding:4px 0}' +
    '.chips{display:flex;flex-wrap:wrap;gap:6px}' +
    '.chip{border:1px solid var(--accent);color:var(--accent);background:#fff;border-radius:16px;padding:6px 11px;font-size:13px;cursor:pointer}' +
    '.foot{border-top:1px solid #eee;padding:10px;display:flex;gap:8px;background:#fff}' +
    '.foot textarea{flex:1;resize:none;border:1px solid #ddd;border-radius:10px;padding:9px 11px;font-size:14px;max-height:100px;outline:none;color:#1f1f1f;background:#fff}' +
    '.foot textarea:focus{border-color:var(--accent)}' +
    '.foot button{border:0;background:var(--accent);color:#fff;border-radius:10px;padding:0 14px;cursor:pointer;font-size:14px;font-weight:600}' +
    '.foot button:disabled{opacity:.5;cursor:default}' +
    '.foot .cam{background:#fff;color:var(--accent);border:1px solid #ddd;padding:0 10px;display:flex;align-items:center}' +
    '.foot .cam svg{width:20px;height:20px}' +
    '.m.user img.up{display:block;max-width:180px;max-height:180px;border-radius:10px;margin-bottom:4px}' +
    '.m.user.photo{padding:5px}' +
    '.walink{display:block;text-align:center;font-size:12px;color:#128c7e;padding:4px 0 8px;background:#fff;text-decoration:none}' +
    '.zoom{position:fixed;inset:0;background:rgba(0,0,0,.85);display:none;align-items:center;justify-content:center;z-index:2}' +
    '.zoom.open{display:flex}.zoom img{max-width:92vw;max-height:88vh;border-radius:8px}' +
    '@media (max-width:480px){.panel{right:0;bottom:0;width:100vw;max-width:100vw;height:100%;max-height:100%;border-radius:0}.fab.hide{display:none}}' +
    '</style>' +
    '<button class="fab" aria-label="Chat with us"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>' +
    '<div class="panel" role="dialog" aria-label="Chat">' +
    '  <div class="head"><div class="t"><b class="name"></b><span>Usually replies instantly</span></div><button class="new" title="Start a new chat">New chat</button><button class="close" aria-label="Close">✕</button></div>' +
    '  <div class="msgs" aria-live="polite"></div>' +
    '  <a class="walink" target="_blank" rel="noopener" style="display:none">Prefer WhatsApp? Chat with our team →</a>' +
    '  <form class="foot"><button type="button" class="cam" aria-label="Upload a photo to find similar designs" title="Upload a photo to find similar designs"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></button><input type="file" accept="image/*" hidden><textarea rows="1" placeholder="Ask about designs, or send a photo…" maxlength="1000"></textarea><button type="submit" class="send">Send</button></form>' +
    '</div>' +
    '<div class="zoom"><img alt=""></div>';

  var $ = function (s) { return root.querySelector(s); };
  var fab = $('.fab'), panel = $('.panel'), msgs = $('.msgs'), form = $('.foot'), input = $('textarea'), sendBtn = $('.foot .send'), camBtn = $('.foot .cam'), fileInput = $('.foot input[type=file]'), walink = $('.walink'), zoom = $('.zoom');
  var busy = false;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function md(s) {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  }
  function inr(n) { return n == null ? '' : '₹' + Math.round(n).toLocaleString('en-IN'); }
  function waUrl(text) {
    var phone = (cfg.whatsappPhone || '').replace(/\D/g, '');
    return phone ? 'https://wa.me/' + phone + '?text=' + encodeURIComponent(text) : null;
  }
  function scroll() { msgs.scrollTop = msgs.scrollHeight; }

  function addBubble(role, text, image) {
    var d = document.createElement('div');
    d.className = 'm ' + role + (image ? ' photo' : '');
    d.innerHTML = (image ? '<img class="up" alt="Your photo" src="' + esc(image) + '">' : '') + md(text || '');
    msgs.appendChild(d);
    scroll();
    return d;
  }

  // `entry` is the saved log entry ({t:'cards', items, more}) so "Load more"
  // results survive a page reload.
  function addCards(items, more, entry) {
    var wrap = document.createElement('div');
    wrap.className = 'cards';
    msgs.appendChild(wrap);
    appendCards(wrap, items);
    if (more) addMoreButton(wrap, more, entry);
    else if (entry && entry.total && entry.items.length > 10) addEndNote(wrap, entry.total);
    // Show the top of the list (and the reply above it), not the last card.
    msgs.scrollTop += wrap.getBoundingClientRect().top - msgs.getBoundingClientRect().top - 140;
  }

  function addMoreButton(wrap, more, entry) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'more';
    var left = more.total - more.offset;
    btn.textContent = 'Load more (' + left + ' more design' + (left > 1 ? 's' : '') + ')';
    btn.onclick = function () {
      btn.disabled = true;
      btn.textContent = 'Loading…';
      fetch(API + '/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(more) })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          btn.remove();
          appendCards(wrap, res.items || []);
          if (entry) { entry.items = entry.items.concat(res.items || []); entry.more = res.more; entry.total = more.total; writeState(); }
          if (res.more) addMoreButton(wrap, res.more, entry);
          else addEndNote(wrap, more.total);
        })
        .catch(function () { btn.disabled = false; btn.textContent = 'Load more - try again'; });
    };
    wrap.appendChild(btn);
  }

  function addEndNote(wrap, total) {
    var n = document.createElement('div');
    n.className = 'end';
    n.textContent = "That's all " + total + ' designs. Ask me to narrow it down by budget or style.';
    wrap.appendChild(n);
  }

  function appendCards(wrap, items) {
    items.forEach(function (p) {
      var c = document.createElement('div');
      c.className = 'card';
      var wa = waUrl('Hi, I am interested in design ' + p.code + ' (' + p.title + (p.price != null ? ', ' + inr(p.price) : '') + '). Is it available?');
      c.innerHTML =
        (p.image ? '<img loading="lazy" src="' + esc(p.image) + '" alt="' + esc(p.title) + '">' : '') +
        '<div class="b"><div class="n">' + esc(p.title) + '</div>' +
        '<div class="meta">' + esc(p.code) + ' · ' + esc(p.purity) + (p.weightG ? ' · ' + p.weightG + ' g' : '') + '</div>' +
        '<div class="p">' + (p.price != null ? inr(p.price) : 'Price on request') + (p.compareAtPrice ? '<s>' + inr(p.compareAtPrice) + '</s>' : '') + '</div>' +
        (wa ? '<a class="wa" target="_blank" rel="noopener" href="' + esc(wa) + '">Enquire on WhatsApp</a>' : '') +
        '</div>';
      var img = c.querySelector('img');
      if (img) img.addEventListener('click', function () { zoom.querySelector('img').src = p.image.replace('-thumb.', '.'); zoom.classList.add('open'); });
      wrap.appendChild(c);
    });
  }

  function addChips() {
    var chips = ['📷 Find similar from a photo', 'Show me gold rings', 'Mangalsutra designs', 'Earrings under ₹30,000', 'Silver murti', 'Where is your store?'];
    var d = document.createElement('div');
    d.className = 'chips';
    chips.forEach(function (t, i) {
      var b = document.createElement('button');
      b.className = 'chip';
      b.type = 'button';
      b.textContent = t;
      b.onclick = i === 0 ? function () { fileInput.click(); } : function () { d.remove(); send(t); };
      d.appendChild(b);
    });
    msgs.appendChild(d);
  }

  function render() {
    msgs.innerHTML = '';
    addBubble('bot', cfg.welcomeMessage);
    state.log.forEach(function (e) {
      if (e.t === 'cards') addCards(e.items, e.more, e);
      else addBubble(e.t, e.text, e.image);
    });
    if (!state.log.length) addChips();
  }

  function setBusy(b) {
    busy = b;
    sendBtn.disabled = b;
    camBtn.disabled = b;
  }

  // Shrinks a photo in the browser before upload (fast on mobile data).
  function resizeImage(file, max, quality) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Could not open that photo - please try a JPG or PNG.')); };
      img.src = url;
    });
  }

  function sendPhoto(file) {
    if (!file || busy) return;
    var caption = input.value.trim();
    input.value = '';
    Promise.all([resizeImage(file, 768, 0.85), resizeImage(file, 240, 0.7)])
      .then(function (r) { send(caption, r[0], r[1]); })
      .catch(function (err) { addBubble('err', err.message); });
  }

  function send(text, image, preview) {
    text = (text || '').trim();
    if ((!text && !image) || busy) return;
    var chips = root.querySelector('.chips');
    if (chips) chips.remove();
    addBubble('user', text, preview);
    state.log.push({ t: 'user', text: text, image: preview || undefined });
    writeState();
    setBusy(true);

    var typing = document.createElement('div');
    typing.className = 'typing';
    typing.textContent = cfg.assistantName + ' is typing…';
    msgs.appendChild(typing);
    scroll();

    var bubble = null, botText = '';
    function ensureBubble() {
      if (!bubble) {
        typing.remove();
        bubble = addBubble('bot', '');
      }
      return bubble;
    }
    function finishBubble() {
      if (bubble && botText.trim()) state.log.push({ t: 'bot', text: botText.trim() });
      else if (bubble) bubble.remove();
      bubble = null;
      botText = '';
    }

    function handle(event, data) {
      if (event === 'meta') { state.conversationId = data.conversationId; writeState(); }
      else if (event === 'text') { botText += data.delta; ensureBubble().innerHTML = md(botText.replace(/^\s+/, '')); scroll(); }
      else if (event === 'replace') { botText = data.text; ensureBubble().innerHTML = md(botText); }
      else if (event === 'products') {
        finishBubble();
        typing.remove();
        var entry = { t: 'cards', items: data.items, more: data.more || null };
        state.log.push(entry);
        addCards(data.items, entry.more, entry);
        msgs.appendChild(typing);
      }
      else if (event === 'error') {
        finishBubble();
        addBubble('err', data.message);
        if (data.restart) { state.conversationId = null; }
      }
    }

    fetch(API + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: state.conversationId, message: text, image: image || undefined, pageUrl: location.href }),
    })
      .then(function (res) {
        if (!res.ok) return res.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.error || 'Request failed'); });
        var reader = res.body.getReader();
        var dec = new TextDecoder();
        var buf = '';
        function pump() {
          return reader.read().then(function (r) {
            if (r.done) return;
            buf += dec.decode(r.value, { stream: true });
            var parts = buf.split('\n\n');
            buf = parts.pop();
            parts.forEach(function (chunk) {
              var ev = (chunk.match(/^event: (.*)$/m) || [])[1];
              var data = (chunk.match(/^data: (.*)$/m) || [])[1];
              if (ev && data) { try { handle(ev, JSON.parse(data)); } catch (e) { /* ignore bad chunk */ } }
            });
            return pump();
          });
        }
        return pump();
      })
      .catch(function (err) { addBubble('err', err.message || 'Network error - please try again.'); })
      .then(function () {
        finishBubble();
        typing.remove();
        writeState();
        setBusy(false);
        input.focus();
      });
  }

  function open(o) {
    state.open = o;
    writeState();
    panel.classList.toggle('open', o);
    fab.classList.toggle('hide', o);
    if (o) { scroll(); setTimeout(function () { input.focus(); }, 50); }
  }

  fab.onclick = function () { open(!panel.classList.contains('open')); };
  $('.close').onclick = function () { open(false); };
  $('.new').onclick = function () { if (busy) return; state = { log: [], open: true }; writeState(); render(); };
  zoom.onclick = function () { zoom.classList.remove('open'); };
  camBtn.onclick = function () { fileInput.click(); };
  fileInput.onchange = function () {
    var f = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    var chips = root.querySelector('.chips');
    if (chips) chips.remove();
    sendPhoto(f);
  };
  form.onsubmit = function (e) { e.preventDefault(); var t = input.value; input.value = ''; send(t); };
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.onsubmit(e); }
  });
  input.addEventListener('input', function () { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 100) + 'px'; });

  fetch(API + '/api/config')
    .then(function (r) { return r.json(); })
    .catch(function () { return {}; })
    .then(function (c) {
      for (var k in c) if (c[k]) cfg[k] = c[k];
      host.style.setProperty('--accent', cfg.accentColor);
      root.querySelector('.name').textContent = cfg.assistantName;
      var wa = waUrl('Hi, I have a question about your jewellery.');
      if (wa) { walink.href = wa; walink.style.display = 'block'; }
      render();
      if (state.open) open(true);
    });
})();
