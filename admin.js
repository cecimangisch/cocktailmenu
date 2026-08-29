// ===== Panel de administración =====
// Entrada con clave (validada en el servidor una sola vez); después,
// cada acción usa esa clave automáticamente:
//  - alternar disponibilidad de ingredientes
//  - agregar, editar, pausar y eliminar tragos

const cfg = window.SUPABASE_CONFIG || {};
let clave = null;

const gate = document.getElementById("gate");
const panel = document.getElementById("panel");
const gateClave = document.getElementById("g-clave");
const gateEntrar = document.getElementById("g-entrar");
const gateMsj = document.getElementById("g-msj");

const contenedor = document.getElementById("chips");
const estado = document.getElementById("estado");
const listaTragos = document.getElementById("lista-tragos");

const formTitulo = document.getElementById("f-titulo");
const campoNombre = document.getElementById("f-nombre");
const campoNota = document.getElementById("f-nota");
const campoSeccion = document.getElementById("f-seccion");
const picker = document.getElementById("f-picker");
const campoNuevo = document.getElementById("f-nuevo");
const botonNuevo = document.getElementById("f-agregar-ing");
const campoTexto = document.getElementById("f-texto");
const botonGuardar = document.getElementById("f-guardar");
const botonCancelar = document.getElementById("f-cancelar");
const mensaje = document.getElementById("f-msj");

function cabeceras(extra) {
  const h = { apikey: cfg.anonKey, ...extra };
  if (cfg.anonKey.startsWith("eyJ")) h.Authorization = "Bearer " + cfg.anonKey;
  return h;
}

async function llamarRpc(nombre, cuerpo) {
  const respuesta = await fetch(cfg.url.replace(/\/$/, "") + "/rest/v1/rpc/" + nombre, {
    method: "POST",
    headers: cabeceras({ "Content-Type": "application/json" }),
    body: JSON.stringify(cuerpo),
  });
  return respuesta;
}

async function rpc(nombre, cuerpo) {
  const respuesta = await llamarRpc(nombre, { ...cuerpo, p_clave: clave });
  if (!respuesta.ok) {
    let detalle = "";
    try {
      detalle = (await respuesta.json()).message || "";
    } catch (e) {}
    // si la clave dejó de ser válida, volver a la entrada
    if (detalle.includes("clave")) {
      localStorage.removeItem("claveAdmin");
      volverAlGate();
    }
    return { ok: false, detalle };
  }
  let datos = null;
  try {
    datos = await respuesta.json();
  } catch (e) {}
  return { ok: true, datos };
}

// ===== Pestañas =====

function mostrarTab(nombre) {
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("tab--activa", t.dataset.tab === nombre);
  });
  document.querySelectorAll(".tab-panel").forEach((p) => {
    p.classList.toggle("oculto", p.dataset.panel !== nombre);
  });
}

document.getElementById("tabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (tab) mostrarTab(tab.dataset.tab);
});

// ===== Entrada con clave =====

function volverAlGate() {
  clave = null;
  panel.classList.add("oculto");
  gate.classList.remove("oculto");
  gateMsj.textContent = "La clave ya no es válida, ingresala de nuevo.";
}

async function validarYEntrar(intento, silencioso) {
  gateMsj.textContent = silencioso ? "" : "Verificando…";
  try {
    const respuesta = await llamarRpc("validar_clave", { p_clave: intento });
    const valida = respuesta.ok && (await respuesta.json()) === true;
    if (!valida) {
      localStorage.removeItem("claveAdmin");
      if (!silencioso) gateMsj.textContent = "Clave incorrecta.";
      return false;
    }
    clave = intento;
    localStorage.setItem("claveAdmin", intento);
    gate.classList.add("oculto");
    panel.classList.remove("oculto");
    await refrescar().catch((e) => {
      estado.textContent = "No se pudieron cargar los datos: " + e.message;
    });
    return true;
  } catch (error) {
    if (!silencioso) gateMsj.textContent = "No se pudo verificar: " + error.message;
    return false;
  }
}

gateEntrar.addEventListener("click", () => {
  const intento = gateClave.value.trim();
  if (intento) validarYEntrar(intento, false);
});

