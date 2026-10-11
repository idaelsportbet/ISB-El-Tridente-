(() => {
  const escapar = valor => String(valor ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  window.renderPickDescription = value => {
    const texto = String(value ?? "");
    if (!/^(?:🏟️|🟢 → |🔥 |📸 |Análisis:)/m.test(texto)) return `<p class="pick-description">${escapar(texto)}</p>`;
    let analisis = false;
    return texto.split(/\r?\n/).map(linea => {
      if (!linea.trim()) return `<div class="pick-space" aria-hidden="true"></div>`;
      if (linea.startsWith("🏟️ ")) return `<div class="pick-line pick-match">${escapar(linea.slice(3).trim())}</div>`;
      if (linea.startsWith("🟢 → ")) return `<div class="pick-line pick-play"><span class="pick-arrow" aria-hidden="true">→</span><span>${escapar(linea.slice(5))}</span></div>`;
      if (linea.startsWith("🔥 ")) return `<div class="pick-line pick-odds"><span aria-hidden="true">🔥</span><span>${escapar(linea.slice(2).trim())}</span></div>`;
      if (linea.startsWith("📸 ")) return `<div class="pick-line pick-instagram">${escapar(linea.slice(3))}</div>`;
      if (linea.startsWith("Análisis:")) { analisis = true; return `<div class="pick-analysis-label">ANÁLISIS</div>${linea.slice(9).trim() ? `<div class="pick-analysis">${escapar(linea.slice(9).trim())}</div>` : ""}`; }
      return analisis ? `<div class="pick-analysis">${escapar(linea)}</div>` : `<div class="pick-line pick-match">${escapar(linea)}</div>`;
    }).join("");
  };
})();
