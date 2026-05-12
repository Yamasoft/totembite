const adminTokenStorageKey = 'totem-bite-admin-token'
const customerTokenStorageKey = 'totem-bite-customer-token'

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

export function fetchProducts() {
  return request('/api/products')
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
  return request('/api/orders', {
    method: 'POST',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {},
    body: JSON.stringify(order),
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
  return request(`/api/customers/lookup?phone=${encodeURIComponent(phone)}`)
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
  return request(`/api/pets/lookup?tel=${encodeURIComponent(tel)}`)
}

export function createPet(payload, token) {
  return request('/api/pets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
}

export function updatePet(id, payload, token) {
  return request(`/api/pets/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
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

export function createAppointment(payload) {
  return request('/api/appointments', {
    method: 'POST',
    body: JSON.stringify(payload),
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
