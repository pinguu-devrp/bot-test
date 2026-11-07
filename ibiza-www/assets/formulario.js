/* Envío del formulario de desbaneo sin recargar la página. Sin él, el formulario también funciona (envío normal). */
(function () {
  var f = document.getElementById('form-desbaneo');
  if (!f) return;
  var estado = document.getElementById('estado');
  var boton = f.querySelector('button[type=submit]');
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!f.reportValidity()) return;
    if (f.elements['zq_trampa'] && f.elements['zq_trampa'].value) return; // campo trampa para bots
    estado.className = 'estado';
    estado.textContent = 'Enviando…';
    boton.disabled = true;
    var control = typeof AbortController === 'function' ? new AbortController() : null;
    var corte = setTimeout(function () { if (control) control.abort(); }, 15000);
    fetch(f.getAttribute('action'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(new FormData(f)).toString(),
      signal: control ? control.signal : undefined
    }).then(function (r) {
      if (!r.ok) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          var e = new Error('http'); e.detalle = (r.status === 422 || r.status === 429) ? d.error : ''; throw e;
        });
      }
      estado.className = 'estado ok';
      estado.textContent = 'Solicitud enviada. El staff la revisará y te responderá.';
      f.reset();
    }).catch(function (e) {
      estado.className = 'estado error';
      estado.textContent = (e && e.detalle) || 'No hemos podido enviarla ahora. Escribe directamente a ibizaroleplayerlc@gmail.com.';
    }).then(function () { clearTimeout(corte); boton.disabled = false; });
  });
})();
