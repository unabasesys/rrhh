/**
 * Genera 6 meses de liquidaciones (ene–jun 2026) para los trabajadores de
 * "Empresa DEMO SPA", simulando incrementos de sueldo, contrato nuevo y baja
 * para que el gráfico de costo empresa del home se vea poblado.
 *
 * Uso: node scripts/seed-demo-liquidaciones.mjs
 *
 * Idempotencia: borra todas las liquidaciones existentes de la org demo del
 * año 2026 antes de insertar las nuevas, así se puede correr varias veces.
 */
import mongoose from 'mongoose'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Cargar .env
try {
  const env = readFileSync(resolve(__dirname, '../.env'), 'utf8')
  for (const line of env.split('\n')) {
    const [k, ...v] = line.split('=')
    if (k && !k.startsWith('#') && v.length) process.env[k.trim()] = v.join('=').trim()
  }
} catch {}

const uri = process.env.MONGODB_URI
if (!uri) { console.error('❌ MONGODB_URI no definida'); process.exit(1) }

await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || 'rrhh' })

// Mongoose con schemas mínimos (_id: String para usar nuestro formato).
// Para inserts usamos el driver nativo (insertMany del collection) para
// evitar cualquier autocast de ObjectId.
const baseSchema = (col) => new mongoose.Schema({ _id: String }, { strict: false, collection: col, _id: false })
const Organization = mongoose.model('Organization', baseSchema('organizations'))
const Contrato     = mongoose.model('Contrato',     baseSchema('contratos'))
// Mongoose pluraliza "Liquidacion" → "liquidacions" (no "liquidaciones");
// usamos esa colección para que el modelo del app las encuentre.
const liquidacionesCol = mongoose.connection.collection('liquidacions')

const demoOrg = await Organization.findOne({ nombre: /^Empresa DEMO SPA$/i }).lean()
if (!demoOrg) { console.error('❌ No existe Empresa DEMO SPA en la base'); process.exit(1) }
console.log(`✓ Org demo: ${demoOrg._id}`)

const contratos = await Contrato.find({ orgId: demoOrg._id }).lean()
console.log(`✓ ${contratos.length} contratos en la org demo`)

if (!contratos.length) {
  console.error('❌ La org demo no tiene contratos — crea los datos demo primero')
  process.exit(1)
}

// Limpiar liquidaciones previas de la org demo del año 2026
const borradas = await liquidacionesCol.deleteMany({ orgId: demoOrg._id, anio: 2026 })
console.log(`✓ Borradas ${borradas.deletedCount} liquidaciones previas de 2026`)

// ── Definir trayectoria 2026 ──────────────────────────────────────────────
// Mes 1 = enero, mes 6 = junio. Sueldos en CLP brutos (sueldo_base).
// Estructura por trabajador: lista de tramos { desdeMes, hastaMes, sueldoBase }
const trayectorias = contratos.map((c, i) => {
  const nombreCompleto = c.trabajador_nombre || `Trabajador ${i + 1}`
  // Sueldo base del contrato. Para sueldos altos (>$5M, ejemplo Camila Pérez
  // con $8.1M tipo proyecto) bajamos a un rango más realista para evitar
  // dominar visualmente el gráfico.
  let baseInicial = Number(c.sueldo_base) || (700_000 + (i % 5) * 250_000)
  if (baseInicial > 5_000_000) baseInicial = Math.round(baseInicial / 3)
  const tid = c.trabajador_id || c._id

  // Reglas:
  //   i = 0     → baja en abril (último mes liquidado = marzo)
  //   i = 1,2   → aumento de 12% desde abril
  //   resto     → trabaja todo el año sin cambios
  if (i === 0) {
    return { tid, nombre: nombreCompleto, tramos: [
      { desde: 1, hasta: 3, base: baseInicial },
    ]}
  }
  if (i === 1 || i === 2) {
    return { tid, nombre: nombreCompleto, tramos: [
      { desde: 1, hasta: 3, base: baseInicial },
      { desde: 4, hasta: 6, base: Math.round(baseInicial * 1.12) },
    ]}
  }
  return { tid, nombre: nombreCompleto, tramos: [
    { desde: 1, hasta: 6, base: baseInicial },
  ]}
})

// Contrato nuevo: persona que entra en abril
trayectorias.push({
  tid:    `w_demo_nuevo_${Date.now()}`,
  nombre: 'Camila Vergara Soto',
  tramos: [{ desde: 4, hasta: 6, base: 1_350_000 }],
  esNuevo: true,
})

