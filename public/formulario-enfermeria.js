document.addEventListener('DOMContentLoaded', () => {
    // Definición de elementos del DOM
    const form = document.getElementById('enfermeriaForm');
    const formStepsContainer = document.getElementById('form-steps-container');
    const steps = document.querySelectorAll('.form-step');
    const progressBar = document.getElementById('progress-bar');
    const prevBtn = document.getElementById('prev-step-btn');
    const nextBtn = document.getElementById('next-step-btn');
    const guardarBtn = document.getElementById('guardar-enfermeria-btn');

    // Variables de estado
    let currentStep = 0;
    const totalSteps = steps.length;

    // Función para mostrar el paso actual y actualizar la barra de progreso
    function showStep(stepIndex) {
        steps.forEach((step, index) => {
            if (index === stepIndex) {
                step.classList.remove('hidden');
            } else {
                step.classList.add('hidden');
            }
        });

        // Actualiza la barra de progreso
        const progress = (stepIndex + 1) / totalSteps * 100;
        progressBar.style.width = `${progress}%`;

        // Muestra/oculta los botones de navegación
        prevBtn.classList.toggle('hidden', stepIndex === 0);
        nextBtn.classList.toggle('hidden', stepIndex === totalSteps - 1);
        guardarBtn.classList.toggle('hidden', stepIndex !== totalSteps - 1);
    }

    // Eventos para los botones de navegación de pasos
    nextBtn.addEventListener('click', () => {
        currentStep++;
        showStep(currentStep);
    });

    prevBtn.addEventListener('click', () => {
        currentStep--;
        showStep(currentStep);
    });
 // Evento para el envío del formulario final
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Obtener los datos de los campos DNI, Nombre y Apellido manualmente
        const dni = document.getElementById('dni').value;
        const nombre = document.getElementById('nombre').value;
        const apellido = document.getElementById('apellido').value;

        // 2. Obtener el resto de los datos del formulario
        const formData = new FormData(form);
        const formValues = Object.fromEntries(formData.entries());

        // 3. Unir todos los datos en un solo objeto
        const finalData = {
            DNI: dni,
            Nombre: nombre,
            Apellido: apellido,
            ...formValues,
        };
        
        try {
            const response = await fetch('/api/enfermeria/guardar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(finalData)
            });

            const result = await response.json();

            if (response.ok) {
                alert('Datos de enfermería guardados correctamente.');
                form.reset();
                currentStep = 0;
                showStep(currentStep);
            } else {
                alert(`Error al guardar los datos: ${result.message}`);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Ocurrió un error al intentar guardar los datos.');
        }
    });

    // ── VERIFICAR DNI + ALERTAS ENFERMERÍA ──
const dniInput = document.getElementById('dni');
dniInput.addEventListener('blur', async function() {
    const dni = this.value.trim();
    if (!/^\d{7,8}$/.test(dni)) return;

    let msgEl = document.getElementById('dniMsg');
    if (!msgEl) {
        msgEl = document.createElement('div');
        msgEl.id = 'dniMsg';
        msgEl.style.cssText = 'margin-top:8px; padding:10px 14px; border-radius:8px; font-size:13px; font-weight:500;';
        dniInput.parentNode.appendChild(msgEl);
    }
    msgEl.style.cssText += 'background:#f8fafc; color:#64748b; border:1px solid #e2e8f0;';
    msgEl.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:6px"></i>Verificando afiliación...';

    try {
        // 1. Verificar IAPOS
        const res = await fetch('/verificar-afiliado/' + dni);
        const data = await res.json();

        if (!data.esActivo) {
            msgEl.style.cssText = 'margin-top:8px; padding:10px 14px; border-radius:8px; font-size:13px; font-weight:500; background:#fef2f2; color:#dc2626; border:1px solid #fecaca;';
            msgEl.innerHTML = '<i class="fas fa-times-circle" style="margin-right:6px"></i>DNI no corresponde a un afiliado activo de IAPOS.';
            return;
        }

        msgEl.style.cssText = 'margin-top:8px; padding:10px 14px; border-radius:8px; font-size:13px; font-weight:500; background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0;';
        msgEl.innerHTML = '<i class="fas fa-check-circle" style="margin-right:6px"></i>Afiliado activo — ' + (data.nombre || '') + (data.localidad ? ' · ' + data.localidad : '');

        // Autocompletar
        if (data.nombre) {
            const partes = data.nombre.trim().split(',');
            if (partes.length >= 2) {
                if (!document.getElementById('apellido').value) document.getElementById('apellido').value = partes[0].trim();
                if (!document.getElementById('nombre').value) document.getElementById('nombre').value = partes[1].trim();
            }
        }

        // 2. Alertas clínicas relevantes para enfermería
        const alertasRes = await fetch('/alertas-clinicas/' + dni);
        const alertasData = await alertasRes.json();

        const camposEnf = ['Presion_Arterial', 'IMC', 'Tabaco', 'Diabetes', 'Inmunizaciones'];
        const alertasEnf = (alertasData.alertas || []).filter(a => camposEnf.includes(a.campo));

        if (alertasEnf.length > 0) {
            let alertaBox = document.getElementById('alertas-enf');
            if (!alertaBox) {
                alertaBox = document.createElement('div');
                alertaBox.id = 'alertas-enf';
                alertaBox.style.cssText = 'margin-top:12px; border-radius:8px; overflow:hidden;';
                msgEl.parentNode.appendChild(alertaBox);
            }
            let html = '<div style="background:#fffbeb; border-left:4px solid #d97706; padding:10px 14px;">';
            html += '<p style="font-size:12px; font-weight:700; color:#92400e; margin-bottom:6px;"><i class="fas fa-exclamation-triangle" style="margin-right:6px"></i>Alertas clínicas relevantes:</p>';
            alertasEnf.forEach(a => {
                const color = a.tipo === 'URGENTE' ? '#dc2626' : a.tipo === 'RIESGO' ? '#d97706' : '#0448a2';
                html += `<p style="font-size:12px; color:${color}; margin:3px 0;">${a.mensaje}</p>`;
            });
            html += '</div>';
            alertaBox.innerHTML = html;
        }

    } catch(e) {
        msgEl.style.cssText = 'margin-top:8px; padding:10px 14px; border-radius:8px; font-size:13px; font-weight:500; background:#fffbeb; color:#d97706; border:1px solid #fde68a;';
        msgEl.innerHTML = '<i class="fas fa-exclamation-triangle" style="margin-right:6px"></i>No se pudo verificar. Continuá o consultá a IAPOS.';
    }
});
    // Muestra el formulario directamente, sin buscar DNI
    form.classList.remove('hidden');
    showStep(0);
});