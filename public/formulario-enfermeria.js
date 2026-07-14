const CATALOGO_PRACTICAS_EXTERNAS = [
  { label: "Mamografía", descripcion: "mamografia" },
  { label: "Ecografía Mamaria", descripcion: "ecografia mamaria" },
  { label: "Ecografía Abdominal", descripcion: "ecografia abdominal" },
  { label: "Videocolonoscopia - VCC", descripcion: "videocolonoscopia - VCC" },
  { label: "Densitometría Ósea", descripcion: "densitometria osea" },
  { label: "Papanicolau", descripcion: "papanicolau" },
  { label: "Oftalmología", descripcion: "oftalmologia" },
  { label: "Espirometría", descripcion: "espirometria" },
  { label: "Test HPV", descripcion: "test HPV" },
  {
    label: "Sangre Oculta en Materia Fecal - SOMF",
    descripcion: "sangre oculta en materia fecal - SOMF",
  },
];

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("enfermeria-form");
  const steps = document.querySelectorAll(".form-step");
  const progressBar = document.getElementById("progress-bar");
  const stepIndicator = document.getElementById("step-indicator");
  let currentStep = 0;

  function showStep(step) {
    steps.forEach((s, i) => {
      s.style.display = i === step ? "block" : "none";
    });
    const progress = ((step + 1) / steps.length) * 100;
    progressBar.style.width = progress + "%";
    stepIndicator.textContent = `Paso ${step + 1} de ${steps.length}`;
  }

  showStep(currentStep);

  document.getElementById("btn-next").addEventListener("click", function () {
    if (currentStep < steps.length - 1) {
      currentStep++;
      showStep(currentStep);
    }
  });

  document.getElementById("btn-prev").addEventListener("click", function () {
    if (currentStep > 0) {
      currentStep--;
      showStep(currentStep);
    }
  });

  // ── VERIFICAR AFILIADO ──
  document
    .getElementById("btn-verificar")
    .addEventListener("click", async function () {
      const dni = document.getElementById("dni").value.trim();
      if (!dni) return alert("Ingresá un DNI.");

      const resultDiv = document.getElementById("resultado-verificacion");
      resultDiv.innerHTML =
        '<p style="color:#666;">Verificando afiliado...</p>';

      try {
        const response = await fetch(`/api/verificar-afiliado/${dni}`);
        const data = await response.json();

        if (data.esActivo) {
          document.getElementById("nombre").value = data.nombre || "";
          document.getElementById("apellido").value = data.apellido || "";

          let alertasHtml = "";
          if (data.alertas && data.alertas.length > 0) {
            alertasHtml = `
              <div id="modal-alertas-enf" style="margin-top:12px; background:#fff3cd; border:1px solid #ffc107; border-radius:8px; padding:12px;">
                <p style="font-weight:700; color:#856404; margin-bottom:8px;">⚠️ Alertas para este afiliado:</p>
                <ul style="margin:0; padding-left:20px; color:#856404; font-size:13px;">
                  ${data.alertas.map((a) => `<li>${a}</li>`).join("")}
                </ul>
              </div>`;
          }

          resultDiv.innerHTML = `
            <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:8px; padding:12px;">
              <p style="color:#15803d; font-weight:700;">✅ Afiliado activo</p>
              <p style="color:#374151; font-size:13px;">${data.nombre || ""} — ${data.edad || "?"} años</p>
            </div>
            ${alertasHtml}`;
        } else {
          resultDiv.innerHTML = `
            <div style="background:#fef2f2; border:1px solid #fca5a5; border-radius:8px; padding:12px;">
              <p style="color:#dc2626; font-weight:700;">❌ No es afiliado activo</p>
              <p style="color:#374151; font-size:13px;">${data.mensaje || ""}</p>
            </div>`;
        }
      } catch (e) {
        resultDiv.innerHTML =
          '<p style="color:red;">Error al verificar afiliado.</p>';
      }
    });

  // ── GUARDAR FORMULARIO ──
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const dni = document.getElementById("dni").value.trim();
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

        // Mensaje de éxito
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
        if (
          result.detail &&
          (result.detail.includes("duplicate") ||
            result.detail === "duplicate_year")
        ) {
          alert("⚠️ " + result.message);
        } else {
          alert(`Error al guardar los datos: ${result.message}`);
        }
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Ocurrió un error al intentar guardar los datos.");
    }
  });
}); // FIN DOMContentLoaded

// ── FUNCIONES GLOBALES ──

