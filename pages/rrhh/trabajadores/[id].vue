<template>
  <div class="ficha-trabajador">
    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>{{ t('loading') }}...</p>
    </div>

    <template v-else-if="trabajador">
      <!-- Header -->
      <div class="ficha-header">
        <div class="trabajador-hero">
          <div class="avatar-lg">
            <img v-if="trabajador.foto" :src="trabajador.foto" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />
            <template v-else>{{ initials }}</template>
          </div>
          <div class="hero-info">
            <h1>{{ trabajador.nombre }} {{ trabajador.apellido }}</h1>
            <p class="cargo">{{ trabajador.cargo }}</p>
            <div class="hero-badges">
              <span class="badge" :class="`badge-${trabajador.tipo_contrato}`">
                {{ labelContrato(trabajador.tipo_contrato) }}
              </span>
              <span class="badge" :class="`badge-estado-${trabajador.estado}`">
                {{ trabajador.estado === 'activo' ? 'Activo' : trabajador.estado === 'inactivo' ? 'Inactivo' : 'Pendiente' }}
              </span>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn btn-ghost" @click="$router.back()">
            <i class="u u-arrow-left"></i> Volver
          </button>
          <button v-if="fichaModificada" class="btn btn-save" :disabled="fichaGuardando" @click="guardarFicha">
            <i class="u u-check"></i> {{ fichaGuardando ? 'Guardando...' : 'Guardar Cambios' }}
          </button>
          <button class="btn btn-outline" @click="openGenContrato">
            <i class="u u-folder-open"></i> Nuevo Contrato
          </button>
          <button
            class="btn btn-danger"
            :disabled="finiquitosTrabajador.length > 0"
            :title="finiquitosTrabajador.length > 0 ? 'Ya existe un finiquito — elimínalo desde Documentos para reabrir' : 'Generar finiquito de término'"
            @click="openFiniquito"
          >
            <i class="u u-delete"></i>
            {{ finiquitosTrabajador.length > 0 ? 'Finiquitado' : 'Término Contrato' }}
          </button>
          <button class="btn btn-primary" @click="openNewLiquidacion">
            <i class="u u-cobros-y-pagos"></i> Nueva Liquidación
          </button>
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="kpi-row">
        <!-- Total Haberes desde última liquidación; fallback a sueldo base -->
        <div class="kpi-card">
          <span class="kpi-label">
            {{ ultimaLiquidacion ? `Total Haberes (${ultimaLiquidacion.mes}/${ultimaLiquidacion.anio})` : (contratosActivos.length > 1 ? `Sueldo (${contratosActivos.length} contratos)` : 'Sueldo Base') }}
          </span>
          <span class="kpi-value">
            {{ ultimaLiquidacion ? formatCLP(ultimaLiquidacion.total_haberes) : (sueldoTotalActivos ? formatCLP(sueldoTotalActivos) : '—') }}
          </span>
        </div>
        <!-- Líquido desde última liquidación; fallback a costo empresa -->
        <div class="kpi-card">
          <span class="kpi-label">
            {{ ultimaLiquidacion ? `Líquido a Pagar` : (contratosActivos.length > 1 ? 'Costo Empresa Total' : 'Costo Empresa') }}
          </span>
          <span class="kpi-value teal">
            {{ ultimaLiquidacion ? formatCLP(ultimaLiquidacion.liquido_a_pagar) : (contratosActivos.length ? formatCLP(costoEmpresa) : '—') }}
          </span>
        </div>
        <!-- Vacaciones acumuladas calculadas desde antigüedad -->
        <div class="kpi-card">
          <span class="kpi-label">Vacaciones Pendientes</span>
          <span class="kpi-value">{{ vacacionesAcumuladas }} días</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Antigüedad</span>
          <span class="kpi-value">{{ antiguedad }}</span>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs-bar">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-btn"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          <i :class="tab.icon"></i> {{ tab.label }}
        </button>
      </div>

      <!-- Tab: Ficha Personal (editable inline) -->
      <div v-if="activeTab === 'ficha'" class="tab-content">
        <div v-if="fichaModificada" class="ficha-save-banner">
          <span>Hay cambios sin guardar</span>
          <button class="btn btn-save btn-sm" :disabled="fichaGuardando" @click="guardarFicha">
            {{ fichaGuardando ? 'Guardando...' : '💾 Guardar Cambios' }}
          </button>
        </div>
        <div class="info-grid">
          <!-- Datos Personales -->
          <div class="info-section">
            <h3>Datos Personales</h3>
            <div class="info-rows">
              <div class="info-row">
                <span class="info-label">Nombre</span>
                <input class="info-input" v-model="fichaEdits.nombre" placeholder="Nombre" />
              </div>
              <div class="info-row">
                <span class="info-label">RUT</span>
                <input class="info-input" v-model="fichaEdits.rut" placeholder="12.345.678-9" />
              </div>
              <div class="info-row">
                <span class="info-label">Email</span>
                <input class="info-input" v-model="fichaEdits.email" type="email" placeholder="correo@empresa.cl" />
              </div>
              <div class="info-row">
                <span class="info-label">Teléfono</span>
                <input class="info-input" v-model="fichaEdits.telefono" placeholder="+56 9 1234 5678" />
              </div>
              <div class="info-row">
                <span class="info-label">Dirección</span>
                <input class="info-input" v-model="fichaEdits.direccion" placeholder="Calle, ciudad" />
              </div>
              <div class="info-row">
                <span class="info-label">F. Nacimiento</span>
                <input class="info-input" v-model="fichaEdits.fecha_nacimiento" type="date" />
              </div>
              <div class="info-row">
                <span class="info-label">Nacionalidad</span>
                <input class="info-input" v-model="fichaEdits.nacionalidad" placeholder="Chilena" />
              </div>
              <div class="info-row">
                <span class="info-label">Profesión</span>
                <input class="info-input" v-model="fichaEdits.profesion" placeholder="Ej: Ingeniero Civil, Técnico Audiovisual" />
              </div>
            </div>
          </div>

          <!-- Datos Laborales -->
          <div class="info-section">
            <h3>Datos Laborales</h3>
            <div class="info-rows">
              <div class="info-row">
                <span class="info-label">Cargo / Función</span>
                <input class="info-input" v-model="fichaEdits.cargo" placeholder="Cargo" />
              </div>
              <div class="info-row">
                <span class="info-label">Departamento</span>
                <input class="info-input" v-model="fichaEdits.departamento" placeholder="Área / Dpto." />
              </div>
              <div class="info-row">
                <span class="info-label">Fecha Ingreso</span>
                <input class="info-input" v-model="fichaEdits.fecha_ingreso" type="date" />
              </div>
            </div>
            <!-- Contrato vigente clickable -->
            <div v-if="contratoVigente" class="contrato-vigente-card" @click="abrirContratoExistente(contratoVigente)">
              <div class="cv-icon"><i class="u u-folder-open"></i></div>
              <div class="cv-info">
                <span class="cv-tipo">{{ labelContrato(contratoVigente.tipo_contrato) }}</span>
                <span class="cv-fechas">Desde {{ formatDate(contratoVigente.fecha_inicio) }}</span>
                <span v-if="contratoVigente.negocio_nombre" class="cv-proyecto">{{ contratoVigente.negocio_nombre }} · {{ contratoVigente.linea_codigo }}</span>
              </div>
              <span class="badge badge-estado-vigente cv-badge">Vigente</span>
              <i class="u u-arrow-right cv-arrow"></i>
            </div>
            <div v-else class="contrato-vigente-card empty-cv" @click="openGenContrato">
              <i class="u u-agregar"></i>
              <span>Sin contrato vigente — click para crear</span>
            </div>
          </div>

          <!-- Previsión Social -->
          <div class="info-section">
            <h3>Previsión Social</h3>
            <div class="info-rows">
              <div class="info-row">
                <span class="info-label">AFP</span>
                <select class="info-input" v-model="fichaEdits.afp">
                  <option>AFP Capital</option><option>AFP Cuprum</option>
                  <option>AFP Habitat</option><option>AFP Modelo</option>
                  <option>AFP PlanVital</option><option>AFP ProVida</option><option>AFP Uno</option>
                </select>
              </div>
              <div class="info-row">
                <span class="info-label">Sistema Salud</span>
                <select class="info-input" v-model="fichaEdits.sistema_salud">
                  <option>FONASA</option><option>Isapre</option>
                </select>
              </div>
              <template v-if="fichaEdits.sistema_salud === 'Isapre'">
                <div class="info-row">
                  <span class="info-label">Isapre</span>
                  <select class="info-input" v-model="fichaEdits.isapre_nombre">
                    <option value="">— Seleccionar —</option>
                    <option>Banmédica</option>
                    <option>Colmena Golden Cross</option>
                    <option>Cruz Blanca</option>
                    <option>Cruz del Norte</option>
                    <option>Esencial</option>
                    <option>MasVida</option>
                    <option>Nueva Masvida</option>
                    <option>Vida Tres</option>
                  </select>
                </div>
                <!-- Tipo de plan + monto -->
                <div class="info-row" style="align-items:flex-start;gap:6px;flex-wrap:wrap">
                  <span class="info-label" style="padding-top:6px">Tipo de Plan</span>
                  <div class="isapre-plan-row">
                    <!-- Selector de tipo -->
                    <select class="info-input isapre-tipo-select" v-model="fichaEdits.isapre_tipo">
                      <option value="UF">UF</option>
                      <option value="$">$</option>
                      <option value="7%+GES(UF)">7% + GES(UF)</option>
                      <option value="7%+GES($)">7% + GES($)</option>
                      <option value="%">%</option>
                    </select>
                    <!-- Input dinámico según tipo -->
                    <div class="money-input-wrap" style="flex:1;min-width:80px;max-width:110px">
                      <!-- UF -->
                      <template v-if="fichaEdits.isapre_tipo === 'UF'">
                        <span class="money-prefix" style="font-size:11px">UF</span>
                        <input class="info-input money-input" v-model.number="fichaEdits.isapre_monto"
                          type="number" step="0.01" min="0" placeholder="2.50" style="padding-left:38px" />
                      </template>
                      <!-- $ pesos -->
                      <template v-else-if="fichaEdits.isapre_tipo === '$'">
                        <span class="money-prefix">$</span>
                        <input class="info-input money-input" v-model.number="fichaEdits.isapre_monto"
                          type="number" step="1000" min="0" placeholder="80000" style="padding-left:28px" />
                      </template>
                      <!-- 7%+GES(UF) o 7%+GES($) → monto es el valor del GES -->
                      <template v-else-if="fichaEdits.isapre_tipo === '7%+GES(UF)'">
                        <span class="money-prefix" style="font-size:11px">UF</span>
                        <input class="info-input money-input" v-model.number="fichaEdits.isapre_monto"
                          type="number" step="0.01" min="0" placeholder="0.50" style="padding-left:38px" />
                      </template>
                      <template v-else-if="fichaEdits.isapre_tipo === '7%+GES($)'">
                        <span class="money-prefix">$</span>
                        <input class="info-input money-input" v-model.number="fichaEdits.isapre_monto"
                          type="number" step="1000" min="0" placeholder="20000" style="padding-left:28px" />
                      </template>
                      <!-- % personalizado -->
                      <template v-else-if="fichaEdits.isapre_tipo === '%'">
                        <input class="info-input money-input" v-model.number="fichaEdits.isapre_monto"
                          type="number" step="0.1" min="7" max="20" placeholder="7.0" style="padding-right:28px;text-align:right" />
                        <span class="money-prefix" style="left:auto;right:8px">%</span>
                      </template>
                    </div>
                  </div>
                </div>
                <!-- Descripción del tipo seleccionado -->
                <div class="info-row" v-if="fichaEdits.isapre_tipo">
                  <span class="info-label"></span>
                  <span class="info-value" style="font-size:11px;color:#6b7280;line-height:1.5">
                    <template v-if="fichaEdits.isapre_tipo === 'UF'">
                      Plan fijo en UF. Descuento = max(7% s/imponible, valor UF del plan).
                    </template>
                    <template v-else-if="fichaEdits.isapre_tipo === '$'">
                      Plan fijo en pesos. Descuento = max(7% s/imponible, monto $).
                    </template>
                    <template v-else-if="fichaEdits.isapre_tipo === '7%+GES(UF)' || fichaEdits.isapre_tipo === '7%+GES($)'">
                      7% s/imponible + aporte GES adicional.
                    </template>
                    <template v-else-if="fichaEdits.isapre_tipo === '%'">
                      Porcentaje personalizado sobre renta imponible (mínimo 7%).
                    </template>
                  </span>
                </div>
              </template>
              <div class="info-row">
                <span class="info-label">Seguro Cesantía</span>
                <span class="info-value muted">{{ ['plazo_fijo','proyecto','jornada'].includes(contratoVigente?.tipo_contrato) ? '0.6% + 3.0%' : '0.6% + 2.4%' }}</span>
              </div>
            </div>
          </div>

          <!-- Datos Bancarios -->
          <div class="info-section">
            <h3>Datos Bancarios</h3>
            <div class="info-rows">
              <div class="info-row">
                <span class="info-label">Banco</span>
                <select class="info-input" v-model="fichaEdits.banco">
                  <option value="">— Seleccionar —</option>
                  <option>Banco de Chile</option>
                  <option>Banco Estado</option>
                  <option>Banco Santander</option>
                  <option>BCI</option>
                  <option>Banco Itaú</option>
                  <option>Scotiabank</option>
                  <option>BBVA</option>
                  <option>Banco Security</option>
                  <option>Banco BICE</option>
                  <option>Banco Falabella</option>
                  <option>Banco Ripley</option>
                  <option>Coopeuch</option>
                  <option>Tenpo / MACH</option>
                </select>
              </div>
              <div class="info-row">
                <span class="info-label">Tipo de Cuenta</span>
                <select class="info-input" v-model="fichaEdits.tipo_cuenta">
                  <option value="">— Seleccionar —</option>
                  <option value="corriente">Cuenta Corriente</option>
                  <option value="vista">Cuenta Vista / RUT</option>
                  <option value="ahorro">Cuenta de Ahorro</option>
                </select>
              </div>
              <div class="info-row">
                <span class="info-label">N° de Cuenta</span>
                <input class="info-input" v-model="fichaEdits.numero_cuenta" placeholder="00000000000" inputmode="numeric" />
              </div>
              <div class="info-row">
                <span class="info-label">Email de Pago</span>
                <input class="info-input" v-model="fichaEdits.email_pago" type="email" placeholder="correo para notificación" />
              </div>
            </div>
          </div>

          <!-- Remuneración (resumen desde contratos activos) -->
          <div class="info-section">
            <h3>Remuneración</h3>
            <div v-if="contratosActivos.length" class="info-rows">
              <!-- Si hay múltiples contratos activos, mostrar total -->
              <template v-if="contratosActivos.length > 1">
                <div class="info-row">
                  <span class="info-label">Contratos activos</span>
                  <span class="info-value">{{ contratosActivos.length }}</span>
                </div>
                <div class="info-row" v-for="c in contratosActivos" :key="c._id">
                  <span class="info-label" style="font-size:11px">{{ c.negocio_nombre || labelContrato(c.tipo_contrato) }}</span>
                  <span class="info-value" style="color:#60a5fa">{{ formatCLP(c.sueldo_base) }}</span>
                </div>
                <div class="info-row highlight">
                  <span class="info-label">Total Sueldos</span>
                  <span class="info-value teal">{{ formatCLP(sueldoTotalActivos) }}</span>
                </div>
              </template>
              <!-- Un solo contrato activo -->
              <template v-else>
                <div class="info-row">
                  <span class="info-label">Sueldo Base</span>
                  <span class="info-value teal">{{ formatCLP(contratosActivos[0].sueldo_base) }}</span>
                </div>
                <div class="info-row" v-if="contratosActivos[0].movilizacion">
                  <span class="info-label">Movilización</span>
                  <span class="info-value">{{ formatCLP(contratosActivos[0].movilizacion) }}</span>
                </div>
                <div class="info-row" v-if="contratosActivos[0].colacion">
                  <span class="info-label">Colación</span>
                  <span class="info-value">{{ formatCLP(contratosActivos[0].colacion) }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Gratificación</span>
                  <span class="info-value">{{ contratosActivos[0].gratificacion === 'anual' ? 'Anual (25%)' : 'Mensual (1/12)' }}</span>
                </div>
              </template>
              <div class="info-row highlight">
                <span class="info-label">Costo Empresa</span>
                <span class="info-value teal">{{ contratosActivos.length ? formatCLP(costoEmpresa) : '—' }}</span>
              </div>
            </div>
            <div v-else class="contrato-vigente-card empty-cv" style="margin-top:0" @click="openGenContrato">
              <i class="u u-cobros-y-pagos"></i>
              <span>El sueldo se define en el contrato — click para crear</span>
            </div>
          </div>

          <!-- ── Acceso al Portal del Trabajador ─────────────────────────── -->
          <div class="info-section">
            <h3>Acceso al portal</h3>
            <div v-if="loadingAccount" class="info-rows">
              <div class="info-row"><span class="info-label">Cargando…</span></div>
            </div>
            <div v-else-if="linkedUser" class="info-rows">
              <div class="info-row">
                <span class="info-label">Email</span>
                <span class="info-value">{{ linkedUser.email }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Rol</span>
                <span class="info-value">
                  {{ linkedUser.rol === 'viewer' ? 'Trabajador' : linkedUser.rol }}
                </span>
              </div>
              <div class="info-row">
                <span class="info-label">Estado</span>
                <span class="info-value" :style="{ color: linkedUser.activo ? '#0DCFA8' : '#ef4444' }">
                  {{ linkedUser.activo ? 'Activo' : 'Desactivado' }}
                </span>
              </div>
              <div class="account-actions">
                <button class="btn btn-secondary btn-sm" @click="openResetPasswordModal">
                  <i class="u u-key"></i> Cambiar contraseña
                </button>
                <button class="btn btn-danger btn-sm" @click="confirmUnlinkUser">
                  <i class="u u-close"></i> Desvincular
                </button>
              </div>
            </div>
            <div v-else class="contrato-vigente-card empty-cv" style="margin-top:0" @click="openCreateAccountModal">
              <i class="u u-key"></i>
              <span>Crear cuenta de acceso al portal</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── Modal Crear cuenta de acceso ─────────────────────────────────── -->
      <div v-if="showCreateAccount" class="modal-overlay" @click.self="showCreateAccount = false">
        <div class="modal">
          <div class="modal-header">
            <h3>Crear cuenta de acceso</h3>
            <button class="btn-icon" @click="showCreateAccount = false"><i class="u u-close"></i></button>
          </div>
          <div class="modal-body">
            <p style="color:#9ca3af;font-size:13px;margin-bottom:14px">
              El trabajador podrá iniciar sesión en
              <code style="color:#0DCFA8">/login</code>
              y acceder a su portal personal para ver liquidaciones, marcaciones y datos.
            </p>
            <div class="form-group">
              <label>Email</label>
              <input class="form-input" v-model="newAccount.email" type="email" placeholder="trabajador@empresa.cl" />
            </div>
            <div class="form-group">
              <label>Contraseña inicial</label>
              <input class="form-input" v-model="newAccount.password" type="text" placeholder="Mínimo 6 caracteres" />
              <span class="form-hint">Compártela con el trabajador — puede cambiarla luego.</span>
            </div>
            <div v-if="newAccount.error" class="error-msg" style="color:#ef4444;margin-top:8px">
              {{ newAccount.error }}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="showCreateAccount = false">Cancelar</button>
            <button class="btn btn-primary" :disabled="newAccount.saving" @click="handleCreateAccount">
              {{ newAccount.saving ? 'Creando…' : 'Crear cuenta' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ─── Modal Reset Password ─────────────────────────────────────────── -->
      <div v-if="showResetPassword" class="modal-overlay" @click.self="showResetPassword = false">
        <div class="modal">
          <div class="modal-header">
            <h3>Cambiar contraseña</h3>
            <button class="btn-icon" @click="showResetPassword = false"><i class="u u-close"></i></button>
          </div>
          <div class="modal-body">
            <p style="color:#9ca3af;font-size:13px;margin-bottom:14px">
              Usuario: <strong>{{ linkedUser?.email }}</strong>
            </p>
            <div class="form-group">
              <label>Nueva contraseña</label>
              <input class="form-input" v-model="resetPwd.value" type="text" placeholder="Mínimo 6 caracteres" />
            </div>
            <div v-if="resetPwd.error" class="error-msg" style="color:#ef4444;margin-top:8px">
              {{ resetPwd.error }}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="showResetPassword = false">Cancelar</button>
            <button class="btn btn-primary" :disabled="resetPwd.saving" @click="handleResetPassword">
              {{ resetPwd.saving ? 'Guardando…' : 'Cambiar' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Tab: Documentos -->
      <div v-if="activeTab === 'documentos'" class="tab-content">
        <div class="docs-toolbar">
          <h3>Documentos</h3>
          <button class="btn btn-primary btn-sm" @click="showUploadDoc = true">
            <i class="u u-agregar"></i> Subir Documento
          </button>
        </div>

        <div class="docs-list" v-if="documentos.length">
          <div class="doc-row" v-for="doc in documentos" :key="doc._id">
            <div class="doc-icon">
              <i class="u u-folder-open"></i>
            </div>
            <div class="doc-info">
              <span class="doc-name">{{ doc.nombre }}</span>
              <span class="doc-meta">{{ doc.tipo }} · {{ formatDate(doc.fecha_subida) }}</span>
            </div>
            <div class="doc-actions">
              <button class="btn-icon" title="Descargar"><i class="u u-download"></i></button>
              <button class="btn-icon" title="Eliminar"><i class="u u-delete"></i></button>
            </div>
          </div>
        </div>

        <div class="empty-docs" v-else>
          <i class="u u-folder-open empty-icon"></i>
          <p>No hay documentos cargados</p>
          <button type="button" class="btn btn-outline btn-sm" @click="showUploadDoc = true">
            Subir primer documento
          </button>
        </div>

        <!-- Finiquitos -->
        <div v-if="finiquitosTrabajador.length" style="margin-top:28px">
          <div class="liq-toolbar" style="margin-bottom:12px">
            <h4 style="margin:0;font-size:14px;font-weight:600;color:#d1d5db">Finiquitos</h4>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>Fecha Término</th>
                <th>Causal</th>
                <th>Total</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="fin in finiquitosTrabajador" :key="fin._id">
                <td>{{ fin.fecha_termino ? formatDate(fin.fecha_termino) : `${fin.mes}/${fin.anio}` }}</td>
                <td style="font-size:12px;color:#9ca3af">
                  {{ MOTIVOS_TERMINO.find(m => m.value === fin.motivo_termino)?.label || fin.motivo_termino || '—' }}
                </td>
                <td class="teal"><strong>{{ formatCLP(fin.total_finiquito || 0) }}</strong></td>
                <td>
                  <span class="badge badge-estado-pagado">Firmado</span>
                </td>
                <td>
                  <template v-if="getEstadoFirmaDoc(fin._id)">
                    <span class="firma-badge" :class="`firma-${getEstadoFirmaDoc(fin._id).estado}`" style="font-size:10px;padding:2px 7px">
                      {{ getEstadoFirmaDoc(fin._id).estado === 'firmado' ? '✓ Firmado' : '⏳ Pendiente' }}
                    </span>
                  </template>
                  <button type="button" class="btn-icon" title="Descargar PDF" @click="descargarFiniquitoPDF(fin)">
                    <i class="u u-download"></i>
                  </button>
                  <button type="button" class="btn-icon btn-icon-danger" title="Eliminar finiquito y reactivar contratos" @click="pedirEliminarFiniquito(fin)">
                    <i class="u u-delete"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Modal confirmar eliminar finiquito -->
        <div v-if="confirmarEliminarFiniquito" class="modal-overlay" @click.self="confirmarEliminarFiniquito = false">
          <div class="modal-box" style="max-width:420px">
            <div class="modal-header">
              <h2>Eliminar Finiquito</h2>
              <button type="button" class="modal-close" @click="confirmarEliminarFiniquito = false">×</button>
            </div>
            <div class="modal-body">
              <p style="color:#f3f4f6;margin-bottom:12px">
                ¿Eliminar este finiquito? Esta acción:
              </p>
              <ul style="color:#d1d5db;font-size:13px;line-height:1.8;padding-left:20px;margin-bottom:16px">
                <li>Eliminará el registro del finiquito</li>
                <li>Reactivará los contratos asociados (→ <strong style="color:#34d399">vigente</strong>)</li>
                <li>Reactivará al trabajador (→ <strong style="color:#34d399">activo</strong>)</li>
              </ul>
              <p style="font-size:12px;color:#f59e0b">
                ⚠ Podrás volver a generar el finiquito desde el botón "Término Contrato".
              </p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-ghost" @click="confirmarEliminarFiniquito = false">Cancelar</button>
              <button type="button" class="btn btn-danger" @click="ejecutarEliminarFiniquito">
                <i class="u u-delete"></i> Eliminar y Reactivar
              </button>
            </div>
          </div>
        </div>

        <!-- Checklist documentos tipo contrato -->
        <div class="docs-checklist">
          <h4>Checklist Documentos Obligatorios</h4>
          <div class="checklist-grid">
            <label v-for="item in checklistDocs" :key="item.id" class="checklist-item">
              <input type="checkbox" :checked="item.done" class="checkbox-input" />
              <span class="checkbox-label" :class="{ done: item.done }">{{ item.label }}</span>
              <span v-if="item.done" class="check-ok">✓</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Tab: Liquidaciones -->
      <div v-if="activeTab === 'liquidaciones'" class="tab-content">
        <div class="liq-toolbar">
          <h3>Historial de Liquidaciones</h3>
          <button class="btn btn-primary btn-sm" @click="openNewLiquidacion">
            <i class="u u-agregar"></i> Nueva Liquidación
          </button>
        </div>

        <table class="data-table" v-if="liquidacionesTrabajador.length">
          <thead>
            <tr>
              <th>Período</th>
              <th>Sueldo Base</th>
              <th>Total Haberes</th>
              <th>Descuentos</th>
              <th>Líquido</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="liq in liquidacionesTrabajador" :key="liq._id">
              <td>{{ liq.mes }}/{{ liq.anio }}</td>
              <td>{{ formatCLP(liq.sueldo_base) }}</td>
              <td>{{ formatCLP(liq.total_haberes) }}</td>
              <td class="red">{{ formatCLP(liq.total_descuentos) }}</td>
              <td class="teal"><strong>{{ formatCLP(liq.liquido_a_pagar) }}</strong></td>
              <td>
                <span class="badge" :class="`badge-estado-${liq.estado}`">
                  {{ liq.estado === 'pagada' ? 'Pagada' : liq.estado === 'pendiente' ? 'Pendiente' : 'Borrador' }}
                </span>
              </td>
              <td>
                <template v-if="getEstadoFirmaDoc(liq._id)">
                  <span class="firma-badge" :class="`firma-${getEstadoFirmaDoc(liq._id).estado}`" style="font-size:10px;padding:2px 7px">
                    {{ getEstadoFirmaDoc(liq._id).estado === 'firmado' ? '✓' : '⏳' }}
                  </span>
                </template>
                <button class="btn-icon btn-firma-doc" title="Enviar a firmar"
                  @click="abrirFirmaModal('liquidacion', liq._id, { titulo: `Liquidación ${liq.mes}/${liq.anio}`, periodo: `${liq.mes}/${liq.anio}`, sueldo_base: liq.sueldo_base, liquido_pagar: liq.liquido_a_pagar })">
                  <i class="u u-edit"></i>
                </button>
                <button class="btn-icon" title="Ver detalle"><i class="u u-eye"></i></button>
                <button class="btn-icon" :class="{ 'spin': liqPdfLoading === liq._id }" title="Descargar PDF" @click="descargarLiqPDF(liq)">
                  <i class="u u-download"></i>
                </button>
                <button class="btn-icon btn-icon-danger" title="Eliminar liquidación" @click="pedirEliminarLiq(liq)">
                  <i class="u u-delete"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="empty-state" v-else>
          <i class="u u-cobros-y-pagos empty-icon"></i>
          <p>No hay liquidaciones registradas</p>
          <button class="btn btn-primary btn-sm" @click="openNewLiquidacion">Generar primera liquidación</button>
        </div>
      </div>

      <!-- Tab: Contratos -->
      <div v-if="activeTab === 'contratos'" class="tab-content">
        <div class="liq-toolbar">
          <h3>Contratos</h3>
          <button class="btn btn-primary btn-sm" @click="openGenContrato">
            <i class="u u-agregar"></i> Generar Contrato PDF
          </button>
        </div>

        <div class="contratos-list" v-if="contratosTrabajador.length">
          <div class="contrato-card" v-for="c in contratosTrabajador" :key="c._id"
            style="cursor:pointer" @click="abrirContratoExistente(c)">
            <div class="contrato-icon">
              <i class="u u-folder-open"></i>
            </div>
            <div class="contrato-info">
              <span class="contrato-tipo">{{ labelContrato(c.tipo_contrato) }}</span>
              <span class="contrato-fechas">
                {{ formatDate(c.fecha_inicio) }} — {{ c.fecha_termino ? formatDate(c.fecha_termino) : 'Indefinido' }}
              </span>
              <span v-if="c.nombre_proyecto" class="contrato-proyecto">📁 {{ c.nombre_proyecto }}</span>
              <span v-if="c.negocio_nombre" class="contrato-proyecto" style="color:#60a5fa">
                🎬 {{ c.negocio_nombre }}
                <span v-if="c.linea_codigo" style="color:#9ca3af"> · {{ c.linea_codigo }} {{ c.linea_nombre }}</span>
              </span>
              <span v-if="c.turno_id" class="contrato-proyecto" style="color:#f59e0b">
                ⏰ Turno: {{ asistenciaStore.turnos?.find(t => (t.id||t._id) === c.turno_id)?.nombre || c.turno_id }}
              </span>
            </div>
            <!-- Horas trabajadas / extra según marcas o liquidación -->
            <div class="contrato-horas" :class="{ 'sin-datos': !horasContratosMes[c._id] }">
              <div class="ch-mes">{{ new Date().toLocaleString('es-CL',{month:'short',year:'numeric'}) }}</div>
              <template v-if="horasContratosMes[c._id]">
                <div class="ch-row" v-if="horasContratosMes[c._id].horas !== null">
                  <i class="u u-asistencia-rrhh ch-icon"></i>
                  <span class="ch-val">{{ horasContratosMes[c._id].dias }} días · {{ horasContratosMes[c._id].horas }}h</span>
                </div>
                <div class="ch-row" v-else-if="horasContratosMes[c._id].dias">
                  <i class="u u-asistencia-rrhh ch-icon"></i>
                  <span class="ch-val">{{ horasContratosMes[c._id].dias }} días</span>
                </div>
                <div class="ch-row extra" v-if="horasContratosMes[c._id].extra > 0">
                  <i class="u u-agregar ch-icon"></i>
                  <span class="ch-val">+{{ horasContratosMes[c._id].extra }}h extra</span>
                </div>
                <div class="ch-row atraso" v-if="horasContratosMes[c._id].atrasos > 0">
                  <i class="u u-alerta ch-icon"></i>
                  <span class="ch-val">{{ horasContratosMes[c._id].atrasos }}min atraso</span>
                </div>
                <div class="ch-fuente">{{ horasContratosMes[c._id].fuente === 'marcas' ? 'marcas' : 'liquidación' }}</div>
              </template>
              <template v-else>
                <div class="ch-row muted">
                  <i class="u u-asistencia-rrhh ch-icon"></i>
                  <span class="ch-val">Sin marcas</span>
                </div>
              </template>
            </div>
            <!-- Resumen económico del contrato -->
            <div class="contrato-costo" v-if="c.sueldo_base">
              <div class="cc-row">
                <span class="cc-label">Líquido est.</span>
                <span class="cc-value">{{ formatCLP(c.sueldo_base) }}</span>
              </div>
              <div class="cc-row">
                <span class="cc-label">Costo empresa</span>
                <span class="cc-value teal">{{ formatCLP(calcCostoEmpresaContrato(c)) }}</span>
              </div>
            </div>
            <div class="contrato-estado">
              <span class="badge" :class="`badge-estado-${c.estado}`">
                {{ c.estado === 'vigente' ? 'Vigente' : c.estado === 'vencido' ? 'Vencido' : 'Firmado' }}
              </span>
            </div>
            <div class="contrato-actions" @click.stop>
              <!-- Estado de firma -->
              <template v-if="getEstadoFirmaDoc(c._id)">
                <span class="firma-badge" :class="`firma-${getEstadoFirmaDoc(c._id).estado}`"
                  :title="getEstadoFirmaDoc(c._id).estado === 'firmado' ? `Firmado el ${new Date(getEstadoFirmaDoc(c._id).fecha).toLocaleDateString('es-CL')}` : 'Pendiente de firma'">
                  {{ getEstadoFirmaDoc(c._id).estado === 'firmado' ? '✓ Firmado' : getEstadoFirmaDoc(c._id).estado === 'pendiente' ? '⏳ Firma pend.' : '✕ Rechazado' }}
                </span>
              </template>
              <button class="btn-icon btn-firma-doc" title="Enviar a firmar"
                @click="abrirFirmaModal('contrato', c._id, { titulo: `Contrato ${labelContrato(c.tipo_contrato)} — ${c.nombre_proyecto || c.negocio_nombre || ''}`.trim(), cargo: c.cargo, fecha_inicio: c.fecha_inicio, fecha_termino: c.fecha_termino, sueldo_base: c.sueldo_base, negocio: c.negocio_nombre })">
                <i class="u u-edit"></i>
              </button>
              <button class="btn-icon" title="Ver/Editar" @click="abrirContratoExistente(c)"><i class="u u-eye"></i></button>
              <button class="btn-icon" title="Descargar PDF" @click="descargarContratoPDFDesdeTab(c)">
                <i class="u u-download"></i>
              </button>
              <button class="btn-icon btn-icon-danger" title="Eliminar contrato" @click="pedirEliminarContrato(c)">
                <i class="u u-delete"></i>
              </button>
            </div>
          </div>
        </div>

        <div class="empty-state" v-else>
          <i class="u u-folder-open empty-icon"></i>
          <p>No hay contratos registrados</p>
          <button class="btn btn-primary btn-sm" @click="openGenContrato">Generar contrato</button>
        </div>
      </div>
    </template>

    <!-- Error State -->
    <div v-else class="error-state">
      <i class="u u-usuarios empty-icon"></i>
      <p>Trabajador no encontrado</p>
      <button class="btn btn-outline" @click="$router.back()">Volver</button>
    </div>

    <!-- ── Modal Contrato (unificado: crear / ver / editar) ─────────────────── -->
    <Teleport to="body">
    <div v-if="showGenContrato" class="modal-overlay" @click.self="showGenContrato = false">
      <div class="modal-box modal-contrato">
        <div class="modal-header">
          <div>
            <h2>{{ contratoViewMode ? 'Contrato' : 'Nuevo Contrato' }}</h2>
            <p class="modal-subtitle">{{ trabajador?.nombre }} {{ trabajador?.apellido }}</p>
          </div>
          <button class="modal-close" @click="showGenContrato = false">×</button>
        </div>
        <div class="modal-body">

          <!-- TIPO DE CONTRATO -->
          <div class="form-section">
            <h4 class="section-label">TIPO DE CONTRATO</h4>

            <!-- Nivel 1: tipo principal -->
            <div class="tipo-selector">
              <button type="button"
                :class="['tipo-pill', contratoForm.tipo_contrato === 'indefinido' && 'active']"
                @click="contratoForm.tipo_contrato = 'indefinido'">
                <i class="u u-usuarios"></i>
                <span>Indefinido</span>
              </button>
              <button type="button"
                :class="['tipo-pill', contratoForm.tipo_contrato === 'plazo_fijo' && 'active']"
                @click="contratoForm.tipo_contrato = 'plazo_fijo'">
                <i class="u u-calendario"></i>
                <span>Plazo Fijo</span>
              </button>
              <button type="button"
                :class="['tipo-pill', ['proyecto','jornada'].includes(contratoForm.tipo_contrato) && 'active']"
                @click="contratoForm.tipo_contrato = ['proyecto','jornada'].includes(contratoForm.tipo_contrato) ? contratoForm.tipo_contrato : 'proyecto'">
                <i class="u u-ventas"></i>
                <span>Proyecto</span>
              </button>
              <button type="button"
                :class="['tipo-pill', contratoForm.tipo_contrato === 'part_time' && 'active']"
                @click="contratoForm.tipo_contrato = 'part_time'">
                <i class="u u-settings"></i>
                <span>Part Time</span>
              </button>
              <!-- Honorarios: solo descarga plantilla Word -->
              <a
                href="/plantillas/contrato-honorarios.docx"
                download="contrato-honorarios-referencia.docx"
                class="tipo-pill tipo-pill-honorarios"
                title="Descarga plantilla Word de referencia para Honorarios">
                <i class="u u-descargar"></i>
                <span>Honorarios</span>
                <small style="font-size:8px;color:#60a5fa;margin-top:1px">↓ Word</small>
              </a>
            </div>

            <!-- Nivel 2: sub-selector Proyecto -->
            <div v-if="['proyecto','jornada'].includes(contratoForm.tipo_contrato)" class="proyecto-sub-selector">
              <!-- Por Proyecto / Obra -->
              <button type="button"
                :class="['proyecto-sub-card', contratoForm.tipo_contrato === 'proyecto' && 'active']"
                @click="contratoForm.tipo_contrato = 'proyecto'">
                <div class="psc-icon">🎬</div>
                <div class="psc-body">
                  <div class="psc-title">Por Proyecto / Obra</div>
                  <div class="psc-law">Ley N° 19.981 · Art. 159 N°5 CT</div>
                  <div class="psc-examples">Director &middot; Productor Ejecutivo &middot; Director de Fotografía &middot; Jefe de Producción</div>
                  <span class="psc-badge psc-badge-bruto">💰 Valor día BRUTO (desde OC)</span>
                </div>
                <div v-if="contratoForm.tipo_contrato === 'proyecto'" class="psc-check">✓</div>
              </button>

              <!-- Por Jornada / Funciones -->
              <button type="button"
                :class="['proyecto-sub-card psc-jornada', contratoForm.tipo_contrato === 'jornada' && 'active']"
                @click="contratoForm.tipo_contrato = 'jornada'">
                <div class="psc-icon">📋</div>
                <div class="psc-body">
                  <div class="psc-title">Por Jornada / Funciones</div>
                  <div class="psc-law">Art. 159 N°5 CT · Corta duración</div>
                  <div class="psc-examples">Técnico día &middot; Actor reparto &middot; Extra &middot; Figurante &middot; Asistente</div>
                  <span class="psc-badge psc-badge-liquido">🤝 Sueldo LÍQUIDO pactado</span>
                </div>
                <div v-if="contratoForm.tipo_contrato === 'jornada'" class="psc-check" style="color:#a78bfa">✓</div>
              </button>
            </div>
          </div>

          <!-- VIGENCIA -->
          <div class="form-section">
            <h4 class="section-label">VIGENCIA</h4>
            <div class="form-grid-2">
              <div class="form-group">
                <label>Fecha de Inicio *</label>
                <input v-model="contratoForm.fecha_inicio" type="date" class="form-input" @change="recalcDiasContrato" />
              </div>
              <div class="form-group" v-if="contratoForm.tipo_contrato !== 'indefinido'">
                <label>Fecha de Término</label>
                <input v-model="contratoForm.fecha_termino" type="date" class="form-input" @change="recalcDiasContrato" />
              </div>
            </div>
          </div>

          <!-- ASOCIACIÓN PRESUPUESTAL (movida arriba) -->
          <div class="form-section">
            <h4 class="section-label">PROYECTO / NEGOCIO</h4>
            <div class="form-grid-2">
              <div class="form-group" style="position:relative">
                <label>Buscar Negocio / Proyecto</label>
                <input
                  v-model="negocioBusqueda"
                  type="text"
                  class="form-input"
                  placeholder="Buscar por nombre o código..."
                  @focus="showNegocioDropdown = true"
                  @blur="setTimeout(() => { if (!showCrearProyecto) showNegocioDropdown = false }, 200)"
                />
                <!-- Dropdown de resultados + opción crear -->
                <div v-if="showNegocioDropdown" class="negocio-dropdown">
                  <div v-for="neg in negociosFiltrados" :key="neg._id"
                    class="negocio-option" @mousedown.prevent="seleccionarNegocio(neg)">
                    <span class="negocio-nombre">
                      {{ neg.nombre }}
                      <span v-if="neg._local" class="negocio-local-badge">Local</span>
                    </span>
                    <span class="negocio-codigo">{{ neg.codigo }}</span>
                  </div>
                  <div v-if="!negociosFiltrados.length" class="negocio-empty">
                    Sin resultados para "{{ negocioBusqueda }}"
                  </div>
                  <div class="negocio-create-btn" @mousedown.prevent="abrirCrearProyecto">
                    <i class="u u-agregar" style="font-size:13px"></i>
                    Crear proyecto<template v-if="negocioBusqueda"> "{{ negocioBusqueda }}"</template>
                  </div>
                </div>

                <!-- Mini-form inline: crear proyecto -->
                <div v-if="showCrearProyecto" class="crear-proyecto-form">
                  <div class="cpf-header">
                    <span>Nuevo Proyecto</span>
                    <button type="button" class="cpf-close" @click="cancelarCrearProyecto">×</button>
                  </div>
                  <div class="cpf-body">
                    <div class="form-group" style="margin-bottom:8px">
                      <label style="font-size:11px">Nombre del proyecto *</label>
                      <input
                        v-model="crearProyectoForm.nombre"
                        type="text"
                        class="form-input form-input-sm"
                        placeholder="Ej: Serie Patagonia 2027"
                        @keyup.enter="confirmarCrearProyecto"
                        @keyup.esc="cancelarCrearProyecto"
                      />
                    </div>
                    <div class="form-group" style="margin-bottom:10px">
                      <label style="font-size:11px">Código <small style="color:#6b7280">(opcional, se genera automático)</small></label>
                      <input
                        v-model="crearProyectoForm.codigo"
                        type="text"
                        class="form-input form-input-sm"
                        placeholder="Ej: PATA-2027"
                        @keyup.enter="confirmarCrearProyecto"
                        @keyup.esc="cancelarCrearProyecto"
                      />
                    </div>
                    <div class="form-group" style="margin-bottom:10px">
                      <label style="font-size:11px">Tipo</label>
                      <select v-model="crearProyectoForm.tipo" class="form-input form-input-sm" style="margin-top:6px">
                        <option value="venta">Proyecto (venta)</option>
                        <option value="gasto">Presupuesto de gasto</option>
                      </select>
                    </div>
                    <p v-if="crearProyectoError" class="cpf-error">{{ crearProyectoError }}</p>
                    <div class="cpf-hint">
                      <i class="u u-informacion" style="font-size:12px; opacity:.6"></i>
                      Se asignan las líneas presupuestales estándar. El sync con Unabase se configura desde el proyecto.
                    </div>
                    <div class="cpf-actions">
                      <button type="button" class="btn btn-ghost btn-sm" @click="cancelarCrearProyecto">Cancelar</button>
                      <button type="button" class="btn btn-primary btn-sm" @click="confirmarCrearProyecto">
                        <i class="u u-agregar"></i> Crear y seleccionar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div class="form-group" style="position:relative">
                <label style="display:flex;align-items:center;justify-content:space-between">
                  <span>Línea Presupuestal</span>
                  <button v-if="negocioSeleccionado" type="button"
                    class="add-linea-btn"
                    @click="abrirCrearLinea"
                    title="Agregar línea a este proyecto">
                    <i class="u u-agregar" style="font-size:11px"></i> Nueva línea
                  </button>
                </label>
                <select v-model="contratoForm.linea_codigo" class="form-input"
                  :disabled="!negocioSeleccionado"
                  @change="e => { const item = lineasNegocio.find(i => i.codigo === e.target.value); if(item) contratoForm.linea_nombre = item.nombre }">
                  <option value="">
                    {{ !negocioSeleccionado ? '← Selecciona un proyecto primero' : (lineasNegocio.length ? '— Seleccionar línea —' : '— Sin líneas, agrega una →') }}
                  </option>
                  <optgroup v-for="cat in [...new Set(lineasNegocio.map(i => i.categoria))]" :key="cat" :label="cat">
                    <option v-for="item in lineasNegocio.filter(i => i.categoria === cat)"
                      :key="item.codigo" :value="item.codigo">
                      {{ item.codigo }} — {{ item.nombre }}
                    </option>
                  </optgroup>
                </select>

                <!-- Mini-form crear línea inline -->
                <div v-if="showCrearLinea" class="crear-proyecto-form" style="top:100%;margin-top:4px">
                  <div class="cpf-header">
                    <span>Nueva Línea — {{ negocioSeleccionado?.nombre }}</span>
                    <button type="button" class="cpf-close" @click="showCrearLinea = false">×</button>
                  </div>
                  <div class="cpf-body">
                    <div class="form-group" style="margin-bottom:8px">
                      <label style="font-size:11px">Nombre *</label>
                      <input v-model="crearLineaForm.nombre" type="text" class="form-input form-input-sm"
                        placeholder="Ej: Camarógrafo, Director de Arte..."
                        @keyup.enter="confirmarCrearLinea" @keyup.esc="showCrearLinea = false" />
                    </div>
                    <div class="form-grid-2" style="gap:8px;margin-bottom:8px">
                      <div class="form-group">
                        <label style="font-size:11px">Código <small style="color:#6b7280">(opcional)</small></label>
                        <input v-model="crearLineaForm.codigo" type="text" class="form-input form-input-sm"
                          placeholder="Ej: 1403-0001"
                          @keyup.enter="confirmarCrearLinea" />
                      </div>
                      <div class="form-group">
                        <label style="font-size:11px">Categoría <small style="color:#6b7280">(opcional)</small></label>
                        <input v-model="crearLineaForm.categoria" type="text" class="form-input form-input-sm"
                          placeholder="Ej: Camera, Art..."
                          @keyup.enter="confirmarCrearLinea" />
                      </div>
                    </div>
                    <p v-if="crearLineaError" class="cpf-error">{{ crearLineaError }}</p>
                    <div class="cpf-actions">
                      <button type="button" class="btn btn-ghost btn-sm" @click="showCrearLinea = false">Cancelar</button>
                      <button type="button" class="btn btn-primary btn-sm" @click="confirmarCrearLinea">
                        <i class="u u-agregar"></i> Agregar línea
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="contratoForm.linea_codigo" class="presupuesto-selected">
              <span class="chip teal">{{ contratoForm.negocio_nombre }}</span>
              <span class="chip">{{ contratoForm.linea_codigo }} — {{ contratoForm.linea_nombre }}</span>
            </div>
          </div>

          <!-- FUNCIONES / ROL -->
          <div class="form-section">
            <h4 class="section-label">FUNCIONES / ROL</h4>
            <div class="form-group">
              <label>Funciones / Descripción del Rol</label>
              <textarea v-model="contratoForm.descripcion_rol" class="form-input form-textarea"
                placeholder="Describir el servicio o función a prestar en la obra audiovisual..." rows="4" />
            </div>
          </div>

          <!-- CONDICIONES LABORALES -->
          <div class="form-section">
            <h4 class="section-label">CONDICIONES LABORALES</h4>
            <div class="form-grid-3">
              <div class="form-group">
                <label>Cargo / Función *</label>
                <input v-model="contratoForm.cargo" type="text" class="form-input"
                  :placeholder="trabajador?.cargo || 'Ej: Camarógrafo'" />
              </div>
              <div class="form-group">
                <label>Jornada</label>
                <select v-model="contratoForm.jornada_semanal" class="form-input">
                  <option value="45">45h/semana (jornada anterior)</option>
                  <option value="44">44h/semana (transición 2024)</option>
                  <option value="42">42h/semana (transición 2026)</option>
                  <option value="40">40h/semana (completa Ley 21.561)</option>
                  <option value="30">30h/semana</option>
                  <option value="20">20h/semana (part time)</option>
                  <option value="diaria">Diaria (por día trabajado)</option>
                  <option value="art22">Art. 22 inc. 2° — Libre de jornada</option>
                  <option value="custom">Otra...</option>
                </select>
                <span v-if="contratoForm.jornada_semanal === 'art22'" class="form-hint">
                  Trabajador exento del límite de jornada (Art. 22 inc. 2° del Código del Trabajo).
                  Aplica solo a gerentes/administradores con facultades generales, o cargos sin
                  fiscalización superior inmediata. No marca asistencia ni genera horas extra.
                </span>
              </div>
              <div class="form-group">
                <label>Lugar de Trabajo</label>
                <input v-model="contratoForm.lugar_trabajo" type="text" class="form-input"
                  placeholder="Ciudad o dirección" />
              </div>
              <div class="form-group" style="grid-column: 1 / -1">
                <label>Dirección donde se realizará el trabajo</label>
                <textarea v-model="contratoForm.direccion_trabajo" class="form-input"
                  placeholder="Ej: Av. Providencia 1234, Of. 501, Santiago" rows="2"
                  style="resize:vertical; min-height:58px" />
              </div>
            </div>
            <div v-if="contratoForm.jornada_semanal === 'custom'" class="form-group" style="margin-top:8px; max-width:180px">
              <label>Horas exactas / semana</label>
              <input v-model.number="contratoForm.horas_semana" type="number" class="form-input" min="1" max="44" />
            </div>
            <div class="form-grid-3" style="margin-top:10px">

              <!-- ── Contrato PROYECTO/OBRA (bruto por día desde OC) ── -->
              <template v-if="contratoForm.tipo_contrato === 'proyecto'">
                <div class="form-group" style="grid-column: 1 / -1">
                  <div class="cf-proyecto-banner">
                    <i class="u u-info-circle" style="color:#0ea5e9"></i>
                    <span>Contrato por proyecto/obra — el sueldo base se calcula desde el <strong>valor BRUTO por día</strong> definido en la OC/Unabase.</span>
                  </div>
                </div>
                <div class="form-group">
                  <label>Valor Día (bruto) *</label>
                  <div class="money-input-wrap">
                    <span class="money-prefix">$</span>
                    <input
                      :value="formatCLPInput(contratoForm.valor_dia)"
                      @input="e => { contratoForm.valor_dia = parseCLPInput(e.target.value); contratoForm.sueldo_base = contratoForm.valor_dia * (contratoForm.dias_contratados || 0); if (!contratoForm._vheManual) contratoForm.valor_hora_extra = _calcValorHoraExtra(contratoForm.valor_dia) }"
                      class="form-input money-input" inputmode="numeric" placeholder="0"
                    />
                  </div>
                  <small class="hint-text">Valor bruto diario de la OC</small>
                </div>
                <div class="form-group">
                  <label>Días Contratados *</label>
                  <input
                    type="number" min="0" max="365"
                    v-model.number="contratoForm.dias_contratados"
                    @input="contratoForm.sueldo_base = (contratoForm.valor_dia || 0) * contratoForm.dias_contratados"
                    class="form-input" placeholder="0"
                  />
                  <small class="hint-text">Días estimados de la obra</small>
                </div>
                <div class="form-group">
                  <label>Sueldo Base (calculado)</label>
                  <span class="form-display teal">{{ formatCLP((contratoForm.valor_dia||0) * (contratoForm.dias_contratados||0)) }}</span>
                  <small class="hint-text">{{ contratoForm.dias_contratados||0 }} días × {{ formatCLP(contratoForm.valor_dia||0) }}</small>
                </div>
                <div class="form-group">
                  <label>Valor Hora Extra (líq.)</label>
                  <div class="money-input-wrap">
                    <span class="money-prefix">$</span>
                    <input
                      :value="formatCLPInput(contratoForm.valor_hora_extra)"
                      @input="e => { contratoForm.valor_hora_extra = parseCLPInput(e.target.value); contratoForm._vheManual = true }"
                      class="form-input money-input" inputmode="numeric" placeholder="0"
                    />
                  </div>
                  <small class="hint-text">
                    Líq. mín. legal: {{ formatCLP(_calcValorHoraExtra(contratoForm.valor_dia)) }}/h
                    <span v-if="!contratoForm._vheManual && contratoForm.valor_dia > 0" style="color:#0ea5e9"> (calculado)</span>
                  </small>
                </div>
                <div class="form-group">
                  <label>HH.EE. Contratadas</label>
                  <input
                    type="number" min="0"
                    v-model.number="contratoForm.horas_extras_contratadas"
                    class="form-input" placeholder="0"
                  />
                  <small class="hint-text">Horas extra estimadas de la obra</small>
                </div>
              </template>

              <!-- ── Contrato JORNADA (sueldo líquido pactado por días de función) ── -->
              <template v-else-if="contratoForm.tipo_contrato === 'jornada'">
                <div class="form-group" style="grid-column: 1 / -1">
                  <div class="cf-proyecto-banner" style="border-color:#8b5cf6;background:rgba(139,92,246,0.08)">
                    <i class="u u-info-circle" style="color:#8b5cf6"></i>
                    <span>Contrato por jornada — ingresa el <strong>sueldo LÍQUIDO pactado</strong> total del período. HH.EE. = (líq÷días)×1.5÷10.</span>
                  </div>
                </div>
                <div class="form-group">
                  <label>Sueldo Líquido Pactado *</label>
                  <div class="money-input-wrap">
                    <span class="money-prefix">$</span>
                    <input
                      :value="formatCLPInput(contratoForm.sueldo_base)"
                      @input="e => {
                        contratoForm.sueldo_base = parseCLPInput(e.target.value)
                        contratoForm.valor_dia   = contratoForm.dias_contratados > 0
                          ? Math.round(contratoForm.sueldo_base / contratoForm.dias_contratados) : 0
                        if (!contratoForm._vheManual)
                          contratoForm.valor_hora_extra = _calcValorHoraExtraJornada(contratoForm.valor_dia)
                      }"
                      class="form-input money-input" inputmode="numeric" placeholder="0"
                    />
                  </div>
                  <small class="hint-text">Monto líquido total acordado con el trabajador</small>
                </div>
                <div class="form-group">
                  <label>Días de Jornada *</label>
                  <input
                    type="number" min="1" max="365"
                    v-model.number="contratoForm.dias_contratados"
                    @input="() => {
                      contratoForm.valor_dia = contratoForm.dias_contratados > 0
                        ? Math.round(contratoForm.sueldo_base / contratoForm.dias_contratados) : 0
                      if (!contratoForm._vheManual)
                        contratoForm.valor_hora_extra = _calcValorHoraExtraJornada(contratoForm.valor_dia)
                    }"
                    class="form-input" placeholder="0"
                  />
                  <small class="hint-text">Días de trabajo pactados (ej. 5)</small>
                </div>
                <div class="form-group">
                  <label>Valor Día Jornada (calculado)</label>
                  <span class="form-display" style="color:#8b5cf6">{{ formatCLP(contratoForm.valor_dia || 0) }}</span>
                  <small class="hint-text">Líq. ÷ días = {{ formatCLP(contratoForm.valor_dia||0) }}/día</small>
                </div>
                <div class="form-group">
                  <label>Valor Hora Extra (líq.)</label>
                  <div class="money-input-wrap">
                    <span class="money-prefix">$</span>
                    <input
                      :value="formatCLPInput(contratoForm.valor_hora_extra)"
                      @input="e => { contratoForm.valor_hora_extra = parseCLPInput(e.target.value); contratoForm._vheManual = true }"
                      class="form-input money-input" inputmode="numeric" placeholder="0"
                    />
                  </div>
                  <small class="hint-text">
                    Mín. legal: {{ formatCLP(_calcValorHoraExtraJornada(contratoForm.valor_dia)) }}/h
                    <span v-if="!contratoForm._vheManual && contratoForm.valor_dia > 0" style="color:#8b5cf6"> (calculado: val_día×1.5÷10)</span>
                    <span
                      v-if="contratoForm._vheManual"
                      class="hint-badge"
                      style="cursor:pointer;margin-left:4px"
                      @click="() => { contratoForm.valor_hora_extra = _calcValorHoraExtraJornada(contratoForm.valor_dia); contratoForm._vheManual = false }"
                    >↻ recalc</span>
                  </small>
                </div>
                <div class="form-group">
                  <label>HH.EE. Contratadas</label>
                  <input
                    type="number" min="0"
                    v-model.number="contratoForm.horas_extras_contratadas"
                    class="form-input" placeholder="0"
                  />
                  <small class="hint-text">Horas extra estimadas de la jornada</small>
                </div>
              </template>

              <!-- ── Contratos normales (indefinido / plazo_fijo / honorarios) ── -->
              <template v-else>
                <div class="form-group" style="grid-column: 1 / -1">
                  <label>Tipo de Sueldo</label>
                  <div class="tipo-sueldo-toggle">
                    <button
                      :class="['tsb', contratoForm.tipo_sueldo === 'bruto' && 'active']"
                      type="button"
                      @click="contratoForm.tipo_sueldo = 'bruto'"
                    >
                      <strong>Bruto</strong>
                      <span>El trabajador descuenta AFP + salud del monto ingresado</span>
                    </button>
                    <button
                      :class="['tsb', contratoForm.tipo_sueldo === 'liquido' && 'active']"
                      type="button"
                      @click="contratoForm.tipo_sueldo = 'liquido'"
                    >
                      <strong>Líquido pactado</strong>
                      <span>El trabajador recibe exactamente este monto. La empresa asume AFP + salud</span>
                    </button>
                  </div>
                </div>
                <div class="form-group">
                  <label>{{ contratoForm.tipo_sueldo === 'liquido' ? 'Sueldo Líquido *' : 'Sueldo Base *' }}</label>
                  <div class="money-input-wrap">
                    <span class="money-prefix">$</span>
                    <input
                      :value="formatCLPInput(contratoForm.sueldo_base)"
                      @input="e => contratoForm.sueldo_base = parseCLPInput(e.target.value)"
                      class="form-input money-input" inputmode="numeric" placeholder="0"
                    />
                  </div>
                </div>
              </template>

              <div class="form-group">
                <label>Gratificación</label>
                <select v-model="contratoForm.gratificacion" class="form-input">
                  <option value="mensual">Mensual (1/12 anual)</option>
                  <option value="anual">Anual (25% utilidades)</option>
                </select>
              </div>
              <div class="form-group">
                <label>Modalidad</label>
                <select v-model="contratoForm.modalidad" class="form-input">
                  <option value="presencial">Presencial</option>
                  <option value="hibrido">Híbrido</option>
                  <option value="remoto">Remoto / Teletrabajo</option>
                </select>
              </div>
              <div class="form-group">
                <label>Movilización</label>
                <div class="money-input-wrap">
                  <span class="money-prefix">$</span>
                  <input
                    :value="formatCLPInput(contratoForm.movilizacion)"
                    @input="e => contratoForm.movilizacion = parseCLPInput(e.target.value)"
                    class="form-input money-input" inputmode="numeric" placeholder="0"
                  />
                </div>
              </div>
              <div class="form-group">
                <label>Colación</label>
                <div class="money-input-wrap">
                  <span class="money-prefix">$</span>
                  <input
                    :value="formatCLPInput(contratoForm.colacion)"
                    @input="e => contratoForm.colacion = parseCLPInput(e.target.value)"
                    class="form-input money-input" inputmode="numeric" placeholder="0"
                  />
                </div>
              </div>
              <div class="form-group">
                <label>Total Mensual</label>
                <span class="form-display teal">{{ formatCLP((contratoForm.sueldo_base||0) + (contratoForm.movilizacion||0) + (contratoForm.colacion||0)) }}</span>
              </div>
            </div>
          </div>

          <!-- TURNO -->
          <div class="form-section">
            <h4 class="section-label">TURNO DE TRABAJO</h4>
            <select v-model="contratoForm.turno_id" class="form-input">
              <option value="">Sin turno asignado</option>
              <option v-for="turno in asistenciaStore.turnos" :key="turno.id || turno._id" :value="turno.id || turno._id">
                {{ turno.nombre }} — {{ turno.hora_entrada }} a {{ turno.hora_salida }}
                ({{ turno.horas_semanales || (turno.horas_diarias * (turno.dias_semana?.length || 5)) }}h/sem)
              </option>
            </select>
            <p v-if="!asistenciaStore.turnos?.length" class="hint-text">
              Sin turnos registrados. Puedes crearlos en
              <a href="/rrhh/asistencia/turnos" target="_blank" rel="noopener">Asistencia → Turnos ↗</a>
            </p>
          </div>

          <!-- CLÁUSULAS ADICIONALES -->
          <div class="form-section">
            <h4 class="section-label">CLÁUSULAS ADICIONALES</h4>
            <div class="clausulas-check">
              <label v-for="cl in clausulasOpcionales" :key="cl.id" class="check-item">
                <input type="checkbox" v-model="contratoForm.clausulas" :value="cl.id" class="checkbox-input" />
                <div>
                  <div class="check-label">{{ cl.label }}</div>
                  <div class="check-desc">{{ cl.desc }}</div>
                </div>
              </label>
            </div>
          </div>

        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showGenContrato = false">Cancelar</button>
          <template v-if="contratoViewMode">
            <button class="btn btn-outline" :disabled="loadingPDF" @click="generarContratoPDF">
              <i class="u u-check"></i> Guardar Cambios
            </button>
            <button class="btn btn-primary" :disabled="loadingPDF" @click="generarContratoPDF">
              <i class="u u-download"></i> Descargar PDF
            </button>
          </template>
          <template v-else>
            <button class="btn btn-outline" :disabled="loadingPDF" @click="generarContratoPDF">
              Guardar Borrador
            </button>
            <button class="btn btn-primary" :disabled="loadingPDF" @click="generarContratoPDF">
              <i class="u u-folder-open"></i> {{ loadingPDF ? 'Guardando...' : 'Generar Contrato' }}
            </button>
          </template>
        </div>
      </div>
    </div>
    </Teleport>

    <!-- Modal Detalle de Contrato -->
    <div v-if="showContratoDetalle && contratoDetalle" class="modal-overlay" @click.self="showContratoDetalle = false">
      <div class="modal-box">
        <div class="modal-header">
          <h2>Contrato — {{ labelContrato(contratoDetalle.tipo_contrato) }}</h2>
          <button class="modal-close" @click="showContratoDetalle = false">×</button>
        </div>
        <div class="modal-body">
          <div class="contrato-detalle-grid">
            <div class="cd-row"><span class="cd-label">Estado</span>
              <span class="badge" :class="`badge-estado-${contratoDetalle.estado}`">{{ contratoDetalle.estado }}</span>
            </div>
            <div class="cd-row"><span class="cd-label">Vigencia</span>
              <span>{{ formatDate(contratoDetalle.fecha_inicio) }} — {{ contratoDetalle.fecha_termino ? formatDate(contratoDetalle.fecha_termino) : 'Indefinido' }}</span>
            </div>
            <div class="cd-row" v-if="contratoDetalle.cargo"><span class="cd-label">Cargo</span><span>{{ contratoDetalle.cargo }}</span></div>
            <div class="cd-row" v-if="contratoDetalle.jornada_semanal"><span class="cd-label">Jornada</span>
              <span>
                {{
                  contratoDetalle.jornada_semanal === 'diaria'  ? 'Diaria'
                  : contratoDetalle.jornada_semanal === 'art22' ? 'Libre de jornada (Art. 22 inc. 2°)'
                  : `${contratoDetalle.horas_semana || contratoDetalle.jornada_semanal}h/semana`
                }}
              </span>
            </div>
            <div class="cd-row" v-if="contratoDetalle.lugar_trabajo"><span class="cd-label">Lugar</span><span>{{ contratoDetalle.lugar_trabajo }}</span></div>
            <div class="cd-row" v-if="contratoDetalle.direccion_trabajo"><span class="cd-label">Dirección</span><span>{{ contratoDetalle.direccion_trabajo }}</span></div>
            <div class="cd-row" v-if="contratoDetalle.sueldo_base"><span class="cd-label">Sueldo Base</span><span class="teal">{{ formatCLP(contratoDetalle.sueldo_base) }}</span></div>
            <div class="cd-row" v-if="contratoDetalle.nombre_proyecto"><span class="cd-label">Proyecto</span><span>{{ contratoDetalle.nombre_proyecto }}</span></div>
            <div class="cd-row" v-if="contratoDetalle.negocio_nombre"><span class="cd-label">Negocio</span><span>{{ contratoDetalle.negocio_nombre }}</span></div>
            <div class="cd-row" v-if="contratoDetalle.linea_codigo"><span class="cd-label">Línea</span>
              <span>{{ contratoDetalle.linea_codigo }} — {{ contratoDetalle.linea_nombre }}</span>
            </div>
            <div class="cd-row" v-if="contratoDetalle.turno_id"><span class="cd-label">Turno</span>
              <span>{{ asistenciaStore.turnos?.find(t => (t.id||t._id) === contratoDetalle.turno_id)?.nombre || contratoDetalle.turno_id }}</span>
            </div>
            <div class="cd-row" v-if="contratoDetalle.descripcion_rol"><span class="cd-label">Funciones</span>
              <span class="cd-descripcion">{{ contratoDetalle.descripcion_rol }}</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showContratoDetalle = false">Cerrar</button>
          <button class="btn btn-outline" @click="descargarContratoPDFDesdeTab(contratoDetalle); showContratoDetalle = false">
            <i class="u u-download"></i> Descargar PDF
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Término de Contrato / Finiquito -->
    <div v-if="showFiniquito" class="modal-overlay" @click.self="showFiniquito = false">
      <div class="modal-box modal-lg">
        <div class="modal-header">
          <h2>Término de Contrato — {{ trabajador?.nombre }} {{ trabajador?.apellido }}</h2>
          <button class="modal-close" @click="showFiniquito = false">×</button>
        </div>
        <div class="modal-body">

          <!-- 1. Motivo y fechas -->
          <div class="form-section">
            <h4 class="section-title">1. Causal de Término</h4>
            <div class="liq-form-grid" style="grid-template-columns: 1fr 1fr;">
              <div class="form-group" style="grid-column: span 2">
                <label>Motivo</label>
                <select v-model="finiquitoForm.motivo_termino" class="form-input" @change="onMotivoChange">
                  <option v-for="m in MOTIVOS_TERMINO" :key="m.value" :value="m.value">
                    {{ m.label }} ({{ m.articulo }})
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label>Fecha de Término</label>
                <input v-model="finiquitoForm.fecha_termino" type="date" class="form-input" @change="onFechaTerminoChange" />
              </div>
              <div class="form-group" v-if="motivoActual?.aplica_mes_aviso">
                <label>¿Se pagó mes de aviso previo?</label>
                <select v-model="finiquitoForm.mes_aviso_dado" class="form-input" @change="recalcFiniquito">
                  <option :value="true">Sí — empleador dio aviso con 30 días</option>
                  <option :value="false">No — incluir sustitutiva de aviso</option>
                </select>
              </div>
            </div>
            <!-- Motivo info chip -->
            <div class="trabajador-info-box" v-if="motivoActual">
              <div class="info-chips">
                <span class="chip">{{ motivoActual.articulo }}</span>
                <span class="chip" :class="motivoActual.aplica_indemnizacion ? 'teal' : ''">
                  {{ motivoActual.aplica_indemnizacion ? '✓ Aplica indemnización años servicio' : '✗ Sin indemnización por años de servicio' }}
                </span>
                <span v-if="motivoActual.aplica_gratificacion === false" class="chip" style="background:rgba(245,158,11,0.15);color:#f59e0b">
                  ✗ Sin gratificación (incluida en tarifa)
                </span>
              </div>
            </div>

            <!-- Contratos que se finiquitan -->
            <template v-if="finiquitoForm.fecha_termino && getContratosAFiniquitar(finiquitoForm.fecha_termino).length">
              <div class="liq-resultado" style="margin-top:12px">
                <div style="font-size:11px;color:#9ca3af;margin-bottom:6px;font-weight:600;letter-spacing:.03em">
                  CONTRATOS QUE CUBRE ESTE FINIQUITO
                </div>
                <div
                  v-for="c in getContratosAFiniquitar(finiquitoForm.fecha_termino)"
                  :key="c._id"
                  class="liq-line"
                  style="font-size:12px"
                >
                  <span style="color:#d1d5db">
                    <span style="color:#6b7280;text-transform:uppercase;font-size:10px">{{ c.tipo_contrato }}</span>
                    <span v-if="c.cargo || c.negocio_nombre" style="color:#9ca3af"> · {{ c.cargo || c.negocio_nombre }}</span>
                    <span v-if="c.fecha_inicio" style="color:#6b7280"> · desde {{ c.fecha_inicio?.slice(0,10) }}</span>
                  </span>
                  <span style="color:#9ca3af">{{ formatCLP(c.sueldo_base || c.valor_dia * (c.dias_contratados||1) || 0) }}</span>
                </div>
              </div>
            </template>
          </div>

          <!-- 2. Cálculo automático -->
          <div class="form-section" v-if="finiquitoCalc">
            <h4 class="section-title">2. Haberes a Pagar (cálculo automático)</h4>
            <div class="liq-resultado">

              <!-- Sueldo Proporcional — editable -->
              <div class="liq-line" style="align-items:center; gap:8px;">
                <span style="flex:1; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                  <span>Sueldo Proporcional ({{ finiquitoForm.dias_trabajados_mes }}/30 días)</span>
                  <span v-if="finiquitoForm.sueldo_proporcional_manual !== null"
                    style="color:#f59e0b;font-size:10px;display:inline-flex;align-items:center;gap:3px">
                    editado
                    <button type="button"
                      style="background:none;border:none;color:#f59e0b;cursor:pointer;font-size:12px;padding:0;line-height:1"
                      title="Restaurar cálculo automático"
                      @click="finiquitoForm.sueldo_proporcional_manual = null"
                    >↻</button>
                  </span>
                </span>
                <div class="money-input-wrap" style="width:140px">
                  <span class="money-prefix">$</span>
                  <input
                    :value="formatCLPInput(finiquitoCalc.sueldo_proporcional)"
                    @input="e => { const v = parseCLPInput(e.target.value); finiquitoForm.sueldo_proporcional_manual = v }"
                    @keydown.enter.prevent
                    class="form-input money-input"
                    inputmode="numeric"
                    style="text-align:right"
                  />
                </div>
              </div>

              <div class="liq-line" v-if="finiquitoCalc.vacaciones_monto > 0">
                <span>Vacaciones Pendientes ({{ finiquitoCalc.vacaciones_dias }} días)</span>
                <span>{{ formatCLP(finiquitoCalc.vacaciones_monto) }}</span>
              </div>
              <div class="liq-line" v-if="finiquitoCalc.gratificacion_proporcional > 0">
                <span>Gratificación Proporcional ({{ finiquitoCalc.meses_anio_curso }} meses)</span>
                <span>{{ formatCLP(finiquitoCalc.gratificacion_proporcional) }}</span>
              </div>
              <div class="liq-line" v-if="finiquitoCalc.indemnizacion_anos_servicio > 0">
                <span>Indemnización Años de Servicio ({{ finiquitoCalc.anos_tope }} año(s) · tope 11)</span>
                <span class="teal">{{ formatCLP(finiquitoCalc.indemnizacion_anos_servicio) }}</span>
              </div>
              <div class="liq-line" v-if="finiquitoCalc.sustitutiva_mes_aviso > 0">
                <span>Indemnización Sustitutiva Mes de Aviso</span>
                <span>{{ formatCLP(finiquitoCalc.sustitutiva_mes_aviso) }}</span>
              </div>

              <div class="liq-form-grid" style="grid-template-columns: 1fr 1fr; margin-top: 12px;">
                <div class="form-group">
                  <label>
                    Días trabajados este mes
                    <span
                      v-if="finiquitoForm.fecha_termino && getContratosAFiniquitar(finiquitoForm.fecha_termino).length"
                      style="color:#34d399;font-size:10px;margin-left:4px"
                    >(desde contratos)</span>
                  </label>
                  <input v-model.number="finiquitoForm.dias_trabajados_mes" type="number" min="0" max="31" class="form-input form-input-sm" @input="recalcFiniquito" />
                </div>
                <div class="form-group">
                  <label>Vacaciones pendientes (días)</label>
                  <input v-model.number="finiquitoForm.vacaciones_dias" type="number" min="0" class="form-input form-input-sm" @input="recalcFiniquito" />
                </div>
              </div>
            </div>
          </div>

          <!-- 3. Indemnización voluntaria -->
          <div class="form-section">
            <h4 class="section-title">3. Indemnización Voluntaria Adicional</h4>
            <div class="form-group">
              <label>Monto bruto adicional (si aplica)</label>
              <div class="money-input-wrap">
                <span class="money-prefix">$</span>
                <input
                  :value="formatCLPInput(finiquitoForm.indemnizacion_vol)"
                  @input="e => { finiquitoForm.indemnizacion_vol = parseCLPInput(e.target.value); recalcFiniquito() }"
                  class="form-input money-input"
                  inputmode="numeric"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <!-- 4. Descuentos del finiquito -->
          <div class="form-section">
            <h4 class="section-title">4. Descuentos del Finiquito</h4>
            <div class="item-list">
              <div v-for="(desc, i) in finiquitoForm.descuentos" :key="i" class="item-row">
                <div class="item-nombre">
                  <input v-model="desc.motivo" type="text" class="form-input form-input-sm" placeholder="Motivo del descuento" />
                </div>
                <div class="item-monto">
                  <div class="money-input-wrap">
                    <span class="money-prefix">$</span>
                    <input
                      :value="formatCLPInput(desc.monto)"
                      @input="e => { desc.monto = parseCLPInput(e.target.value); recalcFiniquito() }"
                      class="form-input money-input"
                      inputmode="numeric"
                      placeholder="0"
                    />
                  </div>
                </div>
                <button class="btn-remove" @click="finiquitoForm.descuentos.splice(i, 1); recalcFiniquito()">×</button>
              </div>
              <button class="btn-add-item" @click="finiquitoForm.descuentos.push({ motivo: '', monto: 0 })">
                <i class="u u-agregar"></i> Agregar descuento
              </button>
            </div>
          </div>

          <!-- Total -->
          <div class="liq-neto" v-if="finiquitoCalc">
            <span>Total Finiquito a Pagar</span>
            <span class="teal">{{ formatCLP(totalFiniquito) }}</span>
          </div>
          <div class="liq-costo-empresa" v-if="finiquitoCalc">
            <span>Antigüedad al término: {{ finiquitoCalc.anos_servicio }} año(s)</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showFiniquito = false">Cancelar</button>
          <button class="btn btn-outline" :disabled="!finiquitoForm.fecha_termino"
            @click="abrirFirmaModal('finiquito', `finiquito_${trabajador?._id}_${finiquitoForm.fecha_termino}`, { titulo: `Finiquito — ${trabajador?.nombre} ${trabajador?.apellido}`, cargo: trabajador?.cargo, fecha_termino: finiquitoForm.fecha_termino, sueldo_base: contratoVigente?.sueldo_base || 0 })">
            <i class="u u-edit"></i> Enviar a Firmar
          </button>
          <button class="btn btn-primary" :disabled="loadingPDF || !finiquitoForm.fecha_termino" @click="generarFiniquitoPDF">
            <i class="u u-download"></i> {{ loadingPDF ? 'Generando...' : 'Descargar PDF' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Nueva Liquidación -->
    <div v-if="showNewLiq" class="modal-overlay" @click.self="showNewLiq = false">
      <div class="modal-box modal-lg">
        <div class="modal-header">
          <h2>Nueva Liquidación — {{ trabajador?.nombre }} {{ trabajador?.apellido }}</h2>
          <button type="button" class="modal-close" @click="showNewLiq = false">×</button>
        </div>
        <div class="modal-body">

          <!-- ── 0. Período ──────────────────────────────────────────────── -->
          <div class="form-section">
            <h4 class="section-title">0. Período a Liquidar</h4>
            <div class="liq-form-grid">
              <div class="form-group">
                <label>Mes</label>
                <select v-model="liqForm.mes" class="form-input">
                  <option v-for="m in meses" :key="m.v" :value="m.v">{{ m.l }}</option>
                </select>
              </div>
              <div class="form-group">
                <label>Año</label>
                <input v-model.number="liqForm.anio" type="number" class="form-input" min="2020" max="2030" />
              </div>
              <!-- Días y horas sólo para contratos no-proyecto -->
              <template v-if="!liqHayProyectos">
                <div class="form-group">
                  <label>Días Trabajados</label>
                  <input v-model.number="liqForm.dias_trabajados" type="number" class="form-input" min="1" max="30" />
                </div>
                <div class="form-group">
                  <label>
                    Horas Extra
                    <span v-if="horasExtraDelMes > 0" class="hint-badge teal" style="font-size:10px;margin-left:4px;cursor:pointer" @click="liqForm.horas_extra = horasExtraDelMes" title="Click para usar horas de marcas">
                      ↙ {{ horasExtraDelMes }}h desde marcas
                    </span>
                  </label>
                  <input v-model.number="liqForm.horas_extra" type="number" class="form-input" min="0" />
                </div>
              </template>
            </div>

            <!-- chip info trabajador -->
            <div class="trabajador-info-box" v-if="trabajador">
              <div class="info-chips">
                <span class="chip">{{ trabajador.afp }}</span>
                <span class="chip">{{ trabajador.sistema_salud || 'FONASA' }}</span>
                <template v-if="liqHayProyectos && liqForm.contratos_sel.length > 0">
                  <span class="chip teal">{{ liqForm.contratos_sel.length }} proyecto{{ liqForm.contratos_sel.length > 1 ? 's' : '' }}</span>
                  <span v-for="s in liqForm.contratos_sel" :key="s.contrato_id" class="chip" style="color:#60a5fa">
                    {{ contratosTrabajador.find(c=>c._id===s.contrato_id)?.negocio_nombre || contratosTrabajador.find(c=>c._id===s.contrato_id)?.nombre_proyecto || '—' }}
                  </span>
                </template>
                <template v-else-if="liqContratoActivo">
                  <span class="chip teal">{{ labelContrato(liqContratoActivo.tipo_contrato) }}</span>
                  <span class="chip teal">{{ formatCLP(liqContratoActivo.sueldo_base) }}</span>
                  <span v-if="liqContratoActivo.negocio_nombre" class="chip" style="color:#60a5fa">{{ liqContratoActivo.negocio_nombre }}</span>
                </template>
                <template v-else-if="contratoVigente">
                  <span class="chip teal">{{ labelContrato(contratoVigente.tipo_contrato) }}</span>
                  <span class="chip teal">{{ formatCLP(contratoVigente.sueldo_base) }}</span>
                </template>
                <template v-else>
                  <span class="chip" style="color:#f59e0b">⚠ Sin contrato vigente</span>
                </template>
              </div>
            </div>
          </div>

          <!-- ── 1. Proyectos del período ────────────────────────────────── -->
          <div class="form-section" v-if="contratosDelPeriodo.length > 0">
            <h4 class="section-title">1. Proyectos del Período</h4>

            <!-- Modo multi-proyecto: checkboxes + horas extra por contrato -->
            <div v-if="liqHayProyectos" style="display:flex;flex-direction:column;gap:10px">
              <div
                v-for="c in contratosDelPeriodo"
                :key="c._id"
                class="liq-contrato-option"
                :class="{ active: esContratoSeleccionado(c._id) }"
              >
                <div class="liq-contrato-check" style="cursor:pointer" @click="toggleContratoLiq(c)">
                  <span :class="['liq-checkbox', esContratoSeleccionado(c._id) && 'checked']">
                    <i v-if="esContratoSeleccionado(c._id)" class="u u-check" style="font-size:10px"></i>
                  </span>
                </div>
                <div class="liq-contrato-left" style="flex:1">
                  <span class="tipo-pill" :class="`tipo-${c.tipo_contrato}`">{{ labelContrato(c.tipo_contrato) }}</span>
                  <div>
                    <div style="font-weight:700;font-size:13px;color:#f3f4f6">{{ c.nombre_proyecto || c.negocio_nombre || c.cargo || '—' }}</div>
                    <div style="font-size:11px;color:#94a3b8">
                      {{ formatCLP(c.sueldo_base) }}
                      · Desde {{ c.fecha_inicio ? new Date(c.fecha_inicio + 'T12:00').toLocaleDateString('es-CL') : '—' }}
                    </div>
                  </div>
                </div>
                <!-- Inputs proyecto/jornada: días × valor día + HH.EE. reales -->
                <div v-if="esContratoSeleccionado(c._id)" class="liq-contrato-inputs liq-proyecto-inputs" @click.stop>
                  <div class="liq-proyecto-fila">
                    <div class="liq-mini-input-group">
                      <label>Días</label>
                      <input
                        type="number" min="0" max="60"
                        :value="getContratoSel(c._id)?.dias"
                        @input="getContratoSel(c._id).dias = +$event.target.value"
                        class="form-input liq-mini-input"
                        style="width:58px"
                      />
                    </div>
                    <div class="liq-mini-input-group" style="flex:1">
                      <label>
                        Valor día
                        <small :style="c.tipo_contrato === 'jornada' ? 'color:#8b5cf6' : 'color:#6b7280'">
                          {{ c.tipo_contrato === 'jornada' ? '(líq.)' : '(bruto)' }}
                        </small>
                      </label>
                      <div class="money-input-wrap">
                        <span class="money-prefix">$</span>
                        <input
                          type="text" inputmode="numeric"
                          :value="formatCLPInput(getContratoSel(c._id)?.valor_dia)"
                          @input="e => {
                            const sel = getContratoSel(c._id)
                            sel.valor_dia = parseCLPInput(e.target.value)
                            if (!sel._vheManual) sel.valor_hora_extra = c.tipo_contrato === 'jornada'
                              ? _calcValorHoraExtraJornada(sel.valor_dia)
                              : _calcValorHoraExtra(sel.valor_dia)
                          }"
                          class="form-input money-input"
                        />
                      </div>
                    </div>
                  </div>
                  <div class="liq-proyecto-fila">
                    <div class="liq-mini-input-group">
                      <label>
                        Hs. Extra
                        <span
                          v-if="horasExtraDelMesContrato(c) > 0"
                          class="hint-badge teal"
                          style="cursor:pointer"
                          @click.stop="getContratoSel(c._id).horas_extra_cantidad = horasExtraDelMesContrato(c)"
                          :title="`${horasExtraDelMesContrato(c)}h desde marcas`"
                        >↙ {{ horasExtraDelMesContrato(c) }}h</span>
                      </label>
                      <input
                        type="number" min="0"
                        :value="getContratoSel(c._id)?.horas_extra_cantidad"
                        @input="getContratoSel(c._id).horas_extra_cantidad = +$event.target.value"
                        @keydown.enter.prevent
                        class="form-input liq-mini-input"
                        style="width:58px"
                      />
                    </div>
                    <div class="liq-mini-input-group" style="flex:1">
                      <label>
                        Valor/hora <small style="color:#6b7280">(líq.)</small>
                        <span
                          v-if="getContratoSel(c._id)?.valor_dia > 0"
                          class="hint-badge"
                          style="cursor:pointer;margin-left:4px"
                          :title="c.tipo_contrato === 'jornada' ? 'val_día×1.5÷10' : 'val_día/8×1.5×(1−AFP−salud)'"
                          @click.stop="() => {
                            const sel = getContratoSel(c._id)
                            sel.valor_hora_extra = c.tipo_contrato === 'jornada'
                              ? _calcValorHoraExtraJornada(sel.valor_dia)
                              : _calcValorHoraExtra(sel.valor_dia)
                            sel._vheManual = false
                          }"
                        >↻ calc</span>
                      </label>
                      <div class="money-input-wrap">
                        <span class="money-prefix">$</span>
                        <input
                          type="text" inputmode="numeric"
                          :value="formatCLPInput(getContratoSel(c._id)?.valor_hora_extra)"
                          @input="e => { const sel = getContratoSel(c._id); sel.valor_hora_extra = parseCLPInput(e.target.value); sel._vheManual = true }"
                          class="form-input money-input"
                        />
                      </div>
                    </div>
                  </div>
                  <!-- Preview total del contrato -->
                  <div class="liq-contrato-preview liq-proyecto-preview">
                    <template v-if="getContratoSel(c._id)?.dias > 0 && getContratoSel(c._id)?.valor_dia > 0">
                      <span>{{ getContratoSel(c._id).dias }}d × {{ formatCLP(getContratoSel(c._id).valor_dia) }} = <strong class="teal">{{ formatCLP(getContratoSel(c._id).dias * getContratoSel(c._id).valor_dia) }}</strong></span>
                    </template>
                    <template v-if="getContratoSel(c._id)?.horas_extra_cantidad > 0 && getContratoSel(c._id)?.valor_hora_extra > 0">
                      <span style="color:#a78bfa">+ {{ getContratoSel(c._id).horas_extra_cantidad }}h × {{ formatCLP(getContratoSel(c._id).valor_hora_extra) }} = <strong>{{ formatCLP(getContratoSel(c._id).horas_extra_cantidad * getContratoSel(c._id).valor_hora_extra) }}</strong></span>
                    </template>
                    <span v-if="!getContratoSel(c._id)?.dias && !getContratoSel(c._id)?.valor_dia" style="color:#6b7280;font-size:11px">Sin datos — verifica el contrato</span>
                    <span v-else :style="c.tipo_contrato === 'jornada' ? 'color:#8b5cf6;font-size:10px' : 'color:#6b7280;font-size:10px'">
                      {{ c.tipo_contrato === 'jornada' ? 'días líq. → gross-up · HH.EE.: val_día×1.5÷10' : 'días bruto · HH.EE. líq. → gross-up' }}
                    </span>
                  </div>
                </div>
              </div>
              <div v-if="liqForm.contratos_sel.length === 0" style="font-size:12px;color:#f59e0b;padding:4px 0">
                ⚠ Selecciona al menos un proyecto
              </div>
            </div>

            <!-- Modo single contract (no proyecto) -->
            <div v-else style="display:flex;flex-direction:column;gap:8px">
              <div
                v-for="c in contratosDelPeriodo"
                :key="c._id"
                class="liq-contrato-option"
                :class="{ active: liqForm.contrato_id === c._id }"
                @click="seleccionarContratoLiq(c)"
              >
                <div class="liq-contrato-left">
                  <span class="tipo-pill" :class="`tipo-${c.tipo_contrato}`">{{ labelContrato(c.tipo_contrato) }}</span>
                  <div>
                    <div style="font-weight:600;font-size:13px">{{ c.nombre_proyecto || c.negocio_nombre || c.cargo || '—' }}</div>
                    <div style="font-size:11px;color:#94a3b8">
                      {{ formatCLP(c.sueldo_base) }}
                      · Desde {{ c.fecha_inicio ? new Date(c.fecha_inicio + 'T12:00').toLocaleDateString('es-CL') : '—' }}
                    </div>
                  </div>
                </div>
                <i v-if="liqForm.contrato_id === c._id" class="u u-check" style="color:#3ac7a5"></i>
              </div>
            </div>
          </div>

          <!-- Bonos -->
          <div class="form-section">
            <h4 class="section-title">2. Bonos y Asignaciones</h4>
            <div class="item-list">
              <div v-for="(bono, i) in liqForm.bonos" :key="i" class="item-row">
                <div class="item-nombre">
                  <select v-model="bono.tipo" class="form-input form-input-sm" @change="onBonoTipoChange(bono)">
                    <option v-for="t in TIPOS_BONOS" :key="t.tipo" :value="t.tipo">{{ t.nombre }}</option>
                  </select>
                </div>
                <div class="item-badge" :class="bono.imponible ? 'badge-imponible' : 'badge-no-imponible'">
                  {{ bono.imponible ? 'Imponible' : 'No Imponible' }}
                </div>
                <!-- semana corrida: botón auto-calc -->
                <template v-if="bono.tipo === 'semana_corrida'">
                  <div class="item-sc-inputs">
                    <input v-model.number="bono.dias_habiles" type="number" min="1" max="31" class="form-input form-input-sm" placeholder="Días háb." title="Días hábiles del mes" style="width:80px" />
                    <input v-model.number="bono.dias_descanso" type="number" min="0" max="10" class="form-input form-input-sm" placeholder="Días desc." title="Domingos + festivos" style="width:80px" />
                    <button class="btn-calc-sc" @click="autoCalcSemanaCorrida(bono)" title="Calcular Semana Corrida">
                      ↻ Calcular
                    </button>
                  </div>
                </template>
                <div class="item-monto">
                  <div class="money-input-wrap">
                    <span class="money-prefix">$</span>
                    <input
                      :value="formatCLPInput(bono.monto)"
                      @input="onBonoMontoInput(bono, $event)"
                      class="form-input money-input"
                      inputmode="numeric"
                      placeholder="0"
                    />
                  </div>
                </div>
                <button class="btn-remove" @click="removeBono(i)" title="Eliminar">×</button>
              </div>
              <button class="btn-add-item" @click="addBono">
                <i class="u u-agregar"></i> Agregar bono / asignación
              </button>
            </div>
          </div>

          <!-- Descuentos adicionales -->
          <div class="form-section">
            <h4 class="section-title">3. Descuentos Adicionales</h4>
            <div class="item-list">
              <div v-for="(desc, i) in liqForm.descuentos" :key="i" class="item-row">
                <div class="item-nombre">
                  <select v-model="desc.tipo" class="form-input form-input-sm" @change="onDescTipoChange(desc)">
                    <option v-for="t in TIPOS_DESCUENTOS" :key="t.tipo" :value="t.tipo">{{ t.nombre }}</option>
                  </select>
                </div>
                <div class="item-monto">
                  <div class="money-input-wrap">
                    <span class="money-prefix">$</span>
                    <input
                      :value="formatCLPInput(desc.monto)"
                      @input="onDescMontoInput(desc, $event)"
                      class="form-input money-input"
                      inputmode="numeric"
                      placeholder="0"
                    />
                  </div>
                </div>
                <button class="btn-remove" @click="removeDescuento(i)" title="Eliminar">×</button>
              </div>
              <button class="btn-add-item" @click="addDescuento">
                <i class="u u-agregar"></i> Agregar descuento
              </button>
            </div>
            <div class="form-group" style="margin-top:12px">
              <label>Notas</label>
              <input v-model="liqForm.notas" type="text" class="form-input" placeholder="Observaciones..." />
            </div>
          </div>

          <!-- Resultado cálculo -->
          <div class="liq-resultado" v-if="liqCalc">
            <h4>Resumen Liquidación</h4>

            <!-- Desglose por proyecto (modo multi) -->
            <div v-if="liqCalc._multiContrato && liqCalc._detalle?.length" class="liq-detalle-proyectos">
              <div v-for="(d, i) in liqCalc._detalle" :key="i" class="liq-detalle-row">
                <span class="liq-detalle-name">{{ d.contrato.nombre_proyecto || d.contrato.negocio_nombre || d.contrato.cargo || '—' }}</span>
                <span class="liq-detalle-info">
                  <template v-if="(d.esProy || d.esJornada) && d.sel.dias && d.sel.valor_dia">
                    {{ d.sel.dias }}d × {{ formatCLP(d.sel.valor_dia) }}/día {{ d.esJornada ? '(líq.)' : '(bruto)' }}
                  </template>
                  <template v-else-if="d.esProy || d.esJornada">{{ d.esJornada ? 'Líquido pactado' : 'Líquido acordado' }}</template>
                  <template v-else>{{ d.sel.dias_trabajados }}d × {{ formatCLP(d.contrato.sueldo_base) }}/mes</template>
                </span>
                <span class="liq-detalle-monto">{{ formatCLP(d.proporcional) }}</span>
                <span v-if="d.montoHorasExtra > 0" class="liq-detalle-extra">
                  <template v-if="(d.esProy || d.esJornada) && d.sel.horas_extra_cantidad && d.sel.valor_hora_extra">
                    +{{ d.sel.horas_extra_cantidad }}h × {{ formatCLP(d.sel.valor_hora_extra) }} = {{ formatCLP(d.montoHorasExtra) }}
                  </template>
                  <template v-else>+{{ formatCLP(d.montoHorasExtra) }} extra</template>
                </span>
              </div>
            </div>

            <div class="liq-cols">
              <div class="liq-col">
                <div class="liq-section-title">Haberes</div>
                <!-- Modo multi proyecto: desglose base + HH.EE. con gross-up unificado -->
                <template v-if="liqCalc._multiContrato">
                  <div class="liq-line">
                    <span>
                      Sueldo Base
                      <small style="color:#6b7280;display:block">
                        {{ _detalleResumen }} · bruto
                      </small>
                    </span>
                    <span>{{ formatCLP(liqCalc.sueldoProporcional) }}</span>
                  </div>
                  <div v-if="liqCalc.montoHorasExtra > 0" class="liq-line">
                    <span>
                      Horas Extra
                      <small style="color:#a78bfa;display:block">Líq.: {{ formatCLP(liqCalc._totalHorasExtraLiq) }} → bruto gross-up</small>
                    </span>
                    <span style="color:#a78bfa">{{ formatCLP(liqCalc.montoHorasExtra) }}</span>
                  </div>
                </template>
                <!-- Modo single proyecto: bruto calculado por gross-up -->
                <template v-else-if="liqCalc.esProyecto">
                  <div class="liq-line">
                    <span>Sueldo Pactado (bruto) <small style="color:#6b7280">Líq.: {{ formatCLP(liqCalc.liquidoAcordado) }}</small></span>
                    <span>{{ formatCLP(liqCalc.sueldoProporcional) }}</span>
                  </div>
                </template>
                <!-- Modo single normal: desglose habitual -->
                <template v-else>
                  <div class="liq-line">
                    <span>Sueldo Base ({{ liqForm.dias_trabajados }}/30)</span>
                    <span>{{ formatCLP(liqCalc.sueldoProporcional) }}</span>
                  </div>
                  <div class="liq-line" v-if="liqCalc.montoHorasExtra > 0">
                    <span>Horas Extra</span><span>{{ formatCLP(liqCalc.montoHorasExtra) }}</span>
                  </div>
                  <div class="liq-line" v-if="liqCalc.gratificacion > 0">
                    <span>Gratificación Legal</span><span>{{ formatCLP(liqCalc.gratificacion) }}</span>
                  </div>
                </template>
                <div v-for="bono in liqForm.bonos.filter(b => b.imponible && b.monto > 0)" :key="bono.tipo" class="liq-line">
                  <span>{{ getNombreBono(bono.tipo) }}</span><span>{{ formatCLP(bono.monto) }}</span>
                </div>
                <div v-for="bono in liqForm.bonos.filter(b => !b.imponible && b.monto > 0)" :key="'ni_'+bono.tipo" class="liq-line muted">
                  <span>{{ getNombreBono(bono.tipo) }} <small>(no imp.)</small></span><span>{{ formatCLP(bono.monto) }}</span>
                </div>
                <div class="liq-line total">
                  <span>Total Haberes</span><span>{{ formatCLP(liqCalc.totalHaberes) }}</span>
                </div>
                <div class="liq-line muted">
                  <span>Renta Imponible</span><span>{{ formatCLP(liqCalc.rentaImponible) }}</span>
                </div>
              </div>
              <div class="liq-col">
                <div class="liq-section-title">Descuentos Legales</div>
                <div class="liq-line">
                  <span>{{ trabajador.afp }}</span><span class="red">-{{ formatCLP(liqCalc.afp_descuento) }}</span>
                </div>
                <div class="liq-line">
                  <span>Salud {{ trabajador.sistema_salud || 'FONASA' }} (7%)</span><span class="red">-{{ formatCLP(liqCalc.salud_descuento) }}</span>
                </div>
                <div class="liq-line" v-if="liqCalc.cesantia_trabajador > 0">
                  <span>Cesantía (0.6%)</span><span class="red">-{{ formatCLP(liqCalc.cesantia_trabajador) }}</span>
                </div>
                <div class="liq-line" v-if="liqCalc.impuesto > 0">
                  <span>Imp. Único 2ª Cat.</span><span class="red">-{{ formatCLP(liqCalc.impuesto) }}</span>
                </div>
                <template v-if="liqForm.descuentos.filter(d => d.monto > 0).length">
                  <div class="liq-section-title" style="margin-top:10px">Otros Descuentos</div>
                  <div v-for="desc in liqForm.descuentos.filter(d => d.monto > 0)" :key="desc.tipo" class="liq-line">
                    <span>{{ getNombreDescuento(desc.tipo) }}</span><span class="red">-{{ formatCLP(desc.monto) }}</span>
                  </div>
                </template>
                <div class="liq-line total red">
                  <span>Total Descuentos Trabajador</span><span>-{{ formatCLP(liqCalc.totalDescuentos) }}</span>
                </div>
                <!-- PREVIRED breakdown -->
                <div v-if="liqCalc.previredTotal" style="margin-top:10px;padding-top:10px;border-top:1px dashed rgba(255,255,255,0.08)">
                  <div class="liq-section-title" style="font-size:11px;margin-bottom:4px">
                    Transferencia PREVIRED
                    <span style="color:#6b7280;font-weight:400"> (estimado mín.)</span>
                  </div>
                  <div class="liq-line muted" style="font-size:11px">
                    <span>Descuentos trabajador</span><span>{{ formatCLP(liqCalc.totalDescuentos) }}</span>
                  </div>
                  <div class="liq-line muted" style="font-size:11px">
                    <span>
                      Aportes empleador
                      <small style="display:block;color:#6b7280">
                        Cesantía {{ (liqCalc.esProyecto || liqCalc.esJornada) ? '3%' : '2.4%' }} + SIS 1.5% + Mutual ≥0.93%*
                      </small>
                    </span>
                    <span>{{ formatCLP(liqCalc.aportesEmpleador) }}</span>
                  </div>
                  <div class="liq-line" style="font-size:12px;font-weight:600;margin-top:2px">
                    <span>Total PREVIRED</span><span>≥ {{ formatCLP(liqCalc.previredTotal) }}</span>
                  </div>
                  <div style="font-size:10px;color:#6b7280;margin-top:3px">
                    *Mutual varía según riesgo de la empresa (0.93%–3.4%). Real: ver Previred.
                  </div>
                </div>
              </div>
            </div>
            <div class="liq-neto">
              <span>Líquido a Pagar</span>
              <span class="teal">{{ formatCLP(liqCalc.liquidoAPagar) }}</span>
            </div>
            <div class="liq-costo-empresa">
              <div>
                <div>Costo Empresa</div>
                <small style="color:#6b7280;font-size:10px">Líquido + PREVIRED completo</small>
              </div>
              <div>
                <div>{{ formatCLP(liqCalc.costoEmpresa) }}</div>
                <small v-if="liqCalc.costoEmpresa && liqCalc.liquidoAPagar" style="color:#6b7280;font-size:10px">
                  = {{ formatCLP(liqCalc.liquidoAPagar) }} + {{ formatCLP(liqCalc.previredTotal) }}
                </small>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" @click="showNewLiq = false">Cancelar</button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="liqCreando || (liqHayProyectos && liqForm.contratos_sel.length === 0) || !liqCalc"
            @click="crearLiquidacion"
          >
            <i v-if="liqCreando" class="u u-loading spin"></i>
            <i v-else class="u u-download"></i>
            {{ liqCreando ? 'Generando...' : 'Crear Liquidación' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Modal: Confirmar Eliminación de Contrato ──────────────────── -->
    <div v-if="showEliminarContrato" class="modal-overlay" @click.self="showEliminarContrato = false">
      <div class="modal-box" style="max-width:420px">
        <div class="modal-header">
          <h2 class="modal-title" style="color:#f87171">
            <i class="u u-delete" style="margin-right:6px"></i>
            Eliminar Contrato
          </h2>
          <button class="modal-close" @click="showEliminarContrato = false">×</button>
        </div>
        <div style="padding:20px 24px">
          <div class="ley-alert" style="background:rgba(239,68,68,0.08);border-color:rgba(239,68,68,0.25);color:#fca5a5;margin-bottom:16px">
            ⚠️ Esta acción es <strong>irreversible</strong>. Se eliminará el contrato y todas sus relaciones (liquidaciones asociadas, solicitudes de firma, etc).
          </div>
          <div v-if="contratoAEliminar" class="contrato-vigente-card" style="cursor:default;margin-bottom:0">
            <div>
              <div class="contrato-card-title">
                {{ labelContrato(contratoAEliminar.tipo_contrato) }}
                <span v-if="contratoAEliminar.nombre_proyecto || contratoAEliminar.negocio_nombre">
                  — {{ contratoAEliminar.nombre_proyecto || contratoAEliminar.negocio_nombre }}
                </span>
              </div>
              <div class="contrato-card-meta">
                Desde {{ contratoAEliminar.fecha_inicio ? formatDate(contratoAEliminar.fecha_inicio) : '—' }}
                · {{ formatCLP(contratoAEliminar.sueldo_base || 0) }}
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showEliminarContrato = false">Cancelar</button>
          <button class="btn btn-danger" @click="confirmarEliminarContrato">
            <i class="u u-delete"></i> Sí, eliminar definitivamente
          </button>
        </div>
      </div>
    </div>

    <!-- ── Modal: Confirmar Eliminación de Liquidación ──────────────── -->
    <div v-if="confirmEliminarLiq.show" class="modal-overlay" @click.self="confirmEliminarLiq.show = false">
      <div class="modal-box" style="max-width:400px">
        <div class="modal-header">
          <h2 class="modal-title" style="color:#f87171">
            <i class="u u-delete" style="margin-right:6px"></i>
            Eliminar Liquidación
          </h2>
          <button class="modal-close" @click="confirmEliminarLiq.show = false">×</button>
        </div>
        <div style="padding:20px 24px">
          <div class="ley-alert" style="background:rgba(239,68,68,0.08);border-color:rgba(239,68,68,0.25);color:#fca5a5;margin-bottom:16px">
            ⚠️ Esta acción es <strong>irreversible</strong>.
          </div>
          <div v-if="confirmEliminarLiq.liq" style="background:rgba(255,255,255,0.04);border-radius:10px;padding:14px 16px">
            <div style="font-size:14px;font-weight:600;color:#f3f4f6;margin-bottom:4px">
              Liquidación {{ confirmEliminarLiq.liq.mes }}/{{ confirmEliminarLiq.liq.anio }}
            </div>
            <div style="font-size:12px;color:#9ca3af">
              Líquido a pagar: <strong style="color:#3ac7a5">{{ formatCLP(confirmEliminarLiq.liq.liquido_a_pagar) }}</strong>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="confirmEliminarLiq.show = false">Cancelar</button>
          <button class="btn btn-danger" @click="confirmarEliminarLiq">
            <i class="u u-delete"></i> Sí, eliminar
          </button>
        </div>
      </div>
    </div>

    <!-- ── Modal: Enviar a Firmar ─────────────────────────────────────── -->
    <div v-if="showFirmaModal" class="modal-overlay" @click.self="showFirmaModal = false">
      <div class="modal-box firma-modal-box">
        <div class="modal-header">
          <h2 class="modal-title">
            <i class="u u-edit" style="margin-right:6px"></i>
            Enviar a Firmar
          </h2>
          <button class="modal-close" @click="showFirmaModal = false">×</button>
        </div>

        <!-- Resumen del documento -->
        <div v-if="firmaDocumento" class="firma-doc-resumen">
          <div class="firma-doc-tipo">
            <span class="tipo-pill" :class="`tipo-${firmaDocumento.tipo_documento}`">
              {{ firmaDocumento.tipo_documento === 'contrato' ? 'Contrato' :
                 firmaDocumento.tipo_documento === 'finiquito' ? 'Finiquito' : 'Liquidación' }}
            </span>
          </div>
          <p class="firma-doc-titulo">{{ firmaDocumento.resumen?.titulo || '—' }}</p>
          <div class="firma-doc-meta">
            <span v-if="firmaDocumento.resumen?.cargo">{{ firmaDocumento.resumen.cargo }}</span>
            <span v-if="firmaDocumento.resumen?.sueldo_base">
              {{ formatCLP(firmaDocumento.resumen.sueldo_base) }}
            </span>
          </div>
        </div>

        <!-- Selector tipo de firma (solo antes de generar) -->
        <div v-if="!firmaCreada" class="firma-tipo-selector">
          <p class="section-label">Tipo de firma</p>
          <div class="firma-tipo-options">
            <label class="firma-tipo-opt" :class="{ active: firmaTipoFirma === 'manual' }">
              <input type="radio" v-model="firmaTipoFirma" value="manual" />
              <div class="firma-tipo-icon">✍️</div>
              <div>
                <strong>Manual</strong>
                <small>Firma con el dedo o lápiz en pantalla táctil</small>
              </div>
            </label>
            <label class="firma-tipo-opt" :class="{ active: firmaTipoFirma === 'digital' }">
              <input type="radio" v-model="firmaTipoFirma" value="digital" />
              <div class="firma-tipo-icon">📧</div>
              <div>
                <strong>Digital</strong>
                <small>Confirma identidad y firma desde el link</small>
              </div>
            </label>
          </div>
        </div>

        <!-- Estado: link generado -->
        <div v-if="firmaCreada" class="firma-link-panel">
          <div class="firma-link-header">
            <span class="firma-link-check">✓</span>
            <span>Link generado</span>
          </div>
          <div class="firma-link-row">
            <input
              class="firma-link-input"
              readonly
              :value="firmasStore.getPortalUrl(firmaCreada.token)"
            />
            <button class="btn btn-outline btn-sm" @click="copiarLinkFirma">
              {{ firmaLinkCopied ? '✓ Copiado' : 'Copiar' }}
            </button>
          </div>
          <div class="firma-link-hint">
            <span v-if="firmaTipoFirma === 'manual'">
              Abre el link en el dispositivo móvil del trabajador para firmar en pantalla
            </span>
            <span v-else>
              Envía este link al trabajador para que confirme su firma digital
            </span>
          </div>
          <div v-if="firmaTipoFirma === 'digital' && firmaCreada?.trabajador_email" class="firma-email-info">
            <i class="u u-email"></i>
            Email del trabajador: <strong>{{ firmaCreada.trabajador_email }}</strong>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showFirmaModal = false">Cerrar</button>
          <template v-if="!firmaCreada">
            <button class="btn btn-primary" @click="generarLinkFirma">
              <i class="u u-edit"></i> Generar Link de Firma
            </button>
          </template>
          <template v-else>
            <button class="btn btn-outline" @click="copiarLinkFirma">
              {{ firmaLinkCopied ? '✓ Copiado' : '📋 Copiar Link' }}
            </button>
            <button class="btn btn-primary" @click="abrirPortalFirma">
              <i class="u u-eye"></i> Abrir Portal de Firma
            </button>
          </template>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue"
import { useRoute, useRouter } from 'vue-router'
import useRrhhStore from '@/stores/rrhh'
import { useAsistenciaStore } from '@/stores/asistencia'
import { useFirmasStore } from '@/stores/firmas'
import {
  TIPOS_BONOS, TIPOS_DESCUENTOS, calcularSemanaCorrida,
  MOTIVOS_TERMINO, calcularFiniquito,
  calcularLiquidacion, getAfpComision, AFP_CHILE,
} from '@/stores/rrhh'

definePageMeta({ name: 'rrhh-trabajador-ficha', layout: 'rrhh', middleware: ['auth'] })

const t = (key) => key
const route = useRoute()
const router = useRouter()
const rrhhStore = useRrhhStore()
const asistenciaStore = useAsistenciaStore()
const firmasStore = useFirmasStore()

const loading = ref(true)
const loadingPDF = ref(false)
const liqPdfLoading = ref(null) // _id de la liq que se está descargando
const activeTab = ref('ficha')
const showNewLiq = ref(false)
const showUploadDoc = ref(false)
const showGenContrato = ref(false)
const showFiniquito = ref(false)

// ── Proyectos / Negocios ──────────────────────────────────────────────────────
const proyectosLocales = ref([])
const proyectosLoading = ref(false)

async function cargarProyectos() {
  if (!import.meta.client) return
  proyectosLoading.value = true
  try {
    const orgId = _authStore?.currentOrgId || null
    const url   = orgId ? `/api/rrhh/proyectos?orgId=${orgId}` : '/api/rrhh/proyectos'
    proyectosLocales.value = await $fetch(url)
  } catch { proyectosLocales.value = [] }
  finally { proyectosLoading.value = false }
}

const negocioBusqueda   = ref('')
const negocioSeleccionado = ref(null)
const showNegocioDropdown = ref(false)

const negociosFiltrados = computed(() => {
  const lista = proyectosLocales.value
  if (!negocioBusqueda.value) return lista
  const q = negocioBusqueda.value.toLowerCase()
  return lista.filter(n =>
    n.nombre.toLowerCase().includes(q) || (n.codigo || '').toLowerCase().includes(q)
  )
})
const lineasNegocioActual = ref([])
const lineasNegocio = computed(() => lineasNegocioActual.value)

async function seleccionarNegocio(neg) {
  negocioSeleccionado.value = neg
  negocioBusqueda.value     = neg.nombre
  contratoForm.value.negocio_id     = neg._id
  contratoForm.value.negocio_nombre = neg.nombre
  contratoForm.value.linea_codigo   = ''
  contratoForm.value.linea_nombre   = ''
  showNegocioDropdown.value = false
  showCrearProyecto.value   = false
  // Cargar líneas de este proyecto
  try {
    const lineas = await $fetch(`/api/rrhh/lineas?proyectoId=${neg._id}`)
    lineasNegocioActual.value = lineas
  } catch { lineasNegocioActual.value = [] }
}

// ── Crear proyecto inline ─────────────────────────────────────────────────────
const showCrearProyecto   = ref(false)
const crearProyectoForm   = ref({ nombre: '', codigo: '', tipo: 'venta' })
const crearProyectoError  = ref('')

function abrirCrearProyecto() {
  crearProyectoForm.value  = {
    nombre: negocioBusqueda.value.trim(),
    codigo: '',
    tipo: 'venta',
  }
  crearProyectoError.value = ''
  showCrearProyecto.value  = true
  showNegocioDropdown.value = false
}

function cancelarCrearProyecto() {
  showCrearProyecto.value = false
  crearProyectoError.value = ''
}

async function confirmarCrearProyecto() {
  const nombre = crearProyectoForm.value.nombre.trim()
  if (!nombre) { crearProyectoError.value = 'El nombre es requerido'; return }

  const _palabras = nombre.split(/\s+/).filter(Boolean)
  const _siglas   = _palabras.length === 1
    ? nombre.slice(0, 4).toUpperCase()
    : _palabras.map(w => w[0]).join('').toUpperCase().slice(0, 6)
  const codigo = crearProyectoForm.value.codigo.trim() || `${_siglas}-${new Date().getFullYear()}`

  const orgId = _authStore?.currentOrgId || null
  try {
    const nuevo = await $fetch('/api/rrhh/proyectos', {
      method: 'POST',
      body: { nombre, codigo, tipo: crearProyectoForm.value.tipo || 'venta', orgId, _local: true },
    })
    proyectosLocales.value = [...proyectosLocales.value, nuevo]
    seleccionarNegocio(nuevo)
  } catch (e) {
    crearProyectoError.value = e?.data?.message || 'Error al crear proyecto'
  }
}

// ── Crear línea inline ────────────────────────────────────────────────────────
const showCrearLinea  = ref(false)
const crearLineaForm  = ref({ nombre: '', codigo: '', categoria: '' })
const crearLineaError = ref('')

function abrirCrearLinea() {
  crearLineaForm.value  = { nombre: '', codigo: '', categoria: '' }
  crearLineaError.value = ''
  showCrearLinea.value  = true
}

async function confirmarCrearLinea() {
  const nombre = crearLineaForm.value.nombre.trim()
  if (!nombre) { crearLineaError.value = 'El nombre es requerido'; return }
  if (!negocioSeleccionado.value) { crearLineaError.value = 'Selecciona un proyecto primero'; return }

  const orgId = _authStore?.currentOrgId || null
  const proyectoId = negocioSeleccionado.value._id

  // Auto-generar código si no se ingresó
  const codigo = crearLineaForm.value.codigo.trim() ||
    `LIN-${String(lineasNegocioActual.value.length + 1).padStart(3, '0')}`

  try {
    const nueva = await $fetch('/api/rrhh/lineas', {
      method: 'POST',
      body: {
        nombre,
        codigo,
        categoria: crearLineaForm.value.categoria.trim() || 'General',
        proyectoId,
        orgId,
      },
    })
    lineasNegocioActual.value = [...lineasNegocioActual.value, nueva]
    // Auto-seleccionar la línea recién creada
    contratoForm.value.linea_codigo = nueva.codigo
    contratoForm.value.linea_nombre = nueva.nombre
    showCrearLinea.value = false
  } catch (e) {
    crearLineaError.value = e?.data?.message || 'Error al crear línea'
  }
}

// ── Cláusulas opcionales del contrato ─────────────────────────────────────────
const clausulasOpcionales = [
  {
    id: 'confidencialidad',
    label: 'Cláusula de Confidencialidad',
    desc: 'El trabajador se obliga a mantener reserva sobre información de la empresa, proyectos y clientes.',
  },
  {
    id: 'no_competencia',
    label: 'No Competencia (post-empleo)',
    desc: 'Durante 6 meses tras el término, el trabajador no podrá trabajar para competidores directos.',
  },
  {
    id: 'propiedad_intelectual',
    label: 'Propiedad Intelectual',
    desc: 'Todo material creado en el desempeño del cargo pertenece exclusivamente a la empresa.',
  },
  {
    id: 'teletrabajo',
    label: 'Anexo Teletrabajo (Ley 21.220)',
    desc: 'Regula las condiciones de prestación de servicios a distancia o teletrabajo.',
  },
]

// ── Contrato form (unificado) ─────────────────────────────────────────────────
const contratoForm = ref({
  tipo_contrato:    'indefinido',
  fecha_inicio:     '',
  fecha_termino:    '',
  nombre_proyecto:  '',
  descripcion_rol:  '',
  cargo:            '',
  jornada_semanal:  '45',
  lugar_trabajo:    'Santiago, Región Metropolitana',
  direccion_trabajo: '',
  horas_semana:     45,
  sueldo_base:      0,
  tipo_sueldo:      'bruto',   // 'bruto' | 'liquido'
  gratificacion:    'mensual',
  modalidad:        'presencial',
  movilizacion:     0,
  colacion:         0,
  turno_id:         '',
  negocio_id:       '',
  negocio_nombre:   '',
  linea_codigo:     '',
  linea_nombre:     '',
  clausulas:        [],
  // Campos extra para contratos por proyecto
  valor_dia:               0,   // Valor bruto por día (desde OC / Unabase)
  dias_contratados:        0,   // Días estimados del proyecto (se recalcula en liq por fechas)
  valor_hora_extra:        0,   // Valor líquido por hora extra acordada
  horas_extras_contratadas: 0,  // HH.EE. estimadas en el contrato
})
// Modo vista de contrato existente (vs. creación)
const contratoViewMode = ref(false)
const contratoEditId = ref(null)

// ── Finiquito form ────────────────────────────────────────────────────────────
const finiquitoForm = ref({
  motivo_termino: 'mutuo_acuerdo',
  fecha_termino: '',
  mes_aviso_dado: true,
  dias_trabajados_mes: 30,
  vacaciones_dias: 0,
  indemnizacion_vol: 0,
  descuentos: [],
  sueldo_proporcional_manual: null,   // null = calcular automático; número = override manual
})

const tabs = [
  { id: 'ficha',        label: 'Ficha Personal', icon: 'u u-usuarios'        },
  { id: 'contratos',   label: 'Contratos',       icon: 'u u-ventas'          },
  { id: 'liquidaciones',label: 'Liquidaciones',  icon: 'u u-cobros-y-pagos'  },
  { id: 'documentos',  label: 'Documentos',      icon: 'u u-folder-open'     },
]

const meses = [
  { v: 1, l: 'Enero' }, { v: 2, l: 'Febrero' }, { v: 3, l: 'Marzo' },
  { v: 4, l: 'Abril' }, { v: 5, l: 'Mayo' }, { v: 6, l: 'Junio' },
  { v: 7, l: 'Julio' }, { v: 8, l: 'Agosto' }, { v: 9, l: 'Septiembre' },
  { v: 10, l: 'Octubre' }, { v: 11, l: 'Noviembre' }, { v: 12, l: 'Diciembre' },
]

const now = new Date()
const liqForm = ref({
  mes: now.getMonth() + 1,
  anio: now.getFullYear(),
  dias_trabajados: 30,
  horas_extra: 0,
  bonos: [],
  descuentos: [],
  notas: '',
  contrato_id: null,       // contrato único (modo no-proyecto)
  contratos_sel: [],       // [{ contrato_id, dias_trabajados, horas_extra }] – modo multi-proyecto
})

// Contratos activos filtrados por el mes/año seleccionado en la liquidación
const contratosDelPeriodo = computed(() => {
  const mes  = liqForm.value.mes
  const anio = liqForm.value.anio
  const primerDia = new Date(anio, mes - 1, 1)
  const ultimoDia = new Date(anio, mes, 0, 23, 59, 59)
  return contratosTrabajador.value.filter(c => {
    if (!['vigente', 'borrador', 'activo'].includes(c.estado)) return false
    const inicio = c.fecha_inicio ? new Date(c.fecha_inicio + 'T12:00:00') : null
    const fin    = c.fecha_termino ? new Date(c.fecha_termino + 'T12:00:00') : null
    if (inicio && inicio > ultimoDia) return false   // aún no empezaba
    if (fin    && fin    < primerDia) return false   // ya había terminado
    return true
  })
})

// ¿El trabajador tiene contratos tipo proyecto/jornada/honorarios vigentes?
const liqHayProyectos = computed(() =>
  contratosDelPeriodo.value.some(c =>
    c.tipo_contrato === 'proyecto' || c.tipo_contrato === 'jornada' || c.tipo_contrato === 'honorarios'
  )
)

// Al cambiar mes/año, re-sincronizar contratos_sel para que solo queden los del período
watch([() => liqForm.value.mes, () => liqForm.value.anio], () => {
  if (!liqHayProyectos.value) return
  const idsDelPeriodo = new Set(contratosDelPeriodo.value.map(c => c._id))
  // Quitar contratos que ya no aplican
  liqForm.value.contratos_sel = liqForm.value.contratos_sel.filter(s => idsDelPeriodo.has(s.contrato_id))
  // Agregar los que aplican y no están aún
  contratosDelPeriodo.value.forEach(c => {
    if (!esContratoSeleccionado(c._id)) {
      liqForm.value.contratos_sel.push(_entradaContratoSel(c))
    }
  })
})

// Contrato activo seleccionado para la liquidación (modo single)
const liqContratoActivo = computed(() => {
  if (!liqForm.value.contrato_id) return contratoVigente.value
  return contratosTrabajador.value.find(c => c._id === liqForm.value.contrato_id) || contratoVigente.value
})

// Horas extra del mes global (para modo single)
const horasExtraDelMes = computed(() => {
  if (!trabajador.value) return 0
  const mes = liqForm.value.mes, anio = liqForm.value.anio
  const marcas = asistenciaStore.marcaciones?.filter(m => {
    if (m.trabajador_id !== (trabajador.value._id || trabajador.value.id)) return false
    const d = new Date(m.fecha || m.timestamp)
    return d.getMonth() + 1 === mes && d.getFullYear() === anio
  }) || []
  return marcas.reduce((s, m) => s + (m.horas_extra || 0), 0)
})

// Horas extra del mes filtradas por proyecto de un contrato específico
function horasExtraDelMesContrato(c) {
  if (!trabajador.value || !c) return 0
  const mes = liqForm.value.mes, anio = liqForm.value.anio
  const proyId = c.proyecto_id || null
  const marcas = asistenciaStore.marcaciones?.filter(m => {
    if (m.trabajador_id !== (trabajador.value._id || trabajador.value.id)) return false
    const d = new Date(m.fecha || m.timestamp)
    if (d.getMonth() + 1 !== mes || d.getFullYear() !== anio) return false
    if (proyId && m.proyecto_id) return m.proyecto_id === proyId
    return true
  }) || []
  return marcas.reduce((s, m) => s + (m.horas_extra || 0), 0)
}

// Días trabajados por defecto: siempre 30 (mes completo) para contratos indefinido/honorarios
function estimarDiasContrato(_c) {
  return 30
}

// Recalcula dias_contratados y sueldo_base desde las fechas del contrato (proyecto/jornada)
function recalcDiasContrato() {
  const cf = contratoForm.value
  if (!['proyecto', 'jornada'].includes(cf.tipo_contrato)) return
  if (!cf.fecha_inicio || !cf.fecha_termino) return
  const inicio  = new Date(cf.fecha_inicio  + 'T12:00')
  const termino = new Date(cf.fecha_termino + 'T12:00')
  if (termino < inicio) return
  const dias = Math.round((termino - inicio) / (1000 * 60 * 60 * 24)) + 1
  cf.dias_contratados = dias
  if (cf.tipo_contrato === 'proyecto') {
    cf.sueldo_base = (cf.valor_dia || 0) * dias
  } else {
    // jornada: sueldo_base es el líquido; recalcular valor_dia
    cf.valor_dia = dias > 0 ? Math.round((cf.sueldo_base || 0) / dias) : 0
    if (!cf._vheManual) cf.valor_hora_extra = _calcValorHoraExtraJornada(cf.valor_dia)
  }
}

// Cuando cambia tipo_contrato a 'proyecto' o 'jornada': jornada diaria + recalcular días
watch(() => contratoForm.value.tipo_contrato, (val) => {
  if (val === 'proyecto' || val === 'jornada') {
    contratoForm.value.jornada_semanal = 'diaria'
    recalcDiasContrato()
  }
})

// ── Valor hora extra PROYECTO/OBRA (valor_dia es BRUTO desde OC) ────────────
// Fórmula: (valor_dia / 8h) × 1.5 × (1 - AFP - salud) → líquido
function _calcValorHoraExtra(valorDia) {
  if (!valorDia || valorDia <= 0) return 0
  const afpRate   = 0.10 + getAfpComision(trabajador.value?.afp || 'capital')
  const saludRate = 0.07
  const brutoHora = valorDia / 8          // hora normal bruta
  const brutoOT   = brutoHora * 1.5      // +50% recargo legal mínimo
  return Math.round(brutoOT * (1 - afpRate - saludRate))
}

// ── Valor hora extra JORNADA (valor_dia es LÍQUIDO pactado) ──────────────────
// Fórmula DT: (sueldo_liq / días) × 1.5 ÷ 10 horas legales
// Ej: $100.000 / 5d = $20.000/d × 1.5 = $30.000 ÷ 10 = $3.000/h líquido
function _calcValorHoraExtraJornada(valorDiaLiquido) {
  if (!valorDiaLiquido || valorDiaLiquido <= 0) return 0
  return Math.round(valorDiaLiquido * 1.5 / 10)
}

// Calcula cuántos días calendario del contrato proyecto caen dentro del período de liquidación
function calcularDiasContratoEnPeriodo(c) {
  const mes  = liqForm.value.mes
  const anio = liqForm.value.anio
  const primerDiaMes = new Date(anio, mes - 1, 1)
  const ultimoDiaMes = new Date(anio, mes, 0)  // último día del mes

  const inicio  = c.fecha_inicio
    ? new Date(c.fecha_inicio.slice(0, 10) + 'T12:00')
    : primerDiaMes
  const termino = c.fecha_termino
    ? new Date(c.fecha_termino.slice(0, 10) + 'T12:00')
    : ultimoDiaMes

  const desde = inicio > primerDiaMes ? inicio : primerDiaMes
  const hasta = termino < ultimoDiaMes ? termino : ultimoDiaMes

  if (desde > hasta) return 0
  return Math.round((hasta - desde) / (1000 * 60 * 60 * 24)) + 1
}

// ¿Está un contrato seleccionado en modo multi?
function esContratoSeleccionado(id) {
  return liqForm.value.contratos_sel.some(s => s.contrato_id === id)
}

// Obtener el objeto sel de un contrato en modo multi
function getContratoSel(id) {
  return liqForm.value.contratos_sel.find(s => s.contrato_id === id)
}

// Genera la entrada inicial para un contrato en la selección multi-proyecto/jornada
function _entradaContratoSel(c) {
  const tipo      = (c.tipo_contrato || '').toLowerCase()
  const esProy    = tipo === 'proyecto'
  const esJornada = tipo === 'jornada'
  const esVariable = esProy || esJornada  // ambos usan el modo días × valor

  // Para proyecto/jornada: días se calculan automáticamente por fechas del contrato en el período
  const diasPeriodo = esVariable ? calcularDiasContratoEnPeriodo(c) : 0

  // Valor día:
  // - Proyecto: bruto desde OC (c.valor_dia); fallback = sueldo_base ÷ dias_contratados
  // - Jornada:  líquido pactado ÷ días (c.valor_dia si guardado; fallback = sueldo_base ÷ dias)
  let valorDia = c.valor_dia || 0
  if (esVariable && !valorDia && c.sueldo_base > 0) {
    const diasRef = c.dias_contratados || diasPeriodo || 1
    valorDia = Math.round(c.sueldo_base / diasRef)
  }

  // HH.EE. desde el contrato (estimadas), con fallback a marcas de asistencia
  const hheeContrato = esVariable
    ? (c.horas_extras_contratadas || horasExtraDelMesContrato(c))
    : horasExtraDelMesContrato(c)

  // Valor hora extra:
  // - Proyecto: (valor_dia_bruto/8)×1.5×(1−AFP−salud) → líquido
  // - Jornada:  valor_dia_liq×1.5÷10 → líquido (fórmula DT)
  let valorHoraExtra = c.valor_hora_extra || 0
  if (!valorHoraExtra && valorDia > 0) {
    valorHoraExtra = esJornada
      ? _calcValorHoraExtraJornada(valorDia)
      : (esProy ? _calcValorHoraExtra(valorDia) : 0)
  }

  return {
    contrato_id:          c._id,
    // ── Campos proyecto/jornada (días reales × valor día + HH.EE.) ──
    dias:                 esVariable ? diasPeriodo : 0,
    valor_dia:            esVariable ? valorDia : 0,
    horas_extra_cantidad: hheeContrato,
    valor_hora_extra:     valorHoraExtra,
    _vheManual:           false,
    // ── Campos indefinido / plazo_fijo (proporcional por días) ──
    dias_trabajados:      esVariable ? 30 : estimarDiasContrato(c),
    horas_extra:          horasExtraDelMesContrato(c),
  }
}

// Caché de valores ingresados por el usuario por contrato (persiste al desmarcar/remarcar)
const _liqSelCache = ref({})

// Toggle selección multi-contrato — preserva los valores ingresados al desmarcar
function toggleContratoLiq(c) {
  const idx = liqForm.value.contratos_sel.findIndex(s => s.contrato_id === c._id)
  if (idx !== -1) {
    // Guardar en caché antes de quitar
    _liqSelCache.value[c._id] = { ...liqForm.value.contratos_sel[idx] }
    liqForm.value.contratos_sel.splice(idx, 1)
  } else {
    // Restaurar desde caché si existe, si no crear entrada fresca
    const cached = _liqSelCache.value[c._id]
    liqForm.value.contratos_sel.push(cached ? { ...cached } : _entradaContratoSel(c))
  }
}

// Selección single (no-proyecto)
function seleccionarContratoLiq(c) {
  liqForm.value.contrato_id = c._id
  if (horasExtraDelMes.value > 0) liqForm.value.horas_extra = horasExtraDelMes.value
}

const trabajador = computed(() => {
  const id = route.params.id
  return rrhhStore.trabajadores.find(t => t._id === id) || null
})

// ── Cuenta de acceso del trabajador (User vinculado) ────────────────────────
const linkedUser     = ref(null)
const loadingAccount = ref(false)
const showCreateAccount = ref(false)
const showResetPassword = ref(false)
const newAccount = reactive({ email: '', password: '', saving: false, error: '' })
const resetPwd   = reactive({ value: '', saving: false, error: '' })

function authHeaders() {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem('rrhh_session')
    if (!raw) return {}
    const s = JSON.parse(raw)
    return s?.token ? { Authorization: `Bearer ${s.token}` } : {}
  } catch { return {} }
}

async function loadLinkedUser() {
  const id = trabajador.value?._id || trabajador.value?.id
  if (!id) return
  loadingAccount.value = true
  try {
    const data = await $fetch(`/api/rrhh/trabajadores/${id}/user`, {
      headers: authHeaders(),
    })
    linkedUser.value = data?.user || null
  } catch { linkedUser.value = null }
  finally { loadingAccount.value = false }
}

function openCreateAccountModal() {
  const t = trabajador.value || {}
  newAccount.email    = t.email || ''
  newAccount.password = ''
  newAccount.error    = ''
  newAccount.saving   = false
  showCreateAccount.value = true
}

async function handleCreateAccount() {
  newAccount.error = ''
  if (!newAccount.email.trim() || !newAccount.password.trim()) {
    newAccount.error = 'Email y contraseña son obligatorios'
    return
  }
  if (newAccount.password.length < 6) {
    newAccount.error = 'La contraseña debe tener al menos 6 caracteres'
    return
  }
  newAccount.saving = true
  try {
    const id = trabajador.value?._id || trabajador.value?.id
    const t  = trabajador.value || {}
    const nombre = [t.nombre, t.apellido_paterno || t.apellido].filter(Boolean).join(' ')
    const res = await $fetch(`/api/rrhh/trabajadores/${id}/create-user`, {
      method: 'POST',
      headers: authHeaders(),
      body: { email: newAccount.email.trim(), password: newAccount.password, nombre },
    })
    if (res?.ok) {
      linkedUser.value = res.user
      showCreateAccount.value = false
    } else {
      newAccount.error = res?.message || 'Error al crear cuenta'
    }
  } catch (e) {
    newAccount.error = e?.data?.message || e?.message || 'Error inesperado'
  } finally {
    newAccount.saving = false
  }
}

function openResetPasswordModal() {
  resetPwd.value  = ''
  resetPwd.error  = ''
  resetPwd.saving = false
  showResetPassword.value = true
}

async function handleResetPassword() {
  resetPwd.error = ''
  if (!resetPwd.value || resetPwd.value.length < 6) {
    resetPwd.error = 'La contraseña debe tener al menos 6 caracteres'
    return
  }
  resetPwd.saving = true
  try {
    const res = await $fetch(`/api/auth/users/${linkedUser.value._id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: { action: 'password', password: resetPwd.value },
    })
    if (res?.ok) {
      showResetPassword.value = false
    } else {
      resetPwd.error = res?.message || 'Error al cambiar contraseña'
    }
  } catch (e) {
    resetPwd.error = e?.data?.message || e?.message || 'Error inesperado'
  } finally {
    resetPwd.saving = false
  }
}

async function confirmUnlinkUser() {
  if (!confirm('¿Desvincular esta cuenta del trabajador? El usuario seguirá existiendo pero perderá acceso al portal personal.')) return
  try {
    const id = trabajador.value?._id || trabajador.value?.id
    await $fetch(`/api/rrhh/trabajadores/${id}/unlink-user`, {
      method: 'POST',
      headers: authHeaders(),
    })
    linkedUser.value = null
  } catch (e) {
    alert(e?.data?.message || 'No se pudo desvincular')
  }
}

// ── Edición inline de Ficha Personal ─────────────────────────────────────────
const fichaEdits = ref({})
const fichaGuardando = ref(false)

function syncFichaEdits() {
  if (!trabajador.value) return
  fichaEdits.value = {
    nombre:          trabajador.value.nombre || '',
    apellido:        trabajador.value.apellido || '',
    rut:             trabajador.value.rut || '',
    email:           trabajador.value.email || '',
    telefono:        trabajador.value.telefono || '',
    direccion:       trabajador.value.direccion || '',
    fecha_nacimiento: trabajador.value.fecha_nacimiento || '',
    nacionalidad:    trabajador.value.nacionalidad || 'Chilena',
    profesion:       trabajador.value.profesion || '',
    cargo:           trabajador.value.cargo || '',
    departamento:    trabajador.value.departamento || '',
    fecha_ingreso:   trabajador.value.fecha_ingreso?.slice(0,10) || '',
    afp:             trabajador.value.afp || '',
    sistema_salud:   trabajador.value.sistema_salud || 'FONASA',
    isapre_nombre:   trabajador.value.isapre_nombre || '',
    // Tipo de plan Isapre: 'UF' | '$' | '7%+GES(UF)' | '7%+GES($)' | '%'
    // Backward compat: si tiene isapre_uf guardado y no isapre_tipo, asumir UF
    isapre_tipo:     trabajador.value.isapre_tipo  || (trabajador.value.isapre_uf ? 'UF' : 'UF'),
    isapre_monto:    trabajador.value.isapre_monto ?? trabajador.value.isapre_uf ?? 0,
    // Datos bancarios
    banco:           trabajador.value.banco            || '',
    tipo_cuenta:     trabajador.value.tipo_cuenta      || '',
    numero_cuenta:   trabajador.value.numero_cuenta    || '',
    email_pago:      trabajador.value.email_pago       || trabajador.value.email || '',
  }
}

watch(trabajador, (val) => {
  if (!val) return
  syncFichaEdits()
  loadLinkedUser()
}, { immediate: true })

// Movilización y colación en 0 para contratos por proyecto/jornada/honorarios
watch(() => contratoForm.value.tipo_contrato, (tipo) => {
  if (tipo === 'proyecto' || tipo === 'jornada' || tipo === 'honorarios') {
    contratoForm.value.movilizacion = 0
    contratoForm.value.colacion = 0
  } else if (tipo === 'indefinido' || tipo === 'plazo_fijo' || tipo === 'part_time') {
    // Solo si vienen en 0, sugerir valores por defecto
    if (!contratoForm.value.movilizacion) contratoForm.value.movilizacion = 50000
    if (!contratoForm.value.colacion) contratoForm.value.colacion = 40000
  }
})

const fichaModificada = computed(() => {
  if (!trabajador.value) return false
  return Object.keys(fichaEdits.value).some(k => {
    const a = (fichaEdits.value[k] ?? '') + ''
    const b = (trabajador.value[k] ?? '') + ''
    return a !== b
  })
})

async function guardarFicha() {
  if (!trabajador.value || !fichaModificada.value) return
  fichaGuardando.value = true
  try {
    await rrhhStore.updateTrabajador(trabajador.value._id, { ...fichaEdits.value })
  } finally {
    fichaGuardando.value = false
  }
}

const initials = computed(() => {
  if (!trabajador.value) return '?'
  return `${trabajador.value.nombre?.[0] || ''}${trabajador.value.apellido?.[0] || ''}`.toUpperCase()
})

// Tasa total imposiciones (AFP trabajador + salud + ces.emp + accidentes + SIS)
const TASA_IMP = 0.1144 + 0.07 + 0.024 + 0.0093 + 0.015 // 0.2327

// Costo empresa para UN contrato dado, respetando tipo_sueldo
function calcCostoEmpresaContrato(c) {
  const base  = c.sueldo_base || 0
  const movil = c.movilizacion || 0
  const colac = c.colacion || 0
  const tipo  = (c.tipo_contrato || '').toLowerCase()
  const esLiq = tipo === 'proyecto' || tipo === 'jornada' || c.tipo_sueldo === 'liquido'

  if (esLiq) {
    // Empresa paga todas las cotizaciones encima del neto acordado
    return Math.round((base + movil + colac) * (1 + TASA_IMP))
  }
  const cesantia   = base * (tipo === 'plazo_fijo' ? 0.03 : 0.024)
  const accidentes = base * 0.0093
  return Math.round(base + movil + colac + cesantia + accidentes)
}

// Líquido estimado al trabajador para un contrato
function calcLiquidoContrato(c) {
  const base  = c.sueldo_base || 0
  const movil = c.movilizacion || 0
  const colac = c.colacion || 0
  const tipo  = (c.tipo_contrato || '').toLowerCase()
  const esLiq = tipo === 'proyecto' || tipo === 'jornada' || c.tipo_sueldo === 'liquido'
  if (esLiq) return base + movil + colac  // el sueldo_base ya ES el neto
  return Math.round(base * (1 - 0.1844) + movil + colac)
}

// Contratos activos (vigentes) del trabajador
const contratosActivos = computed(() =>
  contratosTrabajador.value.filter(c => c.estado === 'vigente')
)

// Suma sueldos de todos los contratos activos
const sueldoTotalActivos = computed(() =>
  contratosActivos.value.reduce((s, c) => s + (c.sueldo_base || 0), 0)
)

// Suma costos empresa de todos los contratos activos
const costoEmpresa = computed(() => {
  if (!contratosActivos.value.length) {
    // fallback si no hay contratos vigentes
    if (!trabajador.value) return 0
    const cv = contratoVigente.value
    const base = cv?.sueldo_base || trabajador.value.sueldo_base || 0
    const cesantia = base * ((cv?.tipo_contrato || 'indefinido') === 'plazo_fijo' ? 0.03 : 0.024)
    return Math.round(base + base * 0.0093 + cesantia)
  }
  return contratosActivos.value.reduce((s, c) => s + calcCostoEmpresaContrato(c), 0)
})

// ── Horas trabajadas según marcaciones del mes actual ─────────────────────────
/**
 * Devuelve resumen de horas para UN contrato en el mes/año dado.
 * Primero busca en marcaciones (asistenciaStore); si no hay, busca en la
 * última liquidación guardada del mismo mes.
 */
function getHorasContrato(contrato, mes = null, anio = null) {
  if (!trabajador.value) return null
  const now2 = new Date()
  const m = mes  || (now2.getMonth() + 1)
  const a = anio || now2.getFullYear()
  const tid = trabajador.value._id || trabajador.value.id

  // 1. Buscar en marcaciones del asistenciaStore
  const marcs = asistenciaStore.marcaciones.filter(marc => {
    if (marc.trabajador_id !== tid) return false
    const f = marc.fecha?.slice(0, 10)
    if (!f) return false
    const d = new Date(f + 'T12:00:00')
    if (d.getMonth() + 1 !== m || d.getFullYear() !== a) return false
    // Opcionalmente, restringir al período del contrato
    if (contrato.fecha_inicio && f < contrato.fecha_inicio.slice(0,10)) return false
    if (contrato.fecha_termino && f > contrato.fecha_termino.slice(0,10)) return false
    return true
  })

  if (marcs.length) {
    const dias       = marcs.filter(x => x.entrada).length
    const horas      = marcs.reduce((s, x) => s + (x.horas_trabajadas || 0), 0)
    const extra      = marcs.reduce((s, x) => s + (x.horas_extra || 0), 0)
    const atrasos    = marcs.reduce((s, x) => s + (x.atraso_minutos || 0), 0)
    return {
      fuente: 'marcas',
      dias,
      horas:   Math.round(horas * 10) / 10,
      extra:   Math.round(extra * 10) / 10,
      atrasos: Math.round(atrasos),
    }
  }

  // 2. Fallback: última liquidación del mismo mes (horas_extra de liqForm guardado)
  const liqsMes = liquidacionesTrabajador.value.filter(
    l => l.mes === m && l.anio === a && l.tipo !== 'finiquito'
  )
  if (liqsMes.length) {
    const liq = liqsMes[0]
    return {
      fuente: 'liquidacion',
      dias:  liq.dias_trabajados || 30,
      horas: null,
      extra: liq.horas_extra || 0,
    }
  }

  return null  // sin datos
}

// Cache de horas por contrato (mes actual) — evita llamadas múltiples en el template
const horasContratosMes = computed(() => {
  const map = {}
  contratosTrabajador.value.forEach(c => {
    map[c._id] = getHorasContrato(c)
  })
  return map
})

const antiguedad = computed(() => {
  if (!trabajador.value?.fecha_ingreso) return '—'
  const ingreso = new Date(trabajador.value.fecha_ingreso + 'T12:00')
  const diff = now - ingreso
  const years  = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
  const months = Math.floor((diff % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44))
  if (years === 0 && months === 0) return 'recién ingresado'
  if (years === 0) return `${months} mes${months !== 1 ? 'es' : ''}`
  return `${years} año${years !== 1 ? 's' : ''}${months > 0 ? ` ${months}m` : ''}`
})

// Última liquidación real (excluye finiquitos)
const ultimaLiquidacion = computed(() =>
  liquidacionesTrabajador.value[0] || null   // ya están ordenadas desc por anio/mes
)

// Vacaciones acumuladas: 15 días hábiles por año = 1.25 días por mes trabajado
// Se descuentan los días tomados guardados en el trabajador
const vacacionesAcumuladas = computed(() => {
  const t = trabajador.value
  if (!t?.fecha_ingreso) return t?.vacaciones_dias ?? 0
  const ingreso = new Date(t.fecha_ingreso + 'T12:00')
  const diffMs  = now - ingreso
  const meses   = diffMs / (1000 * 60 * 60 * 24 * 30.44)
  const acum    = Math.floor(meses * 1.25)          // 15 días/año ÷ 12 meses
  const tomados = t.vacaciones_tomadas || 0
  return Math.max(0, acum - tomados)
})

const motivoActual = computed(() =>
  MOTIVOS_TERMINO.find(m => m.value === finiquitoForm.value.motivo_termino) || MOTIVOS_TERMINO[0]
)

const finiquitoCalc = computed(() => {
  if (!trabajador.value || !finiquitoForm.value.fecha_termino) return null
  const cv = contratoVigente.value
  return calcularFiniquito({
    sueldo_base:                  cv?.sueldo_base || trabajador.value.sueldo_base || 0,
    fecha_ingreso:                trabajador.value.fecha_ingreso,
    fecha_termino:                finiquitoForm.value.fecha_termino,
    motivo_termino:               finiquitoForm.value.motivo_termino,
    dias_trabajados_mes:          finiquitoForm.value.dias_trabajados_mes,
    vacaciones_dias:              finiquitoForm.value.vacaciones_dias,
    mes_aviso:                    !finiquitoForm.value.mes_aviso_dado,
    indemnizacion_vol:            finiquitoForm.value.indemnizacion_vol,
    sueldo_proporcional_override: finiquitoForm.value.sueldo_proporcional_manual,
  })
})

const totalFiniquito = computed(() => {
  if (!finiquitoCalc.value) return 0
  const totalDesc = finiquitoForm.value.descuentos.reduce((s, d) => s + (d.monto || 0), 0)
  return Math.max(0, finiquitoCalc.value.total_haberes - totalDesc)
})

const liquidacionesTrabajador = computed(() => {
  const id = route.params.id
  return rrhhStore.liquidaciones
    .filter(l => l.trabajador_id === id && l.tipo !== 'finiquito')
    .sort((a, b) => b.anio - a.anio || b.mes - a.mes)
})

const finiquitosTrabajador = computed(() => {
  const id = route.params.id
  return rrhhStore.liquidaciones
    .filter(l => l.trabajador_id === id && l.tipo === 'finiquito')
    .sort((a, b) => new Date(b.fecha_termino) - new Date(a.fecha_termino))
})

const contratosTrabajador = computed(() => {
  const id = route.params.id
  return rrhhStore.contratos.filter(c => c.trabajador_id === id)
})

// Contrato vigente: el más reciente con estado 'vigente' del trabajador
const contratoVigente = computed(() => {
  const activos = contratosTrabajador.value.filter(c => c.estado === 'vigente')
  if (!activos.length) return null
  return activos.sort((a, b) => new Date(b.fecha_inicio) - new Date(a.fecha_inicio))[0]
})

// Modal detalle de contrato
const showContratoDetalle = ref(false)
const contratoDetalle = ref(null)

function abrirDetalleContrato(c) {
  contratoDetalle.value = c
  showContratoDetalle.value = true
}

const documentos = ref([])

const checklistDocs = computed(() => {
  const tipo = trabajador.value?.tipo_contrato
  const docs = [
    { id: 'contrato', label: 'Contrato de Trabajo', done: contratosTrabajador.value.length > 0 },
    { id: 'cedula', label: 'Cédula de Identidad', done: false },
    { id: 'afp', label: 'Certificado AFP vigente', done: false },
    { id: 'salud', label: 'Certificado Sistema Salud', done: false },
    { id: 'curriculum', label: 'Currículum Vitae', done: false },
  ]
  if (tipo === 'proyecto' || tipo === 'jornada') {
    docs.push({ id: 'registro_audiovisual', label: 'Registro Audiovisual (Ley 19.981)', done: false })
  }
  return docs
})

// Gross-up simple para HH.EE. líquidas (Ley 19.981 proyecto):
// Halla el bruto tal que bruto − AFP − Salud ≈ liquidoOT (sin impuesto en rangos bajos)
function _grossUpOT(liquidoOT, afpComision = 0.1144, saludRate = 0.07) {
  if (!liquidoOT || liquidoOT <= 0) return 0
  let bruto = Math.round(liquidoOT / (1 - afpComision - saludRate))
  for (let i = 0; i < 10; i++) {
    const afpD = Math.round(bruto * afpComision)
    const salD = Math.round(bruto * saludRate)
    const liq  = bruto - afpD - salD
    const diff = liquidoOT - liq
    if (Math.abs(diff) <= 1) break
    bruto += diff
  }
  return bruto
}

const liqCalc = computed(() => {
  if (!trabajador.value) return null

  // ── Modo multi-proyecto ───────────────────────────────────────────────────
  if (liqHayProyectos.value && liqForm.value.contratos_sel.length > 0) {
    let totalBruto   = 0   // acumulado bruto total (base_bruto + OT_bruto)
    let totalMovil   = 0
    let totalColac   = 0
    const detalle    = []

    // Tasa AFP total (10% base + comisión AFP) para el gross-up de OT
    const afpCom = 0.10 + getAfpComision(trabajador.value.afp) // e.g. 0.1144 para AFP Capital

    for (const sel of liqForm.value.contratos_sel) {
      const c = contratosTrabajador.value.find(x => x._id === sel.contrato_id)
      if (!c) continue
      const base      = c.sueldo_base || 0
      const tipo      = (c.tipo_contrato || '').toLowerCase()
      const esProy    = tipo === 'proyecto'
      const esJornada = tipo === 'jornada'

      let proporcional = 0, montoHorasExtraBruto = 0, montoHorasExtraLiq = 0
      if (esProy) {
        // Proyecto/Obra: valor_dia es BRUTO (desde OC/Unabase)
        // Base = días reales × valor/día bruto (ya es bruto, sin gross-up)
        proporcional = (sel.dias || 0) * (sel.valor_dia || 0)
        // HH.EE. = horas × valor/hora en LÍQUIDO → gross-up a bruto
        const hhLiq = (sel.horas_extra_cantidad || 0) * (sel.valor_hora_extra || 0)
        montoHorasExtraLiq   = hhLiq
        montoHorasExtraBruto = _grossUpOT(hhLiq, afpCom)
      } else if (esJornada) {
        // Jornada: valor_dia es LÍQUIDO pactado → gross-up base
        const liquidoBase = (sel.dias || 0) * (sel.valor_dia || 0)
        proporcional = _grossUpOT(liquidoBase, afpCom)  // gross-up el líquido base
        // HH.EE. usando fórmula DT: valor_hora_extra ya es líquido → gross-up
        const hhLiq = (sel.horas_extra_cantidad || 0) * (sel.valor_hora_extra || 0)
        montoHorasExtraLiq   = hhLiq
        montoHorasExtraBruto = _grossUpOT(hhLiq, afpCom)
      } else {
        // Indefinido / plazo fijo: proporcional + HH.EE. en bruto
        proporcional         = Math.round(base / 30 * (sel.dias_trabajados || 0))
        const valorHora      = Math.round(base / 30 / 8 * 1.5)
        montoHorasExtraBruto = valorHora * (sel.horas_extra || 0)
      }

      totalBruto += proporcional + montoHorasExtraBruto
      totalMovil += c.movilizacion || 0
      totalColac += c.colacion  || 0
      detalle.push({
        contrato: c, proporcional,
        montoHorasExtra: montoHorasExtraBruto, montoHorasExtraLiq, sel,
        esProy, esJornada,
      })
    }

    // Totales separados para display
    const totalBaseVariable  = detalle.filter(d => d.esProy || d.esJornada).reduce((s, d) => s + d.proporcional, 0)
    const totalOTBruto       = detalle.reduce((s, d) => s + (d.montoHorasExtra || 0), 0)
    const totalHorasExtraLiq = detalle.reduce((s, d) => s + (d.montoHorasExtraLiq || 0), 0)
    // Determinar si hay jornada entre los contratos seleccionados
    const hayJornada = detalle.some(d => d.esJornada)

    // Pasar el bruto ya calculado (sin gross-up adicional)
    const resultado = calcularLiquidacion({
      sueldo_base:     totalBruto,
      _yaEsBruto:      true,            // flag: no hacer gross-up
      afp:             trabajador.value.afp,
      sistema_salud:   trabajador.value.sistema_salud,
      isapre_uf:       trabajador.value.isapre_uf || 0,
      tipo_contrato:   'proyecto',      // para cesantía 3% / 0% (plazo fijo)
      tipo_sueldo:     'bruto',
      gratificacion:   'anual',
      movilizacion:    totalMovil,
      colacion:        totalColac,
      dias_trabajados: 30,
      horas_extra:     0,
      bonos:           liqForm.value.bonos,
      descuentos:      liqForm.value.descuentos,
    })
    return {
      ...resultado,
      _detalle:            detalle,
      _multiContrato:      true,
      _totalBaseProyecto:  totalBaseVariable,
      _totalHorasExtraLiq: totalHorasExtraLiq,
      // Overrides: separar sueldo base de HH.EE. en el display
      sueldoProporcional:  totalBaseVariable,   // solo la base (días × valor/día)
      montoHorasExtra:     totalOTBruto,        // OT bruto (gross-up de líquido)
      esProyecto:          !hayJornada,
      esJornada:           hayJornada,
    }
  }

  // ── Modo single contract ──────────────────────────────────────────────────
  const cv = liqContratoActivo.value || contratoVigente.value
  return calcularLiquidacion({
    sueldo_base:    cv?.sueldo_base || trabajador.value.sueldo_base || 0,
    afp:            trabajador.value.afp,
    sistema_salud:  trabajador.value.sistema_salud,
    isapre_uf:      trabajador.value.isapre_uf || 0,
    tipo_contrato:  cv?.tipo_contrato || 'indefinido',
    tipo_sueldo:    cv?.tipo_sueldo || 'bruto',
    gratificacion:  cv?.gratificacion || trabajador.value.gratificacion || 'mensual',
    movilizacion:   cv?.movilizacion || 0,
    colacion:       cv?.colacion || 0,
    dias_trabajados: liqForm.value.dias_trabajados,
    horas_extra:    liqForm.value.horas_extra,
    bonos:          liqForm.value.bonos,
    descuentos:     liqForm.value.descuentos,
  })
})

// Texto resumen del sueldo base para contratos proyecto/jornada (ej. "3d × $159.667")
const _detalleResumen = computed(() => {
  if (!liqCalc.value?._detalle?.length) return ''
  return liqCalc.value._detalle
    .filter(d => (d.esProy || d.esJornada) && d.sel.dias && d.sel.valor_dia)
    .map(d => `${d.sel.dias}d × ${formatCLP(d.sel.valor_dia)}${d.esJornada ? ' líq.' : ''}`)
    .join(' + ')
})

function labelContrato(tipo) {
  const map = {
    indefinido: 'Indefinido',
    plazo_fijo: 'Plazo Fijo',
    proyecto:   'Por Proyecto/Obra',
    jornada:    'Por Jornada',
    honorarios: 'Honorarios',
    part_time:  'Part Time',
  }
  return map[tipo] || tipo
}

function formatCLP(v) {
  if (!v && v !== 0) return '—'
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v)
}

function formatDate(d) {
  if (!d) return '—'
  // Agregar T12:00 para evitar desfase de timezone al parsear solo fecha (YYYY-MM-DD)
  const dateStr = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d + 'T12:00' : d
  return new Date(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function openEditModal() {
  // TODO: open edit modal
}

// ── Bonos / Descuentos ────────────────────────────────────────────────────────
function getNombreBono(tipo) {
  return TIPOS_BONOS.find(t => t.tipo === tipo)?.nombre || tipo
}
function getNombreDescuento(tipo) {
  return TIPOS_DESCUENTOS.find(t => t.tipo === tipo)?.nombre || tipo
}

function addBono() {
  const def = TIPOS_BONOS[0]
  liqForm.value.bonos.push({ tipo: def.tipo, nombre: def.nombre, monto: 0, imponible: def.imponible })
}
function removeBono(i) { liqForm.value.bonos.splice(i, 1) }
function onBonoTipoChange(bono) {
  const def = TIPOS_BONOS.find(t => t.tipo === bono.tipo)
  if (def) { bono.nombre = def.nombre; bono.imponible = def.imponible }
}
function onBonoMontoInput(bono, event) {
  bono.monto = parseCLPInput(event.target.value)
}

function addDescuento() {
  const def = TIPOS_DESCUENTOS[0]
  liqForm.value.descuentos.push({ tipo: def.tipo, nombre: def.nombre, monto: 0 })
}
function removeDescuento(i) { liqForm.value.descuentos.splice(i, 1) }
function onDescTipoChange(desc) {
  const def = TIPOS_DESCUENTOS.find(t => t.tipo === desc.tipo)
  if (def) desc.nombre = def.nombre
}
function onDescMontoInput(desc, event) {
  desc.monto = parseCLPInput(event.target.value)
}

// Auto-calcula Semana Corrida en base a comisiones imponibles del form
function autoCalcSemanaCorrida(bono) {
  const totalComisiones = liqForm.value.bonos
    .filter(b => b.tipo !== 'semana_corrida' && b.imponible && b.monto > 0)
    .reduce((s, b) => s + b.monto, 0)
  const diasHabiles  = bono.dias_habiles  || 22
  const diasDescanso = bono.dias_descanso || 5
  bono.monto = calcularSemanaCorrida(totalComisiones, diasHabiles, diasDescanso)
}

function parseCLPInput(v) {
  return parseInt(String(v).replace(/\./g, '').replace(/,/g, '').replace(/\D/g, '')) || 0
}

function formatCLPInput(n) {
  if (!n && n !== 0) return ''
  return parseInt(String(n).replace(/\D/g, '')) ? parseInt(String(n).replace(/\D/g, '')).toLocaleString('es-CL') : ''
}

function openNewLiquidacion() {
  liqForm.value = {
    mes: now.getMonth() + 1,
    anio: now.getFullYear(),
    dias_trabajados: 30,
    horas_extra: 0,
    bonos: [],
    descuentos: [],
    notas: '',
    contrato_id: null,
    contratos_sel: [],
  }
  // Limpiar caché de valores al abrir liquidación nueva
  _liqSelCache.value = {}

  // Para trabajadores con proyectos, pre-seleccionar contratos del período automáticamente
  // _entradaContratoSel calcula días por fechas del contrato y trae valor_dia/horas del contrato
  if (liqHayProyectos.value) {
    contratosDelPeriodo.value.forEach(c => {
      liqForm.value.contratos_sel.push(_entradaContratoSel(c))
    })
  }
  activeTab.value = 'liquidaciones'
  showNewLiq.value = true
}

async function guardarLiqBorrador() {
  await saveLiq('borrador')
}

async function guardarLiqPagada() {
  await saveLiq('pagada')
}

const liqCreando = ref(false)

async function crearLiquidacion() {
  if (!trabajador.value || !liqCalc.value) return
  liqCreando.value = true
  try {
    // 1. Guardar la liquidación
    await saveLiq('pagada')   // ya cierra el modal
    // 2. Construir payload del PDF desde liqCalc (ya calculado, sin re-fetch)
    await _descargarLiqDesdeCalc()
  } catch (e) {
    console.error('Error creando liquidación', e)
  } finally {
    liqCreando.value = false
  }
}

async function _descargarLiqDesdeCalc() {
  const t   = trabajador.value
  const lc  = liqCalc.value
  if (!t || !lc) return
  const orgInfo = {}

  const mesesNombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const mesNombre = mesesNombres[(liqForm.value.mes || 1) - 1]

  // Haberes del PDF
  const haberesPDF = []
  if (lc._multiContrato && lc._detalle?.length) {
    lc._detalle.forEach(d => {
      haberesPDF.push({
        nombre: d.contrato.nombre_proyecto || d.contrato.negocio_nombre || d.contrato.cargo || 'Proyecto',
        detalle: `30 días × ${fmt(d.contrato.sueldo_base)}/mes`,
        monto: d.proporcional,
      })
      if (d.montoHorasExtra > 0) haberesPDF.push({ nombre: 'Horas Extra', monto: d.montoHorasExtra })
    })
  } else {
    haberesPDF.push({ nombre: 'Sueldo Base', detalle: `${liqForm.value.dias_trabajados}/30 días`, monto: lc.sueldoProporcional })
    if (lc.montoHorasExtra > 0) haberesPDF.push({ nombre: 'Horas Extra', monto: lc.montoHorasExtra })
    if (lc.gratificacion > 0)   haberesPDF.push({ nombre: 'Gratificación Legal', monto: lc.gratificacion })
  }
  liqForm.value.bonos.filter(b => b.monto > 0).forEach(b => haberesPDF.push({ nombre: b.nombre || b.tipo, monto: b.monto, imponible: b.imponible }))

  function fmt(v) {
    if (!v) return '$0'
    return '$' + Math.round(v).toLocaleString('es-CL')
  }

  const _orgLiq1 = getOrgForPdf()
  const payload = {
    organizacion: { nombre: _orgLiq1.nombre, rut: _orgLiq1.rut, direccion: _orgLiq1.direccion, ciudad: _orgLiq1.ciudad },
    logo_base64:  _orgLiq1.logo_base64,
    trabajador: {
      nombre:        `${t.nombre || ''} ${t.apellido || ''}`.trim(),
      rut:           t.rut || '',
      cargo:         t.cargo || '',
      afp:           t.afp || '',
      sistema_salud: t.sistema_salud || 'FONASA',
      dias_trabajados: liqForm.value.contratos_sel.length > 0
        ? '30 (por proyecto)'
        : String(liqForm.value.dias_trabajados),
    },
    liquidacion: {
      periodo:          `${mesNombre} ${liqForm.value.anio}`,
      liquido_a_pagar:  lc.liquidoAPagar,
      haberes: haberesPDF,
      descuentos_legales: [
        { nombre: t.afp || 'AFP',                       monto: lc.afp_descuento },
        { nombre: `Salud ${t.sistema_salud || 'FONASA'}`, monto: lc.salud_descuento },
        { nombre: 'Cesantía (0.6%)',                    monto: lc.cesantia_trabajador },
        ...(lc.impuesto > 0 ? [{ nombre: 'Imp. 2ª Cat.', monto: lc.impuesto }] : []),
      ].filter(d => d.monto > 0),
      otros_descuentos: (liqForm.value.descuentos || []).filter(d => d.monto > 0),
      aportes: [
        { nombre: 'Cesantía empleador', monto: lc.cesantia_empleador },
        { nombre: 'Mutual Seguridad',   monto: lc.mutual },
      ].filter(a => a.monto > 0),
      totales: {
        haberes:     lc.totalHaberes,
        descuentos:  lc.totalDescuentos,
        aportes:     (lc.cesantia_empleador || 0) + (lc.mutual || 0),
      },
      pago: {},
      renta_imponible:     lc.rentaImponible,
      costo_empresa:       lc.costoEmpresa,
    },
  }

  const res = await $fetch('/api/rrhh/liquidacion-pdf', { method: 'POST', body: payload, responseType: 'blob' })
  const url = URL.createObjectURL(new Blob([res], { type: 'application/pdf' }))
  const a   = document.createElement('a')
  a.href    = url
  const rut = (t.rut || 'doc').replace(/\./g, '').replace(/-/g, '')
  a.download = `liquidacion-${rut}-${liqForm.value.mes}-${liqForm.value.anio}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

async function saveLiq(estado) {
  if (!trabajador.value || !liqCalc.value) return
  const isMulti = liqCalc.value._multiContrato

  // Nombres de proyectos incluidos (para mostrar en historial)
  const negocioNombres = isMulti
    ? liqForm.value.contratos_sel
        .map(s => contratosTrabajador.value.find(c => c._id === s.contrato_id))
        .filter(Boolean)
        .map(c => c.negocio_nombre || c.nombre_proyecto || c.cargo || '—')
        .join(' + ')
    : liqContratoActivo.value?.negocio_nombre || ''

  await rrhhStore.createLiquidacion({
    trabajador_id:       trabajador.value._id,
    contrato_id:         isMulti ? null : (liqForm.value.contrato_id || liqContratoActivo.value?._id || null),
    contratos_sel:       isMulti ? liqForm.value.contratos_sel : null,
    negocio_nombre:      negocioNombres,
    mes:                 liqForm.value.mes,
    anio:                liqForm.value.anio,
    dias_trabajados:     isMulti
                           ? liqForm.value.contratos_sel.reduce((s, x) => s + (x.dias_trabajados || 0), 0)
                           : liqForm.value.dias_trabajados,
    horas_extra:         isMulti
                           ? liqForm.value.contratos_sel.reduce((s, x) => s + (x.horas_extra || 0), 0)
                           : liqForm.value.horas_extra,
    bonos:               liqForm.value.bonos,
    descuentos:          liqForm.value.descuentos,
    notas:               liqForm.value.notas,
    sueldo_base:         liqCalc.value.sueldoProporcional,
    total_haberes:       liqCalc.value.totalHaberes,
    total_descuentos:    liqCalc.value.totalDescuentos,
    liquido_a_pagar:     liqCalc.value.liquidoAPagar,
    costo_empresa:       liqCalc.value.costoEmpresa,
    afp_descuento:       liqCalc.value.afp_descuento,
    salud_descuento:     liqCalc.value.salud_descuento,
    cesantia_trabajador: liqCalc.value.cesantia_trabajador,
    cesantia_empleador:  liqCalc.value.cesantia_empleador,
    impuesto:            liqCalc.value.impuesto,
    renta_imponible:     liqCalc.value.rentaImponible,
    renta_tributable:    liqCalc.value.rentaTributable,
    estado,
  })
  showNewLiq.value = false
  await rrhhStore.getLiquidaciones()
}

// ── Descargar Contrato PDF desde el tab de contratos ─────────────────────────
async function descargarContratoPDFDesdeTab(c) {
  // Carga todos los datos del contrato en el form y genera el PDF directamente
  contratoForm.value = {
    tipo_contrato:    c.tipo_contrato || 'indefinido',
    fecha_inicio:     c.fecha_inicio?.slice(0,10) || '',
    fecha_termino:    c.fecha_termino?.slice(0,10) || '',
    nombre_proyecto:  c.nombre_proyecto || '',
    descripcion_rol:  c.descripcion_rol || '',
    cargo:            c.cargo || trabajador.value?.cargo || '',
    jornada_semanal:  c.jornada_semanal || '45',
    lugar_trabajo:    c.lugar_trabajo || 'Santiago, Región Metropolitana',
    direccion_trabajo: c.direccion_trabajo || '',
    horas_semana:     c.horas_semana || 45,
    sueldo_base:      c.sueldo_base || 0,
    tipo_sueldo:      c.tipo_sueldo || 'bruto',
    gratificacion:    c.gratificacion || 'mensual',
    modalidad:        c.modalidad || 'presencial',
    movilizacion:     c.movilizacion || 0,
    colacion:         c.colacion || 0,
    turno_id:         c.turno_id || '',
    negocio_id:       c.negocio_id || '',
    negocio_nombre:   c.negocio_nombre || '',
    linea_codigo:     c.linea_codigo || '',
    linea_nombre:     c.linea_nombre || '',
    clausulas:        c.clausulas || [],
    valor_dia:               c.valor_dia || 0,
    dias_contratados:        c.dias_contratados || 0,
    valor_hora_extra:        c.valor_hora_extra || 0,
    horas_extras_contratadas: c.horas_extras_contratadas || 0,
  }
  contratoViewMode.value = true
  contratoEditId.value = c._id
  await generarContratoPDF()
}

// ── Descargar PDF de una liquidación guardada ─────────────────────────────────
async function descargarLiqPDF(liq) {
  if (liqPdfLoading.value) return
  liqPdfLoading.value = liq._id
  try {
    const t = trabajador.value
    const orgInfo = {}

    // Reconstruir bonos/descuentos desde la liq guardada (si no tiene, array vacío)
    const bonos     = liq.bonos     || []
    const descuentos = liq.descuentos || []

    const _orgLiq2 = getOrgForPdf()
    const payload = {
      organizacion: { nombre: _orgLiq2.nombre, rut: _orgLiq2.rut, direccion: _orgLiq2.direccion, ciudad: _orgLiq2.ciudad },
      logo_base64:  _orgLiq2.logo_base64,
      trabajador: {
        nombre_completo: `${t.nombre} ${t.apellido}`,
        rut:             t.rut || '',
        cargo:           t.cargo || '',
        afp:             t.afp || '',
        sistema_salud:   t.sistema_salud || 'FONASA',
        tipo_contrato:   t.tipo_contrato || 'indefinido',
      },
      liquidacion: {
        mes:                 liq.mes,
        anio:                liq.anio,
        periodo:             `${liq.mes}/${liq.anio}`,
        sueldo_base:         liq.sueldo_base,
        total_haberes:       liq.total_haberes,
        total_descuentos:    liq.total_descuentos,
        liquido_a_pagar:     liq.liquido_a_pagar,
        costo_empresa:       liq.costo_empresa,
        afp_descuento:       liq.afp_descuento,
        salud_descuento:     liq.salud_descuento,
        cesantia_trabajador: liq.cesantia_trabajador,
        cesantia_empleador:  liq.cesantia_empleador,
        impuesto:            liq.impuesto,
        renta_imponible:     liq.renta_imponible,
      },
      haberes: [
        { nombre: 'Sueldo Base', monto: liq.sueldo_base, imponible: true },
        ...bonos.map(b => ({ nombre: b.nombre || b.tipo, monto: b.monto, imponible: b.imponible })),
      ].filter(h => h.monto > 0),
      descuentos_legales: [
        { nombre: t.afp || 'AFP', monto: liq.afp_descuento },
        { nombre: t.sistema_salud || 'FONASA', monto: liq.salud_descuento },
        { nombre: 'Cesantía trabajador', monto: liq.cesantia_trabajador },
        { nombre: 'Imp. Único 2ª Cat.', monto: liq.impuesto },
      ].filter(d => d.monto > 0),
      otros_descuentos: descuentos.filter(d => d.monto > 0),
    }

    const res = await $fetch('/api/rrhh/liquidacion-pdf', {
      method: 'POST',
      body: payload,
      responseType: 'blob',
    })
    const url = URL.createObjectURL(new Blob([res], { type: 'application/pdf' }))
    const a = document.createElement('a')
    a.href = url
    const rut = (t.rut || 'doc').replace(/\./g, '').replace(/-/g, '')
    a.download = `liquidacion-${rut}-${liq.mes}-${liq.anio}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('Error generando liquidación PDF:', e)
    alert('Error al generar el PDF. Verifica que el servidor esté activo.')
  } finally {
    liqPdfLoading.value = null
  }
}

// ── Generar Contrato ──────────────────────────────────────────────────────────
function openGenContrato() {
  const t = trabajador.value
  negocioSeleccionado.value = null
  negocioBusqueda.value = ''
  contratoViewMode.value = false
  contratoEditId.value = null
  contratoForm.value = {
    tipo_contrato:    'indefinido',
    fecha_inicio:     t?.fecha_ingreso?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    fecha_termino:    '',
    nombre_proyecto:  t?.nombre_proyecto || '',
    descripcion_rol:  '',
    cargo:            t?.cargo || '',
    jornada_semanal:  '45',
    lugar_trabajo:    'Santiago, Región Metropolitana',
    direccion_trabajo: '',
    horas_semana:     45,
    sueldo_base:      0,
    tipo_sueldo:      'bruto',
    gratificacion:    'mensual',
    modalidad:        'presencial',
    movilizacion:     50000,
    colacion:         40000,
    turno_id:         '',
    negocio_id:       '',
    negocio_nombre:   '',
    linea_codigo:     '',
    linea_nombre:     '',
    clausulas:        [],
    valor_dia:               0,
    dias_contratados:        0,
    valor_hora_extra:        0,
    horas_extras_contratadas: 0,
  }
  showGenContrato.value = true
}

async function abrirContratoExistente(c) {
  // Abrir el modal en modo vista/edición de un contrato ya creado
  const proyEnLista = proyectosLocales.value.find(n => n._id === c.negocio_id) || null
  negocioSeleccionado.value = proyEnLista
  negocioBusqueda.value = c.negocio_nombre || ''
  contratoViewMode.value = true
  contratoEditId.value = c._id
  contratoForm.value = {
    tipo_contrato:    c.tipo_contrato || 'indefinido',
    fecha_inicio:     c.fecha_inicio?.slice(0,10) || '',
    fecha_termino:    c.fecha_termino?.slice(0,10) || '',
    nombre_proyecto:  c.nombre_proyecto || '',
    descripcion_rol:  c.descripcion_rol || '',
    cargo:            c.cargo || '',
    jornada_semanal:  c.jornada_semanal || String(c.horas_semana || 45),
    lugar_trabajo:    c.lugar_trabajo || 'Santiago, Región Metropolitana',
    direccion_trabajo: c.direccion_trabajo || '',
    horas_semana:     c.horas_semana || 45,
    sueldo_base:      c.sueldo_base || 0,
    tipo_sueldo:      c.tipo_sueldo || 'bruto',
    gratificacion:    c.gratificacion || 'mensual',
    modalidad:        c.modalidad || 'presencial',
    movilizacion:     c.movilizacion || 0,
    colacion:         c.colacion || 0,
    turno_id:         c.turno_id || '',
    negocio_id:       c.negocio_id || '',
    negocio_nombre:   c.negocio_nombre || '',
    linea_codigo:     c.linea_codigo || '',
    linea_nombre:     c.linea_nombre || '',
    clausulas:        c.clausulas || [],
    valor_dia:               c.valor_dia || 0,
    dias_contratados:        c.dias_contratados || 0,
    valor_hora_extra:        c.valor_hora_extra || 0,
    horas_extras_contratadas: c.horas_extras_contratadas || 0,
  }

  // Cargar líneas del proyecto si tiene negocio_id
  // Guardamos linea_codigo y lo reseteamos para que el select se re-renderice
  // correctamente una vez que las opciones estén disponibles (timing async)
  const savedLinea  = c.linea_codigo || ''
  const savedLinNom = c.linea_nombre || ''
  contratoForm.value.linea_codigo = ''
  contratoForm.value.linea_nombre = ''
  lineasNegocioActual.value = []

  if (c.negocio_id) {
    try {
      lineasNegocioActual.value = await $fetch(`/api/rrhh/lineas?proyectoId=${c.negocio_id}`)
      // Si el proyecto no estaba en la lista local, crear objeto mínimo para habilitarlo
      if (!negocioSeleccionado.value) {
        negocioSeleccionado.value = { _id: c.negocio_id, nombre: c.negocio_nombre || '' }
      }
    } catch { lineasNegocioActual.value = [] }
  }

  // Restaurar la línea seleccionada DESPUÉS de que el DOM tenga las opciones
  await nextTick()
  contratoForm.value.linea_codigo = savedLinea
  contratoForm.value.linea_nombre = savedLinNom

  showGenContrato.value = true
}

// ── Término de Contrato / Finiquito ───────────────────────────────────────────

/**
 * Contratos vigentes del trabajador que se finiquitarán.
 * Para proyecto: los que se solapan con el mes de la fecha de término.
 */
function getContratosAFiniquitar(fechaTerminoStr) {
  if (!fechaTerminoStr) return contratosTrabajador.value.filter(c =>
    ['vigente', 'activo', 'borrador'].includes(c.estado)
  )
  const dt = new Date(fechaTerminoStr + 'T12:00')
  const mes  = dt.getMonth() + 1
  const anio = dt.getFullYear()
  const primerDia = new Date(anio, mes - 1, 1)
  const ultimoDia = new Date(anio, mes, 0, 23, 59, 59)

  return contratosTrabajador.value.filter(c => {
    if (!['vigente', 'activo', 'borrador'].includes(c.estado)) return false
    const inicio  = c.fecha_inicio  ? new Date(c.fecha_inicio.slice(0,10)  + 'T12:00') : null
    const termino = c.fecha_termino ? new Date(c.fecha_termino.slice(0,10) + 'T12:00') : null
    if (inicio  && inicio  > ultimoDia) return false
    if (termino && termino < primerDia) return false
    return true
  })
}

/**
 * Calcula días totales desde los contratos activos para la fecha de término.
 * Para proyecto: usa las fechas del contrato vs el mes de término.
 * Para otros: días del contrato o 30 (mes completo).
 */
function diasDeContratos(fechaTerminoStr) {
  const contratos = getContratosAFiniquitar(fechaTerminoStr)
  if (!contratos.length) return 30

  const dt = new Date((fechaTerminoStr || new Date().toISOString().slice(0,10)) + 'T12:00')
  const mes  = dt.getMonth() + 1
  const anio = dt.getFullYear()
  const primerDiaMes = new Date(anio, mes - 1, 1)
  const ultimoDiaMes = new Date(anio, mes, 0)

  let total = 0
  contratos.forEach(c => {
    if (c.tipo_contrato === 'proyecto' || c.tipo_contrato === 'jornada') {
      const inicio  = c.fecha_inicio  ? new Date(c.fecha_inicio.slice(0,10)  + 'T12:00') : primerDiaMes
      const termino = c.fecha_termino ? new Date(c.fecha_termino.slice(0,10) + 'T12:00') : ultimoDiaMes
      const desde = inicio  > primerDiaMes ? inicio  : primerDiaMes
      const hasta = termino < ultimoDiaMes ? termino : ultimoDiaMes
      if (desde <= hasta) total += Math.round((hasta - desde) / (1000*60*60*24)) + 1
    } else {
      total = Math.max(total, c.dias_contratados || 30)
    }
  })
  return total || 30
}

function openFiniquito() {
  const t = trabajador.value
  const fechaTermino = new Date().toISOString().slice(0, 10)

  // Detectar si el contrato vigente es tipo proyecto/jornada → sugerir conclusión
  const cv = contratoVigente.value
  const esProyecto = cv?.tipo_contrato === 'proyecto' || cv?.tipo_contrato === 'jornada'
  const motivoDefecto = esProyecto ? 'conclusion_trabajo' : 'mutuo_acuerdo'
  const esConclusionDefecto = motivoDefecto === 'conclusion_trabajo'

  finiquitoForm.value = {
    motivo_termino:             motivoDefecto,
    fecha_termino:              fechaTermino,
    mes_aviso_dado:             true,
    dias_trabajados_mes:        diasDeContratos(fechaTermino),
    vacaciones_dias:            esConclusionDefecto ? 0 : (vacacionesAcumuladas.value || t?.vacaciones_dias || 0),
    indemnizacion_vol:          0,
    descuentos:                 [],
    sueldo_proporcional_manual: esConclusionDefecto ? 0 : null,
  }
  showFiniquito.value = true
}

function onMotivoChange() {
  const ff = finiquitoForm.value
  const esConclusionTrabajo = ff.motivo_termino === 'conclusion_trabajo'

  if (esConclusionTrabajo) {
    // Todo en $0 — el pago ya fue hecho en la(s) liquidaciones del proyecto
    ff.sueldo_proporcional_manual = 0
    ff.vacaciones_dias = 0
  } else {
    // Restablecer a cálculo automático
    ff.sueldo_proporcional_manual = null
    ff.vacaciones_dias = vacacionesAcumuladas.value || trabajador.value?.vacaciones_dias || 0
  }
  // Recalcular días desde contratos
  if (ff.fecha_termino) ff.dias_trabajados_mes = diasDeContratos(ff.fecha_termino)
}

function recalcFiniquito() {
  // computed finiquitoCalc is reactive, no manual recalc needed
}

function onFechaTerminoChange() {
  const ff = finiquitoForm.value
  if (!ff.fecha_termino) return
  ff.dias_trabajados_mes = diasDeContratos(ff.fecha_termino)
}

// ── Contrato PDF ──────────────────────────────────────────────────────────────
async function generarContratoPDF() {
  if (!trabajador.value) return
  loadingPDF.value = true
  const t = trabajador.value

  const cf = contratoForm.value
  const horasSem = cf.jornada_semanal === 'custom' ? cf.horas_semana
    : cf.jornada_semanal === 'diaria' ? 'diaria'
    : cf.jornada_semanal === 'art22'  ? 'art22'    // libre de jornada
    : parseInt(cf.jornada_semanal) || 45

  // 1. Guardar contrato en localStorage SIEMPRE (antes de intentar el PDF)
  try {
    const payload = {
      trabajador_id:     t._id || t.id,
      trabajador_nombre: `${t.nombre} ${t.apellido || ''}`,
      tipo_contrato:     cf.tipo_contrato,
      fecha_inicio:      cf.fecha_inicio,
      fecha_termino:     cf.fecha_termino || null,
      nombre_proyecto:   cf.nombre_proyecto,
      descripcion_rol:   cf.descripcion_rol,
      cargo:             cf.cargo || t.cargo,
      jornada_semanal:   cf.jornada_semanal,
      horas_semana:      horasSem,
      lugar_trabajo:     cf.lugar_trabajo,
      direccion_trabajo: cf.direccion_trabajo || '',
      modalidad:         cf.modalidad,
      sueldo_base:       cf.tipo_contrato === 'proyecto'
                           ? (cf.valor_dia || 0) * (cf.dias_contratados || 0)
                           : cf.sueldo_base,   // jornada: sueldo_base ES el líquido pactado
      tipo_sueldo:       cf.tipo_contrato === 'proyecto' ? 'bruto'
                       : cf.tipo_contrato === 'jornada'  ? 'liquido'
                       : (cf.tipo_sueldo || 'bruto'),
      valor_dia:               ['proyecto','jornada'].includes(cf.tipo_contrato) ? (cf.valor_dia || 0) : null,
      dias_contratados:        ['proyecto','jornada'].includes(cf.tipo_contrato) ? (cf.dias_contratados || 0) : null,
      valor_hora_extra:        ['proyecto','jornada'].includes(cf.tipo_contrato) ? (cf.valor_hora_extra || 0) : null,
      horas_extras_contratadas: ['proyecto','jornada'].includes(cf.tipo_contrato) ? (cf.horas_extras_contratadas || 0) : null,
      gratificacion:     cf.gratificacion,
      movilizacion:      cf.movilizacion,
      colacion:          cf.colacion,
      clausulas:         cf.clausulas,
      turno_id:          cf.turno_id || null,
      negocio_id:        cf.negocio_id || null,
      negocio_nombre:    cf.negocio_nombre || null,
      linea_codigo:      cf.linea_codigo || null,
      linea_nombre:      cf.linea_nombre || null,
      estado:            'vigente',
      pdf_generado:      false,
      fecha_generacion:  new Date().toISOString(),
    }
    if (contratoViewMode.value && contratoEditId.value) {
      rrhhStore.updateContrato(contratoEditId.value, payload)
    } else {
      await rrhhStore.createContrato(payload)
    }
  } catch (saveErr) {
    console.warn('Error guardando contrato en LS:', saveErr)
  }

  // 2. Intentar generar PDF (opcional — puede fallar si el servidor no está activo)
  try {
    const orgInfo = {}

    const horasSemana = contratoForm.value.jornada_semanal === 'custom'
      ? contratoForm.value.horas_semana
      : contratoForm.value.jornada_semanal === 'diaria'
        ? 'Jornada diaria (según faena)'
        : contratoForm.value.jornada_semanal === 'art22'
          ? 'Trabajador exento de jornada (Art. 22 inc. 2° del Código del Trabajo)'
          : parseInt(contratoForm.value.jornada_semanal) || 45

    const turnoSeleccionado = contratoForm.value.turno_id
      ? asistenciaStore.turnos.find(tr => (tr.id || tr._id) === contratoForm.value.turno_id)
      : null

    // El script Python espera: campos de negocio en la raíz (d.get("cargo"), d.get("sueldo_base"), etc.)
    // y d.get("trabajador") con campos "nombre" (no "nombre_completo"), "domicilio", "afp", etc.
    // y d.get("empleador") para representante / d.get("organizacion") para nombre/rut/dirección empresa
    const funciones = cf.descripcion_rol
      ? cf.descripcion_rol.split('\n').map(f => f.trim()).filter(Boolean)
      : []

    const payload = {
      // Tipo y campos raíz (lo que Python lee con d.get(...))
      tipo_contrato:    cf.tipo_contrato,
      cargo:            cf.cargo || t.cargo || '',
      sueldo_base:      cf.sueldo_base || 0,
      gratificacion:    cf.gratificacion || 'mensual',
      colacion:         cf.colacion || 0,
      movilizacion:     cf.movilizacion || 0,
      fecha_inicio:     cf.fecha_inicio || '',
      fecha_termino:    cf.fecha_termino || null,
      nombre_proyecto:  cf.nombre_proyecto || '',
      descripcion_rol:  cf.descripcion_rol || '',
      funciones,
      lugar_trabajo:    cf.lugar_trabajo || 'Santiago',
      direccion_trabajo: cf.direccion_trabajo || cf.lugar_trabajo || 'Santiago',
      modalidad:        cf.modalidad || 'presencial',
      jornada_horas:    horasSemana,
      turno:            turnoSeleccionado
        ? `${turnoSeleccionado.nombre} (${turnoSeleccionado.hora_entrada}–${turnoSeleccionado.hora_salida})`
        : '',
      negocio:          cf.negocio_nombre || '',
      linea_presupuestal: cf.linea_codigo
        ? `${cf.linea_codigo} — ${cf.linea_nombre}`
        : '',
      clausulas_extras: cf.clausulas || [],
      fecha_documento:  new Date().toISOString().slice(0, 10),
      // Organización (lo que Python lee con org.get(...))
      organizacion: (() => { const _o = getOrgForPdf(); return { nombre: _o.nombre, rut: _o.rut, direccion: _o.direccion, ciudad: _o.ciudad } })(),
      logo_base64:  getOrgForPdf().logo_base64,
      // Empleador — representante legal (emp.get("representante") en Python)
      empleador: {
        representante:     getOrgForPdf().representante,
        rut_representante: '',
      },
      // Trabajador — Python usa trab.get("nombre"), NO "nombre_completo"
      trabajador: {
        nombre:           `${t.nombre} ${t.apellido || ''}`.trim(),
        rut:              t.rut || '',
        domicilio:        t.direccion || '',
        email:            t.email || '',
        telefono:         t.telefono || '',
        fecha_nacimiento: t.fecha_nacimiento || '',
        nacionalidad:     t.nacionalidad || 'Chilena',
        profesion:        t.profesion || cf.cargo || t.cargo || '',
        afp:              t.afp || '',
        sistema_salud:    t.sistema_salud || 'FONASA',
      },
    }

    const res = await $fetch('/api/rrhh/contrato-pdf', {
      method: 'POST',
      body: payload,
      responseType: 'blob',
    })

    const url = URL.createObjectURL(new Blob([res], { type: 'application/pdf' }))
    const a = document.createElement('a')
    a.href = url
    const tipo = contratoForm.value.tipo_contrato
    const rut = (t.rut || 'doc').replace(/\./g, '').replace(/-/g, '')
    a.download = `contrato-${tipo}-${rut}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('PDF ERROR:', e.message, e.data)
    alert('Error PDF: ' + (e.data?.message || e.message || 'Error desconocido'))
    // No alertar — el contrato ya fue guardado; el PDF se puede generar luego
  } finally {
    loadingPDF.value = false
  }

  showGenContrato.value = false
}

// ── Finiquito PDF ─────────────────────────────────────────────────────────────
async function generarFiniquitoPDF() {
  if (!trabajador.value || !finiquitoCalc.value) return
  loadingPDF.value = true
  const t = trabajador.value
  const calc = finiquitoCalc.value
  const ff = finiquitoForm.value

  // 1. Guardar finiquito, cerrar contratos y marcar trabajador como inactivo
  try {
    // IDs de contratos vigentes que se finiquitan
    const contratosAFin = getContratosAFiniquitar(ff.fecha_termino)
    const contratos_ids = contratosAFin.map(c => c._id)

    // Guardar como liquidación de finiquito (incluye los contratos cerrados)
    await rrhhStore.createLiquidacion({
      trabajador_id:    t._id || t.id,
      trabajador_rut:   t.rut || '',
      trabajador_nombre: t.nombre,
      tipo:             'finiquito',
      motivo_termino:   ff.motivo_termino,
      fecha_termino:    ff.fecha_termino,
      mes:              new Date(ff.fecha_termino + 'T12:00').getMonth() + 1,
      anio:             new Date(ff.fecha_termino + 'T12:00').getFullYear(),
      dias_trabajados:  ff.dias_trabajados_mes,
      sueldo_base:      contratoVigente.value?.sueldo_base || t.sueldo_base || 0,
      sueldo_proporcional:         calc.sueldo_proporcional,
      gratificacion_proporcional:  calc.gratificacion_proporcional,
      vacaciones_monto:            calc.vacaciones_monto,
      indemnizacion_anos_servicio: calc.indemnizacion_anos_servicio,
      sustitutiva_mes_aviso:       calc.sustitutiva_mes_aviso,
      indemnizacion_voluntaria:    ff.indemnizacion_vol || 0,
      total_finiquito:             calc.total_haberes || 0,
      estado:           'pagado',
      contratos_ids,              // para poder reactivar si se elimina el finiquito
    })

    // Cerrar cada contrato → estado 'terminado'
    contratos_ids.forEach(cid => {
      rrhhStore.updateContrato(cid, {
        estado:         'terminado',
        fecha_termino:  ff.fecha_termino,
      })
    })

    // Marcar trabajador como inactivo
    await rrhhStore.updateTrabajador(t._id || t.id, {
      estado:        'inactivo',
      fecha_termino: ff.fecha_termino,
    })
  } catch (saveErr) {
    console.warn('Error guardando finiquito en LS:', saveErr)
  }

  // 2. Intentar generar PDF (opcional)
  try {
    const orgInfo = {}

    const _orgFin1 = getOrgForPdf()
    const payload = {
      motivo_termino: ff.motivo_termino,
      fecha_termino:  ff.fecha_termino,
      fecha_aviso:    ff.mes_aviso_dado ? null : ff.fecha_termino,
      fecha_emision:  new Date().toISOString().slice(0, 10),
      organizacion: {
        nombre:        _orgFin1.nombre,
        rut:           _orgFin1.rut,
        representante: _orgFin1.representante || '',
        giro:          '',
        domicilio:     _orgFin1.direccion,
        ciudad:        _orgFin1.ciudad,
      },
      logo_base64: _orgFin1.logo_base64,
      trabajador: {
        nombre_completo: `${t.nombre} ${t.apellido || ''}`,
        rut:             t.rut || '',
        cargo:           t.cargo || '',
        fecha_ingreso:   t.fecha_ingreso || '',
        domicilio:       t.direccion || '',
      },
      liquidacion: {
        sueldo_base:                  contratoVigente.value?.sueldo_base || t.sueldo_base || 0,
        dias_trabajados:              ff.dias_trabajados_mes,
        sueldo_proporcional:          calc.sueldo_proporcional,
        vacaciones_pendientes_dias:   calc.vacaciones_dias,
        vacaciones_pendientes_monto:  calc.vacaciones_monto,
        gratificacion_proporcional:   calc.gratificacion_proporcional,
        indemnizacion_anos_servicio:  calc.indemnizacion_anos_servicio,
        sustitutiva_mes_aviso:        calc.sustitutiva_mes_aviso,
        indemnizacion_voluntaria:     calc.indemnizacion_vol,
        anos_servicio:                calc.anos_tope,
      },
      descuentos_finiquito: ff.descuentos.filter(d => d.monto > 0),
    }

    const res = await $fetch('/api/rrhh/finiquito-pdf', {
      method: 'POST',
      body: payload,
      responseType: 'blob',
    })

    const url = URL.createObjectURL(new Blob([res], { type: 'application/pdf' }))
    const a = document.createElement('a')
    a.href = url
    const rut = (t.rut || 'doc').replace(/\./g, '').replace(/-/g, '')
    const fecha = ff.fecha_termino.replace(/-/g, '')
    a.download = `finiquito-${rut}-${fecha}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.warn('No se pudo generar PDF de finiquito (servidor no disponible):', e.message)
  } finally {
    loadingPDF.value = false
  }

  showFiniquito.value = false
}

// ── Eliminar Contrato ─────────────────────────────────────────────────────────
// ── Eliminar Liquidación ──────────────────────────────────────────────────────
const confirmEliminarLiq = ref({ show: false, liq: null })

function pedirEliminarLiq(liq) {
  confirmEliminarLiq.value = { show: true, liq }
}

function confirmarEliminarLiq() {
  const liq = confirmEliminarLiq.value.liq
  if (!liq) return
  rrhhStore.deleteLiquidacion(liq._id)
  confirmEliminarLiq.value = { show: false, liq: null }
}

// ── Eliminar finiquito → reactivar contratos y trabajador ────────────────────
const confirmarEliminarFiniquito = ref(false)
const finiquitoAEliminar = ref(null)

function pedirEliminarFiniquito(fin) {
  finiquitoAEliminar.value = fin
  confirmarEliminarFiniquito.value = true
}

function ejecutarEliminarFiniquito() {
  const fin = finiquitoAEliminar.value
  const t   = trabajador.value
  if (!fin || !t) return

  // Reactivar contratos que estaban en este finiquito
  const cids = fin.contratos_ids || []
  cids.forEach(cid => {
    rrhhStore.updateContrato(cid, {
      estado:        'vigente',
      fecha_termino: null,
    })
  })

  // Reactivar al trabajador
  rrhhStore.updateTrabajador(t._id || t.id, {
    estado:        'activo',
    fecha_termino: null,
  })

  // Eliminar el registro de finiquito
  rrhhStore.deleteLiquidacion(fin._id)

  confirmarEliminarFiniquito.value = false
  finiquitoAEliminar.value = null
}

// ── Descargar PDF de un finiquito ya guardado ─────────────────────────────────
async function descargarFiniquitoPDF(fin) {
  const t = trabajador.value
  if (!t) return
  try {
    const orgInfo = {}
    const _orgFin2 = getOrgForPdf()
    const payload = {
      motivo_termino: fin.motivo_termino,
      fecha_termino:  fin.fecha_termino || `${fin.anio}-${String(fin.mes).padStart(2,'0')}-30`,
      fecha_emision:  new Date().toISOString().slice(0,10),
      organizacion: {
        nombre:        _orgFin2.nombre,
        rut:           _orgFin2.rut,
        representante: _orgFin2.representante || '',
        domicilio:     _orgFin2.direccion,
        ciudad:        _orgFin2.ciudad,
      },
      logo_base64: _orgFin2.logo_base64,
      trabajador: {
        nombre_completo: `${t.nombre} ${t.apellido || ''}`,
        rut:             t.rut || '',
        cargo:           t.cargo || '',
        fecha_ingreso:   t.fecha_ingreso || '',
        domicilio:       t.direccion || '',
      },
      liquidacion: {
        sueldo_base:                 fin.sueldo_base || 0,
        dias_trabajados:             fin.dias_trabajados || 0,
        sueldo_proporcional:         fin.sueldo_proporcional || 0,
        vacaciones_pendientes_dias:  fin.vacaciones_dias || 0,
        vacaciones_pendientes_monto: fin.vacaciones_monto || 0,
        gratificacion_proporcional:  fin.gratificacion_proporcional || 0,
        indemnizacion_anos_servicio: fin.indemnizacion_anos_servicio || 0,
        sustitutiva_mes_aviso:       fin.sustitutiva_mes_aviso || 0,
        indemnizacion_voluntaria:    fin.indemnizacion_voluntaria || 0,
        anos_servicio:               fin.anos_servicio || 0,
      },
      descuentos_finiquito: [],
    }
    const res = await $fetch('/api/rrhh/finiquito-pdf', { method: 'POST', body: payload, responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([res], { type: 'application/pdf' }))
    const a = document.createElement('a')
    a.href = url
    const rut = (t.rut || 'doc').replace(/\./g,'').replace(/-/g,'')
    a.download = `finiquito-${rut}-${(fin.fecha_termino||'').slice(0,10).replace(/-/g,'')}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.warn('Error descargando finiquito PDF:', e.message)
  }
}

// ── Eliminar Contrato ─────────────────────────────────────────────────────────
const showEliminarContrato = ref(false)
const contratoAEliminar    = ref(null)

function pedirEliminarContrato(c) {
  contratoAEliminar.value = c
  showEliminarContrato.value = true
}

function confirmarEliminarContrato() {
  if (!contratoAEliminar.value) return
  const id = contratoAEliminar.value._id
  // Eliminar liquidaciones asociadas a este contrato
  rrhhStore.liquidaciones
    .filter(l => l.contrato_id === id)
    .forEach(l => rrhhStore.deleteLiquidacion?.(l._id))
  // Eliminar el contrato
  rrhhStore.deleteContrato(id)
  showEliminarContrato.value = false
  contratoAEliminar.value = null
}

// ── Módulo de Firmas ──────────────────────────────────────────────────────────
const showFirmaModal  = ref(false)
const firmaDocumento  = ref(null)   // { tipo, id, resumen }
const firmaTipoFirma  = ref('manual')  // 'manual' | 'digital'
const firmaCreada     = ref(null)   // solicitud recién creada
const firmaLinkCopied = ref(false)

function abrirFirmaModal(tipo_documento, documento_id, resumen) {
  firmaDocumento.value  = { tipo_documento, documento_id, resumen }
  firmaTipoFirma.value  = 'manual'
  firmaCreada.value     = null
  firmaLinkCopied.value = false
  showFirmaModal.value  = true
}

function generarLinkFirma() {
  if (!trabajador.value || !firmaDocumento.value) return
  const t = trabajador.value
  const resumenConEmail = {
    ...firmaDocumento.value.resumen,
    email: t.email || '',
  }
  firmaCreada.value = firmasStore.crearSolicitud({
    tipo_documento:    firmaDocumento.value.tipo_documento,
    documento_id:      firmaDocumento.value.documento_id,
    trabajador_id:     t._id || t.id,
    trabajador_nombre: `${t.nombre} ${t.apellido}`,
    trabajador_email:  t.email || '',
    tipo_firma:        firmaTipoFirma.value,
    resumen:           resumenConEmail,
  })
}

function copiarLinkFirma() {
  if (!firmaCreada.value) return
  const url = firmasStore.getPortalUrl(firmaCreada.value.token)
  navigator.clipboard.writeText(url).then(() => {
    firmaLinkCopied.value = true
    setTimeout(() => { firmaLinkCopied.value = false }, 2000)
  })
}

function abrirPortalFirma() {
  if (!firmaCreada.value) return
  const url = firmasStore.getPortalUrl(firmaCreada.value.token)
  window.open(url, '_blank', 'noopener')
}

// Obtener estado de firma de un documento
function getEstadoFirmaDoc(documento_id) {
  return firmasStore.getEstadoFirma(documento_id)
}

// ── Org store (para datos en PDFs) ────────────────────────────────────────
let _orgStore  = null
let _authStore = null

/**
 * Devuelve { org, logoB64 } de la org activa.
 * Fallback: usa los valores de localStorage (legado).
 */
function getOrgForPdf() {
  const org = _authStore && _orgStore
    ? _orgStore.getById(_authStore.currentOrgId) || null
    : null

  const logoB64 = org?.logo
    ? (org.logo.includes(',') ? org.logo.split(',')[1] : org.logo)
    : null

  return {
    nombre:        org?.nombre        || localStorage.getItem('rrhh_org_name')    || 'Mi Empresa',
    rut:           org?.rut           || localStorage.getItem('rrhh_org_rut')     || '',
    direccion:     org?.direccion     || localStorage.getItem('rrhh_org_address') || '',
    ciudad:        org?.ciudad        || 'Santiago',
    representante: org?.representanteLegal?.nombre || '',
    rut_rep:       org?.representanteLegal?.rut    || '',
    logo_base64:   logoB64,
  }
}

onMounted(async () => {
  // Cargar org/auth stores
  const { useOrgStore }  = await import('@/stores/org')
  const { useAuthStore } = await import('@/stores/auth')
  _orgStore  = useOrgStore()
  _authStore = useAuthStore()

  if (!rrhhStore.trabajadores.length) {
    await rrhhStore.getTrabajadores()
  }
  if (!rrhhStore.liquidaciones.length) {
    await rrhhStore.getLiquidaciones()
  }
  if (!rrhhStore.contratos.length) {
    await rrhhStore.getContratos()
  }
  // Cargar turnos desde asistenciaStore para el modal de contrato
  asistenciaStore.init()
  // Cargar solicitudes de firma
  firmasStore.init()
  // Cargar proyectos desde la API
  await cargarProyectos()
  loading.value = false

  // Abrir modal de contrato si viene desde el módulo de contratos
  await nextTick()
  if (route.query.nuevoContrato) {
    openGenContrato()
    router.replace({ query: {} })
  } else if (route.query.editContrato) {
    const c = rrhhStore.contratos.find(c => c._id === route.query.editContrato)
    if (c) abrirContratoExistente(c)
    router.replace({ query: {} })
  }
})

</script>

<style scoped>
.ficha-trabajador {
  padding: 24px;
  max-width: 1200px;
}

/* Header */
.ficha-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.trabajador-hero {
  display: flex;
  align-items: center;
  gap: 20px;
}

.avatar-lg {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--primary-surface-default, #2a9d8f);
  color: #fff;
  font-size: 26px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.hero-info h1 {
  font-size: 24px;
  font-weight: 700;
  color: var(--neutral-text-title, #f3f4f6);
  margin: 0 0 4px;
}

.hero-info .cargo {
  color: var(--neutral-text-body, #9ca3af);
  margin: 0 0 10px;
  font-size: 14px;
}

.hero-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

/* KPI Row */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 28px;
}

.kpi-card {
  background: var(--neutral-background-strong, #2a3a4a);
  border: 1px solid var(--neutral-border-light, rgba(255,255,255,0.07));
  border-radius: 12px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kpi-label {
  font-size: 12px;
  color: var(--neutral-text-body, #9ca3af);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.kpi-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--neutral-text-title, #f3f4f6);
}

/* Tabs */
.tabs-bar {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--neutral-border-light, rgba(255,255,255,0.07));
  margin-bottom: 24px;
}

.tab-btn {
  padding: 10px 18px;
  background: none;
  border: none;
  color: var(--neutral-text-body, #9ca3af);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 7px;
  font-family: inherit;
}

.tab-btn:hover {
  color: var(--neutral-text-title, #f3f4f6);
}

.tab-btn.active {
  color: var(--primary-text-default, #3ac7a5);
  border-bottom-color: var(--primary-text-default, #3ac7a5);
}

.tab-content {
  animation: fadeIn 0.2s ease;
}

/* Info Grid */
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.info-section {
  background: var(--neutral-background-strong, #2a3a4a);
  border: 1px solid var(--neutral-border-light, rgba(255,255,255,0.07));
  border-radius: 12px;
  padding: 20px;
}

.info-section h3 {
  font-size: 13px;
  font-weight: 700;
  color: var(--primary-text-default, #3ac7a5);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0 0 16px;
}

.info-rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--neutral-border-light, rgba(255,255,255,0.05));
}

.info-row:last-child {
  border-bottom: none;
}

.info-row.highlight {
  background: var(--primary-surface-shadow-8a, rgba(58,199,165,0.08));
  border-radius: 6px;
  padding: 8px 10px;
  margin: 4px 0;
}

.info-label {
  font-size: 13px;
  color: var(--neutral-text-body, #9ca3af);
}

.info-value {
  font-size: 13px;
  font-weight: 500;
  color: var(--neutral-text-title, #f3f4f6);
}
.info-value.muted { color: var(--neutral-text-caption, #6b7280); }

/* Inline editable ficha */
.info-input {
  background: rgba(255,255,255,0.05);
  border: 1.5px solid transparent;
  border-radius: 6px;
  padding: 5px 8px;
  font-family: Nunito; font-size: 13px; font-weight: 500;
  color: var(--neutral-text-title, #111827);
  outline: none;
  width: 100%;
  transition: border-color .15s, background .15s;
}
.info-input:hover { border-color: rgba(58,199,165,0.25); background: rgba(255,255,255,0.07); }
.info-input:focus { border-color: #3ac7a5; background: rgba(58,199,165,0.06); }
.info-input-money { font-weight: 700; color: #3ac7a5; }
.info-input option { background: var(--neutral-background-default, #ffffff); }

/* Isapre plan type row */
.isapre-plan-row {
  display: flex;
  gap: 6px;
  align-items: center;
  flex: 1;
}
.isapre-tipo-select {
  width: auto;
  min-width: 120px;
  flex-shrink: 0;
}

/* Ficha save banner */
.ficha-save-banner {
  display: flex; align-items: center; justify-content: space-between;
  background: rgba(58,199,165,0.1);
  border: 1.5px solid rgba(58,199,165,0.3);
  border-radius: 8px; padding: 10px 16px;
  margin-bottom: 16px; font-size: 13px; color: #3ac7a5;
}
.btn-save {
  background: #2a9d8f; color: #fff; border: none;
  border-radius: 7px; padding: 0 16px; height: 34px;
  font-family: Nunito; font-size: 13px; font-weight: 700;
  cursor: pointer; transition: background .15s;
}
.btn-save:hover { background: #238a7d; }
.btn-save:disabled { opacity: .5; cursor: not-allowed; }
.btn-save.btn-sm { height: 28px; padding: 0 12px; font-size: 12px; }

/* Contrato modal grid */
.modal-contrato { width: 700px; max-width: 96vw; }
.contrato-tipos-grid {
  display: flex; gap: 8px; flex-wrap: wrap;
}
.tipo-btn {
  padding: 7px 16px; border-radius: 20px;
  font-family: Nunito; font-size: 12px; font-weight: 700;
  background: rgba(255,255,255,0.06);
  border: 1.5px solid rgba(255,255,255,0.1);
  color: var(--neutral-text-caption, #6b7280); cursor: pointer; transition: all .15s;
}
.tipo-btn:hover { border-color: rgba(58,199,165,0.4); color: var(--neutral-text-title, #111827); }
.tipo-btn.active { background: rgba(58,199,165,0.15); border-color: #3ac7a5; color: #3ac7a5; }
.form-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
.form-textarea { resize: vertical; min-height: 70px; }
.teal-title { color: #3ac7a5 !important; font-size: 11px !important; text-transform: uppercase; letter-spacing: .06em; }
.hint-text { font-size: 11px; color: var(--neutral-text-subtitle, #6b7280); margin-top: 6px; }
.hint-text a { color: #3ac7a5; cursor: pointer; text-decoration: underline; }

/* Negocio dropdown */
.negocio-dropdown {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 200;
  background: var(--neutral-background-default, #ffffff);
  border: 1.5px solid rgba(58,199,165,0.35);
  border-radius: 8px; overflow: hidden;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
}
.negocio-option {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px; cursor: pointer; transition: background .12s;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.negocio-option:last-child { border-bottom: none; }
.negocio-option:hover { background: rgba(58,199,165,0.1); }
.negocio-nombre { font-size: 13px; font-weight: 600; color: var(--neutral-text-title, #111827); display: flex; align-items: center; gap: 6px; }
.negocio-codigo { font-size: 11px; color: var(--neutral-text-caption, #6b7280); }
.negocio-option:last-child { border-bottom: 1px solid rgba(255,255,255,0.05); }

.negocio-local-badge {
  font-size: 10px; font-weight: 500; padding: 1px 6px;
  background: rgba(251,191,36,0.15); color: #fbbf24;
  border-radius: 4px; border: 1px solid rgba(251,191,36,0.3);
}

.negocio-empty {
  padding: 12px 14px; font-size: 12px; color: var(--neutral-text-subtitle, #6b7280); font-style: italic;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.negocio-create-btn {
  display: flex; align-items: center; gap: 7px;
  padding: 10px 14px; cursor: pointer;
  font-size: 13px; font-weight: 500;
  color: var(--color-primary, #3ac7a5);
  transition: background .12s;
}
.negocio-create-btn:hover { background: rgba(58,199,165,0.08); }

.add-linea-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 6px;
  border: 1px solid rgba(58,199,165,0.3);
  background: rgba(58,199,165,0.06);
  color: #3ac7a5; font-size: 11px; font-weight: 600;
  cursor: pointer; transition: background 0.15s;
  font-family: inherit;
}
.add-linea-btn:hover { background: rgba(58,199,165,0.14); }

/* Mini-form crear proyecto */
.crear-proyecto-form {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 210;
  background: var(--neutral-background-default, #ffffff);
  border: 1px solid rgba(58,199,165,0.35);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6);
  overflow: hidden;
}
.cpf-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px 8px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  font-size: 12px; font-weight: 600; color: var(--color-primary, #3ac7a5);
  letter-spacing: .04em; text-transform: uppercase;
}
.cpf-close {
  background: none; border: none; cursor: pointer;
  color: var(--neutral-text-caption, #6b7280); font-size: 18px; line-height: 1; padding: 0 2px;
  transition: color .12s;
}
.cpf-close:hover { color: #f87171; }
.cpf-body { padding: 12px 14px 14px; }
.cpf-hint {
  display: flex; gap: 6px; align-items: flex-start;
  font-size: 11px; color: var(--neutral-text-subtitle, #6b7280); line-height: 1.5;
  margin-bottom: 12px;
}
.cpf-error {
  font-size: 11px; color: #f87171; margin-bottom: 8px;
}
.cpf-actions {
  display: flex; justify-content: flex-end; gap: 8px;
}

.presupuesto-selected { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }

/* Docs */
.docs-toolbar, .liq-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.docs-toolbar h3, .liq-toolbar h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--neutral-text-title, #f3f4f6);
  margin: 0;
}

.docs-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
}

.doc-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  background: var(--neutral-background-strong, #2a3a4a);
  border: 1px solid var(--neutral-border-light, rgba(255,255,255,0.07));
  border-radius: 8px;
}

.doc-icon i {
  font-size: 20px;
  color: var(--primary-text-default, #3ac7a5);
}

.doc-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.doc-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--neutral-text-title, #f3f4f6);
}

.doc-meta {
  font-size: 12px;
  color: var(--neutral-text-body, #9ca3af);
}

.doc-actions {
  display: flex;
  gap: 4px;
}

.docs-checklist {
  background: var(--neutral-background-strong, #2a3a4a);
  border: 1px solid var(--neutral-border-light, rgba(255,255,255,0.07));
  border-radius: 12px;
  padding: 20px;
  margin-top: 16px;
}

.docs-checklist h4 {
  font-size: 13px;
  font-weight: 600;
  color: var(--neutral-text-title, #f3f4f6);
  margin: 0 0 14px;
}

.checklist-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.checklist-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--neutral-text-body, #9ca3af);
}

.checklist-item .checkbox-label.done {
  color: var(--primary-text-default, #3ac7a5);
}

.check-ok {
  color: var(--primary-text-default, #3ac7a5);
  font-weight: 700;
}

.checkbox-input {
  accent-color: var(--primary-text-default, #3ac7a5);
}

/* Contratos list */
.contratos-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.contrato-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: var(--neutral-background-strong, #2a3a4a);
  border: 1px solid var(--neutral-border-light, rgba(255,255,255,0.07));
  border-radius: 10px;
  transition: border-color 0.15s, background 0.15s;
}
.contrato-card:hover {
  border-color: rgba(58,199,165,0.3);
  background: rgba(58,199,165,0.04);
}

.contrato-icon i {
  font-size: 22px;
  color: var(--primary-text-default, #3ac7a5);
}

.contrato-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.contrato-tipo {
  font-size: 14px;
  font-weight: 600;
  color: var(--neutral-text-title, #f3f4f6);
}

.contrato-fechas, .contrato-proyecto {
  font-size: 12px;
  color: var(--neutral-text-body, #9ca3af);
}

/* Horas trabajadas por contrato */
.contrato-horas {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 12px;
  background: rgba(255,255,255,0.03);
  border-radius: 8px;
  border: 1px solid var(--neutral-border-light, #e2e8f0);
  min-width: 120px;
  flex-shrink: 0;
}
.contrato-horas.sin-datos {
  opacity: 0.5;
}
.ch-mes {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--neutral-text-subtitle, #6b7280);
  margin-bottom: 3px;
}
.ch-row {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--neutral-text-body, #374151);
}
.ch-row.extra { color: #fbbf24; }
.ch-row.atraso { color: #f87171; }
.ch-row.muted { color: var(--neutral-text-subtitle, #6b7280); }
.ch-icon { font-size: 11px; opacity: 0.7; }
.ch-val { font-weight: 600; }
.ch-fuente {
  font-size: 9px;
  color: #4b5563;
  margin-top: 2px;
  font-style: italic;
}

.contrato-costo {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 14px;
  background: rgba(255,255,255,0.03);
  border-radius: 8px;
  border: 1px solid var(--neutral-border-light, #e2e8f0);
  min-width: 130px;
  flex-shrink: 0;
}
.cc-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}
.cc-label {
  font-size: 10px;
  color: var(--neutral-text-subtitle, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.cc-value {
  font-size: 13px;
  font-weight: 700;
  color: var(--neutral-text-title, #111827);
}
.cc-value.teal { color: #3ac7a5; }

.contrato-actions {
  display: flex;
  gap: 4px;
}

/* Data table */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th {
  padding: 10px 14px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: var(--neutral-text-body, #9ca3af);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--neutral-border-light, rgba(255,255,255,0.08));
}

.data-table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--neutral-border-light, rgba(255,255,255,0.05));
  color: var(--neutral-text-title, #f3f4f6);
}

.data-table tbody tr:hover td {
  background: var(--neutral-background-strong, #2a3a4a);
}

/* Modal Liquidación */
.liq-form-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.liq-resultado {
  background: var(--neutral-background-default, #1e272e);
  border-radius: 10px;
  padding: 20px;
  border: 1px solid var(--neutral-border-light, rgba(255,255,255,0.07));
}

.liq-resultado h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--neutral-text-title, #f3f4f6);
  margin: 0 0 16px;
}

.liq-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 16px;
}

.liq-section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--neutral-text-body, #9ca3af);
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--neutral-border-light, rgba(255,255,255,0.07));
}

.liq-empresa-absorbe {
  font-size: 12px;
  color: var(--neutral-text-subtitle, #6b7280);
  line-height: 1.6;
  background: rgba(58,199,165,0.07);
  border: 1px solid rgba(58,199,165,0.2);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.liq-line {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  padding: 4px 0;
  color: var(--neutral-text-body, #9ca3af);
}

.liq-line span:last-child {
  font-weight: 500;
  color: var(--neutral-text-title, #f3f4f6);
}

.liq-line.total {
  border-top: 1px solid var(--neutral-border-light, rgba(255,255,255,0.1));
  margin-top: 6px;
  padding-top: 8px;
  font-weight: 600;
  color: var(--neutral-text-title, #f3f4f6);
}

.liq-neto {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: var(--primary-surface-shadow-8a, rgba(58,199,165,0.08));
  border-radius: 8px;
  border: 1px solid rgba(58, 199, 165, 0.3);
  font-size: 16px;
  font-weight: 700;
  color: var(--neutral-text-title, #f3f4f6);
  margin-bottom: 8px;
}

.liq-costo-empresa {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  font-size: 12px;
  color: var(--neutral-text-body, #9ca3af);
  padding: 6px 4px;
}
.liq-costo-empresa > div { line-height: 1.4; }
.liq-costo-empresa > div:last-child { text-align: right; }

/* Item list (bonos / descuentos) */
.item-list { display: flex; flex-direction: column; gap: 8px; }
.item-row { display: flex; align-items: center; gap: 8px; }
.item-nombre { flex: 2; }
.item-monto { flex: 1; min-width: 130px; }
.item-sc-inputs { display: flex; gap: 6px; align-items: center; }

.item-badge {
  font-size: 10px; font-weight: 600;
  padding: 2px 8px; border-radius: 12px; white-space: nowrap;
}
.badge-imponible { background: rgba(251,191,36,0.15); color: #fbbf24; }
.badge-no-imponible { background: rgba(156,163,175,0.12); color: var(--neutral-text-caption, #6b7280); }

.money-input-wrap {
  display: flex; align-items: center;
  background: var(--neutral-background-default, #1e272e);
  border: 1.5px solid var(--neutral-border-light, rgba(255,255,255,0.1));
  border-radius: 8px; padding: 0 12px; height: 37px;
  transition: border-color 0.2s; width: 100%; box-sizing: border-box;
}
.money-input-wrap:focus-within { border-color: var(--primary-text-default, #3ac7a5); }
.money-prefix { color: var(--neutral-text-body); font-size: 13px; font-weight: 700; margin-right: 4px; user-select: none; }
.money-input { flex: 1; background: transparent !important; border: none !important; padding: 0 !important; text-align: right; font-weight: 700; outline: none !important; color: var(--neutral-text-title, #f3f4f6); font-family: inherit; font-size: 13px; }

.btn-add-item {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px; border-radius: 8px;
  font-size: 12px; font-weight: 600;
  color: var(--primary-text-default, #3ac7a5);
  background: rgba(58,199,165,0.07);
  border: 1.5px dashed rgba(58,199,165,0.3);
  cursor: pointer; font-family: inherit;
  width: 100%; justify-content: center;
  transition: all 0.15s; margin-top: 4px;
}
.btn-add-item:hover { background: rgba(58,199,165,0.12); border-color: rgba(58,199,165,0.5); }

.btn-calc-sc {
  padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;
  background: rgba(58,199,165,0.15); color: #3ac7a5;
  border: 1px solid rgba(58,199,165,0.3); cursor: pointer; font-family: inherit;
  white-space: nowrap; transition: all 0.15s;
}
.btn-calc-sc:hover { background: rgba(58,199,165,0.25); }

.btn-icon.red { color: #f87171; }

.btn-remove {
  flex-shrink: 0;
  width: 28px; height: 28px;
  border-radius: 6px;
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.3);
  color: #f87171;
  font-size: 16px; line-height: 1;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
  font-family: inherit;
}
.btn-remove:hover {
  background: rgba(248, 113, 113, 0.25);
  border-color: rgba(248, 113, 113, 0.6);
}

.trabajador-info-box {
  background: rgba(58,199,165,0.07); border: 1px solid rgba(58,199,165,0.2);
  border-radius: 8px; padding: 10px 14px; margin-top: 12px;
}
.info-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.chip {
  display: inline-flex; align-items: center; padding: 3px 10px;
  border-radius: 20px; font-size: 11px; font-weight: 500;
  background: rgba(255,255,255,0.07); color: var(--neutral-text-body, #9ca3af);
}
.chip.teal { background: rgba(58,199,165,0.15); color: #3ac7a5; }

.form-section { margin-bottom: 20px; }
.section-title {
  font-size: 13px; font-weight: 600;
  color: var(--primary-text-default, #3ac7a5);
  text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 12px;
}

/* Modal contrato — tipo pills */
.section-label {
  font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--neutral-text-subtitle, #6b7280); margin: 0 0 10px;
}
.tipo-selector {
  display: flex; gap: 8px; flex-wrap: wrap;
}
.tipo-pill {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 10px 14px; border-radius: 10px;
  font-size: 11px; font-weight: 700;
  background: rgba(255,255,255,0.04);
  border: 1.5px solid rgba(255,255,255,0.08);
  color: var(--neutral-text-caption, #6b7280); cursor: pointer; font-family: inherit;
  transition: all 0.15s; min-width: 80px;
}
.tipo-pill i { font-size: 16px; }
.tipo-pill:hover { border-color: rgba(58,199,165,0.3); color: var(--neutral-text-body, #374151); }
.tipo-pill.active {
  background: rgba(58,199,165,0.12);
  border-color: #3ac7a5; color: #3ac7a5;
}

/* ── Proyecto sub-selector (nivel 2) ─────────────────────────────────────── */
.proyecto-sub-selector {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 12px;
}
.proyecto-sub-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1.5px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: all 0.18s;
  position: relative;
}
.proyecto-sub-card:hover {
  border-color: rgba(58,199,165,0.3);
  background: rgba(58,199,165,0.05);
}
.proyecto-sub-card.active {
  border-color: #3ac7a5;
  background: rgba(58,199,165,0.09);
}
.proyecto-sub-card.psc-jornada:hover {
  border-color: rgba(139,92,246,0.35);
  background: rgba(139,92,246,0.06);
}
.proyecto-sub-card.psc-jornada.active {
  border-color: #8b5cf6;
  background: rgba(139,92,246,0.09);
}
.psc-icon {
  font-size: 24px;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 1px;
}
.psc-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
}
.psc-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--neutral-text-title, #111827);
  line-height: 1.3;
}
.psc-law {
  font-size: 10px;
  color: var(--neutral-text-subtitle, #6b7280);
  margin-top: 1px;
}
.psc-examples {
  font-size: 10.5px;
  color: var(--neutral-text-caption, #6b7280);
  margin-top: 4px;
  line-height: 1.5;
}
.psc-badge {
  display: inline-block;
  margin-top: 8px;
  font-size: 9.5px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 5px;
  letter-spacing: 0.02em;
}
.psc-badge-bruto {
  background: rgba(14,165,233,0.15);
  color: #38bdf8;
}
.psc-badge-liquido {
  background: rgba(139,92,246,0.15);
  color: #a78bfa;
}
.psc-check {
  font-size: 14px;
  font-weight: 700;
  color: #3ac7a5;
  flex-shrink: 0;
  align-self: center;
}

/* Ley alert */
.ley-alert {
  display: flex; align-items: flex-start; gap: 10px;
  background: rgba(251,191,36,0.08);
  border: 1px solid rgba(251,191,36,0.25);
  border-radius: 8px; padding: 12px 14px; margin-top: 12px;
  font-size: 12px; color: #fbbf24;
}
.ley-alert i { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
.ley-alert strong { display: block; margin-bottom: 3px; }
.ley-alert p { margin: 0; color: #d97706; }

/* form-grid-2 */
.form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

/* form-display (valor calculado) */
.form-display {
  display: inline-flex; align-items: center;
  font-size: 16px; font-weight: 700;
  padding: 9px 0;
}
.form-display.teal { color: #3ac7a5; }

/* Cláusulas adicionales */
.clausulas-check { display: flex; flex-direction: column; gap: 10px; }
.check-item {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 14px;
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--neutral-border-light, #e2e8f0);
  border-radius: 8px; cursor: pointer;
  transition: border-color 0.15s;
}
.check-item:hover { border-color: rgba(58,199,165,0.3); }
.check-item .checkbox-input { margin-top: 2px; flex-shrink: 0; }
.check-label { font-size: 13px; font-weight: 600; color: var(--neutral-text-title, #111827); margin-bottom: 2px; }
.check-desc { font-size: 11px; color: var(--neutral-text-caption, #6b7280); }

/* Contrato vigente card en la ficha */
.contrato-vigente-card {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px; margin-top: 12px;
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--neutral-border-light, #e2e8f0);
  border-radius: 8px; cursor: pointer; transition: all 0.15s;
}
.contrato-vigente-card:hover { background: rgba(58,199,165,0.08); border-color: rgba(58,199,165,0.3); }
.contrato-vigente-card.empty-cv {
  justify-content: center; gap: 8px;
  border-style: dashed; color: var(--neutral-text-subtitle, #6b7280); font-size: 13px;
}
.contrato-vigente-card.empty-cv:hover { color: #3ac7a5; border-color: rgba(58,199,165,0.4); }
.cv-icon i { font-size: 20px; color: #3ac7a5; }
.cv-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.cv-tipo { font-size: 13px; font-weight: 600; color: var(--neutral-text-title, #111827); }
.cv-fechas { font-size: 11px; color: var(--neutral-text-caption, #6b7280); }
.cv-proyecto { font-size: 11px; color: #60a5fa; }
.cv-badge { margin-left: auto; }
.cv-arrow { color: var(--neutral-text-subtitle, #6b7280); font-size: 14px; }

/* Contrato detalle grid (modal de detalle) */
.contrato-detalle-grid { display: flex; flex-direction: column; gap: 0; }
.cd-row {
  display: flex; gap: 12px; align-items: flex-start;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  font-size: 13px;
}
.cd-row:last-child { border-bottom: none; }
.cd-label { min-width: 120px; font-size: 11px; color: var(--neutral-text-caption, #6b7280); text-transform: uppercase; letter-spacing: 0.04em; padding-top: 2px; }
.cd-descripcion { color: var(--neutral-text-body, #374151); white-space: pre-wrap; }

/* Modal overlay */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-box {
  background: var(--neutral-background-strong, #2a3a4a);
  border-radius: 16px;
  border: 1px solid var(--neutral-border-light, rgba(255,255,255,0.1));
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  width: 90%;
  max-width: 640px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-lg { max-width: 720px; }

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--neutral-border-light, rgba(255,255,255,0.08));
}

.modal-header h2 {
  font-size: 17px;
  font-weight: 700;
  color: var(--neutral-text-title, #f3f4f6);
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  font-size: 22px;
  color: var(--neutral-text-body, #9ca3af);
  cursor: pointer;
  padding: 2px 6px;
  line-height: 1;
}

.modal-close:hover { color: var(--neutral-text-title, #f3f4f6); }
.modal-subtitle { font-size: 13px; color: var(--neutral-text-caption, #6b7280); margin: 2px 0 0; }

.modal-body {
  padding: 24px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--neutral-border-light, rgba(255,255,255,0.08));
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  font-family: inherit;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-sm { padding: 6px 12px; font-size: 12px; }

.btn-primary {
  background: var(--primary-surface-default, #2a9d8f);
  color: #fff;
}
.btn-primary:hover { opacity: 0.85; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-danger {
  background: rgba(239, 68, 68, 0.15);
  border: 1.5px solid rgba(239, 68, 68, 0.4);
  color: #f87171;
}
.btn-danger:hover { background: rgba(239, 68, 68, 0.25); border-color: rgba(239, 68, 68, 0.7); }

.btn-outline {
  background: transparent;
  border: 1.5px solid var(--primary-text-default, #3ac7a5);
  color: var(--primary-text-default, #3ac7a5);
}
.btn-outline:hover { background: var(--primary-surface-shadow-8a, rgba(58,199,165,0.08)); }

.btn-ghost {
  background: transparent;
  color: var(--neutral-text-body, #9ca3af);
}
.btn-ghost:hover { color: var(--neutral-text-title, #f3f4f6); }

.btn-icon {
  background: none;
  border: none;
  color: var(--neutral-text-body, #9ca3af);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  font-size: 15px;
  transition: all 0.15s;
}
.btn-icon:hover {
  background: var(--neutral-background-default, #1e272e);
  color: var(--neutral-text-title, #f3f4f6);
}

/* Form */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 12px;
  font-weight: 600;
  color: var(--neutral-text-body, #9ca3af);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.form-input {
  background: var(--neutral-background-default, #1e272e);
  border: 1.5px solid var(--neutral-border-light, rgba(255,255,255,0.1));
  border-radius: 8px;
  padding: 9px 12px;
  color: var(--neutral-text-title, #f3f4f6);
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.2s;
  width: 100%;
  box-sizing: border-box;
}
.form-hint {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  color: #9ca3af;
  line-height: 1.45;
  background: rgba(13, 207, 168, 0.08);
  border-left: 2px solid #0DCFA8;
  padding: 6px 10px;
  border-radius: 4px;
}
.form-input:focus {
  outline: none;
  border-color: var(--primary-text-default, #3ac7a5);
}

/* Badges */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
}

.badge-indefinido { background: rgba(58,199,165,0.15); color: #3ac7a5; }
.badge-plazo_fijo { background: rgba(251,191,36,0.15); color: #fbbf24; }
.badge-proyecto { background: rgba(139,92,246,0.15); color: #a78bfa; }
.badge-honorarios { background: rgba(249,115,22,0.15); color: #fb923c; }
.badge-part_time { background: rgba(96,165,250,0.15); color: #60a5fa; }
.badge-estado-activo { background: rgba(34,197,94,0.15); color: #4ade80; }
.badge-estado-inactivo { background: rgba(239,68,68,0.15); color: #f87171; }
.badge-estado-pendiente { background: rgba(251,191,36,0.15); color: #fbbf24; }
.badge-estado-pagada { background: rgba(34,197,94,0.15); color: #4ade80; }
.badge-estado-borrador { background: rgba(156,163,175,0.15); color: var(--neutral-text-caption, #6b7280); }
.badge-estado-vigente { background: rgba(34,197,94,0.15); color: #4ade80; }
.badge-estado-vencido { background: rgba(239,68,68,0.15); color: #f87171; }
.badge-estado-firmado { background: rgba(58,199,165,0.15); color: #3ac7a5; }

/* Colors */
.teal { color: #3ac7a5 !important; }
.red { color: #f87171 !important; }

/* Empty state */
.empty-state, .empty-docs {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  gap: 12px;
  color: var(--neutral-text-body, #9ca3af);
}

.empty-icon {
  font-size: 48px;
  opacity: 0.3;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px;
  gap: 16px;
  color: var(--neutral-text-body, #9ca3af);
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(58,199,165,0.2);
  border-top-color: #3ac7a5;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

.btn-icon.spin i { animation: spin 0.8s linear infinite; opacity: 0.6; }

/* Contrato vigente card en ficha */
.contrato-vigente-card {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; margin-top: 12px;
  background: rgba(58,199,165,0.06);
  border: 1.5px solid rgba(58,199,165,0.2);
  border-radius: 10px; cursor: pointer;
  transition: background 0.18s, border-color 0.18s;
}
.contrato-vigente-card:hover { background: rgba(58,199,165,0.12); border-color: rgba(58,199,165,0.4); }
.contrato-vigente-card.empty-cv {
  background: rgba(156,163,175,0.05); border-color: rgba(156,163,175,0.15);
  color: var(--neutral-text-caption, #6b7280); font-size: 13px; gap: 8px; justify-content: center;
}
.cv-icon { font-size: 18px; color: #3ac7a5; flex-shrink: 0; }
.cv-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.cv-tipo { font-weight: 600; font-size: 13px; color: var(--neutral-text-title, #111827); }
.cv-fechas { font-size: 12px; color: var(--neutral-text-caption, #6b7280); }
.cv-proyecto { font-size: 12px; color: #60a5fa; }
.cv-badge { font-size: 11px; }
.cv-arrow { font-size: 14px; color: var(--neutral-text-caption, #6b7280); flex-shrink: 0; }

/* Modal detalle contrato */
.contrato-detalle-grid { display: flex; flex-direction: column; gap: 12px; }
.cd-row { display: flex; gap: 12px; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
.cd-row:last-child { border-bottom: none; }
.cd-label { font-size: 12px; color: var(--neutral-text-caption, #6b7280); font-weight: 600; min-width: 120px; flex-shrink: 0; text-transform: uppercase; letter-spacing: 0.03em; }
.cd-descripcion { font-size: 13px; color: var(--neutral-text-body, #374151); line-height: 1.6; }

/* Profesión en ficha */
.info-row .hint-text {
  font-size: 11px; color: var(--neutral-text-caption, #6b7280); margin: 4px 0 0 0;
}

/* Responsive */
@media (max-width: 1023px) {
  /* Reduce padding general en tablet/móvil */
  .ficha-trabajador { padding: 16px; }

  /* Header: apilado en columna */
  .ficha-header { flex-direction: column; align-items: flex-start; gap: 12px; }
  .header-actions { width: 100%; flex-wrap: wrap; }
  .header-actions .btn { flex: 1; min-width: 120px; justify-content: center; font-size: 12px; padding: 8px 10px; }

  /* Avatar más pequeño en móvil */
  .trabajador-hero { gap: 14px; }
  .avatar-lg { width: 58px; height: 58px; font-size: 20px; }
  .hero-info h1 { font-size: 18px; }
  .hero-info .cargo { font-size: 13px; margin-bottom: 6px; }

  /* KPIs: 2 columnas en lugar de 4 */
  .kpi-row { grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 18px; }
  .kpi-card { padding: 14px 16px; }
  .kpi-value { font-size: 17px; }

  /* Tabs: scroll horizontal si no caben */
  .tabs-bar { overflow-x: auto; gap: 0; padding-bottom: 2px; }
  .tab-btn  { white-space: nowrap; flex-shrink: 0; padding: 8px 14px; font-size: 13px; }

  /* Contrato card: diseño en columna en móvil */
  .contrato-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding: 14px 16px;
  }
  .contrato-horas { min-width: 100%; flex-shrink: 1; }

  /* Info grid en una columna */
  .info-grid { grid-template-columns: 1fr; }

  /* Liquidaciones */
  .liq-cols { grid-template-columns: 1fr; }
  .liq-form-grid { grid-template-columns: repeat(2, 1fr); }
}

/* ── Selector contrato en liquidación ───────────────────────────────────── */
.liq-contrato-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border: 1.5px solid var(--border, rgba(255,255,255,0.08));
  border-radius: 10px;
  cursor: pointer;
  transition: border-color .15s, background .15s;
  background: var(--bg-secondary, #1e2d3a);
  flex-wrap: wrap;
}
.liq-contrato-option:hover { border-color: var(--primary, #3ac7a5); }
.liq-contrato-option.active {
  border-color: var(--primary, #3ac7a5);
  background: rgba(58,199,165,0.07);
}
.liq-contrato-check { flex-shrink: 0; }
.liq-checkbox {
  width: 18px; height: 18px; border-radius: 5px;
  border: 2px solid rgba(255,255,255,0.2);
  display: flex; align-items: center; justify-content: center;
  transition: all .15s;
}
.liq-checkbox.checked {
  background: #3ac7a5;
  border-color: #3ac7a5;
  color: #fff;
}
.liq-contrato-left { display: flex; align-items: center; gap: 12px; }

/* Inputs de días/horas por contrato (en modo multi) */
.liq-contrato-inputs {
  display: flex; align-items: flex-end; gap: 8px;
  margin-left: auto;
  flex-wrap: wrap;
}
.liq-mini-input-group {
  display: flex; flex-direction: column; gap: 3px;
}
.liq-mini-input-group label {
  font-size: 10px; font-weight: 600; color: var(--neutral-text-subtitle, #6b7280);
  text-transform: uppercase; letter-spacing: 0.05em;
  display: flex; align-items: center; gap: 4px;
}
.liq-mini-input {
  width: 72px !important; padding: 6px 8px !important;
  font-size: 12px !important; text-align: center;
}
.liq-contrato-preview {
  font-size: 11px; font-weight: 700; color: #3ac7a5;
  white-space: nowrap; align-self: center;
  background: rgba(58,199,165,0.1);
  border-radius: 6px; padding: 4px 8px;
}

/* Inputs proyecto: layout en 2 filas (días/valor + HH.EE./valor hora) */
.liq-proyecto-inputs {
  display: flex; flex-direction: column; gap: 6px;
  margin-left: auto; min-width: 280px;
}
.liq-proyecto-fila {
  display: flex; align-items: flex-end; gap: 8px;
}
.liq-proyecto-preview {
  display: flex; flex-direction: column; gap: 2px;
  white-space: normal; font-size: 11px;
  background: rgba(58,199,165,0.07);
  border-radius: 6px; padding: 5px 8px;
  color: #3ac7a5;
}

/* Desglose por proyecto en el resumen */
.liq-detalle-proyectos {
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--neutral-border-light, #e2e8f0);
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 14px;
  display: flex; flex-direction: column; gap: 5px;
}
.liq-detalle-row {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  font-size: 11.5px;
}
.liq-detalle-name { font-weight: 700; color: var(--neutral-text-title, #111827); flex: 1; }
.liq-detalle-info { color: var(--neutral-text-subtitle, #6b7280); font-size: 11px; }
.liq-detalle-monto { color: #3ac7a5; font-weight: 700; font-size: 12px; }
.liq-detalle-extra { color: #a78bfa; font-size: 11px; font-weight: 600; }

.hint-badge {
  background: rgba(58,199,165,0.15);
  color: #3ac7a5;
  border-radius: 6px;
  padding: 1px 6px;
}

/* ── Botón eliminar (rojo) en contrato card ──────────────────────────────── */
.btn-icon-danger {
  color: #f87171 !important;
  opacity: 0.6;
}
.btn-icon-danger:hover {
  opacity: 1;
  background: rgba(239, 68, 68, 0.15) !important;
}

/* ── Firma Modal ─────────────────────────────────────────────────────────── */
.firma-modal-box {
  max-width: 520px;
}

.firma-doc-resumen {
  background: var(--bg-secondary, #f8f9fa);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 10px;
  padding: 14px 18px;
  margin-bottom: 18px;
}

.firma-doc-tipo { margin-bottom: 6px; }

.tipo-contrato   { background: #dbeafe; color: #1d4ed8; }
.tipo-finiquito  { background: #fef3c7; color: #92400e; }
.tipo-liquidacion { background: #dcfce7; color: #166534; }

.firma-doc-titulo {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin: 0 0 6px;
}

.firma-doc-meta {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: var(--text-secondary, #64748b);
}

.firma-tipo-selector { margin-bottom: 18px; }

.firma-tipo-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}

.firma-tipo-opt {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 2px solid var(--border, #e2e8f0);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.firma-tipo-opt.active {
  border-color: var(--primary, #6366f1);
  background: var(--primary-soft, #eef2ff);
}

.firma-tipo-opt input[type="radio"] {
  display: none;
}

.firma-tipo-icon {
  font-size: 24px;
  line-height: 1;
  flex-shrink: 0;
}

.firma-tipo-opt strong {
  display: block;
  font-size: 14px;
  color: var(--text-primary, #1e293b);
}

.firma-tipo-opt small {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
}

.firma-link-panel {
  background: var(--bg-secondary, #f8f9fa);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 10px;
  padding: 16px 18px;
  margin-bottom: 18px;
}

.firma-link-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  color: var(--success, #16a34a);
  margin-bottom: 12px;
}

.firma-link-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: var(--success, #16a34a);
  color: #fff;
  border-radius: 50%;
  font-size: 13px;
  flex-shrink: 0;
}

.firma-link-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.firma-link-input {
  flex: 1;
  font-size: 12px;
  font-family: monospace;
  padding: 7px 10px;
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 6px;
  background: white;
  color: var(--text-primary, #1e293b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.firma-link-hint {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
  margin-bottom: 8px;
}

.firma-email-info {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ── Banner informativo contrato proyecto ───────────────────────────────────── */
.cf-proyecto-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(14, 165, 233, 0.08);
  border: 1px solid rgba(14, 165, 233, 0.2);
  color: var(--neutral-text-body, #9ca3af);
  font-size: 13px;
  line-height: 1.5;
}
.cf-proyecto-banner i { flex-shrink: 0; margin-top: 2px; }
.cf-proyecto-banner strong { color: var(--neutral-text-title, #f3f4f6); }

/* ── Tipo de Sueldo toggle ──────────────────────────────────────────────────── */
.tipo-sueldo-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 4px;
}

.tsb {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1.5px solid var(--neutral-border-light, rgba(255,255,255,0.09));
  background: var(--neutral-bg-card, rgba(255,255,255,0.04));
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;
  color: var(--neutral-text-body, #9ca3af);
}

.tsb strong {
  font-size: 13px;
  font-weight: 600;
  color: var(--neutral-text-title, #f3f4f6);
  line-height: 1.2;
}

.tsb span {
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--neutral-text-body, #9ca3af);
}

.tsb:hover {
  border-color: rgba(58, 199, 165, 0.35);
  background: rgba(58, 199, 165, 0.05);
}

.tsb.active {
  border-color: var(--color-primary, #3ac7a5);
  background: rgba(58, 199, 165, 0.10);
}

.tsb.active strong {
  color: var(--color-primary, #3ac7a5);
}
</style>
