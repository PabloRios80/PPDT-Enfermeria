document.addEventListener("DOMContentLoaded", () => {
  // Definición de elementos del DOM
  const form = document.getElementById("enfermeriaForm");
  const formStepsContainer = document.getElementById("form-steps-container");
  const steps = document.querySelectorAll(".form-step");
  const progressBar = document.getElementById("progress-bar");
  const prevBtn = document.getElementById("prev-step-btn");
  const nextBtn = document.getElementById("next-step-btn");
  const guardarBtn = document.getElementById("guardar-enfermeria-btn");

  // Variables de estado
  let currentStep = 0;
  const totalSteps = steps.length;

  // Función para mostrar el paso actual y actualizar la barra de progreso
  function showStep(stepIndex) {
    steps.forEach((step, index) => {
      if (index === stepIndex) {
        step.classList.remove("hidden");
      } else {
        step.classList.add("hidden");
      }
    });

    // Actualiza la barra de progreso
    const progress = ((stepIndex + 1) / totalSteps) * 100;
    progressBar.style.width = `${progress}%`;

    // Muestra/oculta los botones de navegación
    prevBtn.classList.toggle("hidden", stepIndex === 0);
    nextBtn.classList.toggle("hidden", stepIndex === totalSteps - 1);
    guardarBtn.classList.toggle("hidden", stepIndex !== totalSteps - 1);
  }

  // Eventos para los botones de navegación de pasos
  nextBtn.addEventListener("click", () => {
    currentStep++;
    showStep(currentStep);
  });

  prevBtn.addEventListener("click", () => {
    currentStep--;
    showStep(currentStep);
  });

  // Evento para el envío del formulario final
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const dni = document.getElementById("dni").value;
    const nombre = document.getElementById("nombre").value;
    const apellido = document.getElementById("apellido").value;

    const formData = new FormData(form);
    const formValues = Object.fromEntries(formData.entries());

    const finalData = {
      DNI: dni,
      Nombre: nombre,
      Apellido: apellido,
      "Nombre Enfermera": document.getElementById("nombre_enfermera").value,
      ...formValues,
    };

    try {
      const response = await fetch("/api/enfermeria/guardar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalData),
      });

      const result = await response.json();

      if (response.ok) {
        // Actualizar tablero_dia
        try {
          await fetch("/api/enfermeria/actualizar-tablero", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dni }),
          });
        } catch (e) {
          console.warn("No se pudo actualizar tablero:", e.message);
        }

        // Mostrar mensaje de éxito
        const msgExito = document.createElement("div");
        msgExito.style.cssText =
          "background:#f0fdf4; border:1px solid #86efac; border-radius:8px; padding:12px 16px; margin-top:16px; color:#15803d; font-weight:700; font-size:14px; text-align:center;";
        msgExito.innerHTML = "✅ Datos de enfermería guardados correctamente.";
        document.querySelector("main .container").appendChild(msgExito);

        form.reset();
        currentStep = 0;
        showStep(currentStep);

        // Mostrar sección de indicaciones
        mostrarSeccionIndicaciones(dni);
      } else {
        if (result.detail && result.detail.includes("duplicate")) {
          alert(
            "⚠️ Ya existe un registro de enfermería para este paciente en el día de hoy.",
          );
        } else {
          alert(`Error al guardar los datos: ${result.message}`);
        }
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Ocurrió un error al intentar guardar los datos.");
    }
  });

  // ── VERIFICAR DNI + ALERTAS ENFERMERÍA ──
  const dniInput = document.getElementById("dni");
  dniInput.addEventListener("blur", async function () {
    const dni = this.value.trim();
    if (!/^[a-zA-Z]?\d{6,8}$/.test(dni)) return;

    let msgEl = document.getElementById("dniMsg");
    if (!msgEl) {
      msgEl = document.createElement("div");
      msgEl.id = "dniMsg";
      msgEl.style.cssText =
        "margin-top:8px; padding:10px 14px; border-radius:8px; font-size:13px; font-weight:500;";
      dniInput.parentNode.appendChild(msgEl);
    }
    msgEl.style.cssText +=
      "background:#f8fafc; color:#64748b; border:1px solid #e2e8f0;";
    msgEl.innerHTML =
      '<i class="fas fa-spinner fa-spin" style="margin-right:6px"></i>Verificando afiliación...';

    try {
      // 1. Verificar IAPOS
      const res = await fetch("/verificar-afiliado/" + dni);
      const data = await res.json();

      if (!data.esActivo) {
        msgEl.style.cssText =
          "margin-top:8px; padding:10px 14px; border-radius:8px; font-size:13px; font-weight:500; background:#fef2f2; color:#dc2626; border:1px solid #fecaca;";
        msgEl.innerHTML =
          '<i class="fas fa-times-circle" style="margin-right:6px"></i>DNI no corresponde a un afiliado activo de IAPOS.';
        return;
      }

      msgEl.style.cssText =
        "margin-top:8px; padding:10px 14px; border-radius:8px; font-size:13px; font-weight:500; background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0;";
      msgEl.innerHTML =
        '<i class="fas fa-check-circle" style="margin-right:6px"></i>Afiliado activo — ' +
        (data.nombre || "") +
        (data.localidad ? " · " + data.localidad : "");

      // Autocompletar
      if (data.nombre) {
        const partes = data.nombre.trim().split(",");
        if (partes.length >= 2) {
          if (!document.getElementById("apellido").value)
            document.getElementById("apellido").value = partes[0].trim();
          if (!document.getElementById("nombre").value)
            document.getElementById("nombre").value = partes[1].trim();
        }
      }
      // 2. Alertas clínicas
      const alertasRes = await fetch("/alertas-clinicas/" + dni);
      const alertasData = await alertasRes.json();
      const alertas = alertasData.alertas || [];

      if (alertas.length > 0) {
        let modal = document.getElementById("modal-alertas-enf");
        if (!modal) {
          modal = document.createElement("div");
          modal.id = "modal-alertas-enf";
          modal.style.cssText =
            "margin-top:16px; border-radius:10px; overflow:hidden; border:2px solid #fca5a5;";
          dniInput.closest("div").parentNode.after(modal);
        }

        let html = `
        <div style="background:#dc2626; padding:10px 16px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;"
             onclick="document.getElementById('modal-alertas-enf-body').classList.toggle('hidden')">
            <span style="color:white; font-weight:700; font-size:13px;">
                <i class="fas fa-exclamation-triangle" style="margin-right:6px"></i>
                ALERTAS CLÍNICAS — ${alertas.length} registro${alertas.length > 1 ? "s" : ""}
            </span>
            <i class="fas fa-chevron-down" style="color:white; font-size:12px;"></i>
        </div>
        <div id="modal-alertas-enf-body" style="padding:12px 16px; background:#fff5f5; display:flex; flex-direction:column; gap:6px;">`;

        alertas.forEach((a) => {
          const color =
            a.tipo === "URGENTE"
              ? "#dc2626"
              : a.tipo === "RIESGO"
                ? "#d97706"
                : "#1d4ed8";
          const bg =
            a.tipo === "URGENTE"
              ? "#fef2f2"
              : a.tipo === "RIESGO"
                ? "#fffbeb"
                : "#eff6ff";
          html += `<div style="background:${bg}; border-left:3px solid ${color}; padding:7px 10px; border-radius:4px; font-size:13px; color:${color}; font-weight:500;">${a.mensaje}</div>`;
        });

        html += `</div>`;
        modal.innerHTML = html;
      }
    } catch (e) {
      msgEl.style.cssText =
        "margin-top:8px; padding:10px 14px; border-radius:8px; font-size:13px; font-weight:500; background:#fffbeb; color:#d97706; border:1px solid #fde68a;";
      msgEl.innerHTML =
        '<i class="fas fa-exclamation-triangle" style="margin-right:6px"></i>No se pudo verificar. Continuá o consultá a IAPOS.';
    }
  });
  // Muestra el formulario directamente, sin buscar DNI
  form.classList.remove("hidden");
  showStep(0);
  const enfermeraInput = document.getElementById("nombre_enfermera");
  if (window.dpProfesional && enfermeraInput) {
    enfermeraInput.value = window.dpProfesional;
    enfermeraInput.setAttribute("readonly", true);
    enfermeraInput.classList.add("bg-gray-100");
  }
});
async function mostrarSeccionIndicaciones(dni) {
  // Crear sección si no existe
  let seccion = document.getElementById("seccion-indicaciones");
  if (!seccion) {
    seccion = document.createElement("div");
    seccion.id = "seccion-indicaciones";
    seccion.style.cssText =
      "margin-top:24px; background:white; border-radius:12px; padding:20px; border:2px solid #3b82f6;";
    document.querySelector("main .container").appendChild(seccion);
  }

  <div style="margin-top:16px; border-top:1px solid #e5e7eb; padding-top:16px;">
    <button
      onclick="abrirCatalogoPracticas('${dni}')"
      style="width:100%; background:#f0f9ff; border:2px dashed #3b82f6; color:#1d4ed8; padding:10px; border-radius:8px; font-weight:700; cursor:pointer; font-size:13px;"
    >
      + Indicar práctica adicional
    </button>
  </div>;

  seccion.innerHTML = `
    <h3 style="color:#1d4ed8; font-weight:700; margin-bottom:16px; font-size:16px;">
        📋 Indicaciones para prestadores externos — DNI ${dni}
    </h3>
    <div id="lista-indicaciones-enf" style="margin-bottom:16px;">
        <p style="color:#999; text-align:center;">Cargando prácticas...</p>
    </div>
    
    <div style="margin-top:20px; text-align:center;">
        <button onclick="finalizarEnfermeria()"
            style="background:#014189; color:white; border:none; padding:12px 32px; border-radius:8px; font-weight:700; cursor:pointer; font-size:14px;">
            ✓ Finalizar y atender próximo paciente
        </button>
    </div>`;

  await cargarIndicacionesEnfermeria(dni);
  seccion.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function cargarIndicacionesEnfermeria(dni) {
  const lista = document.getElementById("lista-indicaciones-enf");
  try {
    const res = await fetch(`/api/practicas-indicaciones/${dni}`);
    const data = await res.json();
    const practicas = data.practicas || [];

    if (practicas.length === 0) {
      lista.innerHTML =
        '<p style="color:#999; text-align:center; font-size:13px;">No hay prácticas externas autorizadas para este paciente.</p>';
      return;
    }

    lista.innerHTML = practicas
      .map(
        (p) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border:1px solid ${p.indicacion_entregada ? "#86efac" : "#e5e7eb"}; border-radius:8px; margin-bottom:8px; background:${p.indicacion_entregada ? "#f0fdf4" : "#f9fafb"};">
                <span style="font-size:13px; color:${p.indicacion_entregada ? "#15803d" : "#374151"}; font-weight:${p.indicacion_entregada ? "700" : "400"};">
                    ${p.descripcion_practica}
                </span>
                <button onclick="marcarIndicacionEnfermeria(${p.id}, ${!p.indicacion_entregada}, '${dni}')"
                    style="font-size:12px; padding:5px 12px; border-radius:20px; font-weight:700; border:none; cursor:pointer; background:${p.indicacion_entregada ? "#dcfce7" : "#e5e7eb"}; color:${p.indicacion_entregada ? "#15803d" : "#6b7280"};">
                    ${p.indicacion_entregada ? "✓ Entregada" : "Marcar"}
                </button>
            </div>`,
      )
      .join("");
  } catch (e) {
    lista.innerHTML =
      '<p style="color:red; text-align:center; font-size:13px;">Error al cargar prácticas.</p>';
  }
}

async function marcarIndicacionEnfermeria(id, valor, dni) {
  await fetch(`/api/indicacion-practica/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ indicacion_entregada: valor }),
  });
  cargarIndicacionesEnfermeria(dni);
}

