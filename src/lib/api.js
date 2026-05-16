import { normalizePhoneNational } from './phone'

const adminTokenStorageKey = 'totem-bite-admin-token'
const customerTokenStorageKey = 'totem-bite-customer-token'

function withNationalPhone(payload, field) {
  if (!payload || !(field in payload)) return payload
  return {
    ...payload,
    [field]: normalizePhoneNational(payload[field]),
  }
}

function apiBaseUrl() {
  const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim()
  if (configuredBase) {
    return configuredBase.replace(/\/+$/, '')
  }
  return window.location.origin
}

function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) {
    return path
  }
  return new URL(path, apiBaseUrl()).toString()
}

async function request(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  if (response.status === 204) {
    return null
  }

  const rawBody = await response.text()
  const trimmedBody = rawBody.trim()
  let payload = null

  if (trimmedBody) {
    try {
      payload = JSON.parse(trimmedBody)
    } catch {
      throw new Error(`Resposta invalida do servidor (${response.status}).`)
    }
  }

  if (!response.ok) {
    if (payload && typeof payload === 'object') {
      throw new Error(payload.error || payload.message || `Falha na requisicao (${response.status}).`)
    }

    throw new Error(`Falha na requisicao (${response.status}).`)
  }

  return payload
}

export function getAdminToken() {
  return window.localStorage.getItem(adminTokenStorageKey) || ''
}

export function setAdminToken(token) {
  window.localStorage.setItem(adminTokenStorageKey, token)
}

export function clearAdminToken() {
  window.localStorage.removeItem(adminTokenStorageKey)
}

export function getCustomerToken() {
  return window.localStorage.getItem(customerTokenStorageKey) || ''
}

export function setCustomerToken(token) {
  window.localStorage.setItem(customerTokenStorageKey, token)
}

export function clearCustomerToken() {
  window.localStorage.removeItem(customerTokenStorageKey)
}

export function fetchProducts(token) {
  return request('/api/products', token
    ? { headers: { Authorization: `Bearer ${token}` } }
    : {}
  )
}

export function uploadProductImage(file, token) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      request('/api/products/upload-image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ data: reader.result, name: file.name }),
      }).then(resolve).catch(reject)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function fetchMeta() {
  return request('/api/meta')
}

export function fetchPromotions() {
  return request('/api/promotions')
}

export function fetchOrders(token) {
  return request('/api/orders', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export function fetchDashboard(token) {
  return request('/api/dashboard', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export function loginAdmin(credentials) {
  return request('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
}

export function createProduct(product, token) {
  return request('/api/products', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(product),
  })
}

export function updateProduct(productId, product, token) {
  return request(`/api/products/${productId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(product),
  })
}

export function deleteProduct(productId, token) {
  return request(`/api/products/${productId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export function createPromotion(promotion, token) {
  return request('/api/promotions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(promotion),
  })
}

export function updatePromotion(promotionId, promotion, token) {
  return request(`/api/promotions/${promotionId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(promotion),
  })
}

export function deletePromotion(promotionId, token) {
  return request(`/api/promotions/${promotionId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export function createOrder(order) {
  const token = getCustomerToken()
  const payload = withNationalPhone(order, 'phone')
  return request('/api/orders', {
    method: 'POST',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {},
    body: JSON.stringify(payload),
  })
}

export function fetchPublicOrderStatus(token) {
  return request(`/api/status/${encodeURIComponent(token)}`)
}

export function fetchKitchenOrders() {
  return request('/api/kitchen/orders')
}

export function updateKitchenOrderStatus(orderId, status) {
  return request(`/api/kitchen/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
}

export function updateOrderPayment(orderId, token) {
  return request(`/api/orders/${orderId}/payment`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export function cancelOrder(orderId, statusToken) {
  return request(`/api/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: 'PUT',
    body: JSON.stringify({ statusToken }),
  })
}

export function loginCustomer(credentials) {
  return request('/api/customers/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
}

export function registerCustomer(payload) {
  return request('/api/customers/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function requestCustomerRegisterCode(payload) {
  return request('/api/customers/register-code', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchCustomerProfile(token = getCustomerToken()) {
  return request('/api/customers/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export function fetchCustomerOrders(token = getCustomerToken()) {
  return request('/api/customers/orders', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export function findCustomerByPhone(phone) {
  return request(`/api/customers/lookup?phone=${encodeURIComponent(normalizePhoneNational(phone))}`)
}

export function fetchPixStatus(txid) {
  return request(`/api/pix/status/${encodeURIComponent(txid)}`)
}

// ── Pets ────────────────────────────────────────────────────────────────────

export function fetchPets({ busca = '', tipo = '', ativo = '1' } = {}, token) {
  const params = new URLSearchParams()
  if (busca) params.set('busca', busca)
  if (tipo)  params.set('tipo', tipo)
  if (ativo !== '') params.set('ativo', ativo)
  const qs = params.toString()
  return request(`/api/pets${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function fetchPet(id, token) {
  return request(`/api/pets/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function lookupPetsByPhone(tel) {
  return request(`/api/pets/lookup?tel=${encodeURIComponent(normalizePhoneNational(tel))}`)
}

export function createPet(payload, token) {
  const normalizedPayload = withNationalPhone(payload, 'responsavel_tel')
  return request('/api/pets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(normalizedPayload),
  })
}

export function updatePet(id, payload, token) {
  const normalizedPayload = withNationalPhone(payload, 'responsavel_tel')
  return request(`/api/pets/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(normalizedPayload),
  })
}

export function deletePet(id, token) {
  return request(`/api/pets/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

// ── Appointments ────────────────────────────────────────────────────────────

export function fetchAppointments({ data = '', servico_tipo = '', status = '' } = {}, token) {
  const params = new URLSearchParams()
  if (data) params.set('data', data)
  if (servico_tipo) params.set('servico_tipo', servico_tipo)
  if (status) params.set('status', status)
  const qs = params.toString()
  return request(`/api/appointments${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function fetchAppointmentSlots({ data, servico_tipo }) {
  const params = new URLSearchParams({ data, servico_tipo })
  return request(`/api/appointments/slots?${params}`)
}

/** Busca agendamentos do cliente pelo telefone (endpoint público) */
export function fetchMyAppointments(tel) {
  const params = new URLSearchParams({ tel })
  return request(`/api/appointments/my?${params}`)
}

export function createAppointment(payload) {
  const normalizedPayload = withNationalPhone(payload, 'cliente_telefone')
  return request('/api/appointments', {
    method: 'POST',
    body: JSON.stringify(normalizedPayload),
  })
}

export function updateAppointmentStatus(id, status, token) {
  return request(`/api/appointments/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  })
}

export function deleteAppointment(id, token) {
  return request(`/api/appointments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function requestCustomerPasswordReset(payload) {
  return request('/api/customers/forgot-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function confirmCustomerPasswordReset(payload) {
  return request('/api/customers/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
