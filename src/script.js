const screens = Array.from(document.querySelectorAll('.screen'))
const dots = Array.from(document.querySelectorAll('.step-indicator span'))
const phoneInput = document.querySelector('#phone')
const nameInput = document.querySelector('#name')
const emailInput = document.querySelector('#email')

const screenOrder = ['phone', 'profile', 'done']

function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function showScreen(name) {
  const activeIndex = screenOrder.indexOf(name)

  screens.forEach((screen) => {
    screen.classList.toggle('active', screen.dataset.screen === name)
  })

  dots.forEach((dot, index) => {
    dot.classList.toggle('active', index === activeIndex)
  })
}

function requireField(input, message) {
  if (input.value.trim()) return true
  input.setCustomValidity(message)
  input.reportValidity()
  input.setCustomValidity('')
  return false
}

// Máscara de telefone
phoneInput.addEventListener('input', (event) => {
  event.target.value = formatPhone(event.target.value)
})

// Ações dos botões
document.addEventListener('click', (event) => {
  const action = event.target.dataset.action
  if (!action) return

  // Próximo: telefone
  if (action === 'phone-next') {
    if (!requireField(phoneInput, 'Informe o celular para continuar.')) return

    const phoneDigits = phoneInput.value.replace(/\D/g, '')
    if (phoneDigits.length < 10) {
      phoneInput.setCustomValidity('Informe um celular válido.')
      phoneInput.reportValidity()
      phoneInput.setCustomValidity('')
      return
    }

    showScreen('profile')
  }

  // Próximo: perfil
  if (action === 'profile-next') {
    if (!requireField(nameInput, 'Informe seu nome.')) return
    if (!requireField(emailInput, 'Informe seu e-mail.')) return

    if (!emailInput.value.includes('@')) {
      emailInput.setCustomValidity('E-mail inválido.')
      emailInput.reportValidity()
      emailInput.setCustomValidity('')
      return
    }

    // Aqui já deixa pronto pra usar no seu sistema depois
    const user = {
      phone: phoneInput.value,
      name: nameInput.value,
      email: emailInput.value
    }

    console.log('Usuário:', user)

    showScreen('done')
  }

  // Voltar
  if (action === 'back-phone') {
    showScreen('phone')
  }

  // Reiniciar
  if (action === 'restart') {
    phoneInput.value = ''
    nameInput.value = ''
    emailInput.value = ''
    showScreen('phone')
  }

  // Pular
  if (action === 'skip') {
    window.location.href = 'catalogo.html'
  }
})