<template>
  <div class="reportes-page">
    <!-- ── Section Tabs: Herramientas ─────────────────────────────────── -->
    <RrhhSectionTabs :tabs="herramientasTabs" current="reportes" />

    <!-- Sub-tabs internos -->
    <div class="report-tabs">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'previred' }"
        @click="activeTab = 'previred'"
      >
        <i class="u u-usuarios"></i> Previred
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'centralizacion' }"
        @click="activeTab = 'centralizacion'"
      >
        <i class="u u-cobros-y-pagos"></i> Centralización Contable
      </button>
    </div>

    <!-- Toolbar -->
    <div class="page-toolbar">
      <div class="toolbar-left">
        <select v-model="filtroAnio" class="form-input form-input-sm">
          <option v-for="y in anios" :key="y" :value="y">{{ y }}</option>
        </select>
        <select v-model="filtroMes" class="form-input form-input-sm">
          <option v-for="m in meses" :key="m.v" :value="m.v">{{ m.l }}</option>
        </select>
      </div>
      <div class="toolbar-right">
        <template v-if="activeTab === 'previred'">
          <button class="btn btn-outline" @click="descargarTXT" :disabled="!filasPrevired.length">
            <i class="u u-descargar"></i> Descargar TXT Previred
          </button>
          <button class="btn btn-primary" @click="descargarPDF" :disabled="!filasPrevired.length">
            <i class="u u-descargar"></i> Descargar PDF Leyes Sociales
          </button>
        </template>
        <template v-else>
          <button class="btn btn-primary" @click="descargarCentralizacion" :disabled="!filasPrevired.length">
            <i class="u u-descargar"></i> Descargar Excel Centralización
          </button>
        </template>
      </div>
    </div>

    <!-- KPI Dashboard -->
    <div class="kpi-grid">
      <div class="kpi-card kpi-main">
        <div class="kpi-icon"><i class="u u-usuarios"></i></div>
        <div class="kpi-data">
          <span class="kpi-label">Trabajadores en nómina</span>
          <span class="kpi-value">{{ filasPrevired.length }}</span>
          <span class="kpi-sub">{{ mesLabel }} {{ filtroAnio }}</span>
        </div>
      </div>
      <div class="kpi-card kpi-main">
        <div class="kpi-icon teal"><i class="u u-cobros-y-pagos"></i></div>
        <div class="kpi-data">
          <span class="kpi-label">Renta imponible total</span>
          <span class="kpi-value teal">{{ formatCLP(totales.imponible) }}</span>
          <span class="kpi-sub">base de cotización</span>
        </div>
      </div>
      <div class="kpi-card kpi-main">
        <div class="kpi-icon yellow"><i class="u u-folder-open"></i></div>
        <div class="kpi-data">
          <span class="kpi-label">Cotización AFP</span>
          <span class="kpi-value yellow">{{ formatCLP(totales.afp) }}</span>
          <span class="kpi-sub">descuento trabajador</span>
        </div>
      </div>
      <div class="kpi-card kpi-main">
        <div class="kpi-icon purple"><i class="u u-ventas"></i></div>
        <div class="kpi-data">
          <span class="kpi-label">Cotización Salud</span>
          <span class="kpi-value purple">{{ formatCLP(totales.salud) }}</span>
          <span class="kpi-sub">FONASA / ISAPRE</span>
        </div>
      </div>
    </div>

    <!-- ═══════════════ TAB PREVIRED ═══════════════ -->
    <template v-if="activeTab === 'previred'">
    <!-- Header sección -->
    <div class="section-header">
      <div>
        <h3>Previred · Nómina del período</h3>
        <p class="section-desc">
          Detalle de cotizaciones previsionales por trabajador. El archivo TXT cumple el formato estándar
          de declaración mensual de Previred; el PDF resume el detalle de leyes sociales para tu contabilidad.
        </p>
      </div>
    </div>

    <!-- Tabla Previred -->
    <div class="table-wrap">
      <table v-if="filasPrevired.length" class="data-table">
        <thead>
          <tr>
            <th>RUT</th>
            <th>Nombre</th>
            <th>Cargo</th>
            <th class="text-right">Días</th>
            <th>AFP</th>
            <th class="text-right">Imponible</th>
            <th class="text-right">Cot. AFP</th>
            <th class="text-right">SIS</th>
            <th>Salud</th>
            <th class="text-right">Cot. Salud</th>
            <th class="text-right">AFC trab.</th>
            <th class="text-right">AFC emp.</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in filasPrevired" :key="row.trabajador_id">
            <td><span class="mono">{{ row.rutFormat }}</span></td>
            <td>{{ row.nombreCompleto }}</td>
            <td class="muted">{{ row.cargo }}</td>
            <td class="text-right">{{ row.dias }}</td>
            <td>{{ row.afpNombre }}</td>
            <td class="text-right">{{ formatCLP(row.imponible) }}</td>
            <td class="text-right">{{ formatCLP(row.cotAfp) }}</td>
            <td class="text-right">{{ formatCLP(row.sis) }}</td>
            <td>{{ row.saludNombre }}</td>
            <td class="text-right">{{ formatCLP(row.cotSalud) }}</td>
            <td class="text-right">{{ formatCLP(row.afcTrab) }}</td>
            <td class="text-right">{{ formatCLP(row.afcEmp) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="5" class="text-right"><strong>Totales</strong></td>
            <td class="text-right"><strong>{{ formatCLP(totales.imponible) }}</strong></td>
            <td class="text-right"><strong>{{ formatCLP(totales.afp) }}</strong></td>
            <td class="text-right"><strong>{{ formatCLP(totales.sis) }}</strong></td>
            <td></td>
            <td class="text-right"><strong>{{ formatCLP(totales.salud) }}</strong></td>
            <td class="text-right"><strong>{{ formatCLP(totales.afcTrab) }}</strong></td>
            <td class="text-right"><strong>{{ formatCLP(totales.afcEmp) }}</strong></td>
          </tr>
        </tfoot>
      </table>

      <div v-else class="empty-state">
        <i class="u u-folder-open" style="font-size:42px;color:#374151"></i>
        <p>No hay liquidaciones para {{ mesLabel }} {{ filtroAnio }}.</p>
        <p class="hint">Genera las liquidaciones del período en la sección Contratos y Liq.</p>
      </div>
    </div>
    </template>

    <!-- ═══════════════ TAB CENTRALIZACIÓN ═══════════════ -->
    <template v-else-if="activeTab === 'centralizacion'">
    <div class="section-header">
      <div>
        <h3>Centralización Contable de Remuneraciones</h3>
        <p class="section-desc">
          Asientos contables del período listos para subir a tu sistema (un Debe/Haber por concepto).
          Las cargas patronales se duplican: una al Debe como gasto y otra al Haber como pasivo por pagar.
        </p>
      </div>
    </div>

    <div class="table-wrap">
      <table v-if="filasCentralizacion.length" class="data-table">
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Cód. CC</th>
            <th>Centro Costo</th>
            <th class="text-right">Debe</th>
            <th class="text-right">Haber</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in filasCentralizacion" :key="idx">
            <td>{{ row.concepto }}</td>
            <td class="muted mono">{{ row.codigoCC || '—' }}</td>
            <td class="muted">{{ row.centroCC || '—' }}</td>
            <td class="text-right">{{ row.debe ? formatCLP(row.debe) : '' }}</td>
            <td class="text-right">{{ row.haber ? formatCLP(row.haber) : '' }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" class="text-right"><strong>TOTAL</strong></td>
            <td class="text-right"><strong>{{ formatCLP(totalesCentralizacion.debe) }}</strong></td>
            <td class="text-right"><strong>{{ formatCLP(totalesCentralizacion.haber) }}</strong></td>
          </tr>
        </tfoot>
      </table>

      <div v-else class="empty-state">
        <i class="u u-folder-open" style="font-size:42px;color:#374151"></i>
        <p>No hay liquidaciones para {{ mesLabel }} {{ filtroAnio }}.</p>
        <p class="hint">Genera las liquidaciones del período en la sección Contratos y Liq.</p>
      </div>
    </div>
    </template>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import useRrhhStore from '@/stores/rrhh'
import RrhhSectionTabs from '@/components/rrhh/SectionTabs.vue'

definePageMeta({ name: 'rrhh-reportes', layout: 'rrhh', middleware: ['auth'] })

const rrhhStore = useRrhhStore()

const now = new Date()
const filtroAnio = ref(now.getFullYear())
const filtroMes  = ref(now.getMonth() + 1)
const activeTab  = ref('previred')   // 'previred' | 'centralizacion'

const meses = [
  { v: 1, l: 'Enero' }, { v: 2, l: 'Febrero' }, { v: 3, l: 'Marzo' },
  { v: 4, l: 'Abril' }, { v: 5, l: 'Mayo' }, { v: 6, l: 'Junio' },
  { v: 7, l: 'Julio' }, { v: 8, l: 'Agosto' }, { v: 9, l: 'Septiembre' },
  { v: 10, l: 'Octubre' }, { v: 11, l: 'Noviembre' }, { v: 12, l: 'Diciembre' },
]
const mesLabel = computed(() => meses.find(m => m.v === filtroMes.value)?.l || '')

const anios = computed(() => {
  const yr = now.getFullYear()
  return [yr + 1, yr, yr - 1, yr - 2, yr - 3]
})

const herramientasTabs = [
  { key: 'reportes', label: 'Reportes y Nómina', path: '/rrhh/reportes' },
  { key: 'informes', label: 'Informes Asistencia', path: '/rrhh/asistencia/informes' },
]

// Asegurar que trabajadores y liquidaciones estén cargados al entrar
// (si el usuario entra directo a /rrhh/reportes el store estaba vacío).
onMounted(async () => {
  try {
    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()
    await authStore.init()
    rrhhStore.setOrgId?.(authStore.currentOrgId)
  } catch {}
  if (!rrhhStore.trabajadores?.length) await rrhhStore.getTrabajadores?.()
  if (!rrhhStore.liquidaciones?.length) await rrhhStore.getLiquidaciones?.()
})

// ─── Cotización: una fila por liquidación válida del mes/año seleccionado ──
// Reglas:
//  - Scope por organización activa
//  - Excluir borradores
//  - Excluir liquidaciones cuyo trabajador no existe o está inactivo
//  - Un trabajador puede tener N liquidaciones (varios contratos vigentes)
const liquidacionesPeriodo = computed(() => {
  const oid = rrhhStore.currentOrgId
  const activos = new Set(
    (rrhhStore.trabajadores || [])
      .filter(t => t.estado !== 'inactivo')
      .map(t => t._id)
  )
  return (rrhhStore.liquidaciones || []).filter(l => {
    if (oid && l.orgId && l.orgId !== oid) return false
    if (Number(l.anio) !== Number(filtroAnio.value)) return false
    if (Number(l.mes)  !== Number(filtroMes.value))  return false
    if (l.estado === 'borrador') return false
    if (!activos.has(l.trabajador_id)) return false   // excluye huérfanas e inactivos
    return true
  })
})

const filasPrevired = computed(() =>
  liquidacionesPeriodo.value.map(liq => {
    const trab = rrhhStore.trabajadores.find(t => t._id === liq.trabajador_id) || {}
    const sueldoImp = liq.total_imponible ?? liq.sueldo_base ?? 0
    return {
      trabajador_id:   liq.trabajador_id,
      rutFormat:       formatRut(trab.rut),
      rutLimpio:       (trab.rut || '').replace(/[^0-9kK]/g, ''),
      nombreCompleto:  [trab.nombre, trab.apellido_paterno || trab.apellido, trab.apellido_materno].filter(Boolean).join(' ').trim() || trab.nombre || '—',
      apellidoPaterno: trab.apellido_paterno || trab.apellido || '',
      apellidoMaterno: trab.apellido_materno || '',
      nombres:         trab.nombre || '',
      sexo:            (trab.sexo || 'M').toUpperCase(),
      cargo:           trab.cargo || '—',
      dias:            liq.dias_trabajados || 30,
      imponible:       sueldoImp,
      afpNombre:       trab.afp || liq.afp_nombre || 'Modelo',
      cotAfp:          liq.afp_descuento || 0,
      sis:             liq.sis_empleador || Math.round(sueldoImp * 0.0162),
      saludNombre:     trab.isapre || trab.salud || liq.salud_nombre || 'Fonasa',
      cotSalud:        liq.salud_descuento || 0,
      afcTrab:         liq.cesantia_trabajador || 0,
      afcEmp:          liq.cesantia_empleador  || 0,
      tipoContrato:    trab.tipo_contrato || liq.tipo_contrato || 'indefinido',
    }
  })
)

const totales = computed(() => {
  const acc = { imponible: 0, afp: 0, sis: 0, salud: 0, afcTrab: 0, afcEmp: 0 }
  filasPrevired.value.forEach(r => {
    acc.imponible += r.imponible
    acc.afp      += r.cotAfp
    acc.sis      += r.sis
    acc.salud    += r.cotSalud
    acc.afcTrab  += r.afcTrab
    acc.afcEmp   += r.afcEmp
  })
  return acc
})

// ─── Filas Centralización (preview client-side) ─────────────────────────────
// Solo es vista previa. El cálculo real lo hace el backend al descargar.
const filasCentralizacion = computed(() => {
  if (!liquidacionesPeriodo.value.length) return []
  const liqs = liquidacionesPeriodo.value
  const rows = []
  const pushDebe  = (concepto, monto, cc = '0000', cn = 'raiz') => {
    if (monto) rows.push({ concepto, codigoCC: cc, centroCC: cn, debe: monto, haber: 0 })
  }
  const pushHaber = (concepto, monto, cc = '0000', cn = 'raiz') => {
    if (monto) rows.push({ concepto, codigoCC: cc, centroCC: cn, debe: 0, haber: monto })
  }
  const pushPatronal = (concepto, monto) => {
    if (!monto) return
    rows.push({ concepto, codigoCC: '0000', centroCC: 'raiz', debe: monto, haber: 0 })
    rows.push({ concepto, codigoCC: null,   centroCC: null,   debe: 0, haber: monto })
  }

  const sum = (key) => liqs.reduce((s, l) => s + (Number(l[key]) || 0), 0)

  const sueldoBase = sum('sueldo_base')
  const gratif     = sum('gratificacion')
  const afp        = sum('afp_descuento')
  const cesTrab    = sum('cesantia_trabajador')
  const impuesto   = sum('impuesto')
  const cesEmp     = sum('cesantia_empleador')
  const liquido    = sum('liquido_a_pagar')

  // Bonos/descuentos custom y salud separada por sistema
  let comision = 0, semCorrida = 0, hExtra = 0, otrosHab = 0
  let anticipos = 0, otrosDescTrb = 0, creditoCCAF = 0
  let saludFonasa = 0, isapre7 = 0, isapreSobre7 = 0
  let cesFondoSolid = 0, segAccid = 0, sis = 0, capInd = 0, expVida = 0

  for (const liq of liqs) {
    for (const b of (Array.isArray(liq.bonos) ? liq.bonos : [])) {
      const m = Number(b?.monto || b?.valor || 0)
      if (!m) continue
      const n = String(b?.nombre || b?.concepto || '').toLowerCase()
      if (n.includes('comisi')) comision += m
      else if (n.includes('semana')) semCorrida += m
      else if (n.includes('extra') || n.includes('hora')) hExtra += m
      else otrosHab += m
    }
    if (liq.semana_corrida) semCorrida += Number(liq.semana_corrida) || 0
    if (liq.horas_extra_valor) hExtra += Number(liq.horas_extra_valor) || 0
    for (const d of (Array.isArray(liq.descuentos) ? liq.descuentos : [])) {
      const m = Number(d?.monto || d?.valor || 0)
      if (!m) continue
      const n = String(d?.nombre || d?.concepto || '').toLowerCase()
      if (n.includes('anticip')) anticipos += m
      else if (n.includes('ccaf') || n.includes('crédito') || n.includes('credito')) creditoCCAF += m
      else otrosDescTrb += m
    }

    const t = rrhhStore.trabajadores.find(x => x._id === liq.trabajador_id)
    const desc = liq.salud_descuento || 0
    const imp  = liq.renta_imponible || liq.total_imponible || liq.sueldo_base || 0
    const tope7 = Math.round(imp * 0.07)
    const isFonasa = /fonasa/i.test(t?.sistema_salud || t?.isapre || 'fonasa')
    if (isFonasa) saludFonasa += desc
    else {
      isapre7      += Math.min(desc, tope7)
      isapreSobre7 += Math.max(0, desc - tope7)
    }

    cesFondoSolid += Math.round(imp * 0.014)
    segAccid      += Math.round(imp * 0.0093)
    sis           += Math.round(imp * 0.0162)
    capInd        += Math.round(imp * 0.001)
    expVida       += Math.round(imp * 0.007)
  }

  pushDebe('Sueldo Base',           sueldoBase)
  pushDebe('Gratificación Mensual', gratif)
  pushDebe('Comisión Venta',        comision)
  pushDebe('Semana Corrida',        semCorrida)
  pushDebe('Horas Extra 50%',       hExtra)
  if (otrosHab) pushDebe('Otros Haberes', otrosHab)

  pushHaber('AFP',                       afp)
  pushHaber('Salud 7% (Fonasa)',         saludFonasa)
  pushHaber('Isapre',                    isapre7)
  pushHaber('Isapre sobre 7%',           isapreSobre7)
  pushHaber('Seguro Cesantia Trabajador', cesTrab)
  pushHaber('Impuestos',                  impuesto)
  pushHaber('Descuento Anticipo',         anticipos)
  pushHaber('Otros Descuentos',           otrosDescTrb)
  pushHaber('Descuento Crédito Personal CCAF', creditoCCAF)

  pushPatronal('Seguro Cesantia Empleador',         cesEmp)
  pushPatronal('Seguro Cesantia (Fondo Solidario)', cesFondoSolid)
  pushPatronal('Seguro accidentes del Trabajo',     segAccid)
  pushPatronal('Seguro Invalidez y Supervivencia (SIS)', sis)

  pushDebe('Capitalización Individual AFP', capInd)
  pushDebe('Expectativa de Vida',           expVida)

  pushHaber('Liquido a Pago', liquido)

  return rows
})

const totalesCentralizacion = computed(() => {
  let debe = 0, haber = 0
  for (const r of filasCentralizacion.value) {
    debe  += r.debe  || 0
    haber += r.haber || 0
  }
  return { debe, haber }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatCLP(n) {
  if (n == null) return '$0'
  return '$' + Math.round(n).toLocaleString('es-CL')
}

function formatRut(rut) {
  if (!rut) return '—'
  const clean = String(rut).replace(/[^0-9kK]/g, '').toUpperCase()
  if (clean.length < 2) return rut
  const dv = clean.slice(-1)
  const num = clean.slice(0, -1)
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv
}

// ─── Descargas ───────────────────────────────────────────────────────────────
async function descargarTXT() {
  const anio = filtroAnio.value
  const mes  = String(filtroMes.value).padStart(2, '0')
  const authStore = (await import('@/stores/auth')).useAuthStore()
  const token = authStore.token
  const orgId = authStore.currentOrgId || ''

  try {
    const blob = await $fetch(`/api/rrhh/reportes/previred-txt?anio=${anio}&mes=${mes}${orgId ? '&orgId=' + orgId : ''}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      responseType: 'blob',
    })
    triggerDownload(blob, `previred_${anio}${mes}.txt`)
  } catch (e) {
    alert('No se pudo generar el archivo TXT: ' + (e?.data?.message || e.message))
  }
}

async function descargarPDF() {
  const anio = filtroAnio.value
  const mes  = String(filtroMes.value).padStart(2, '0')
  const authStore = (await import('@/stores/auth')).useAuthStore()
  const token = authStore.token
  const orgId = authStore.currentOrgId || ''

  try {
    const blob = await $fetch(`/api/rrhh/reportes/previred-pdf?anio=${anio}&mes=${mes}${orgId ? '&orgId=' + orgId : ''}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      responseType: 'blob',
    })
    triggerDownload(blob, `${anio}${mes}_detalle_leyes_sociales.pdf`)
  } catch (e) {
    alert('No se pudo generar el PDF: ' + (e?.data?.message || e.message))
  }
}

async function descargarCentralizacion() {
  const anio = filtroAnio.value
  const mes  = String(filtroMes.value).padStart(2, '0')
  const authStore = (await import('@/stores/auth')).useAuthStore()
  const token = authStore.token
  const orgId = authStore.currentOrgId || ''

  try {
    const blob = await $fetch(`/api/rrhh/reportes/centralizacion-xlsx?anio=${anio}&mes=${mes}${orgId ? '&orgId=' + orgId : ''}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      responseType: 'blob',
    })
    triggerDownload(blob, `${anio}${mes}_centralizacion_contable.xlsx`)
  } catch (e) {
    alert('No se pudo generar el Excel: ' + (e?.data?.message || e.message))
  }
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 100)
}
</script>

<style scoped>
.reportes-page { padding: 0 24px 32px; }

.page-toolbar {
  display: flex; justify-content: space-between; align-items: center;
  margin: 16px 0 20px; gap: 12px; flex-wrap: wrap;
}
.toolbar-left, .toolbar-right { display: flex; gap: 8px; align-items: center; }

.form-input {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  padding: 7px 11px;
  color: #e5e7eb;
  font-size: 13px;
}
.form-input-sm { font-size: 13px; }

.btn {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 14px; border-radius: 8px; font-weight: 600; font-size: 13px;
  cursor: pointer; border: 1px solid transparent;
  transition: all 0.15s ease;
}
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-outline {
  background: rgba(255,255,255,0.04);
  color: #e5e7eb;
  border-color: rgba(255,255,255,0.1);
}
.btn-outline:hover:not(:disabled) { background: rgba(255,255,255,0.08); }
.btn-primary {
  background: #0DCFA8;
  color: #062D3A;
}
.btn-primary:hover:not(:disabled) { opacity: 0.9; }

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}
.kpi-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  gap: 14px;
  align-items: center;
}
.kpi-icon {
  width: 40px; height: 40px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(13, 207, 168, 0.12);
  color: #0DCFA8;
  font-size: 20px;
  flex-shrink: 0;
}
.kpi-icon.teal   { background: rgba(13,207,168,0.12);   color: #0DCFA8; }
.kpi-icon.yellow { background: rgba(245,158,11,0.12);   color: #f59e0b; }
.kpi-icon.purple { background: rgba(139,92,246,0.12);   color: #8b5cf6; }

.kpi-data { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.kpi-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.4px; }
.kpi-value { font-size: 22px; font-weight: 700; color: #e5e7eb; }
.kpi-value.teal   { color: #0DCFA8; }
.kpi-value.yellow { color: #f59e0b; }
.kpi-value.purple { color: #8b5cf6; }
.kpi-sub { font-size: 11px; color: #6b7280; }

.section-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin: 12px 0 14px; gap: 16px;
}
.section-header h3 { font-size: 16px; font-weight: 700; margin: 0; color: #e5e7eb; }
.section-desc { font-size: 12px; color: #94a3b8; margin: 4px 0 0; max-width: 700px; line-height: 1.5; }

.table-wrap {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  overflow: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.data-table th {
  background: rgba(255,255,255,0.03);
  color: #94a3b8;
  font-weight: 600;
  text-align: left;
  padding: 11px 12px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  white-space: nowrap;
}
.data-table td {
  padding: 10px 12px;
  color: #e5e7eb;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.data-table tbody tr:hover { background: rgba(255,255,255,0.02); }
.data-table tfoot td {
  background: rgba(13,207,168,0.05);
  font-weight: 700;
  color: #0DCFA8;
  border-top: 1px solid rgba(13,207,168,0.15);
  border-bottom: none;
}
.text-right { text-align: right; }
.muted { color: #94a3b8; }
.mono { font-family: 'SFMono-Regular', Menlo, Consolas, monospace; font-size: 12px; }

.empty-state {
  padding: 60px 20px;
  text-align: center;
  color: #6b7280;
}
.empty-state p { margin: 12px 0 0; }
.empty-state .hint { font-size: 12px; color: #6b7280; margin-top: 6px; }

/* Sub-tabs internos */
.report-tabs {
  display: flex;
  gap: 4px;
  margin-top: 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 16px;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s ease;
}
.tab-btn:hover { color: #e5e7eb; }
.tab-btn.active {
  color: #0DCFA8;
  border-bottom-color: #0DCFA8;
}
</style>