async function mostrarSeccionIndicaciones(dni) {
  let seccion = document.getElementById("seccion-indicaciones");
  if (!seccion) {
    seccion = document.createElement("div");
    seccion.id = "seccion-indicaciones";
    seccion.style.cssText =
      "margin-top:24px; background:white; border-radius:12px; padding:20px; border:2px solid #3b82f6;";
    document.querySelector("main .container").appendChild(seccion);
  }

  seccion.innerHTML = `
    <h3 style="color:#1d4ed8; font-weight:700; margin-bottom:16px; font-size:16px;">
        📋 Indicaciones para prestadores externos — DNI ${dni}
    </h3>
    <div id="lista-indicaciones-enf" style="margin-bottom:16px;">
        <p style="color:#999; text-align:center;">Cargando prácticas...</p>
    </div>
    <div style="margin-top:16px; border-top:1px solid #e5e7eb; padding-top:16px;">
        <button onclick="abrirCatalogoPracticas('${dni}')"
            style="width:100%; background:#f0f9ff; border:2px dashed #3b82f6; color:#1d4ed8; padding:10px; border-radius:8px; font-weight:700; cursor:pointer; font-size:13px; margin-bottom:12px;">
            + Indicar práctica adicional
        </button>
    </div>
    <div style="margin-top:8px; text-align:center;">
        <button onclick="finalizarEnfermeria('${dni}')"
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
        '<p style="color:#999; text-align:center; font-size:13px;">No hay prácticas externas autorizadas para este paciente. Usá el botón de abajo para agregar.</p>';
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

function abrirCatalogoPracticas(dni) {
  document.getElementById("modal-catalogo")?.remove();

  const modal = document.createElement("div");
  modal.id = "modal-catalogo";
  modal.style.cssText =
    "position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px;";
  modal.innerHTML = `
    <div style="background:white; border-radius:12px; padding:24px; max-width:480px; width:100%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <h3 style="color:#1d4ed8; font-weight:700; margin:0;">Indicar práctica adicional</h3>
            <button onclick="document.getElementById('modal-catalogo').remove()"
                style="background:none; border:none; font-size:20px; cursor:pointer; color:#666;">✕</button>
        </div>
        <p style="font-size:13px; color:#666; margin-bottom:16px;">Seleccioná las prácticas que querés indicar al paciente:</p>
        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:20px;">
            ${CATALOGO_PRACTICAS_EXTERNAS.map(
              (p) => `
            <label style="display:flex; align-items:center; gap:10px; padding:10px 14px; border:1px solid #e5e7eb; border-radius:8px; cursor:pointer;">
                <input type="checkbox" value="${p.descripcion}" style="width:16px; height:16px;">
                <span style="font-size:13px; color:#374151;">${p.label}</span>
            </label>`,
            ).join("")}
        </div>
        <button onclick="guardarPracticasAdicionales('${dni}')"
            style="width:100%; background:#1d4ed8; color:white; border:none; padding:12px; border-radius:8px; font-weight:700; cursor:pointer; font-size:14px;">
            ✓ Autorizar e indicar seleccionadas
        </button>
    </div>`;
  document.body.appendChild(modal);
}

async function guardarPracticasAdicionales(dni) {
  const checkboxes = document.querySelectorAll(
    "#modal-catalogo input[type='checkbox']:checked",
  );
  if (checkboxes.length === 0) return alert("Seleccioná al menos una práctica.");

  const practicasAGuardar = [];
  checkboxes.forEach((cb) => {
    if (cb.value === "test HPV") {
      practicasAGuardar.push("test HPV genotipo 16");
      practicasAGuardar.push("test HPV genotipo 18");
      practicasAGuardar.push("test HPV otros genotipos alto riesgo");
    } else {
      practicasAGuardar.push(cb.value);
    }
  });

  try {
    const res = await fetch("/api/agregar-practicas-adicionales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dni, practicas: practicasAGuardar }),
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById("modal-catalogo").remove();
      cargarIndicacionesEnfermeria(dni);
    } else {
      alert("Error al guardar: " + data.message);
    }
  } catch (e) {
    alert("Error de conexión.");
  }
}

async function finalizarEnfermeria(dni) {
  try {
    await fetch("/api/enfermeria/actualizar-extras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dni }),
    });
  } catch (e) {
    console.warn("No se pudo guardar extras:", e.message);
  }

  document.getElementById("seccion-indicaciones")?.remove();
  document
    .querySelectorAll("div[style*='background:#f0fdf4']")
    .forEach((el) => el.remove());
  document.getElementById("dni").value = "";
  document.getElementById("nombre").value = "";
  document.getElementById("apellido").value = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}