gateClave.addEventListener("keydown", (e) => {
  if (e.key === "Enter") gateEntrar.click();
});

// ===== Chips de disponibilidad =====

function pintar(boton, disponible) {
  boton.classList.toggle("chip--on", disponible);
  boton.classList.toggle("chip--off", !disponible);
  boton.setAttribute("aria-pressed", disponible ? "true" : "false");
}

function crearChipDisponibilidad(ing, sinUso) {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "chip" + (sinUso ? " chip--sinuso" : "");
  boton.textContent = ing.nombre;
  if (sinUso) boton.title = "Ningún trago usa este ingrediente";
  pintar(boton, ing.disponible);
  boton.addEventListener("click", async () => {
    const nuevo = !ing.disponible;
    pintar(boton, nuevo); // optimista
    boton.disabled = true;
    const r = await rpc("marcar_ingrediente", { p_id: ing.id, p_disponible: nuevo }).catch(() => ({ ok: false }));
    boton.disabled = false;
    if (r.ok) {
      ing.disponible = nuevo;
      actualizarAccionesIngredientes();
    } else {
      pintar(boton, ing.disponible); // revertir
    }
  });
  return boton;
}

// ===== Lista del súper e ingredientes sin uso =====

const btnSuper = document.getElementById("btn-super");
const btnLimpiar = document.getElementById("btn-limpiar");
const msjIng = document.getElementById("msj-ing");
let datos = { ingredientes: [], tragos: [], ingredientesPorTrago: new Map(), sinUso: new Set() };

function actualizarAccionesIngredientes() {
  const faltan = datos.ingredientes.filter((i) => !i.disponible);
  btnSuper.classList.toggle("oculto", faltan.length === 0);
  btnSuper.textContent = `🛒 Copiar lista del súper (${faltan.length})`;
  btnLimpiar.classList.toggle("oculto", datos.sinUso.size === 0);
  btnLimpiar.textContent = `Limpiar sin uso (${datos.sinUso.size})`;
}

function textoListaSuper() {
  const faltan = datos.ingredientes.filter((i) => !i.disponible).map((i) => i.nombre);
  const faltanSet = new Set(faltan);

  // tragos que vuelven a estar disponibles si comprás todo eso
  const vuelven = datos.tragos
    .filter((t) => {
      if (!t.visible) return false;
      const reqs = datos.ingredientesPorTrago.get(t.id) || [];
      return reqs.length > 0 && reqs.some((n) => faltanSet.has(n));
    })
    .map((t) => t.nombre);

  let texto = "🛒 Lista del súper\n\n" + faltan.map((n) => "- " + n).join("\n");
  if (vuelven.length > 0) {
    texto += "\n\nCon esto vuelven: " + vuelven.join(", ");
  }
  return texto;
}

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch (e) {
    // navegadores viejos o sin permiso de portapapeles
    const area = document.createElement("textarea");
    area.value = texto;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e2) {}
    area.remove();
    return ok;
  }
}

btnSuper.addEventListener("click", async () => {
  const texto = textoListaSuper();
  const ok = await copiar(texto);
  msjIng.textContent = ok
    ? "Lista copiada, ya la podés pegar donde quieras."
    : "No se pudo copiar. Copiala a mano:\n" + texto;
  if (ok) setTimeout(() => (msjIng.textContent = ""), 4000);
});

btnLimpiar.addEventListener("click", async () => {
  const cuantos = datos.sinUso.size;
  const nombres = [...datos.sinUso].join(", ");
  if (!confirm(`¿Eliminar ${cuantos} ingrediente(s) que ningún trago usa?\n\n${nombres}`)) return;
  btnLimpiar.disabled = true;
  const r = await rpc("eliminar_ingredientes_sin_uso", {}).catch(() => ({ ok: false }));
  btnLimpiar.disabled = false;
  if (r.ok) {
    msjIng.textContent = `Listo, se eliminaron ${r.datos ?? cuantos} ingrediente(s).`;
    await refrescar();
    setTimeout(() => (msjIng.textContent = ""), 4000);
  } else {
    msjIng.textContent = "No se pudo limpiar." + (r.detalle ? " " + r.detalle : "");
  }
});

