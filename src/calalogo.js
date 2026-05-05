let carrinho = []
let total = 0

// FORMATA REAL
function formatar(valor) {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

// ATUALIZA BARRA
function atualizarCarrinho() {
  const itens = document.getElementById('cart-items')
  const totalEl = document.getElementById('cart-total')

  itens.innerText = `${carrinho.length} itens`
  totalEl.innerText = formatar(total)
}

// ADICIONAR ITEM
function adicionarItem(nome, preco) {
  carrinho.push({ nome, preco })
  total += preco

  atualizarCarrinho()

  console.log('Carrinho:', carrinho)
}

// CLICK NOS BOTÕES +
document.querySelectorAll('.btn-plus').forEach((botao, index) => {

  botao.addEventListener('click', () => {

    if (index === 0) {
      adicionarItem('Combo Brasa', 29.90)
    }

    if (index === 1) {
      adicionarItem('X-Burger', 18.70)
    }

    if (index === 2) {
      adicionarItem('Refrigerante', 6.00)
    }

  })

})

// BOTÃO VER PEDIDO
document.getElementById('cart-button').addEventListener('click', () => {

  if (carrinho.length === 0) {
    alert('Carrinho vazio')
    return
  }

  let resumo = 'Seu pedido:\n\n'

  carrinho.forEach(item => {
    resumo += `${item.nome} - ${formatar(item.preco)}\n`
  })

  resumo += `\nTotal: ${formatar(total)}`

  alert(resumo)

})