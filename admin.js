// ===== Configuración de ingredientes disponibles =====
// Lista los ingredientes como chips; tocarlos alterna disponible/agotado.
// Además permite agregar un trago nuevo eligiendo sus ingredientes.
// Los cambios se guardan en Supabase vía funciones que exigen la clave
// de administración (se pide una vez y queda guardada en el navegador).

const cfg = window.SUPABASE_CONFIG || {};
const contenedor = document.getElementById("chips");
const estado = document.getElementById("estado");

function cabeceras(extra) {
  const h = { apikey: cfg.anonKey, ...extra };
  if (cfg.anonKey.startsWith("eyJ")) h.Authorization = "Bearer " + cfg.anonKey;
  return h;
}

function pedirClave(forzar) {
  let clave = localStorage.getItem("claveAdmin");
  if (!clave || forzar) {
    clave = prompt("Clave de administración:");
    if (clave) localStorage.setItem("claveAdmin", clave);
  }
  return clave;
}

async function rpc(nombre, cuerpo) {
  const clave = pedirClave(false);
  if (!clave) return { ok: false, sinClave: true };
  const respuesta = await fetch(cfg.url.replace(/\/$/, "") + "/rest/v1/rpc/" + nombre, {
    method: "POST",
    headers: cabeceras({ "Content-Type": "application/json" }),
    body: JSON.stringify({ ...cuerpo, p_clave: clave }),
  });
  if (!respuesta.ok) {
    localStorage.removeItem("claveAdmin");
    let detalle = "";
    try {
      detalle = (await respuesta.json()).message || "";
    } catch (e) {}
    return { ok: false, detalle };
  }
  return { ok: true };
}

// ===== Chips de disponibilidad =====

function pintar(boton, disponible) {
  boton.classList.toggle("chip--on", disponible);
  boton.classList.toggle("chip--off", !disponible);
  boton.setAttribute("aria-pressed", disponible ? "true" : "false");
}

function crearChipDisponibilidad(ing) {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "chip";
  boton.textContent = ing.nombre;
  pintar(boton, ing.disponible);
  boton.addEventListener("click", async () => {
    const nuevo = !ing.disponible;
    pintar(boton, nuevo); // optimista
    boton.disabled = true;
    const r = await rpc("marcar_ingrediente", { p_id: ing.id, p_disponible: nuevo }).catch(() => ({ ok: false }));
    boton.disabled = false;
    if (r.ok) {
      ing.disponible = nuevo;
    } else {
      pintar(boton, ing.disponible); // revertir
      if (!r.sinClave) alert("No se pudo guardar. ¿Clave incorrecta?");
    }
  });
  return boton;
}

async function cargarIngredientes() {
  const respuesta = await fetch(
    cfg.url.replace(/\/$/, "") + "/rest/v1/ingredientes?select=id,nombre,disponible&order=nombre.asc",
    { headers: cabeceras() }
  );
  if (!respuesta.ok) throw new Error("HTTP " + respuesta.status);
  return respuesta.json();
}

// ===== Formulario de trago nuevo =====

const seleccion = new Set(); // nombres de ingredientes elegidos
let textoEditado = false; // true si la usuaria tocó el campo de texto a mano

const campoNombre = document.getElementById("f-nombre");
const campoNota = document.getElementById("f-nota");
const campoSeccion = document.getElementById("f-seccion");
const picker = document.getElementById("f-picker");
const campoNuevo = document.getElementById("f-nuevo");
const botonNuevo = document.getElementById("f-agregar-ing");
const campoTexto = document.getElementById("f-texto");
const botonGuardar = document.getElementById("f-guardar");
const mensaje = document.getElementById("f-msj");

function actualizarTexto() {
  if (!textoEditado) campoTexto.value = [...seleccion].join(", ");
}

function crearChipPicker(nombre) {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "chip chip--picker";
  boton.textContent = nombre;
  boton.setAttribute("aria-pressed", "false");
  boton.addEventListener("click", () => {
    const elegido = !seleccion.has(nombre);
    if (elegido) seleccion.add(nombre);
    else seleccion.delete(nombre);
    boton.classList.toggle("chip--sel", elegido);
    boton.setAttribute("aria-pressed", elegido ? "true" : "false");
    actualizarTexto();
  });
  return boton;
}

campoTexto.addEventListener("input", () => {
  textoEditado = campoTexto.value.trim() !== "";
});

botonNuevo.addEventListener("click", () => {
  const nombre = campoNuevo.value.trim();
  if (!nombre) return;
  const yaExiste = [...picker.children].some(
    (c) => c.textContent.toLowerCase() === nombre.toLowerCase()
  );
  if (!yaExiste) {
    const chip = crearChipPicker(nombre);
    picker.appendChild(chip);
    chip.click(); // queda seleccionado
  }
  campoNuevo.value = "";
});

campoNuevo.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    botonNuevo.click();
  }
});

botonGuardar.addEventListener("click", async () => {
  const nombre = campoNombre.value.trim();
  if (!nombre) {
    mensaje.textContent = "Falta el nombre del trago.";
    return;
  }
  if (seleccion.size === 0) {
    mensaje.textContent = "Elegí al menos un ingrediente.";
    return;
  }
  const texto = campoTexto.value.trim() || [...seleccion].join(", ");

  botonGuardar.disabled = true;
  mensaje.textContent = "Guardando…";
  const r = await rpc("agregar_trago", {
    p_seccion: campoSeccion.value,
    p_nombre: nombre,
    p_nota: campoNota.value.trim() || null,
    p_ingredientes_texto: texto,
    p_ingredientes: [...seleccion],
  }).catch(() => ({ ok: false }));
  botonGuardar.disabled = false;

  if (r.ok) {
    mensaje.textContent = `Listo: "${nombre}" ya está en la carta.`;
    campoNombre.value = "";
    campoNota.value = "";
    campoTexto.value = "";
    textoEditado = false;
    seleccion.clear();
    await refrescar(); // los ingredientes nuevos aparecen en ambas listas
  } else {
    mensaje.textContent =
      "No se pudo guardar. " + (r.detalle || (r.sinClave ? "Falta la clave." : "¿Clave incorrecta?"));
  }
});

// ===== Carga inicial =====

async function refrescar() {
  const ingredientes = await cargarIngredientes();
  contenedor.querySelectorAll(".chip").forEach((c) => c.remove());
  picker.innerHTML = "";
  ingredientes.forEach((ing) => {
    contenedor.appendChild(crearChipDisponibilidad(ing));
    const chip = crearChipPicker(ing.nombre);
    if (seleccion.has(ing.nombre)) {
      chip.classList.add("chip--sel");
      chip.setAttribute("aria-pressed", "true");
    }
    picker.appendChild(chip);
  });
}

async function iniciar() {
  if (!cfg.url || !cfg.anonKey) {
    estado.textContent = "Falta configurar Supabase en config.js";
    return;
  }
  try {
    await refrescar();
    if (contenedor.querySelectorAll(".chip").length > 0) estado.remove();
    else estado.textContent = "No hay ingredientes cargados todavía.";
  } catch (error) {
    estado.textContent = "No se pudieron cargar los ingredientes: " + error.message;
  }
}

iniciar();
