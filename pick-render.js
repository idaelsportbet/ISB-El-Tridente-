(() => {
  const escapar = valor => String(valor ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const instagramLogo = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><defs><linearGradient id="instagramPickGradient" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#feda75"/><stop offset=".5" stop-color="#d62976"/><stop offset="1" stop-color="#4f5bd5"/></linearGradient></defs><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="url(#instagramPickGradient)" stroke-width="2.2"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="url(#instagramPickGradient)" stroke-width="2.2"/><circle cx="17.6" cy="6.6" r="1.25" fill="#d62976"/></svg>`;
  window.renderPickDescription = value => {
    const texto = String(value ?? "");
    if (!/^(?:🏟️|🟢 → |🔥 |📸 |Análisis:)/m.test(texto)) return `<p class="pick-description">${escapar(texto)}</p>`;
    let analisis = false;
    return texto.split(/\r?\n/).map(linea => {
      if (!linea.trim()) return `<div class="pick-space" aria-hidden="true"></div>`;
      if (linea.startsWith("🏟️ ")) return `<div class="pick-line pick-match">${escapar(linea.slice(3).trim())}</div>`;
      if (linea.startsWith("🟢 → ")) return `<div class="pick-line pick-play"><span class="pick-arrow" aria-hidden="true">→</span><span>${escapar(linea.slice(5))}</span></div>`;
      if (linea.startsWith("🔥 ")) return `<div class="pick-line pick-odds"><span aria-hidden="true">🔥</span><span>${escapar(linea.slice(2).trim())}</span></div>`;
      if (linea.startsWith("📸 ")) return `<div class="pick-line pick-instagram"><span class="pick-instagram-logo">${instagramLogo}</span><span>${escapar(linea.slice(3))}</span><span class="isb-verified" role="img" aria-label="Insignia ISB"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1.2 14.3 3l3-.2 1.3 2.7 2.7 1.3-.2 3 1.8 2.2-1.8 2.3.2 3-2.7 1.3-1.3 2.7-3-.2L12 23l-2.3-1.9-3 .2-1.3-2.7-2.7-1.3.2-3L1.1 12l1.8-2.2-.2-3 2.7-1.3 1.3-2.7 3 .2L12 1.2Z"/><path fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="m7.4 12.2 3 3 6.3-6.5"/></svg></span></div>`;
      if (linea.startsWith("Análisis:")) { analisis = true; return `<div class="pick-analysis-label">ANÁLISIS</div>${linea.slice(9).trim() ? `<div class="pick-analysis">${escapar(linea.slice(9).trim())}</div>` : ""}`; }
      return analisis ? `<div class="pick-analysis">${escapar(linea)}</div>` : `<div class="pick-line pick-match">${escapar(linea)}</div>`;
    }).join("");
  };
})();
