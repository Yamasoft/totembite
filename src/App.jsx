import { useState } from "react";
import "./styles.css";
import "./catalogo.css";

const products = [
  { id: 1, name: "Combo Brasa", description: "Hambúrguer artesanal, batata crocante e bebida.", price: 29.9, image: "/images/combo-brasa.png" },
  { id: 2, name: "Burger Brasa", description: "Pão, carne, queijo e molho especial.", price: 18.9, image: "/images/burger-brasa.png" },
  { id: 3, name: "Chicken Crisp", description: "Frango crocante, queijo e molho da casa.", price: 19.9, image: "/images/chicken-crisp.png" },
  { id: 4, name: "Hero Burger", description: "Burger especial da casa com muito sabor.", price: 26.9, image: "/images/hero-burger.png" },
  { id: 5, name: "Brownie Duplo", description: "Brownie de chocolate com cobertura cremosa.", price: 11.9, image: "/images/brownie-duplo.png" },
  { id: 6, name: "Milkshake Cacau", description: "Milkshake cremoso de chocolate.", price: 16.9, image: "/images/milkshake-cacau.png" },
  { id: 7, name: "Soda Cítrica", description: "Bebida refrescante com limão e hortelã.", price: 9.9, image: "/images/soda-citrica.png" }
];

export default function App() {
  const [screen, setScreen] = useState("login");
  const [cart, setCart] = useState([]);
  const [phone, setPhone] = useState("");

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  function money(value) {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  function addToCart(product) {
    setCart((currentCart) => {
      const existing = currentCart.find((item) => item.id === product.id);

      if (existing) {
        return currentCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...currentCart, { ...product, quantity: 1 }];
    });
  }

  function decreaseFromCart(productId) {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(productId) {
    setCart((currentCart) => currentCart.filter((item) => item.id !== productId));
  }

  function animateAndAdd(event, product) {
    event.currentTarget.classList.add("clicked");

    setTimeout(() => {
      event.currentTarget.classList.remove("clicked");
    }, 180);

    addToCart(product);
  }

  function formatPhone(value) {
    const digits = value.replace(/\D/g, "").slice(0, 11);

    if (digits.length <= 2) return digits ? `(${digits}` : "";
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }

    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (screen === "catalogo") {
    return (
      <>
        <main className="app-shell">
          <header className="hero">
            <div className="hero-top">
              <div>
                <span className="eyebrow">Peça agora</span>
                <h1>Brasa Go</h1>
              </div>

              <div className="brand-badge">BG</div>
            </div>
          </header>

          <section className="promo-card">
            <img className="promo-bg" src="/images/combo-brasa.png" alt="Combo Brasa" />

            <div className="promo-overlay">
              <span>Oferta do dia</span>
              <strong>Combo Brasa</strong>
              <p>Hambúrguer + batata + bebida</p>
              <div className="promo-price">{money(products[0].price)}</div>

              <button onClick={(event) => animateAndAdd(event, products[0])}>
                Adicionar
              </button>
            </div>
          </section>

          <nav className="categories">
            <button className="active">Todos</button>
            <button>Combos</button>
            <button>Lanches</button>
            <button>Bebidas</button>
            <button>Sobremesas</button>
          </nav>

          <section className="section-title">
            <h2>Cardápio</h2>
          </section>

          <section className="products">
            {products.map((product) => (
              <article className="product-card" key={product.id}>
                <img className="product-img" src={product.image} alt={product.name} />

                <div className="product-info">
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <span className="product-price">{money(product.price)}</span>
                </div>

                <button
                  className="add-btn"
                  onClick={(event) => animateAndAdd(event, product)}
                >
                  +
                </button>
              </article>
            ))}
          </section>
        </main>

        <footer className="cart-bar">
          <div>
            <strong>{money(total)}</strong>
          </div>
          <button
            onClick={() => setScreen("cart")}
            disabled={cart.length === 0}
          >
            Ver pedido
          </button>
        </footer>
      </>
    );
  }

  if (screen === "cart") {
    return (
      <main className="app-shell cart-page">
        <header className="cart-header">
          <button onClick={() => setScreen("catalogo")}>←</button>
          <div>
            <span className="eyebrow">Seu pedido</span>
            <h1>Carrinho</h1>
          </div>
        </header>

        {cart.length === 0 ? (
          <section className="empty-cart">
            <h2>Carrinho vazio</h2>
            <p>Adicione produtos para continuar.</p>
            <button onClick={() => setScreen("catalogo")}>Voltar ao cardápio</button>
          </section>
        ) : (
          <>
            <section className="cart-list">
              {cart.map((item) => (
                <article className="cart-item" key={item.id}>
                  <img src={item.image} alt={item.name} />

                  <div className="cart-item-info">
                    <h3>{item.name}</h3>
                    <span>{money(item.price)}</span>

                    <div className="qty-control">
                      <button onClick={() => decreaseFromCart(item.id)}>-</button>
                      <strong>{item.quantity}</strong>
                      <button onClick={() => addToCart(item)}>+</button>
                    </div>
                  </div>

                  <button
                    className="remove-btn"
                    onClick={() => removeFromCart(item.id)}
                  >
                    Remover
                  </button>
                </article>
              ))}
            </section>

            <section className="cart-summary">
              <div>
                <span>Total</span>
                <strong>{money(total)}</strong>
              </div>

              <button>Finalizar pedido</button>
            </section>
          </>
        )}
      </main>
    );
  }

  return (
    <main className="phone-stage">

            <section className="app-phone">
        <div className="hero-panel">
          <header className="brand-bar">
            <div className="brand-mark">
              <span>BG</span>
            </div>

            <button className="ghost-link" onClick={() => setScreen("catalogo")}>
              Pular
            </button>
          </header>

          <div className="burger-art">
            <span className="bun top"></span>
            <span className="lettuce"></span>
            <span className="cheese"></span>
            <span className="burger"></span>
            <span className="bun bottom"></span>
          </div>

          <div className="hero-copy">
            <p>Clube de vantagens</p>
            <h1>Brasa Go</h1>
          </div>
        </div>

        <section className="signup-card">
          <div className="step-indicator">
            <span className="active"></span>
            <span></span>
            <span></span>
          </div>

          <div className="screen active">
            <span className="eyebrow">Comece agora</span>
            <h2>Entre ou crie sua conta.</h2>

            <p className="muted">
              Use seu celular para receber ofertas, acompanhar pedidos e salvar seus favoritos.
            </p>

            <label>Celular</label>
            <input
              value={phone}
              inputMode="tel"
              placeholder="(11) 99999-9999"
              onChange={(event) => setPhone(formatPhone(event.target.value))}
            />

            <button className="primary-cta" onClick={() => setScreen("catalogo")}>
              Continuar
            </button>

            <button className="secondary-cta">Entrar com e-mail</button>

            <p className="terms">
              Ao continuar, você aceita os termos do Brasa Go.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}