// ===== Configuración de ingredientes disponibles =====
// Lista los ingredientes como chips; tocarlos alterna disponible/agotado.
// El cambio se guarda en Supabase vía la función marcar_ingrediente,
// que exige la clave de administración (se pide una vez y queda guardada).

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

async function guardar(ingrediente, disponible) {
  const clave = pedirClave(false);
  if (!clave) return false;
  const respuesta = await fetch(cfg.url.replace(/\/$/, "") + "/rest/v1/rpc/marcar_ingrediente", {
    method: "POST",
    headers: cabeceras({ "Content-Type": "application/json" }),
    body: JSON.stringify({ p_id: ingrediente.id, p_disponible: disponible, p_clave: clave }),
  });
  if (!respuesta.ok) {
    localStorage.removeItem("claveAdmin");
    return false;
  }
  return true;
}

function pintar(boton, disponible) {
  boton.classList.toggle("chip--on", disponible);
  boton.classList.toggle("chip--off", !disponible);
  boton.setAttribute("aria-pressed", disponible ? "true" : "false");
}

async function iniciar() {
  if (!cfg.url || !cfg.anonKey) {
    estado.textContent = "Falta configurar Supabase en config.js";
    return;
  }
  try {
    const respuesta = await fetch(
      cfg.url.replace(/\/$/, "") + "/rest/v1/ingredientes?select=id,nombre,disponible&order=nombre.asc",
      { headers: cabeceras() }
    );
    if (!respuesta.ok) throw new Error("HTTP " + respuesta.status);
    const ingredientes = await respuesta.json();
    if (ingredientes.length === 0) {
      estado.textContent = "No hay ingredientes cargados todavía.";
      return;
    }

    estado.remove();
    ingredientes.forEach((ing) => {
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "chip";
      boton.textContent = ing.nombre;
      pintar(boton, ing.disponible);
      boton.addEventListener("click", async () => {
        const nuevo = !ing.disponible;
        pintar(boton, nuevo); // optimista
        boton.disabled = true;
        const ok = await guardar(ing, nuevo).catch(() => false);
        boton.disabled = false;
        if (ok) {
          ing.disponible = nuevo;
        } else {
          pintar(boton, ing.disponible); // revertir
          alert("No se pudo guardar. ¿Clave incorrecta?");
        }
      });
      contenedor.appendChild(boton);
    });
  } catch (error) {
    estado.textContent = "No se pudieron cargar los ingredientes: " + error.message;
  }
}

iniciar();