async function agregarPracticaDesdeEnfermeria(dni) {
  const descripcion = document
    .getElementById("nueva-practica-enf")
    .value.trim();
  if (!descripcion) return alert("Ingresá la descripción de la práctica.");
  await fetch("/api/agregar-practica-enfermeria", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dni, descripcion_practica: descripcion }),
  });
  document.getElementById("nueva-practica-enf").value = "";
  cargarIndicacionesEnfermeria(dni);
}
async function finalizarEnfermeria(dni) {
  const kitHpv = document.getElementById("check-kit-hpv")?.checked || false;
  const somf = document.getElementById("check-somf")?.checked || false;

  try {
    await fetch("/api/enfermeria/actualizar-extras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dni, kit_hpv: kitHpv, somf }),
    });
  } catch (e) {
    console.warn("No se pudo guardar extras:", e.message);
  }

  document.getElementById("seccion-indicaciones")?.remove();
  document.querySelectorAll('[id^="msgExito"]').forEach((el) => el.remove());
  document.getElementById("dni").value = "";
  document.getElementById("nombre").value = "";
  document.getElementById("apellido").value = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}
const CATALOGO_PRACTICAS_EXTERNAS = [
    { label: 'Mamografía', descripcion: 'mamografia' },
    { label: 'Ecografía Mamaria', descripcion: 'ecografia mamaria' },
    { label: 'Ecografía Abdominal', descripcion: 'ecografia abdominal' },
    { label: 'Videocolonoscopia - VCC', descripcion: 'videocolonoscopia - VCC' },
    { label: 'Densitometría Ósea', descripcion: 'densitometria osea' },
    { label: 'Papanicolau', descripcion: 'papanicolau' },
    { label: 'Oftalmología', descripcion: 'oftalmologia' },
    { label: 'Espirometría', descripcion: 'espirometria' },
    { label: 'Test HPV', descripcion: 'test HPV' },
    { label: 'Sangre Oculta en Materia Fecal - SOMF', descripcion: 'sangre oculta en materia fecal - SOMF' },
];

