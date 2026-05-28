import mongoose from 'mongoose'

const ContratoSchema = new mongoose.Schema({
  _id:               { type: String, required: true },  // c_timestamp_random
  trabajador_id:     { type: String, required: true, index: true },
  trabajador_nombre: { type: String },
  // Tipo
  tipo_contrato:     { type: String, required: true, enum: ['indefinido', 'plazo_fijo', 'proyecto', 'jornada', 'part_time', 'honorarios', 'sueldo_empresarial'] },
  subtipo:           { type: String },   // 'proyecto_obra' | 'jornada'
  // Vigencia
  fecha_inicio:      { type: String, required: true },
  fecha_termino:     { type: String },
  // Proyecto
  nombre_proyecto:   { type: String },
  negocio_id:        { type: String },
  negocio_nombre:    { type: String },
  linea_codigo:      { type: String },
  linea_nombre:      { type: String },
  // Rol
  cargo:             { type: String },
  descripcion_rol:   { type: String },
  jornada_semanal:   { type: String },
  lugar_trabajo:     { type: String },
  direccion_trabajo: { type: String },
  modalidad:         { type: String, default: 'presencial' },
  // Remuneración
  sueldo_base:       { type: Number, default: 0 },
  tipo_sueldo:       { type: String, default: 'liquido' },  // 'bruto' | 'liquido'
  valor_dia:         { type: Number },
  dias_contratados:  { type: Number },
  valor_hora_extra:  { type: Number },
  horas_extras_contratadas: { type: Number, default: 0 },
  gratificacion:     { type: String, default: 'mensual' },
  movilizacion:      { type: Number, default: 0 },
  colacion:          { type: Number, default: 0 },
  // Cláusulas
  clausulas:         { type: [String], default: [] },
  turno_id:          { type: String },
  // ── Sueldo Empresarial (Art. 31 N°6 LIR) ──────────────────────────────────
  // Aplica SOLO cuando tipo_contrato === 'sueldo_empresarial'. Es una figura
  // tributaria (no laboral): el socio/dueño se asigna remuneración como gasto
  // necesario. Sin subordinación, sin cesantía, sin gratificación legal. AFP
  // y salud son voluntarias y se pagan por Previred con RUT personal.
  rut_socio:               { type: String },
  pct_participacion:       { type: Number, default: 0 },   // % participación societaria
  cotiza_afp_voluntaria:   { type: Boolean, default: false },
  cotiza_salud_voluntaria: { type: Boolean, default: false },
  declara_trabajo_efectivo:{ type: Boolean, default: false }, // requisito SII
  justificacion_monto:     { type: String },                // respaldo razonabilidad de mercado
  // Estado
  estado:            { type: String, default: 'vigente', enum: ['vigente', 'terminado', 'borrador'] },
  pdf_generado:      { type: Boolean, default: false },
  // Org (multi-empresa)
  orgId:             { type: String, default: null, ref: 'Organization' },
  // Metadatos
  creado:            { type: Date, default: Date.now },
  fecha_generacion:  { type: String },
}, { _id: false, versionKey: false })

export default mongoose.models.Contrato
  || mongoose.model('Contrato', ContratoSchema)