// ===== Lista de tragos =====

const nombreSeccion = { cocktails: "Cocktails", autor: "De autor", clasicos: "Clásicos" };

function filaTrago(trago, ingredientesPorTrago) {
  const li = document.createElement("li");
  li.className = "trago-fila" + (trago.visible ? "" : " trago-fila--pausado");

  const info = document.createElement("div");
  info.className = "trago-fila-info";
  info.innerHTML =
    `<strong>${trago.nombre}</strong>` +
    (trago.nota ? ` <span class="trago-fila-nota">(${trago.nota})</span>` : "") +
    `<br /><small>${nombreSeccion[trago.seccion] || trago.seccion} · ${trago.ingredientes}</small>` +
    (trago.visible ? "" : `<br /><small class="trago-fila-etiqueta">PAUSADO — no sale en la carta</small>`);

  const acciones = document.createElement("div");
  acciones.className = "trago-fila-acciones";

  const bEditar = document.createElement("button");
  bEditar.type = "button";
  bEditar.className = "admin-boton admin-boton--mini admin-boton--secundario";
  bEditar.textContent = "Editar";
  bEditar.addEventListener("click", () => empezarEdicion(trago, ingredientesPorTrago));

  const bPausar = document.createElement("button");
  bPausar.type = "button";
  bPausar.className = "admin-boton admin-boton--mini admin-boton--secundario";
  bPausar.textContent = trago.visible ? "Pausar" : "Reanudar";
  bPausar.addEventListener("click", async () => {
    bPausar.disabled = true;
    const r = await rpc("pausar_trago", { p_id: trago.id, p_visible: !trago.visible }).catch(() => ({ ok: false }));
    bPausar.disabled = false;
    if (r.ok) await refrescar();
    else alert("No se pudo guardar." + (r.detalle ? " " + r.detalle : ""));
  });

  const bEliminar = document.createElement("button");
  bEliminar.type = "button";
  bEliminar.className = "admin-boton admin-boton--mini admin-boton--peligro";
  bEliminar.textContent = "Eliminar";
  bEliminar.addEventListener("click", async () => {
    if (!confirm(`¿Eliminar "${trago.nombre}" definitivamente?\nSi solo querés sacarlo un tiempo, usá Pausar.`)) return;
    bEliminar.disabled = true;
    const r = await rpc("eliminar_trago", { p_id: trago.id }).catch(() => ({ ok: false }));
    bEliminar.disabled = false;
    if (r.ok) {
      if (editandoId === trago.id) cancelarEdicion();
      await refrescar();
    } else alert("No se pudo eliminar." + (r.detalle ? " " + r.detalle : ""));
  });

  acciones.append(bEditar, bPausar, bEliminar);
  li.append(info, acciones);
  return li;
}

// ===== Propuestas de los invitados =====

const listaPropuestas = document.getElementById("lista-propuestas");
const globoPropuestas = document.getElementById("globo-propuestas");

function filaPropuesta(propuesta) {
  const li = document.createElement("li");
  li.className = "trago-fila";

  const fecha = new Date(propuesta.creada_en).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  });

  const info = document.createElement("div");
  info.className = "trago-fila-info";
  info.innerHTML =
    `<strong>${propuesta.nombre}</strong>` +
    (propuesta.ingredientes ? `<br /><small>${propuesta.ingredientes}</small>` : "") +
    `<br /><small class="trago-fila-meta">${propuesta.autor ? "de " + propuesta.autor + " · " : ""}${fecha}</small>`;

  const acciones = document.createElement("div");
  acciones.className = "trago-fila-acciones";

  const bUsar = document.createElement("button");
  bUsar.type = "button";
  bUsar.className = "admin-boton admin-boton--mini admin-boton--secundario";
  bUsar.textContent = "Usar";
  bUsar.addEventListener("click", () => usarPropuesta(propuesta));

  const bDescartar = document.createElement("button");
  bDescartar.type = "button";
  bDescartar.className = "admin-boton admin-boton--mini admin-boton--peligro";
  bDescartar.textContent = "Descartar";
  bDescartar.addEventListener("click", async () => {
    bDescartar.disabled = true;
    const r = await rpc("resolver_propuesta", { p_id: propuesta.id, p_estado: "descartada" }).catch(() => ({ ok: false }));
    bDescartar.disabled = false;
    if (r.ok) await cargarPropuestas();
    else alert("No se pudo descartar." + (r.detalle ? " " + r.detalle : ""));
  });

  acciones.append(bUsar, bDescartar);
  li.append(info, acciones);
  return li;
}

