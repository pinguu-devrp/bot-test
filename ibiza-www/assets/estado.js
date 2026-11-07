/* Estado en vivo de la portada: miembros del Discord.
   El dato lo da el bot (GET /api/estado). Si algo falla, se muestra el guion: nunca una cifra inventada.
   Sin este script la página se ve igual, con el guion. */
(function () {
  var zona = document.querySelector('[data-api]');
  if (!zona) return;
  var api = zona.getAttribute('data-api');
  var campo = function (n) { return zona.querySelector('[data-vivo="' + n + '"]'); };
  var miembros = campo('miembros');
  var sinMovimiento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var primera = true;

  function miles(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  /* La primera vez, la cifra sube desde 0: es el único movimiento de la página al cargar. */
  function poner(el, texto, numero) {
    if (!el) return;
    if (numero == null || sinMovimiento || !primera) { el.textContent = texto(numero); return; }
    var inicio = null;
    function paso(t) {
      if (inicio === null) inicio = t;
      var p = Math.min((t - inicio) / 900, 1);
      el.textContent = texto(numero * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
  }

  function pintar(d) {
    poner(miembros, function (n) { return n == null ? '—' : miles(n); }, typeof d.miembros === 'number' ? d.miembros : null);
    primera = false;
  }

  /* Los seguidores no vienen del bot: van escritos en la página (data-valor) y solo se animan. */
  var seguidores = campo('seguidores');
  if (seguidores && Number(seguidores.getAttribute('data-valor')) > 0) {
    poner(seguidores, function (n) { return miles(n); }, Number(seguidores.getAttribute('data-valor')));
  }

  function refrescar() {
    var control = typeof AbortController === 'function' ? new AbortController() : null;
    var corte = setTimeout(function () { if (control) control.abort(); }, 8000);
    fetch(zona.getAttribute('data-api') || api, { headers: { Accept: 'application/json' }, signal: control ? control.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(function (d) { if (d && d.ok) pintar(d); else throw new Error('respuesta'); })
      .catch(function () { if (primera) pintar({ miembros: null }); })
      .then(function () { clearTimeout(corte); });
  }

  refrescar();
  setInterval(function () { if (!document.hidden) refrescar(); }, 60000);
  document.addEventListener('ibiza:refrescar-estado', refrescar);
})();
