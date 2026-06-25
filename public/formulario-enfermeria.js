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

    // 1. Obtener los datos de los campos DNI, Nombre y Apellido manualmente
    const dni = document.getElementById("dni").value;
    const nombre = document.getElementById("nombre").value;
    const apellido = document.getElementById("apellido").value;

    // 2. Obtener el resto de los datos del formulario
    const formData = new FormData(form);
    const formValues = Object.fromEntries(formData.entries());

    // 3. Unir todos los datos en un solo objeto
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(finalData),
      });

      const result = await response.json();

      if (response.ok) {
        alert("Datos de enfermería guardados correctamente.");
        form.reset();
        currentStep = 0;
        showStep(currentStep);
      } else {
        alert(`Error al guardar los datos: ${result.message}`);
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
    if (!/^\d{7,8}$/.test(dni)) return;

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
