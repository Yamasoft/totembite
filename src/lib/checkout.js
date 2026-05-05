export const kioskPaymentMethods = [
  {
    id: 'pix',
    label: 'PIX',
    title: 'PIX',
    description: 'QR Code na tela',
    badge: 'Rapido',
  },
  {
    id: 'credit',
    label: 'Credito',
    title: 'Credito',
    description: 'Pinpad externo',
    badge: 'Cartao',
  },
  {
    id: 'debit',
    label: 'Debito',
    title: 'Debito',
    description: 'Pinpad externo',
    badge: 'Cartao',
  },
]

export function buildPickupOrderPayload({
  cartItems,
  customer,
  paymentMethod,
  subtotal,
  deliveryFee,
  total,
}) {
  return {
    paymentMethod,
    mode: 'pickup',
    customerName: customer.pickupName.trim(),
    phone: customer.phone.trim() || 'Nao informado',
    address: 'Retirada no balcao',
    items: cartItems.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    })),
    subtotal,
    deliveryFee,
    total,
  }
}
