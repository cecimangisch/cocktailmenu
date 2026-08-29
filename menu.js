// ===== Menú dinámico desde Supabase =====
// Lee los tragos de la tabla `tragos` y reemplaza las listas estáticas.
// Si además existen las tablas de ingredientes, los tragos a los que les
// falta algún ingrediente se muestran en gris (agotados).
// Si Supabase no está configurado o falla, queda el menú estático del HTML.

function escapar(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

async function consultar(cfg, ruta) {
  const url = cfg.url.replace(/\/$/, "") + "/rest/v1/" + ruta;
  // con las keys nuevas (sb_publishable_...) alcanza el header apikey;
  // el Bearer solo corresponde a las keys legacy con formato JWT (eyJ...)
  const headers = { apikey: cfg.anonKey };
  if (cfg.anonKey.startsWith("eyJ")) {
    headers.Authorization = "Bearer " + cfg.anonKey;
  }
  const respuesta = await fetch(url, { headers });
  if (!respuesta.ok) throw new Error("HTTP " + respuesta.status + " en " + ruta);
  return respuesta.json();
}

async function cargarMenu() {
  const cfg = window.SUPABASE_CONFIG || {};
  if (!cfg.url || !cfg.anonKey) return false;

  try {
    // las tablas de ingredientes pueden no existir todavía: si fallan,
    // el menú se muestra completo sin marcar agotados
    const [tragos, ingredientes, relaciones] = await Promise.all([
      consultar(
        cfg,
        "tragos?select=id,seccion,nombre,nota,ingredientes&visible=is.true&order=orden.asc,id.asc"
      ),
      consultar(cfg, "ingredientes?select=id,disponible").catch(() => null),
      consultar(cfg, "trago_ingredientes?select=trago_id,ingrediente_id").catch(() => null),
    ]);
    if (!Array.isArray(tragos) || tragos.length === 0) return false;

    let requisitos = null;
    let enStock = null;
    if (ingredientes && relaciones) {
      enStock = new Set(ingredientes.filter((i) => i.disponible).map((i) => i.id));
      requisitos = new Map();
      relaciones.forEach((r) => {
        if (!requisitos.has(r.trago_id)) requisitos.set(r.trago_id, []);
        requisitos.get(r.trago_id).push(r.ingrediente_id);
      });
    }

    const estaDisponible = (trago) => {
      if (!requisitos) return true;
      const reqs = requisitos.get(trago.id) || [];
      return reqs.every((id) => enStock.has(id));
    };

    let cambiado = false;
    document.querySelectorAll(".lista[data-seccion]").forEach((lista) => {
      const seccion = lista.dataset.seccion;
      const items = tragos.filter((t) => t.seccion === seccion);
      if (items.length === 0) return;
      // solo la sección de autor va sobre el papel; el resto sobre el verde
      const claseVerde = seccion === "autor" ? " trago--verde" : "";
      const rotulo = lista.querySelector(".rotulo");
      lista.innerHTML =
        (rotulo ? rotulo.outerHTML.replace(" visible", "") : "") +
        items
          .map((t) => {
            const claseAgotado = estaDisponible(t) ? "" : " trago--agotado";
            return `
        <li class="trago${claseVerde}${claseAgotado} reveal">
          <h2>${escapar(t.nombre)}${t.nota ? ` <span class="nota">(${escapar(t.nota)})</span>` : ""}</h2>
          <p>${escapar(t.ingredientes)}</p>
        </li>`;
          })
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
        // el borde rasgado puede destapar otra sección al mismo tiempo
        const destapa = entrada.target.dataset.revela;
        if (destapa) {
          const seccion = document.querySelector(destapa);
          if (seccion) seccion.classList.add("visible");
        }
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

// ===== Proponer un trago =====

const modal = document.getElementById("modal-propuesta");

if (modal) {
  const abrir = document.getElementById("abrir-propuesta");
  const cerrar = document.getElementById("p-cerrar");
  const enviar = document.getElementById("p-enviar");
  const campos = {
    nombre: document.getElementById("p-nombre"),
    ingredientes: document.getElementById("p-ingredientes"),
    autor: document.getElementById("p-autor"),
  };
  const msj = document.getElementById("p-msj");

  function abrirModal() {
    modal.classList.remove("oculto");
    document.body.style.overflow = "hidden";
    campos.nombre.focus();
  }

  function cerrarModal() {
    modal.classList.add("oculto");
    document.body.style.overflow = "";
    msj.textContent = "";
    enviar.disabled = false;
    enviar.textContent = "Enviar propuesta";
  }

  abrir.addEventListener("click", abrirModal);
  cerrar.addEventListener("click", cerrarModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) cerrarModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("oculto")) cerrarModal();
  });

  enviar.addEventListener("click", async () => {
    const cfg = window.SUPABASE_CONFIG || {};
    const nombre = campos.nombre.value.trim();
    if (!nombre) {
      msj.textContent = "Poné al menos el nombre del trago.";
      return;
    }
    if (!cfg.url || !cfg.anonKey) {
      msj.textContent = "No se pueden recibir propuestas por ahora.";
      return;
    }

    enviar.disabled = true;
    msj.textContent = "Enviando…";
    try {
      const headers = { apikey: cfg.anonKey, "Content-Type": "application/json" };
      if (cfg.anonKey.startsWith("eyJ")) headers.Authorization = "Bearer " + cfg.anonKey;
      const respuesta = await fetch(cfg.url.replace(/\/$/, "") + "/rest/v1/rpc/proponer_trago", {
        method: "POST",
        headers,
        body: JSON.stringify({
          p_nombre: nombre,
          p_ingredientes: campos.ingredientes.value.trim() || null,
          p_autor: campos.autor.value.trim() || null,
        }),
      });
      if (!respuesta.ok) throw new Error("HTTP " + respuesta.status);

      msj.textContent = "¡Gracias! Tu propuesta quedó anotada.";
      enviar.textContent = "Enviada ✓";
      Object.values(campos).forEach((c) => (c.value = ""));
      setTimeout(cerrarModal, 1800);
    } catch (error) {
      enviar.disabled = false;
      msj.textContent = "No se pudo enviar. Probá de nuevo en un rato.";
    }
  });
}
