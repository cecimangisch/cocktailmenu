// ===== Menú dinámico desde Supabase =====
// Lee los tragos de la tabla `tragos` y reemplaza las listas estáticas.
// Si Supabase no está configurado o falla, queda el menú estático del HTML.

function escapar(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

async function cargarMenu() {
  const cfg = window.SUPABASE_CONFIG || {};
  if (!cfg.url || !cfg.anonKey) return false;

  try {
    const url =
      cfg.url.replace(/\/$/, "") +
      "/rest/v1/tragos" +
      "?select=seccion,nombre,nota,ingredientes" +
      "&visible=is.true&order=orden.asc,id.asc";
    // con las keys nuevas (sb_publishable_...) alcanza el header apikey;
    // el Bearer solo corresponde a las keys legacy con formato JWT (eyJ...)
    const headers = { apikey: cfg.anonKey };
    if (cfg.anonKey.startsWith("eyJ")) {
      headers.Authorization = "Bearer " + cfg.anonKey;
    }
    const respuesta = await fetch(url, { headers });
    if (!respuesta.ok) throw new Error("HTTP " + respuesta.status);
    const tragos = await respuesta.json();
    if (!Array.isArray(tragos) || tragos.length === 0) return false;

    let cambiado = false;
    document.querySelectorAll(".lista[data-seccion]").forEach((lista) => {
      const seccion = lista.dataset.seccion;
      const items = tragos.filter((t) => t.seccion === seccion);
      if (items.length === 0) return;
      const claseExtra = seccion === "especiales" ? " trago--verde" : "";
      lista.innerHTML = items
        .map(
          (t) => `
        <li class="trago${claseExtra} reveal">
          <h2>${escapar(t.nombre)}${t.nota ? ` <span class="nota">(${escapar(t.nota)})</span>` : ""}</h2>
          <p>${escapar(t.ingredientes)}</p>
        </li>`
        )
        .join("");
      cambiado = true;
    });
    return cambiado;
  } catch (error) {
    console.warn("No se pudo leer el menú de Supabase, se usa el estático:", error);
    return false;
  }
}

// ===== Animaciones de aparición =====

const observador = new IntersectionObserver(
  (entradas) => {
    entradas.forEach((entrada) => {
      if (entrada.isIntersecting) {
        entrada.target.classList.add("visible");
        observador.unobserve(entrada.target);
      }
    });
  },
  { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
);

function animar() {
  document
    .querySelectorAll(
      ".reveal, .reveal-titulo, .reveal-script, .reveal-ilustracion, .reveal-rasgado"
    )
    .forEach((el) => observador.observe(el));

  // aparición escalonada de los tragos dentro de cada lista
  document.querySelectorAll(".lista").forEach((lista) => {
    lista.querySelectorAll(".trago").forEach((el, i) => {
      el.style.transitionDelay = `${i * 90}ms`;
    });
  });
}

animar();
cargarMenu().then((cambiado) => {
  if (cambiado) animar();
});