async function cargarPropuestas() {
  const r = await rpc("listar_propuestas", {}).catch(() => ({ ok: false }));
  listaPropuestas.innerHTML = "";
  if (!r.ok) {
    // la tabla puede no existir todavía (falta correr el SQL)
    listaPropuestas.innerHTML =
      '<li class="admin-estado">No se pudieron cargar las propuestas. ¿Ejecutaste supabase-propuestas.sql?</li>';
    globoPropuestas.classList.add("oculto");
    return;
  }
  const propuestas = r.datos || [];
  if (propuestas.length === 0) {
    listaPropuestas.innerHTML = '<li class="admin-estado">No hay propuestas pendientes.</li>';
    globoPropuestas.classList.add("oculto");
    return;
  }
  propuestas.forEach((p) => listaPropuestas.appendChild(filaPropuesta(p)));
  globoPropuestas.textContent = propuestas.length;
  globoPropuestas.classList.remove("oculto");
}

// ===== Formulario (agregar y editar) =====

const seleccion = new Set(); // nombres de ingredientes elegidos
let textoEditado = false; // true si el campo de texto se tocó a mano
let editandoId = null; // id del trago en edición, o null si es alta
let propuestaOrigenId = null; // propuesta que dio origen al trago que se está cargando

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

function sincronizarPicker() {
  picker.querySelectorAll(".chip").forEach((c) => {
    const elegido = seleccion.has(c.textContent);
    c.classList.toggle("chip--sel", elegido);
    c.setAttribute("aria-pressed", elegido ? "true" : "false");
  });
}

function empezarEdicion(trago, ingredientesPorTrago) {
  editandoId = trago.id;
  campoNombre.value = trago.nombre;
  campoNota.value = trago.nota || "";
  campoSeccion.value = trago.seccion;
  campoTexto.value = trago.ingredientes;
  textoEditado = true;
  seleccion.clear();
  (ingredientesPorTrago.get(trago.id) || []).forEach((n) => seleccion.add(n));
  sincronizarPicker();
  formTitulo.textContent = "EDITAR TRAGO";
  botonGuardar.textContent = "Guardar cambios";
  botonCancelar.classList.remove("oculto");
  mensaje.textContent = "";
  document.getElementById("form-trago").scrollIntoView({ behavior: "smooth" });
}

function usarPropuesta(propuesta) {
  cancelarEdicion();
  propuestaOrigenId = propuesta.id;
  campoNombre.value = propuesta.nombre;
  if (propuesta.ingredientes) {
    campoTexto.value = propuesta.ingredientes;
    textoEditado = true;
  }
  formTitulo.textContent = "AGREGAR TRAGO PROPUESTO";
  mensaje.textContent = "Elegí los ingredientes reales y guardá.";
  botonCancelar.classList.remove("oculto");
  mostrarTab("tragos");
  document.getElementById("form-trago").scrollIntoView({ behavior: "smooth" });
}

function cancelarEdicion() {
  editandoId = null;
  propuestaOrigenId = null;
  campoNombre.value = "";
  campoNota.value = "";
  campoTexto.value = "";
  textoEditado = false;
  seleccion.clear();
  sincronizarPicker();
  formTitulo.textContent = "AGREGAR TRAGO";
  botonGuardar.textContent = "Guardar trago";
  botonCancelar.classList.add("oculto");
  mensaje.textContent = "";
}

botonCancelar.addEventListener("click", cancelarEdicion);

campoTexto.addEventListener("input", () => {
  textoEditado = campoTexto.value.trim() !== "";
});