// Otro contrato nuevo: entra en mayo con sueldo mayor (rol senior)
trayectorias.push({
  tid:    `w_demo_nuevo2_${Date.now() + 1}`,
  nombre: 'Matías Soto Pérez',
  tramos: [{ desde: 5, hasta: 6, base: 2_100_000 }],
  esNuevo: true,
})

// ── Generar liquidaciones ─────────────────────────────────────────────────
// Fórmula simplificada (cálculo real está en stores/rrhh.js — para seed usamos
// aproximación razonable que produce números realistas):
//   total_haberes   = sueldo_base × 1.25  (incluye gratificación legal 25%)
//   afp             = 11.44% del imponible
//   salud           = 7%   del imponible
//   cesantia_trab   = 0.6%
//   total_descuentos = afp + salud + cesantia_trab + impuesto (simplificado)
//   liquido_a_pagar = total_haberes - total_descuentos
//   cesantia_empl   = 2.4%
//   sis_empl        = 1.62%
//   costo_empresa   = total_haberes + cesantia_empl + sis_empl

function calcular(base) {
  const totalHaberes = Math.round(base * 1.25)
  const afp          = Math.round(totalHaberes * 0.1144)
  const salud        = Math.round(totalHaberes * 0.07)
  const cesTrab      = Math.round(totalHaberes * 0.006)
  // Impuesto único simplificado: solo si totalHaberes > 1.5M
  const impuesto     = totalHaberes > 1_500_000 ? Math.round(totalHaberes * 0.04) : 0
  const totalDesc    = afp + salud + cesTrab + impuesto
  const liquido      = totalHaberes - totalDesc
  const cesEmpl      = Math.round(totalHaberes * 0.024)
  const sisEmpl      = Math.round(totalHaberes * 0.0162)
  const costoEmpresa = totalHaberes + cesEmpl + sisEmpl
  return { totalHaberes, afp, salud, cesTrab, impuesto, totalDesc, liquido, cesEmpl, sisEmpl, costoEmpresa }
}

const liquidaciones = []
const ahora = new Date()

for (const t of trayectorias) {
  for (const tramo of t.tramos) {
    for (let mes = tramo.desde; mes <= tramo.hasta; mes++) {
      const c = calcular(tramo.base)
      const ts = Date.now() + Math.floor(Math.random() * 1e6)
      const rand = Math.random().toString(36).slice(2, 7)
      liquidaciones.push({
        _id:                  `liq_${ts}_${rand}`,
        trabajador_id:        t.tid,
        trabajador_nombre:    t.nombre,
        mes,
        anio:                 2026,
        dias_trabajados:      30,
        sueldo_base:          tramo.base,
        total_haberes:        c.totalHaberes,
        total_descuentos:     c.totalDesc,
        liquido_a_pagar:      c.liquido,
        costo_empresa:        c.costoEmpresa,
        afp_descuento:        c.afp,
        salud_descuento:      c.salud,
        cesantia_trabajador:  c.cesTrab,
        cesantia_empleador:   c.cesEmpl,
        impuesto:             c.impuesto,
        renta_imponible:      c.totalHaberes,
        renta_tributable:     c.totalHaberes - c.afp - c.salud,
        bonos:                [],
        descuentos:           [],
        estado:               'pagada',
        orgId:                demoOrg._id,
        creado:               ahora,
      })
    }
  }
}

const res = await liquidacionesCol.insertMany(liquidaciones)
console.log(`✓ Insertadas ${res.insertedCount} liquidaciones`)

// Resumen
const porMes = {}
for (const l of liquidaciones) {
  porMes[l.mes] = (porMes[l.mes] || 0) + l.costo_empresa
}
console.log('\nCosto empresa por mes:')
for (let m = 1; m <= 6; m++) {
  console.log(`  ${String(m).padStart(2, '0')}/2026: $${(porMes[m] || 0).toLocaleString('es-CL')}`)
}

const totalAnio = liquidaciones.reduce((s, l) => s + l.costo_empresa, 0)
console.log(`\nTotal año: $${totalAnio.toLocaleString('es-CL')}`)
console.log(`Promedio mensual: $${Math.round(totalAnio / 6).toLocaleString('es-CL')}`)

await mongoose.disconnect()
process.exit(0)
