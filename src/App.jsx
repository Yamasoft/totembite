import { useEffect, useState } from "react";
import "./styles.css";
import "./catalogo.css";
import { categories, initialMenuItems } from "./data/menu";

const products = initialMenuItems;
const featuredProduct = products.find((product) => product.combo) ?? products[0];

export default function App() {
  const [screen, setScreen] = useState("login");
  const [cart, setCart] = useState([]);
  const [phone, setPhone] = useState("");
  const [activeCategory, setActiveCategory] = useState("todos");

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const filteredProducts = activeCategory === "todos"
    ? products
    : products.filter((product) => product.category === activeCategory);

  useEffect(() => {
    window.history.replaceState({ screen: "login" }, "", window.location.href);

    function handlePopState(event) {
      setScreen(event.state?.screen ?? "login");
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  function navigateTo(nextScreen) {
    window.history.pushState({ screen: nextScreen }, "", window.location.href);
    setScreen(nextScreen);
  }

  function goBack(fallbackScreen) {
    if (window.history.state?.screen) {
      window.history.back();
      return;
    }

    setScreen(fallbackScreen);
  }

  function money(value) {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  function addToCart(product) {
    if (product.stock === 0) return;

    setCart((currentCart) => {
      const existing = currentCart.find((item) => item.id === product.id);

      if (existing) {
        if (existing.quantity >= product.stock) return currentCart;

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
    if (product.stock === 0) return;

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
              <div className="hero-title-row">
                <button className="catalog-back-btn" onClick={() => goBack("login")} aria-label="Voltar">
                  {"<"}
                </button>

                <div>
                  <span className="eyebrow">Peca agora</span>
                  <h1>Brasa Go</h1>
                  <p>Lanches, combos e sobremesas preparados na hora.</p>
                </div>
              </div>

              <div className="brand-badge">BG</div>
            </div>
          </header>

          <section className="promo-card">
            <img className="promo-bg" src={featuredProduct.image} alt={featuredProduct.name} />

            <div className="promo-overlay">
              <span>Oferta do dia</span>
              <strong>{featuredProduct.name}</strong>
              <p>{featuredProduct.description}</p>

              <div className="promo-actions">
                <div className="promo-price">{money(featuredProduct.price)}</div>

                <button onClick={(event) => animateAndAdd(event, featuredProduct)}>
                  Adicionar
                </button>
              </div>
            </div>
          </section>

          <nav className="categories">
            <button
              className={activeCategory === "todos" ? "active" : ""}
              onClick={() => setActiveCategory("todos")}
            >
              Todos
            </button>

            {categories.map((category) => (
              <button
                key={category.id}
                className={activeCategory === category.id ? "active" : ""}
                onClick={() => setActiveCategory(category.id)}
              >
                {category.label}
              </button>
            ))}
          </nav>

          <section className="section-title">
            <div>
              <span className="eyebrow">Cardapio</span>
              <h2>Escolha seu pedido</h2>
            </div>
          </section>

          <section className="products">
            {filteredProducts.map((product) => {
              const unavailable = product.stock === 0;
              const cartItem = cart.find((item) => item.id === product.id);

              return (
                <article className={`product-card ${unavailable ? "is-unavailable" : ""}`} key={product.id}>
                  <div className="product-media">
                    <img className="product-img" src={product.image} alt={product.name} />
                  </div>

                  <div className="product-info">
                    <div className="product-heading">
                      <h3>{product.name}</h3>
                      <span className="product-price">{money(product.price)}</span>
                    </div>

                    <p>{product.description}</p>
                  </div>

                  {cartItem ? (
                    <div className="menu-qty-control" aria-label={`Quantidade de ${product.name}`}>
                      <button onClick={() => decreaseFromCart(product.id)} aria-label={`Remover ${product.name}`}>
                        -
                      </button>
                      <strong>{cartItem.quantity}</strong>
                      <button onClick={() => addToCart(product)} aria-label={`Adicionar ${product.name}`}>
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      className="add-btn"
                      onClick={(event) => animateAndAdd(event, product)}
                      disabled={unavailable}
                      aria-label={`Adicionar ${product.name}`}
                    >
                      +
                    </button>
                  )}
                </article>
              );
            })}
          </section>
        </main>

        <footer className="cart-bar">
          <div>
            <span>{totalItems} {totalItems === 1 ? "item" : "itens"}</span>
            <strong>{money(total)}</strong>
          </div>

          <button
            onClick={() => navigateTo("cart")}
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
          <button onClick={() => goBack("catalogo")} aria-label="Voltar">
            {"<"}
          </button>
          <div>
            <span className="eyebrow">Seu pedido</span>
            <h1>Carrinho</h1>
          </div>
        </header>

        {cart.length === 0 ? (
          <section className="empty-cart">
            <h2>Carrinho vazio</h2>
            <p>Adicione produtos para continuar.</p>
            <button onClick={() => goBack("catalogo")}>Voltar ao cardapio</button>
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

            <button className="ghost-link" onClick={() => navigateTo("catalogo")}>
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

            <button className="primary-cta" onClick={() => navigateTo("catalogo")}>
              Continuar
            </button>

            <button className="secondary-cta">Entrar com e-mail</button>

            <p className="terms">
              Ao continuar, voce aceita os termos do Brasa Go.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
