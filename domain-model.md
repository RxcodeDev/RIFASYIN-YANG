# Reglas de Negocio — RIFA Control de Boletos

> Documento generado con datos **en vivo** consultados directamente desde Google Sheets.  
> Total de registros analizados: **1,100 boletos**.  
> Fecha de consulta: 2026-04-16.

---

## 1. Arquitectura General

| Elemento | Detalle |
|---|---|
| **Frontend** | HTML + CSS + JavaScript ES Modules |
| **Backend** | Google Apps Script Web App (REST) |
| **URL del script** | `https://script.google.com/macros/s/AKfycbyx.../exec` |
| **Protocolo GET** | `?accion=getAll` → devuelve todos los boletos |
| **Protocolo POST** | Body JSON con `{ accion, ...params }` para agregar/actualizar |
| **Acciones disponibles** | `getAll`, `agregar`, `actualizar` |

**Flujo de llamadas:**
- `getAll()` → GET `?accion=getAll` → devuelve `{ ok: true, data: [...] }`
- `add(datos)` → POST `{ accion: "agregar", datos }` → agrega fila
- `update(numero, columna, valor)` → POST `{ accion: "actualizar", numero, columna, valor }`
- `updateRecord()` hace diff columna por columna y solo envía los campos que cambiaron, en paralelo

---

## 2. Estructura de Columnas del Sheet

El sheet tiene **26 columnas**. Las primeras 14 son de negocio; las últimas 12 son abonos.

> ⚠️ **Problema de calidad detectado:** Las columnas `Restante` y `AB1` tienen un espacio en blanco al final de su nombre en el sheet (`"Restante "`, `"AB1 "`). Esto puede causar bugs al acceder por nombre exacto.

### Columnas de negocio (14)

| # | Nombre exacto en sheet | Tipo | Descripción |
|---|---|---|---|
| 1 | `No. Boleto` | Número entero | Identificador único del boleto. Llave primaria. Rango: 1–1100. |
| 2 | `Nombre del Comprador` | Texto | Nombre completo del comprador. |
| 3 | `Teléfono` | Número | Teléfono del comprador (10 dígitos). |
| 4 | `Estado Boleto` | Enum | Estado del boleto (ver sección 3). |
| 5 | `Estado Pago` | Enum | Estado del cobro (ver sección 4). |
| 6 | `Vendedor` | Texto | Quien vendió el boleto (ver sección 7). |
| 7 | `Promotor` | Texto | Red/persona que promovió la venta (ver sección 7). |
| 8 | `Fecha de Venta` | ISO 8601 | Fecha en que se registró la venta. Ej: `2026-04-16T07:00:00.000Z` |
| 9 | `Método de Pago` | Enum | Forma de pago usada (ver sección 5). |
| 10 | `Fecha Límite Apartado` | ISO 8601 | Fecha máxima para liquidar un boleto apartado. |
| 11 | `Estado Apartado` | Enum | Estado del apartado: `Activo` (ver sección 6). |
| 12 | `ID Cliente` | Texto | Identificador único del cliente. Formato: `CL-XXXX`. |
| 13 | `Cliente Repetido` | Texto/emoji | Si el cliente ya compró antes, se marca como `⚠️ Repetido`. Vacío si es primera compra. |
| 14 | `Restante ` *(con espacio)* | Número | Monto pendiente de pago en pesos ($). |

### Columnas de abonos (12)

| Nombre | Descripción |
|---|---|
| `AB1 ` *(con espacio)*, `AB2` … `AB12` | Cada columna registra un pago parcial en pesos. Se llenan de izquierda a derecha conforme el comprador va abonando. Máximo 12 abonos por boleto. |

---

## 3. Estado del Boleto (`Estado Boleto`)

| Valor | Conteo actual | Color en UI | Descripción |
|---|---|---|---|
| `Disponible` | **815** (74.1%) | Gris oscuro | Sin dueño, libre para vender. Default al crear. |
| `Apartado` | **263** (23.9%) | Amarillo | Reservado, pago pendiente de completar. |
| `Pagado` | **22** (2.0%) | Verde-lima | Liquidado en su totalidad. |

---

## 4. Estado de Pago (`Estado Pago`)

| Valor | Conteo actual | Descripción |
|---|---|---|
| `No pagado` | **1,078** | Sin pago o con abonos parciales. Default al crear. |
| `Pagado` | **21** | Pago completo registrado. |
| `pagado ` *(con espacio)* | **1** | ⚠️ Dato sucio — versión mal escrita de "Pagado". |

> **Nota:** Existe 1 registro con `"pagado "` (minúscula + espacio) que no coincide con los valores válidos y podría causar errores en filtros.

---

## 5. Método de Pago (`Método de Pago`)

| Valor | Descripción |
|---|---|
| `Efectivo` | Pago en efectivo. |
| `Efectivo ` *(con espacio)* | ⚠️ Dato sucio — duplicado con espacio extra. |
| `Transfer` | Transferencia bancaria o pago digital. |
| `Boletos` | Pago con boletos (canje o modalidad interna). |
| *(vacío)* | Sin método asignado. Default al crear. |