botonNuevo.addEventListener("click", () => {
  const nombre = campoNuevo.value.trim();
  if (!nombre) return;
  const existente = [...picker.children].find(
    (c) => c.textContent.toLowerCase() === nombre.toLowerCase()
  );
  if (existente) {
    if (!seleccion.has(existente.textContent)) existente.click();
  } else {
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
  const datos = {
    p_seccion: campoSeccion.value,
    p_nombre: nombre,
    p_nota: campoNota.value.trim() || null,
    p_ingredientes_texto: texto,
    p_ingredientes: [...seleccion],
  };

  botonGuardar.disabled = true;
  mensaje.textContent = "Guardando…";
  const r = editandoId
    ? await rpc("editar_trago", { p_id: editandoId, ...datos }).catch(() => ({ ok: false }))
    : await rpc("agregar_trago", datos).catch(() => ({ ok: false }));
  botonGuardar.disabled = false;

  if (r.ok) {
    const verbo = editandoId ? "actualizado" : "agregado";
    const origen = propuestaOrigenId;
    cancelarEdicion();
    mensaje.textContent = `Listo: "${nombre}" ${verbo}.`;
    // si venía de una propuesta, queda marcada como aprobada
    if (origen) await rpc("resolver_propuesta", { p_id: origen, p_estado: "aprobada" }).catch(() => {});
    await refrescar();
  } else {
    mensaje.textContent = "No se pudo guardar." + (r.detalle ? " " + r.detalle : "");
  }
});

// ===== Carga de datos =====

async function consultar(ruta) {
  const respuesta = await fetch(cfg.url.replace(/\/$/, "") + "/rest/v1/" + ruta, {
    headers: cabeceras(),
  });
  if (!respuesta.ok) throw new Error("HTTP " + respuesta.status);
  return respuesta.json();
}

async function refrescar() {
  const [ingredientes, tragos, relaciones] = await Promise.all([
    consultar("ingredientes?select=id,nombre,disponible&order=nombre.asc"),
    consultar("tragos?select=id,seccion,nombre,nota,ingredientes,visible&order=nombre.asc"),
    consultar("trago_ingredientes?select=trago_id,ingrediente_id"),
  ]);

  const nombrePorId = new Map(ingredientes.map((i) => [i.id, i.nombre]));
  const ingredientesPorTrago = new Map();
  relaciones.forEach((r) => {
    if (!ingredientesPorTrago.has(r.trago_id)) ingredientesPorTrago.set(r.trago_id, []);
    const nombre = nombrePorId.get(r.ingrediente_id);
    if (nombre) ingredientesPorTrago.get(r.trago_id).push(nombre);
  });

  // ingredientes que ya no usa ningún trago
  const usados = new Set(relaciones.map((r) => r.ingrediente_id));
  const sinUso = new Set(
    ingredientes.filter((i) => !usados.has(i.id)).map((i) => i.nombre)
  );
  datos = { ingredientes, tragos, ingredientesPorTrago, sinUso };

  contenedor.querySelectorAll(".chip").forEach((c) => c.remove());
  picker.innerHTML = "";
  ingredientes.forEach((ing) => {
    contenedor.appendChild(crearChipDisponibilidad(ing, sinUso.has(ing.nombre)));
    picker.appendChild(crearChipPicker(ing.nombre));
  });
  sincronizarPicker();
  actualizarAccionesIngredientes();

  listaTragos.innerHTML = "";
  tragos.forEach((t) => listaTragos.appendChild(filaTrago(t, ingredientesPorTrago)));

  await cargarPropuestas();

  if (estado.isConnected) {
    if (ingredientes.length > 0) estado.remove();
    else estado.textContent = "No hay ingredientes cargados todavía.";
  }
}

// ===== Arranque =====

async function iniciar() {
  if (!cfg.url || !cfg.anonKey) {
    gateMsj.textContent = "Falta configurar Supabase en config.js";
    gateEntrar.disabled = true;
    return;
  }
  const guardada = localStorage.getItem("claveAdmin");
  if (guardada) {
    const entro = await validarYEntrar(guardada, true);
    if (entro) return;
  }
  gateClave.focus();
}

iniciar();