function abrirCatalogoPracticas(dni) {
    // Remover modal anterior si existe
    document.getElementById('modal-catalogo')?.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-catalogo';
    modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px;';
    modal.innerHTML = `
        <div style="background:white; border-radius:12px; padding:24px; max-width:480px; width:100%;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h3 style="color:#1d4ed8; font-weight:700; margin:0;">Indicar práctica adicional</h3>
                <button onclick="document.getElementById('modal-catalogo').remove()"
                    style="background:none; border:none; font-size:20px; cursor:pointer; color:#666;">✕</button>
            </div>
            <p style="font-size:13px; color:#666; margin-bottom:16px;">Seleccioná las prácticas que querés indicar al paciente:</p>
            <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:20px;">
                ${CATALOGO_PRACTICAS_EXTERNAS.map(p => `
                    <label style="display:flex; align-items:center; gap:10px; padding:10px 14px; border:1px solid #e5e7eb; border-radius:8px; cursor:pointer; hover:background:#f9fafb;">
                        <input type="checkbox" value="${p.descripcion}" style="width:16px; height:16px;">
                        <span style="font-size:13px; color:#374151;">${p.label}</span>
                    </label>`).join('')}
            </div>
            <button onclick="guardarPracticasAdicionales('${dni}')"
                style="width:100%; background:#1d4ed8; color:white; border:none; padding:12px; border-radius:8px; font-weight:700; cursor:pointer; font-size:14px;">
                ✓ Autorizar e indicar seleccionadas
            </button>
        </div>`;
    document.body.appendChild(modal);
}

async function guardarPracticasAdicionales(dni) {
    const checkboxes = document.querySelectorAll('#modal-catalogo input[type="checkbox"]:checked');
    if (checkboxes.length === 0) return alert('Seleccioná al menos una práctica.');

    const practicasAGuardar = [];
    checkboxes.forEach(cb => {
        if (cb.value === 'test HPV') {
            practicasAGuardar.push('test HPV genotipo 16');
            practicasAGuardar.push('test HPV genotipo 18');
            practicasAGuardar.push('test HPV otros genotipos alto riesgo');
        } else {
            practicasAGuardar.push(cb.value);
        }
    });

    try {
        const res = await fetch('/api/agregar-practicas-adicionales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dni, practicas: practicasAGuardar })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('modal-catalogo').remove();
            cargarIndicacionesEnfermeria(dni);
        } else {
            alert('Error al guardar: ' + data.message);
        }
    } catch(e) {
        alert('Error de conexión.');
    }
}