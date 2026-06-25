require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3003;

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
console.log('Sirviendo estáticos desde:', path.join(__dirname, 'public'));

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

// ── VERIFICAR AFILIADO IAPOS ──
app.get('/verificar-afiliado/:dni', async (req, res) => {
    const dni = req.params.dni;
    const hoy = new Date().toISOString().split('T')[0];
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
            <BEWsValidaAfi.Execute xmlns="IAPOS_WS">
                <Usuario>CONSULTAPDP</Usuario>
                <Passwd>1Qaz</Passwd>
                <Nafiliado>${dni}</Nafiliado>
                <Badocnumdo>${dni}</Badocnumdo>
                <Tidocodigo_de_documento>96</Tidocodigo_de_documento>
                <Ogorcodigo>1</Ogorcodigo>
                <Fechpresta>${hoy}</Fechpresta>
            </BEWsValidaAfi.Execute>
        </soap:Body>
    </soap:Envelope>`;
    try {
        const response = await axios.post(
            'https://aswe.santafe.gov.ar/iapos-sw-srvt/servlet/abewsvalidaafi',
            soapBody,
            {
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'SOAPAction': 'IAPOS_WSaction/ABEWSVALIDAAFI.Execute'
                },
                timeout: 10000
            }
        );
        const xml = response.data;
        const get = (tag) => {
            const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`));
            return m ? m[1].trim() : null;
        };
        const estado = get('Estado');
        res.json({
            esActivo: estado === 'A',
            estado,
            nombre: get('Apenom'),
            edad: get('Edad'),
            sexo: get('Sexo'),
            localidad: get('Localidad'),
            mensaje: get('Msgdsc')
        });
    } catch(e) {
        res.status(500).json({ esActivo: false, error: e.message });
    }
});

// ── GUARDAR ENFERMERÍA ──
app.post('/api/enfermeria/guardar', async (req, res) => {
    try {
        const newRow = req.body;
        newRow['Fecha_cierre_Enf'] = new Date().toLocaleDateString('es-AR');

        // 1. Guardar en Supabase
        const { error } = await supabase
            .from('enfermeria_consultas')
            .insert({
                dni: newRow['DNI'],
                nombre: newRow['Nombre'],
                apellido: newRow['Apellido'],
                altura_cm: newRow['Altura (cm)'],
                peso_kg: newRow['Peso (kg)'],
                circunferencia_cintura_cm: newRow['Circunferencia de cintura (cm)'],
                presion_arterial: newRow['Presion Arterial (mmhg)'],
                vacunas: newRow['Vacunas'],
                agudeza_visual: newRow['Agudeza Visual'],
                espirometria_pdf: newRow['Espirometria (Enlace a PDF)'],
                fecha_cierre_enf: newRow['Fecha_cierre_Enf'],
                nombre_enfermera: newRow['Nombre Enfermera']
            });

        if (error) {
            console.error('Error Supabase enfermería:', error);
            return res.status(500).json({ message: 'Error al guardar en base de datos.' });
        }

        console.log('✅ Enfermería guardada en Supabase para DNI:', newRow['DNI']);

        // 2. Backup Google Sheets (no bloqueante)
        if (APPS_SCRIPT_URL) {
            axios.post(APPS_SCRIPT_URL, {
                action: 'guardarEnfermeria',
                payload: newRow
            }).catch(e => console.warn('Backup Google Sheets falló:', e.message));
        }

        res.status(200).json({ message: 'Datos guardados correctamente.' });
    } catch (error) {
        console.error('Error al guardar datos de enfermería:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});
app.get('/alertas-clinicas/:dni', async (req, res) => {
    const { dni } = req.params;
    try {
        const { data: afiliado } = await supabase
            .from('afiliados').select('*').eq('dni', dni).single();

        const { data: ultimoDP } = await supabase
            .from('historial_dia_preventivo').select('*')
            .eq('dni', dni).order('fechax', { ascending: false }).limit(1).single();

        const alertas = [];

        // Patologías declaradas
        if (afiliado?.hipertension === 'si')
            alertas.push({ tipo: 'URGENTE', campo: 'Presion_Arterial', mensaje: '🚨 Declara hipertensión en hoja de vida' });
        if (afiliado?.diabetes === 'si')
            alertas.push({ tipo: 'URGENTE', campo: 'Diabetes', mensaje: '🚨 Declara diabetes en hoja de vida' });
        if (afiliado?.colesterol === 'si')
            alertas.push({ tipo: 'RIESGO', campo: 'IMC', mensaje: '⚠️ Declara colesterol alto en hoja de vida' });
        if (afiliado?.depresion === 'si')
            alertas.push({ tipo: 'RIESGO', campo: 'Salud_Mental', mensaje: '⚠️ Declara depresión en hoja de vida' });

        // Hábitos de riesgo
        if (afiliado?.fuma && afiliado.fuma !== 'nunca' && afiliado.fuma !== '')
            alertas.push({ tipo: 'RIESGO', campo: 'Tabaco', mensaje: `⚠️ Fumador declarado: ${afiliado.fuma}` });
        if (afiliado?.fumador_cronico === 'si')
            alertas.push({ tipo: 'URGENTE', campo: 'Tabaco', mensaje: '🚨 Fumador crónico declarado' });
        if (afiliado?.abuso_alcohol_drogas === 'si')
            alertas.push({ tipo: 'URGENTE', campo: 'Adicciones', mensaje: '🚨 Declara abuso de alcohol y/o drogas' });
        if (afiliado?.sedentarismo === 'si')
            alertas.push({ tipo: 'INFO', campo: 'IMC', mensaje: 'ℹ️ Declara sedentarismo' });

        // BMI desde hoja de vida
        if (afiliado?.categoria_bmi) {
            const cat = afiliado.categoria_bmi.toLowerCase();
            if (cat.includes('obesidad'))
                alertas.push({ tipo: 'URGENTE', campo: 'IMC', mensaje: `🚨 BMI ${afiliado.bmi} — ${afiliado.categoria_bmi} (hoja de vida)` });
            else if (cat.includes('sobrepeso'))
                alertas.push({ tipo: 'RIESGO', campo: 'IMC', mensaje: `⚠️ BMI ${afiliado.bmi} — ${afiliado.categoria_bmi} (hoja de vida)` });
        }

        // Antecedentes familiares relevantes
        if (afiliado?.hipertension_familiar === 'si')
            alertas.push({ tipo: 'INFO', campo: 'Presion_Arterial', mensaje: 'ℹ️ Antecedente familiar de hipertensión' });
        if (afiliado?.diabetes_familiar === 'si')
            alertas.push({ tipo: 'INFO', campo: 'Diabetes', mensaje: 'ℹ️ Antecedente familiar de diabetes' });

        // DP anterior
        if (ultimoDP?.presion_arterial === 'Hipertensión')
            alertas.push({ tipo: 'URGENTE', campo: 'Presion_Arterial', mensaje: '🚨 Hipertensión registrada en Día Preventivo anterior' });

        res.json({ success: true, afiliado: afiliado || null, alertas });
    } catch(e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.listen(PORT, () => console.log(`Portal Enfermería corriendo en http://localhost:${PORT}`));