---

## 6. Estado del Apartado (`Estado Apartado`)

| Valor | Conteo | Descripción |
|---|---|---|
| `Activo` | Todos los registros con apartado | El apartado está vigente. Default. |
| `Inactivo` | 0 registros actualmente | Previsto para apartar vencidos, pero no se usa aún. |

---

## 7. Vendedores y Promotores

> ⚠️ **Problema de normalización:** los mismos nombres aparecen con distintas mayúsculas y espacios. Esto afecta los filtros y los conteos.

**Vendedores únicos (normalizados):** Dedotes, Luis, Pelos, Rebeca  
**Variantes sucias detectadas:** `"Luis "`, `"LUIS "`, `"luis"`, `"Rebeca "`, `"Pelos "`

**Promotores únicos (normalizados):** Any, Chivis, Dedotes, El mago, Karina, Kiwi, Luis, Mama, Mamá, Maritza, Marta, Mayra, Pelos, Rebeca, Susana Jalomo, Vane, Victor, Yessenia  
_(20 promotores distintos — la red de promotores es más amplia que la de vendedores)_

---

## 8. Precio del Boleto y Lógica de Abonos

- **Precio base del boleto: $550 MXN**
- Los compradores pueden pagar en **hasta 12 abonos** (columnas `AB1`–`AB12`)
- `Restante` = $550 − (suma de todos los abonos registrados)
- Cuando `Restante = 0` y `Estado Pago = Pagado` → boleto liquidado
- **131 boletos** (11.9%) tienen al menos un abono registrado

**Valores posibles de `Restante`** (observados en datos reales):  
`$50`, `$150`, `$250`, `$350`, `$400`, `$450`, `$500`, `$550`

**Ejemplos de flujo de abonos:**

| Boleto | AB1 | AB2 | Restante | Estado Pago |
|---|---|---|---|---|
| Pago completo de golpe | $550 | — | $0 | Pagado |
| Un abono de $100 | $100 | — | $450 | No pagado |
| Dos abonos de $50 c/u | $50 | $50 | $450 | No pagado |

---

## 9. ID Cliente

- Formato: `CL-XXXX` (número secuencial de 4 dígitos, ej. `CL-0001`)
- Permite identificar si un cliente compró más de un boleto
- Cuando el sistema detecta que el teléfono/nombre ya existe, marca la columna `Cliente Repetido` con `⚠️ Repetido`

---

## 10. Estadísticas Actuales del Sheet (en vivo)

| Métrica | Valor |
|---|---|
| Total de boletos | **1,100** |
| Disponibles | **815** (74.1%) |
| Apartados | **263** (23.9%) |
| Pagados | **22** (2.0%) |
| Con deuda (Restante > 0) | **1,078** |
| Con abonos registrados | **131** |
| Vendedores activos | **4** (normalizados) |
| Red de promotores | **18** (normalizados) |

---

## 11. Operaciones CRUD de la API

| Operación | Método HTTP | Parámetros | Descripción |
|---|---|---|---|
| Leer todos | `GET` | `?accion=getAll` | Devuelve array completo de boletos |
| Crear boleto | `POST` | `{ accion: "agregar", datos: {...} }` | Agrega fila nueva al sheet |
| Actualizar campo | `POST` | `{ accion: "actualizar", numero, columna, valor }` | Edita una celda específica por número de boleto |
| **Eliminar** | ❌ No existe | — | No está implementado |

`updateRecord()` realiza un **diff** entre el objeto original y el modificado, y solo llama a `actualizar` por cada columna que cambió, todas en paralelo con `Promise.allSettled`.

---

## 12. Problemas de Calidad de Datos Detectados

| Problema | Columna(s) afectada(s) | Impacto |
|---|---|---|
| Nombre de columna con espacio al final | `Restante `, `AB1 ` | Bugs al acceder por nombre exacto (`r['Restante']` vs `r['Restante ']`) |
| Valores con espacio extra | `Efectivo `, `pagado `, `Luis `, `Rebeca `, etc. | Filtros y comparaciones fallan (`===`) |
| Capitalización inconsistente | `luis` / `Luis` / `LUIS` | Duplicados en el filtro de vendedores |
| `pagado ` en minúsculas con espacio | `Estado Pago` | 1 registro no coincide con el valor válido `Pagado` |

---

## 13. Flujo de Estados Típico

```
[Alta]           → Estado Boleto: Disponible
                   Estado Pago: No pagado
                   Restante: $550
        ↓
[Apartado]       → Estado Boleto: Apartado
                   Fecha Límite Apartado: fecha acordada
                   Estado Apartado: Activo
                   AB1: primer abono recibido
                   Restante: $550 − abonos
        ↓
[Abonos]         → AB2, AB3... se llenan conforme se paga
                   Restante se reduce con cada abono
        ↓
[Pago completo]  → Estado Boleto: Pagado
                   Estado Pago: Pagado
                   Restante: 0
```

---

*Generado el 2026-04-16 consultando directamente el Google Sheet en vivo (1,100 registros).*