import { useEffect, useRef, useState } from "react";
import * as QRCode from "qrcode";
import "./styles.css";
import "./catalogo.css";
import { categories, communityItems } from "./data/menu";
import { campaigns } from "./data/campaigns";
import { ProductImage } from "./components/ProductImage";
import {
  clearAdminToken,
  cancelOrder,
  createOrder,
  createProduct,
  createPromotion,
  deleteProduct,
  deletePromotion,
  fetchDashboard,
  fetchOrders,
  fetchProducts,
  uploadProductImage,
  fetchPromotions,
  fetchKitchenOrders,
  fetchPixStatus,
  fetchPublicOrderStatus,
  getAdminToken,
  loginAdmin,
  setAdminToken,
  updateProduct,
  updatePromotion,
  updateKitchenOrderStatus,
  fetchAppointments,
  fetchAppointmentSlots,
  createAppointment,
  fetchMyAppointments,
  updateAppointmentStatus,
  deleteAppointment,
  fetchPets,
  fetchPet,
  lookupPetsByPhone,
  createPet,
  updatePet,
  deletePet,
} from "./lib/api";
import { formatPhoneNational, normalizePhoneNational } from "./lib/phone";
import { PainelServicos } from "./painel/PainelServicos";

const paymentMethods = [
  {
    id: "pix",
    title: "Pix",
    description: "PIX agora",
    section: "Pagar agora"
  },
  {
    id: "card_on_delivery",
    title: "Cartão",
    description: "Pague com cartão na entrega ou retirada.",
    section: "Pagar na entrega/retirada"
  },
  {
    id: "cash_on_delivery",
    title: "Dinheiro",
    description: "Pague em dinheiro na entrega ou retirada.",
    section: "Pagar na entrega/retirada"
  },
  {
    id: "card_online",
    title: "Cartão online",
    description: "Pagamento por cartão online em breve.",
    section: "Cartão online"
  }
];
const orderStatusSteps = ["received", "preparing", "ready", "finished"];
const pendingPixStorageKey = "totem-bite-pending-pix";
const activeOrdersStorageKey = "totem-bite-active-orders";
const customerPhoneStorageKey = "farmavet-customer-phone";
const customerAddressStorageKey = "farmavet-customer-address";
const fulfillmentOptions = [
  {
    id: "pickup",
    title: "Retirar na loja",
    description: "Retire produtos e itens no balcao da Farmavet."
  },
  {
    id: "delivery",
    title: "Receber em casa",
    description: "Entrega no endereco informado."
  }
];
const adminTabs = [
  { id: "inicio",     label: "Início",     description: "Visão geral e acesso rápido",                  icon: "🏠" },
  { id: "vendas",     label: "Vendas",     description: "Pedidos, status e período",                    icon: "🛒" },
  { id: "produtos",   label: "Produtos",   description: "Itens físicos, preços, estoque e imagens",     icon: "📦" },
  { id: "servicos",   label: "Serviços",   description: "Serviços agendáveis — banho, clínica",         icon: "✂️" },
  { id: "relatorios", label: "Relatórios", description: "Produto, recebimento e período",               icon: "📊" },
  { id: "promocoes",  label: "Promoções",  description: "Vitrine comercial e destaques",                icon: "🏷" },
  { id: "agenda",     label: "Agenda",     description: "Agendamentos de banho, tosa e clínica",        icon: "📅" },
  { id: "pets",       label: "Pets",       description: "Cadastro, histórico e ficha por pet",          icon: "🐾" },
  { id: "painel-ops", label: "Painel Ops", description: "Operacional — clínica e banho & tosa",         icon: "⚙️" },
];

const APPOINTMENT_STATUS_LABEL = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  em_atendimento: "Em atendimento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const APPOINTMENT_NEXT_STATUS = {
  // "confirmado" removido do fluxo visual principal (mantido no backend para compatibilidade)
  agendado: "em_atendimento",
  confirmado: "em_atendimento", // agendamentos antigos com status confirmado ainda avançam corretamente
  em_atendimento: "concluido",
};

const SERVICE_TYPE_LABEL = {
  banho: "Banho",
  tosa: "Tosa",
  banho_tosa: "Banho + Tosa",
  hidratacao: "Hidratação",
  consulta_veterinaria: "Consulta Vet.",
  vacinacao: "Vacinação",
  exame: "Exame",
};

const SERVICE_TYPE_OPTIONS_FOR_CATEGORY = {
  banho_tosa: ["banho", "tosa", "banho_tosa", "hidratacao"],
  clinica: ["consulta_veterinaria", "vacinacao", "exame"],
};

const PET_TIPO_LABEL = { cao: "Cão", gato: "Gato", passaro: "Pássaro", roedor: "Roedor", reptil: "Réptil", outro: "Outro" };
const PET_TIPO_AVATAR = { cao: "🐕", gato: "🐈", passaro: "🦜", roedor: "🐹", reptil: "🦎", outro: "🐾" };
const PET_PORTE_LABEL = { pequeno: "Pequeno", medio: "Médio", grande: "Grande" };

function emptyPetDraft() {
  return {
    nome: "", tipo: "cao", raca: "", porte: "medio", sexo: "", data_nascimento: "",
    cor: "", responsavel_nome: "", responsavel_tel: "", responsavel_email: "", observacoes: "",
  };
}

function formatAgendaDate(dateStr) {
  if (!dateStr) return "";
  try {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return dateStr;
  }
}

function guessServiceType(product) {
  const id = product.id || "";
  if (id.includes("banho") && id.includes("hidratacao")) return "banho_tosa";
  if (id.includes("banho")) return "banho";
  if (id.includes("tosa")) return "tosa";
  if (id.includes("hidratacao")) return "hidratacao";
  if (id.includes("consulta")) return "consulta_veterinaria";
  if (id.includes("vacinacao") || id.includes("vacin")) return "vacinacao";
  if (id.includes("exame")) return "exame";
  const cat = product.category || "";
  if (cat === "banho_tosa") return "banho";
  if (cat === "clinica") return "consulta_veterinaria";
  return "banho";
}

const categoryIcons = {
  produtos:   "🐾",
  banho_tosa: "🛁",
  clinica:    "🩺",
  comunidade: "🤝",
};


const serviceCategories = ["banho_tosa", "clinica"];
const communityCategories = ["comunidade"];

const catalogImageByProductId = {
  "racao-caes-adultos": "/images/produtos/racao-caes-premium.png",
  "racao-gatos-castrados": "/images/produtos/racao-gatos-premium.png",
  "antipulgas-carrapatos": "/images/produtos/antipulgas-veterinario.png",
  "vermifugo": "/images/produtos/vermifugo-oral-premium.png",
  "shampoo-neutro-pet": "/images/produtos/shampoo-pet-dermatologico.png",
  "banho-completo-pet": "/images/servicos/banho-completo-premium.webp",
  "pacote-banho-hidratacao": "/images/servicos/banho-hidratacao-premium.webp",
  "tosa-higienica": "/images/servicos/tosa-higienica-premium.webp",
  "consulta-veterinaria": "/images/servicos/consulta-veterinaria-premium.webp",
  "vacinacao-v8-v10": "/images/servicos/vacinacao-premium.webp",
  "exames-basicos": "/images/servicos/exames-laboratoriais-premium.webp",
};

const catalogImageByPromotionId = {
  "promo-1": "/images/banners/campanha-banho-tosa-premium.png",
  "promo-2": "/images/banners/campanha-vacinacao-premium.svg",
  "promo-3": "/images/banners/campanha-racao-premium.svg",
};

function mapCatalogProductImages(products) {
  return products.map((product) => ({
    ...product,
    image: catalogImageByProductId[product.id] ?? product.image,
  }));
}

function mapCatalogPromotionImages(promotions) {
  return promotions.map((promotion) => ({
    ...promotion,
    image: catalogImageByPromotionId[promotion.id] ?? promotion.image,
  }));
}

function initialScreenFromPath() {
  if (window.location.pathname.startsWith("/admin")) return "admin";
  if (window.location.pathname === "/cozinha") return "kitchen";
  if (window.location.pathname === "/pedidos") return "orders";
  if (window.location.pathname.startsWith("/s/")) return "tracking";
  return "login";
}

function tokenFromPath() {
  return window.location.pathname.startsWith("/s/")
    ? window.location.pathname.split("/").filter(Boolean)[1]
    : "";
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function categoryLabelFor(category) {
  return categories.find((item) => item.id === category)?.label ?? "Produto";
}

function emptyProductDraft() {
  return {
    id: "",
    name: "",
    description: "",
    category: "produtos",
    categoryLabel: "Produtos pet",
    price: "0",
    stock: "0",
    promo: false,
    combo: false,
    ativo: true,
    image: "/images/produtos/produto-pet.png"
  };
}

function emptyServiceDraft() {
  return {
    id: "",
    name: "",
    description: "",
    category: "banho_tosa",
    categoryLabel: "Banho & Tosa",
    price: "0",
    duracao_min: "60",
    ativo: true,
    image: "/images/servicos/servico-pet.png",
  };
}

function emptyPromotionDraft() {
  return {
    id: "",
    tag: "",
    title: "",
    description: "",
    highlight: ""
  };
}

function readPendingPixOrder() {
  try {
    const raw = window.localStorage.getItem(pendingPixStorageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePendingPixOrder(order, payment, trackingToken) {
  try {
    window.localStorage.setItem(
      pendingPixStorageKey,
      JSON.stringify({ order, payment, trackingToken })
    );
  } catch {
    // If storage is unavailable, the live screen still keeps polling normally.
  }
}

function clearPendingPixOrder() {
  try {
    window.localStorage.removeItem(pendingPixStorageKey);
  } catch {
    // Ignore storage errors; order status still comes from the backend.
  }
}

function readActiveOrders() {
  try {
    const raw = window.localStorage.getItem(activeOrdersStorageKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeActiveOrders(orders) {
  try {
    window.localStorage.setItem(activeOrdersStorageKey, JSON.stringify(orders));
  } catch {
    // The tracking page remains usable even if local storage is unavailable.
  }
}

function readCustomerPhone() {
  try {
    const raw = window.localStorage.getItem(customerPhoneStorageKey) || "";
    return formatPhoneNational(raw);
  } catch {
    return "";
  }
}

function saveCustomerPhone(phone) {
  try {
    const digits = normalizePhoneNational(phone);
    if (digits) {
      window.localStorage.setItem(customerPhoneStorageKey, digits);
    } else {
      window.localStorage.removeItem(customerPhoneStorageKey);
    }
  } catch {
    // Ignore storage errors.
  }
}

function readCustomerAddress() {
  try {
    const raw = window.localStorage.getItem(customerAddressStorageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCustomerAddress(cep, address, number, note) {
  try {
    window.localStorage.setItem(
      customerAddressStorageKey,
      JSON.stringify({ cep, address, number, note })
    );
  } catch {
    // Ignore storage errors.
  }
}

export default function App() {
  const productDetailTouchStart = useRef({ x: 0, y: 0 });
  const productDetailScrollY = useRef(0);
  const [screen, setScreen] = useState(initialScreenFromPath);
  const [cart, setCart] = useState([]);
  const [phone, setPhone] = useState(readCustomerPhone);
  const [fulfillmentMode, setFulfillmentMode] = useState("");
  const [deliveryCep, setDeliveryCep] = useState(() => readCustomerAddress()?.cep ?? "");
  const [deliveryAddress, setDeliveryAddress] = useState(() => readCustomerAddress()?.address ?? "");
  const [deliveryNumber, setDeliveryNumber] = useState(() => readCustomerAddress()?.number ?? "");
  const [deliveryAddressNote, setDeliveryAddressNote] = useState(() => readCustomerAddress()?.note ?? "");
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const [activeCategory, setActiveCategory] = useState("produtos");
  const [selectedPayment, setSelectedPayment] = useState("pix");
  const [lastOrder, setLastOrder] = useState(null);
  const [trackingToken, setTrackingToken] = useState(tokenFromPath);
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [activeOrders, setActiveOrders] = useState(readActiveOrders);
  const [kitchenOrders, setKitchenOrders] = useState([]);
  const [kitchenStatuses, setKitchenStatuses] = useState({});
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogPromotions, setCatalogPromotions] = useState([]);
  const [catalogStatus, setCatalogStatus] = useState("idle");
  const [catalogError, setCatalogError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adminToken, setAdminTokenState] = useState(getAdminToken());
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminTab, setAdminTab] = useState("inicio");
  const [adminDashboard, setAdminDashboard] = useState(null);
  const [adminOrders, setAdminOrders] = useState([]);
  const [adminProducts, setAdminProducts] = useState([]);
  const [adminPromotions, setAdminPromotions] = useState([]);
  const [adminOrderFilter, setAdminOrderFilter] = useState("all");
  const [adminReportMode, setAdminReportMode] = useState("");
  const [adminReportStartDate, setAdminReportStartDate] = useState("");
  const [adminReportEndDate, setAdminReportEndDate] = useState("");
  const [adminPeriodOpen, setAdminPeriodOpen] = useState(false);
  const [adminCredentials, setAdminCredentials] = useState({ username: "", password: "" });
  const [editingProductId, setEditingProductId] = useState("");
  const [productDraft, setProductDraft] = useState(emptyProductDraft());
  const [adminProductSearch, setAdminProductSearch] = useState("");
  const [adminServiceSearch, setAdminServiceSearch] = useState("");
  const [editingServiceId, setEditingServiceId] = useState("");
  const [serviceDraft, setServiceDraft] = useState(emptyServiceDraft());
  const [editingPromotionId, setEditingPromotionId] = useState("");
  const [promotionDraft, setPromotionDraft] = useState(emptyPromotionDraft());
  const [pixCharge, setPixCharge] = useState(null);
  const [pixQrDataUrl, setPixQrDataUrl] = useState("");
  const [pixStatusMessage, setPixStatusMessage] = useState("");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [paymentNotice, setPaymentNotice] = useState("");
  const [showFarmavetLogo, setShowFarmavetLogo] = useState(true);
  // Pets admin
  const [adminPets, setAdminPets] = useState([]);
  const [adminPetsBusca, setAdminPetsBusca] = useState("");
  const [adminPetsTipo, setAdminPetsTipo] = useState("");
  const [adminPetsLoading, setAdminPetsLoading] = useState(false);
  const [adminPetsError, setAdminPetsError] = useState("");
  const [editingPetId, setEditingPetId] = useState("");
  const [petDraft, setPetDraft] = useState(emptyPetDraft());
  const [selectedPet, setSelectedPet] = useState(null);   // pet com historico expandido
  const [petHistoryLoading, setPetHistoryLoading] = useState(false); // loading do historico
  // Agenda admin
  const [adminAppointments, setAdminAppointments] = useState([]);
  const [adminAgendaDate, setAdminAgendaDate] = useState(() => saoPauloDateKey());
  const [adminAgendaTipo, setAdminAgendaTipo] = useState("");
  const [adminAgendaLoading, setAdminAgendaLoading] = useState(false);
  const [adminAgendaError, setAdminAgendaError] = useState("");
  // Booking flow (client)
  const [bookingState, setBookingState] = useState(null);
  const [pendingAppointments, setPendingAppointments] = useState(() => {
    try {
      const saved = localStorage.getItem("farmavet_my_appointments");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [showAppointmentsSheet, setShowAppointmentsSheet] = useState(false);
  const [myApptsLoading, setMyApptsLoading] = useState(false);
  // Visitante: ação bloqueada até informar celular
  const [phonePrompt, setPhonePrompt] = useState(null); // null | { run: fn }

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Campanha especial ativa — futuramente virá do backend
  const today = saoPauloDateKey();
  const activeCampaign = campaigns.find(
    (c) => c.active && c.startDate <= today && today <= c.endDate
  ) ?? null;
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = fulfillmentMode === "delivery" ? 0 : 0;
  const orderTotal = total + deliveryFee;
  const pixOrderTotal = lastOrder?.total ?? orderTotal;
  const filteredProducts = communityCategories.includes(activeCategory)
    ? []
    : activeCategory === "todos"
      ? catalogProducts
      : catalogProducts.filter((product) => product.category === activeCategory);
  const featuredProduct = catalogProducts.find((product) => product.combo) ?? catalogProducts[0] ?? null;
  const featuredPromotion = catalogPromotions[0] ?? null;

  useEffect(() => {
    window.history.replaceState({ screen }, "", window.location.href);

    function handlePopState(event) {
      setScreen(event.state?.screen ?? "login");
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    saveCustomerPhone(phone);
  }, [phone]);

  useEffect(() => {
    if (!selectedProduct) return undefined;

    document.body.classList.add("product-detail-open");
    document.body.style.overflow = "hidden";
    document.body.style.position = "relative";

    const currentState = window.history.state || { screen };
    if (!currentState.productModal) {
      window.history.pushState({ ...currentState, screen, productModal: true }, "", window.location.href);
    }

    function handlePopState() {
      setSelectedProduct(null);
      restoreProductListScroll();
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      document.body.classList.remove("product-detail-open");
      document.body.style.overflow = "";
      document.body.style.position = "";
      window.removeEventListener("popstate", handlePopState);
    };
  }, [selectedProduct, screen]);

  useEffect(() => {
    if (selectedProduct) return;
    document.body.classList.remove("product-detail-open");
    document.body.style.overflow = "";
    document.body.style.position = "";
    restoreProductListScroll();
  }, [selectedProduct, screen]);

  async function openPaidOrderStatus(token) {
    const order = { ...(await fetchPublicOrderStatus(token)), statusToken: token };
    setCart([]);
    setTrackedOrder(order);
    setLastOrder(order);
    setPixCharge(null);
    setPixStatusMessage("");
    rememberActiveOrder(order);
    clearPendingPixOrder();
    navigateTo("tracking", token ? `/s/${token}` : window.location.href);
  }

  function rememberActiveOrder(order) {
    if (!order?.statusToken) return;
    setActiveOrders((currentOrders) => {
      const nextOrders = [
        {
          id: order.id,
          number: order.number,
          total: order.total,
          mode: order.mode,
          tipoEntrega: order.tipoEntrega,
          address: order.address,
          status: order.status,
          statusLabel: order.statusLabel,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          formaPagamento: order.formaPagamento,
          statusPagamento: order.statusPagamento,
          textoFormaPagamento: order.textoFormaPagamento,
          statusToken: order.statusToken,
          statusUpdatedAt: order.statusUpdatedAt
        },
        ...currentOrders.filter((item) => item.statusToken !== order.statusToken)
      ].slice(0, 8);
      writeActiveOrders(nextOrders);
      return nextOrders;
    });
  }

  async function openSavedOrder(orderToken) {
    setOrderError("");
    try {
      const order = { ...(await fetchPublicOrderStatus(orderToken)), statusToken: orderToken };
      setTrackedOrder(order);
      setLastOrder(order);
      setTrackingToken(orderToken);
      rememberActiveOrder(order);
      navigateTo("tracking", `/s/${orderToken}`);
    } catch (error) {
      setOrderError(error.message);
    }
  }

  useEffect(() => {
    const pending = readPendingPixOrder();
    if (!pending?.trackingToken || !pending?.payment) return undefined;

    let active = true;

    async function restorePendingPix() {
      setLastOrder(pending.order || null);
      setTrackingToken(pending.trackingToken);

      if (!pending.payment?.txid || pending.payment?.sandbox) {
        setPixCharge(pending.payment);
        setPixStatusMessage(pending.payment?.sandbox ? "Pix em modo de teste." : "Aguardando pagamento via Pix...");
        navigateTo("payment");
        return;
      }

      try {
        const status = await fetchPixStatus(pending.payment.txid);
        if (!active) return;

        if (status.status === "CONCLUIDO") {
          await openPaidOrderStatus(pending.trackingToken);
          return;
        }

        setPixCharge(pending.payment);
        setPixStatusMessage("Aguardando pagamento via Pix...");
        navigateTo("payment");
      } catch (error) {
        if (!active) return;
        setPixCharge(pending.payment);
        setPixStatusMessage("Aguardando pagamento via Pix...");
        setOrderError(error.message);
        navigateTo("payment");
      }
    }

    restorePendingPix();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (screen !== "tracking" || !trackingToken) return undefined;

    let active = true;

    async function loadStatus() {
      try {
        const order = { ...(await fetchPublicOrderStatus(trackingToken)), statusToken: trackingToken };
        if (active) {
          setTrackedOrder(order);
          rememberActiveOrder(order);
          setOrderError("");
        }
      } catch (error) {
        if (active) setOrderError(error.message);
      }
    }

    loadStatus();
    const timer = window.setInterval(loadStatus, 4000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [screen, trackingToken]);

  useEffect(() => {
    if (screen !== "orders" || activeOrders.length === 0) return undefined;

    let active = true;

    async function refreshActiveOrders() {
      try {
        const refreshedOrders = await Promise.all(
          activeOrders.map(async (order) => ({
            ...(await fetchPublicOrderStatus(order.statusToken)),
            statusToken: order.statusToken
          }))
        );
        if (!active) return;
        setActiveOrders(refreshedOrders);
        writeActiveOrders(refreshedOrders);
        setOrderError("");
      } catch (error) {
        if (active) setOrderError(error.message);
      }
    }

    refreshActiveOrders();
    const timer = window.setInterval(refreshActiveOrders, 5000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [screen, activeOrders.length]);

  useEffect(() => {
    if (screen !== "kitchen") return undefined;

    let active = true;

    async function loadKitchen() {
      try {
        const payload = await fetchKitchenOrders();
        if (active) {
          setKitchenOrders(payload.orders || []);
          setKitchenStatuses(payload.statuses || {});
          setOrderError("");
        }
      } catch (error) {
        if (active) setOrderError(error.message);
      }
    }

    loadKitchen();
    const timer = window.setInterval(loadKitchen, 5000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [screen]);

  useEffect(() => {
    if (screen !== "catalogo") return undefined;
    if (catalogStatus === "ready" && catalogProducts.length) return undefined;

    let active = true;

    async function loadCatalog() {
      setCatalogStatus("loading");
      setCatalogError("");

      try {
        const [products, promotions] = await Promise.all([fetchProducts(), fetchPromotions()]);
        if (!active) return;

        if (!products.length) {
          throw new Error("Cardápio vazio no servidor.");
        }

        const productsWithImages = mapCatalogProductImages(products);
        setCatalogProducts(productsWithImages);
        setCatalogPromotions(mapCatalogPromotionImages(promotions));
        setCart((currentCart) =>
          currentCart
            .map((cartItem) => {
              const currentProduct = productsWithImages.find((product) => product.id === cartItem.id);
              return currentProduct ? { ...cartItem, ...currentProduct } : null;
            })
            .filter(Boolean)
        );
        setCatalogStatus("ready");
      } catch (error) {
        if (active) {
          setCatalogProducts([]);
          setCatalogPromotions([]);
          setCart([]);
          setCatalogError(error.message || "Não foi possível conectar ao servidor.");
          setCatalogStatus("error");
        }
      }
    }

    loadCatalog();

    return () => {
      active = false;
    };
  }, [screen]);

  useEffect(() => {
    let active = true;

    async function preloadCatalog() {
      setCatalogStatus("loading");
      setCatalogError("");

      try {
        const [products, promotions] = await Promise.all([fetchProducts(), fetchPromotions()]);
        if (!active) return;

        if (!products.length) {
          throw new Error("Cardápio vazio no servidor.");
        }

        setCatalogProducts(mapCatalogProductImages(products));
        setCatalogPromotions(mapCatalogPromotionImages(promotions));
        setCatalogStatus("ready");
      } catch (error) {
        if (!active) {
          return;
        }

        setCatalogProducts([]);
        setCatalogPromotions([]);
        setCatalogError(error.message || "Não foi possível conectar ao servidor.");
        setCatalogStatus("error");
      }
    }

    preloadCatalog();

    return () => {
      active = false;
    };
  }, []);

  async function loadAdminData(token = adminToken) {
    if (!token) return;
    setAdminLoading(true);
    setAdminError("");

    try {
      const [dashboard, orders, products, promotions] = await Promise.all([
        fetchDashboard(token),
        fetchOrders(token),
        fetchProducts(token),
        fetchPromotions()
      ]);
      setAdminDashboard(dashboard);
      setAdminOrders(orders);
      setAdminProducts(products.map((p) => ({ ...p, image: catalogImageByProductId[p.id] ?? p.image })));
      setAdminPromotions(mapCatalogPromotionImages(promotions));
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setAdminLoading(false);
    }
  }

  async function loadAgenda(date = adminAgendaDate, tipo = adminAgendaTipo) {
    if (!adminToken) return;
    setAdminAgendaLoading(true);
    setAdminAgendaError("");
    try {
      const rows = await fetchAppointments({ data: date, servico_tipo: tipo }, adminToken);
      setAdminAppointments(rows || []);
    } catch (err) {
      setAdminAgendaError(err.message);
    } finally {
      setAdminAgendaLoading(false);
    }
  }

  async function handleAgendaStatusChange(appointment, newStatus) {
    try {
      await updateAppointmentStatus(appointment.id, newStatus, adminToken);
      setAdminAppointments((prev) =>
        prev.map((a) => a.id === appointment.id ? { ...a, status: newStatus } : a)
      );
    } catch (err) {
      alert(`Erro ao atualizar status: ${err.message}`);
    }
  }

  async function handleAgendaDelete(appointment) {
    if (!window.confirm(`Cancelar agendamento de ${appointment.pet_nome} (${appointment.cliente_nome})?`)) return;
    try {
      await deleteAppointment(appointment.id, adminToken);
      setAdminAppointments((prev) => prev.filter((a) => a.id !== appointment.id));
    } catch (err) {
      alert(`Erro ao cancelar: ${err.message}`);
    }
  }

  // ── Pets admin helpers ───────────────────────────────────────────────────
  async function loadPets(busca = adminPetsBusca, tipo = adminPetsTipo) {
    if (!adminToken) return;
    setAdminPetsLoading(true);
    setAdminPetsError("");
    try {
      const rows = await fetchPets({ busca, tipo }, adminToken);
      setAdminPets(rows || []);
    } catch (err) {
      setAdminPetsError(err.message);
    } finally {
      setAdminPetsLoading(false);
    }
  }

  async function savePet(event) {
    event.preventDefault();
    const payload = {
      ...petDraft,
      responsavel_tel: phoneDigits(petDraft.responsavel_tel),
    };
    try {
      if (editingPetId) {
        await updatePet(editingPetId, payload, adminToken);
      } else {
        await createPet(payload, adminToken);
      }
      setEditingPetId("");
      setPetDraft(emptyPetDraft());
      await loadPets();
    } catch (err) {
      alert(`Erro ao salvar pet: ${err.message}`);
    }
  }

  function startEditingPet(pet) {
    setEditingPetId(pet.id);
    setPetDraft({
      nome: pet.nome, tipo: pet.tipo, raca: pet.raca, porte: pet.porte,
      sexo: pet.sexo, data_nascimento: pet.data_nascimento, cor: pet.cor,
      responsavel_nome: pet.responsavel_nome, responsavel_tel: formatPhone(pet.responsavel_tel),
      responsavel_email: pet.responsavel_email, observacoes: pet.observacoes,
    });
    setSelectedPet(null);
  }

  async function removeAdminPet(id) {
    if (!window.confirm("Desativar este pet?")) return;
    try {
      await deletePet(id, adminToken);
      setAdminPets((prev) => prev.filter((p) => p.id !== id));
      if (selectedPet?.id === id) setSelectedPet(null);
    } catch (err) {
      alert(`Erro ao desativar: ${err.message}`);
    }
  }

  async function openPetHistory(pet) {
    if (selectedPet?.id === pet.id) { setSelectedPet(null); return; }
    setPetHistoryLoading(pet.id);
    try {
      const detail = await fetchPet(pet.id, adminToken);
      setSelectedPet(detail);
    } catch (err) {
      alert(`Erro ao carregar histórico: ${err.message}`);
    } finally {
      setPetHistoryLoading(false);
    }
  }

  // ── Booking flow helpers ─────────────────────────────────────────────────
  function updateBooking(patch) {
    setBookingState((prev) => prev ? { ...prev, ...patch } : prev);
  }

  async function bookingLoadSlots(date, servicoTipo) {
    updateBooking({ slotsLoading: true, slots: [], selectedSlot: null, error: "" });
    try {
      const rows = await fetchAppointmentSlots({ data: date, servico_tipo: servicoTipo });
      updateBooking({ slots: rows || [], slotsLoading: false });
    } catch (err) {
      updateBooking({ slotsLoading: false, error: err.message });
    }
  }

  async function bookingSubmit() {
    if (!bookingState) return;
    const { product, form, selectedSlot } = bookingState;
    if (!selectedSlot) { updateBooking({ error: "Selecione um horário." }); return; }
    const servicoTipo = guessServiceType(product);
    updateBooking({ submitting: true, error: "" });
    try {
      const created = await createAppointment({
        pet_id: form.pet_id || undefined,
        cliente_nome: form.cliente_nome,
        cliente_telefone: phoneDigits(form.cliente_telefone),
        pet_nome: form.pet_nome,
        pet_tipo: form.pet_tipo,
        pet_porte: form.pet_porte,
        servico_tipo: servicoTipo,
        servico_nome: product.name,
        profissional: selectedSlot.profissional,
        data: bookingState.date,
        hora_inicio: selectedSlot.hora_inicio,
        observacoes: form.observacoes,
      });
      // Monta entrada com dados reais retornados pelo servidor
      const newAppt = {
        id: created?.id ?? `local-${Date.now()}`,
        servico_nome: created?.servico_nome ?? product.name,
        servico_tipo: created?.servico_tipo ?? servicoTipo,
        profissional: created?.profissional ?? selectedSlot.profissional,
        data: created?.data ?? bookingState.date,
        hora_inicio: created?.hora_inicio ?? selectedSlot.hora_inicio,
        hora_fim: created?.hora_fim ?? selectedSlot.hora_fim,
        status: created?.status ?? "agendado",
        pet_nome: created?.pet_nome ?? form.pet_nome,
        pet_tipo: created?.pet_tipo ?? form.pet_tipo,
        cliente_telefone: phoneDigits(form.cliente_telefone),
        observacoes: created?.observacoes ?? form.observacoes ?? "",
      };
      setPendingAppointments((prev) => {
        const updated = [newAppt, ...prev.filter((a) => a.id !== newAppt.id)];
        try { localStorage.setItem("farmavet_my_appointments", JSON.stringify(updated)); } catch {}
        return updated;
      });
      updateBooking({ submitting: false, done: true });
    } catch (err) {
      updateBooking({ submitting: false, error: err.message });
    }
  }

  /** Atualiza status real dos agendamentos do cliente via API */
  async function refreshMyAppointments(tel) {
    if (!tel || phoneDigits(tel).length !== 11) return;
    setMyApptsLoading(true);
    try {
      const rows = await fetchMyAppointments(phoneDigits(tel));
      if (!Array.isArray(rows)) return;
      setPendingAppointments((prev) => {
        // Mescla: atualiza status dos que vieram do servidor, mantém locais que ainda não chegaram
        const serverById = Object.fromEntries(rows.map((r) => [r.id, r]));
        const merged = prev.map((a) => serverById[a.id] ? { ...a, status: serverById[a.id].status } : a);
        // Adiciona agendamentos do servidor que não estão na lista local (ex: outro dispositivo)
        const localIds = new Set(prev.map((a) => a.id));
        rows.forEach((r) => { if (!localIds.has(r.id)) merged.push(r); });
        merged.sort((a, b) => (a.data + a.hora_inicio).localeCompare(b.data + b.hora_inicio));
        try { localStorage.setItem("farmavet_my_appointments", JSON.stringify(merged)); } catch {}
        return merged;
      });
    } catch { /* silencioso — a lista local continua disponível */ }
    finally { setMyApptsLoading(false); }
  }

  function requirePhone(pendingFn) {
    if (phoneDigits(phone).length === 11) {
      pendingFn(phone);
      return;
    }
    setPhonePrompt({ run: pendingFn });
  }

  useEffect(() => {
    if (screen !== "admin" || !adminToken) return undefined;
    loadAdminData(adminToken);
    return undefined;
  }, [screen, adminToken]);

  useEffect(() => {
    if (screen !== "payment" || !pixCharge?.txid || pixCharge?.sandbox) return undefined;

    let active = true;

    async function pollPixStatus() {
      try {
        const status = await fetchPixStatus(pixCharge.txid);
        if (!active) return;

        if (status.status === "CONCLUIDO") {
          await openPaidOrderStatus(trackingToken);
          if (!active) return;
          return;
        }

        if (status.status && status.status !== "PENDENTE") {
          setPixStatusMessage(`Status Pix: ${status.status}`);
          return;
        }

        setPixStatusMessage("Aguardando pagamento via Pix...");
      } catch (error) {
        if (active) setOrderError(error.message);
      }
    }

    pollPixStatus();
    const timer = window.setInterval(pollPixStatus, 4000);
    const handleFocus = () => pollPixStatus();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") pollPixStatus();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [screen, pixCharge, trackingToken]);

  useEffect(() => {
    let active = true;

    async function buildPixQr() {
      const pixCode = pixCharge?.pixCopiaECola || pixCharge?.payload || "";
      if (!pixCharge || pixCharge.sandbox || !pixCode) {
        setPixQrDataUrl("");
        return;
      }

      if (pixCharge.qrPngBase64) {
        setPixQrDataUrl(`data:image/png;base64,${pixCharge.qrPngBase64}`);
        return;
      }

      try {
        const dataUrl = await QRCode.toDataURL(pixCode, {
          errorCorrectionLevel: "M",
          margin: 1,
          scale: 8,
          color: {
            dark: "#111111",
            light: "#ffffff"
          }
        });
        if (active) setPixQrDataUrl(dataUrl);
      } catch {
        if (active) setPixQrDataUrl("");
      }
    }

    buildPixQr();

    return () => {
      active = false;
    };
  }, [pixCharge]);

  function navigateTo(nextScreen, path = window.location.href) {
    if (typeof path === "string" && path.startsWith("/")) {
      window.history.pushState({ screen: nextScreen }, "", path);
    } else {
      window.history.pushState({ screen: nextScreen }, "", window.location.href);
    }
    setScreen(nextScreen);
  }

  function replaceTo(nextScreen, path = "/") {
    window.history.replaceState({ screen: nextScreen }, "", path);
    setScreen(nextScreen);
  }

  function goBack(fallbackScreen) {
    if (window.history.state?.screen) {
      window.history.back();
      return;
    }

    setScreen(fallbackScreen);
  }

  function openCatalog() {
    if (catalogStatus === "idle") {
      setCatalogStatus("loading");
    }
    navigateTo("catalogo");
  }

  function openCatalogAt(category) {
    setActiveCategory(category);
    openCatalog();
  }

  async function handleAdminLogin(event) {
    event.preventDefault();
    setAdminLoading(true);
    setAdminError("");

    try {
      const response = await loginAdmin(adminCredentials);
      setAdminToken(response.token);
      setAdminTokenState(response.token);
      setScreen("admin");
      window.history.pushState({ screen: "admin" }, "", "/admin");
      await loadAdminData(response.token);
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setAdminLoading(false);
    }
  }

  function handleAdminLogout() {
    clearAdminToken();
    setAdminTokenState("");
    setAdminDashboard(null);
    setAdminOrders([]);
    setAdminProducts([]);
    setAdminPromotions([]);
    setAdminTab("resumo");
    setAdminError("");
    setAdminCredentials({ username: "", password: "" });
    setEditingProductId("");
    setEditingServiceId("");
    setEditingPromotionId("");
    setProductDraft(emptyProductDraft());
    setServiceDraft(emptyServiceDraft());
    setPromotionDraft(emptyPromotionDraft());
    navigateTo("login", "/");
  }

  function startEditingProduct(product) {
    setEditingProductId(product.id);
    setProductDraft({
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      categoryLabel: product.categoryLabel,
      price: String(product.price),
      stock: String(product.stock),
      promo: Boolean(product.promo),
      combo: Boolean(product.combo),
      ativo: product.ativo !== false,
      image: product.image
    });
    setAdminTab("produtos");
  }

  function startEditingPromotion(promotion) {
    setEditingPromotionId(promotion.id);
    setPromotionDraft({
      id: promotion.id,
      tag: promotion.tag,
      title: promotion.title,
      description: promotion.description,
      highlight: promotion.highlight
    });
    setAdminTab("promocoes");
  }

  async function saveProduct(event) {
    event.preventDefault();
    if (!adminToken) return;

    const payload = {
      ...productDraft,
      id: productDraft.id || slugify(productDraft.name),
      categoryLabel: productDraft.categoryLabel || categoryLabelFor(productDraft.category),
      price: Number(productDraft.price),
      stock: Number(productDraft.stock)
    };

    setAdminLoading(true);
    setAdminError("");

    try {
      if (editingProductId) {
        await updateProduct(editingProductId, payload, adminToken);
      } else {
        await createProduct(payload, adminToken);
      }
      setEditingProductId("");
      setProductDraft(emptyProductDraft());
      await loadAdminData(adminToken);
      if (screen === "catalogo") {
        const products = await fetchProducts();
        if (!products.length) {
          throw new Error("Cardápio vazio no servidor.");
        }
        setCatalogProducts(mapCatalogProductImages(products));
        setCatalogStatus("ready");
        setCatalogError("");
      }
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setAdminLoading(false);
    }
  }

  async function savePromotion(event) {
    event.preventDefault();
    if (!adminToken) return;

    const payload = {
      ...promotionDraft,
      id: promotionDraft.id || slugify(promotionDraft.title),
    };

    setAdminLoading(true);
    setAdminError("");

    try {
      if (editingPromotionId) {
        await updatePromotion(editingPromotionId, payload, adminToken);
      } else {
        await createPromotion(payload, adminToken);
      }
      setEditingPromotionId("");
      setPromotionDraft(emptyPromotionDraft());
      await loadAdminData(adminToken);
      if (screen === "catalogo") {
        const promotions = await fetchPromotions();
        setCatalogPromotions(mapCatalogPromotionImages(promotions));
      }
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setAdminLoading(false);
    }
  }

  async function removeAdminProduct(productId) {
    if (!adminToken) return;
    setAdminLoading(true);
    setAdminError("");

    try {
      await deleteProduct(productId, adminToken);
      if (editingProductId === productId) {
        setEditingProductId("");
        setProductDraft(emptyProductDraft());
      }
      await loadAdminData(adminToken);
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setAdminLoading(false);
    }
  }

  function startEditingService(service) {
    setEditingServiceId(service.id);
    setServiceDraft({
      id: service.id,
      name: service.name,
      description: service.description,
      category: service.category,
      categoryLabel: service.categoryLabel,
      price: String(service.price),
      duracao_min: String(service.duracao_min ?? "60"),
      ativo: service.ativo !== false,
      image: service.image,
    });
    setAdminTab("servicos");
  }

  async function saveService(event) {
    event.preventDefault();
    if (!adminToken) return;

    const payload = {
      ...serviceDraft,
      id: serviceDraft.id || slugify(serviceDraft.name),
      categoryLabel: serviceDraft.categoryLabel || categoryLabelFor(serviceDraft.category),
      price: Number(serviceDraft.price),
      stock: 0,
      promo: false,
      combo: false,
      tipo: "servico",
      duracao_min: Number(serviceDraft.duracao_min) || 60,
    };

    setAdminLoading(true);
    setAdminError("");

    try {
      if (editingServiceId) {
        await updateProduct(editingServiceId, payload, adminToken);
      } else {
        await createProduct(payload, adminToken);
      }
      setEditingServiceId("");
      setServiceDraft(emptyServiceDraft());
      await loadAdminData(adminToken);
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setAdminLoading(false);
    }
  }

  async function removeAdminService(serviceId) {
    if (!adminToken) return;
    setAdminLoading(true);
    setAdminError("");

    try {
      await deleteProduct(serviceId, adminToken);
      if (editingServiceId === serviceId) {
        setEditingServiceId("");
        setServiceDraft(emptyServiceDraft());
      }
      await loadAdminData(adminToken);
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setAdminLoading(false);
    }
  }

  async function removeAdminPromotion(promotionId) {
    if (!adminToken) return;
    setAdminLoading(true);
    setAdminError("");

    try {
      await deletePromotion(promotionId, adminToken);
      if (editingPromotionId === promotionId) {
        setEditingPromotionId("");
        setPromotionDraft(emptyPromotionDraft());
      }
      await loadAdminData(adminToken);
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setAdminLoading(false);
    }
  }

  function money(value) {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  function formatDateTime(value) {
    if (!value) return "-";
    return parseServerDate(value).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo"
    });
  }

  function parseServerDate(value) {
    if (!value) return new Date(NaN);
    if (value instanceof Date) return value;
    const text = String(value);
    const hasExplicitTimeZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(text);
    return new Date(hasExplicitTimeZone ? text : `${text}Z`);
  }

  function saoPauloDateKey(value = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(value);
    const mapped = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${mapped.year}-${mapped.month}-${mapped.day}`;
  }

  /** Retorna HH:MM no fuso de Brasília (America/Sao_Paulo) */
  function saoPauloTimeHHMM(value = new Date()) {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(value); // ex.: "14:35"
  }

  function addToCart(product) {
    if (product.stock === 0) return;
    if (serviceCategories.includes(product.category)) return;

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

  function addSelectedProductToCart(product) {
    addToCart(product);
    closeSelectedProduct();
  }

  function openProductDetail(product) {
    productDetailScrollY.current = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    setSelectedProduct(product);
  }

  function restoreProductListScroll() {
    const y = productDetailScrollY.current;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: y, left: 0, behavior: "auto" });
    });
  }

  function closeSelectedProduct() {
    setSelectedProduct(null);
    restoreProductListScroll();
    if (window.history.state?.productModal) {
      window.history.back();
    }
  }

  function handleProductDetailTouchStart(event) {
    const touch = event.touches[0];
    if (!touch) return;
    productDetailTouchStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleProductDetailTouchMove(event) {
    if (event.touches.length !== 1) {
      event.preventDefault();
      return;
    }

    const touch = event.touches[0];
    const deltaX = touch.clientX - productDetailTouchStart.current.x;
    const deltaY = touch.clientY - productDetailTouchStart.current.y;
    const isHorizontalDrag = Math.abs(deltaX) > Math.abs(deltaY);
    const verticalScrollArea = event.target.closest(".product-detail-copy");

    if (isHorizontalDrag || !verticalScrollArea) {
      event.preventDefault();
    }
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

    if (event?.currentTarget) {
      event.currentTarget.classList.add("clicked");
      setTimeout(() => event.currentTarget.classList.remove("clicked"), 180);
    }

    addToCart(product);
  }

  function resetOrderFlow() {
    setCart([]);
    setPixCharge(null);
    setPixStatusMessage("");
    setLastOrder(null);
    setTrackedOrder(null);
    setTrackingToken("");
    setOrderError("");
    setSelectedPayment("pix");
    setFulfillmentMode("");
    setDeliveryCep("");
    setDeliveryAddress("");
    setDeliveryNumber("");
    setDeliveryAddressNote("");
    setIsSearchingCep(false);
    setPaymentNotice("");
    clearPendingPixOrder();
  }

  function statusTime(value, minutesToAdd = 0) {
    const base = value ? parseServerDate(value) : new Date();
    if (Number.isNaN(base.getTime())) return "";
    base.setMinutes(base.getMinutes() + minutesToAdd);
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit"
    }).format(base).replace(":", ":") + "h";
  }

  function orderStatusText(order) {
    const isDelivery = order?.mode === "delivery";
    const address = order?.address && order.address !== "Retirada no balcão"
      ? order.address
      : "o endereço informado";
    const eta = statusTime(order?.statusUpdatedAt, 25);

    if (!order) {
      return {
        title: "Aguardando cozinha",
        body: "Mantenha esta tela aberta. A cozinha atualiza o andamento do pedido em tempo real."
      };
    }

    if (order.status === "ready" && isDelivery) {
      return {
        title: "Entregador saiu para entrega",
        body: `Entregador saiu para ${address}. Previsão de chegada às ${eta}.`
      };
    }

    if (order.status === "ready") {
      return {
        title: "Pronto para retirada",
        body: "Seu pedido está pronto para retirada no balcão."
      };
    }

    if (order.status === "finished" && isDelivery) {
      return {
        title: "Pedido entregue",
        body: "Obrigado. Bom apetite!"
      };
    }

    if (order.status === "finished") {
      return {
        title: "Pedido retirado",
        body: "Obrigado. Bom apetite!"
      };
    }

    if (order.status === "preparing") {
      return {
        title: "Em preparo",
        body: isDelivery
          ? "Seu pedido está sendo preparado. Avisaremos quando sair para entrega."
          : "Seu pedido está sendo preparado. Avisaremos quando estiver pronto para retirada."
      };
    }

    if (order.paymentStatus === "pending" && order.paymentMethod !== "pix") {
      return {
        title: "Pedido enviado",
        body: pendingPaymentInstruction(order) || "A cozinha recebeu seu pedido. O pagamento será feito na entrega ou retirada."
      };
    }

    return {
      title: "Recebido pela cozinha",
      body: isDelivery
        ? "Pagamento confirmado. A cozinha recebeu seu pedido para entrega."
        : "Pagamento confirmado. A cozinha recebeu seu pedido para retirada."
    };
  }

  function timelineLabel(status, order) {
    const isDelivery = order?.mode === "delivery";
    if (status === "received") return "Recebido pela cozinha";
    if (status === "preparing") return "Em preparo";
    if (status === "ready") return isDelivery ? "Saiu para entrega" : "Pronto para retirada";
    if (status === "finished") return isDelivery ? "Entregue / Finalizado" : "Retirado / Finalizado";
    return status;
  }

  function orderModeLabel(mode) {
    return mode === "delivery" ? "Entrega" : "Retirada";
  }

  function paymentDetailsFor(paymentId, mode) {
    const isDelivery = mode === "delivery";
    const tipoEntrega = isDelivery ? "entrega" : "retirada";

    if (paymentId === "pix") {
      return {
        paymentMethod: "pix",
        paymentStatus: "pending",
        formaPagamento: "pix",
        textoFormaPagamento: "PIX",
        statusPagamento: "pendente",
        tipoEntrega,
      };
    }

    if (paymentId === "card_on_delivery") {
      return {
        paymentMethod: isDelivery ? "cartao_entrega" : "cartao_retirada",
        paymentStatus: "pending",
        formaPagamento: isDelivery ? "cartao_entrega" : "cartao_retirada",
        textoFormaPagamento: isDelivery ? "Cartão na entrega" : "Cartão na retirada",
        statusPagamento: "pendente",
        tipoEntrega,
      };
    }

    if (paymentId === "cash_on_delivery") {
      return {
        paymentMethod: isDelivery ? "dinheiro_entrega" : "dinheiro_retirada",
        paymentStatus: "pending",
        formaPagamento: isDelivery ? "dinheiro_entrega" : "dinheiro_retirada",
        textoFormaPagamento: isDelivery ? "Dinheiro na entrega" : "Dinheiro na retirada",
        statusPagamento: "pendente",
        tipoEntrega,
      };
    }

    return {
      paymentMethod: "cartao_online",
      paymentStatus: "pending",
      formaPagamento: "cartao_online",
      textoFormaPagamento: "Cartão online",
      statusPagamento: "pendente",
      tipoEntrega,
    };
  }

  function paymentStatusLabel(order) {
    if (order?.paymentStatus === "paid" || order?.statusPagamento === "pago") {
      return order?.formaPagamento === "pix" || order?.paymentMethod === "pix"
        ? "PAGO VIA PIX"
        : "PAGAMENTO PAGO";
    }

    const paymentText = order?.textoFormaPagamento || order?.paymentMethod || "Pagamento";
    return `PAGAMENTO PENDENTE · ${paymentText.toUpperCase()}`;
  }

  function pendingPaymentInstruction(order) {
    const text = order?.textoFormaPagamento || "";
    if (text === "Cartão na retirada") return "Pedido enviado. Pague com cartão na retirada.";
    if (text === "Dinheiro na retirada") return "Pedido enviado. Pague em dinheiro na retirada.";
    if (text === "Cartão na entrega") return "Pedido enviado. Pagamento com cartão na entrega.";
    if (text === "Dinheiro na entrega") return "Pedido enviado. Pagamento em dinheiro na entrega.";
    return "";
  }

  function phoneDigits(value) {
    return normalizePhoneNational(value);
  }

  function formatPhone(value) {
    return formatPhoneNational(value);
  }

  function applyPhoneInput(value) {
    return formatPhone(phoneDigits(value));
  }

  function handleBookingPhoneChange(event) {
    const formatted = applyPhoneInput(event.currentTarget.value);
    updateBooking({
      form: { ...bookingState.form, cliente_telefone: formatted },
      foundPets: null,
      error: "",
    });
  }

  function handleBookingPhoneBeforeInput(event) {
    if (!event.data || !/\d/.test(event.data)) return;
    const input = event.currentTarget;
    const selected = Math.max(0, input.selectionEnd - input.selectionStart);
    if (selected === 0 && phoneDigits(input.value).length >= 11) {
      event.preventDefault();
    }
  }

  function handleBookingPhonePaste(event) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text");
    const formatted = applyPhoneInput(pasted);
    updateBooking({
      form: { ...bookingState.form, cliente_telefone: formatted },
      foundPets: null,
      error: "",
    });
  }

  function formatCep(value) {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }

  function deliveryAddressLine() {
    const parts = [
      deliveryAddress.trim(),
      deliveryNumber.trim() ? `n ${deliveryNumber.trim()}` : "",
      deliveryAddressNote.trim()
    ].filter(Boolean);
    return parts.join(", ");
  }

  async function searchCep() {
    const digits = deliveryCep.replace(/\D/g, "");
    if (digits.length !== 8) {
      setOrderError("Informe um CEP com 8 digitos.");
      return;
    }

    setIsSearchingCep(true);
    setOrderError("");

    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!response.ok) throw new Error("Não foi possível buscar o CEP.");

      const payload = await response.json();
      if (payload.erro) throw new Error("CEP não encontrado.");

      const street = [payload.logradouro, payload.bairro, payload.localidade, payload.uf]
        .filter(Boolean)
        .join(", ");
      setDeliveryAddress(street);
    } catch (error) {
      setOrderError(error.message || "Não foi possível buscar o CEP.");
    } finally {
      setIsSearchingCep(false);
    }
  }

  async function finishOrder() {
    setIsSubmittingOrder(true);
    setOrderError("");
    setPaymentNotice("");

    try {
      if (!fulfillmentMode) {
        throw new Error("Escolha se vai retirar ou receber por entrega.");
      }
      const finalDeliveryAddress = deliveryAddressLine();
      if (fulfillmentMode === "delivery" && !finalDeliveryAddress) {
        throw new Error("Informe o endereço de entrega.");
      }

      if (selectedPayment === "card_online") {
        setPaymentNotice("Pagamento por cartão online em desenvolvimento. Esta funcionalidade estará disponível em breve.");
        return;
      }

      const isPix = selectedPayment === "pix";
      const payment = paymentDetailsFor(selectedPayment, fulfillmentMode);
      const payload = await createOrder({
        ...payment,
        mode: fulfillmentMode,
        customerName: "Cliente app",
        phone: phoneDigits(phone) || "Não informado",
        address: fulfillmentMode === "delivery" ? finalDeliveryAddress : "Retirada no balcão",
        subtotal: total,
        deliveryFee,
        total: orderTotal,
        items: cart.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      });

      const token = payload.order?.statusToken;
      const order = {
        ...payload.order,
      };

      if (fulfillmentMode === "delivery" && finalDeliveryAddress) {
        saveCustomerAddress(deliveryCep, deliveryAddress, deliveryNumber, deliveryAddressNote);
      }

      setLastOrder(order);
      setTrackingToken(token);
      if (isPix) {
        savePendingPixOrder(order, payload.payment || null, token);
        setTrackedOrder(null);
        setPixCharge(payload.payment || null);
        setPixStatusMessage(payload.payment?.sandbox ? "Pix em modo de teste." : "Aguardando pagamento via Pix...");
        return;
      }

      clearPendingPixOrder();
      setCart([]);
      setPixCharge(null);
      setTrackedOrder(order);
      rememberActiveOrder({ ...order, statusToken: token });
      navigateTo("tracking", token ? `/s/${token}` : window.location.href);
    } catch (error) {
      setOrderError(error.message);
    } finally {
      setIsSubmittingOrder(false);
    }
  }

  async function copyPixCode() {
    const pixCode = pixCharge?.pixCopiaECola || pixCharge?.payload || "";
    if (!pixCode) {
      setPixStatusMessage("Código Pix indisponível.");
      return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(pixCode);
      } else {
        const input = document.getElementById("pix-copy-code");
        if (!input) throw new Error("Campo do código Pix não encontrado.");
        input.focus();
        input.select();
        const copied = document.execCommand("copy");
        if (!copied) throw new Error("Cópia manual necessária.");
      }
      setPixStatusMessage("Código Pix copiado.");
    } catch {
      const input = document.getElementById("pix-copy-code");
      if (input) {
        input.focus();
        input.select();
      }
      setPixStatusMessage("Toque no código selecionado e copie manualmente.");
    }
  }

  async function changeKitchenStatus(orderId, status) {
    const updated = await updateKitchenOrderStatus(orderId, status);
    setKitchenOrders((currentOrders) =>
      currentOrders
        .map((order) => (order.id === orderId ? updated : order))
        .filter((order) => order.status !== "finished")
    );
  }

  function nextKitchenStatus(status) {
    if (status === "received") return "preparing";
    if (status === "preparing") return "ready";
    if (status === "ready") return "finished";
    return "finished";
  }

  function nextKitchenLabel(status, mode = "pickup") {
    if (status === "received") return "Tocar para iniciar preparo";
    if (status === "preparing") return mode === "delivery" ? "Tocar quando sair para entrega" : "Tocar para marcar pronto";
    if (status === "ready") return mode === "delivery" ? "Entregue? Tocar para finalizar" : "Cliente retirou? Tocar para finalizar";
    return "Pedido finalizado";
  }

  function advanceKitchenStatus(order) {
    changeKitchenStatus(order.id, nextKitchenStatus(order.status));
  }

  if (screen === "catalogo") {
    const catalogUnavailable = catalogStatus === "loading" || catalogStatus === "error" || !catalogProducts.length;
    const catalogLoading = catalogStatus === "idle" || catalogStatus === "loading";

    return (
      <>
        <main className="app-shell">
          <header className="hero">
            <div className="hero-top">
              <button className="catalog-back-btn" onClick={() => replaceTo("login", "/")} aria-label="Voltar">
                {"<"}
              </button>

              <div className="catalog-hero-brand">
                <div className={`catalog-hero-badge ${showFarmavetLogo ? "" : "fallback"}`}>
                  {showFarmavetLogo ? (
                    <img
                      src="/logoFarmavet.jpeg"
                      alt="Farmavet"
                      onError={() => setShowFarmavetLogo(false)}
                    />
                  ) : (
                    <span>FV</span>
                  )}
                </div>
                <p className="catalog-hero-sub">PetShop e Clínica Veterinária</p>
              </div>
            </div>
          </header>

          {catalogUnavailable ? (
            <section className="catalog-unavailable">
              <div className="catalog-unavailable-mark">!</div>
              <span className="eyebrow">Catálogo em tempo real</span>
              <h2>{catalogLoading ? "Carregando catálogo" : "Catálogo indisponível"}</h2>
              <p>
                {catalogLoading
                  ? "Buscando produtos e serviços da Farmavet."
                  : "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente."}
              </p>
              {catalogError && <strong>{catalogError}</strong>}
              <button onClick={openCatalog}>Tentar novamente</button>
            </section>
          ) : (
            <>
              <nav className="categories">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    className={`${activeCategory === category.id ? "active" : ""} cat-btn-${category.id}`}
                    onClick={() => setActiveCategory(category.id)}
                  >
                    <span className="cat-icon" aria-hidden="true">{categoryIcons[category.id]}</span>
                    {category.label}
                  </button>
                ))}
              </nav>

              <section className="products">
                {communityCategories.includes(activeCategory) ? (
                  communityItems.map((item) => (
                    <article className="community-card" key={item.id}>
                      <div className="community-card-tag">{item.tag}</div>
                      <div className="community-card-body">
                        <h3>{item.name}</h3>
                        <p>{item.description}</p>
                      </div>
                      <button
                        className="community-card-btn"
                        onClick={() => alert(`${item.name}\n\nEm breve mais informações aqui.`)}
                      >
                        {item.action}
                      </button>
                    </article>
                  ))
                ) : filteredProducts.map((product) => {
                  const unavailable = product.stock === 0;
                  const cartItem = cart.find((item) => item.id === product.id);
                  const isService = serviceCategories.includes(product.category);

                  return (
                    <article
                      className={`product-card${unavailable ? " is-unavailable" : ""}${isService ? " is-service" : ""}`}
                      key={product.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openProductDetail(product)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openProductDetail(product);
                        }
                      }}
                    >
                      <div className="product-media" data-cat={product.category}>
                        {product.promo && !isService && <span className="product-promo-badge">Promo</span>}
                        {isService && <span className="product-service-badge">Serviço</span>}
                        {unavailable && <span className="product-stock-badge">Esgotado</span>}
                        <ProductImage
                          className="product-img"
                          src={product.image}
                          alt={product.name}
                          category={product.category}
                        />
                      </div>

                      <div className="product-info">
                        <div className="product-heading">
                          <h3>{product.name}</h3>
                          <p>{product.description}</p>
                          {isService && (
                            <button
                              className="schedule-btn"
                              onClick={(event) => {
                                event.stopPropagation();
                                requirePhone((currentPhone) => setBookingState({
                                  open: true,
                                  product,
                                  step: "form",
                                  form: {
                                    pet_id: "",
                                    cliente_nome: "",
                                    cliente_telefone: currentPhone,
                                    pet_nome: "",
                                    pet_tipo: "cao",
                                    pet_porte: "medio",
                                    observacoes: "",
                                  },
                                  foundPets: null,
                                  petsSearching: false,
                                  date: saoPauloDateKey(),
                                  slots: [],
                                  slotsLoading: false,
                                  selectedSlot: null,
                                  submitting: false,
                                  done: false,
                                  error: "",
                                }));
                              }}
                            >
                              📅 Agendar
                            </button>
                          )}
                        </div>
                        <span className="product-price">{money(product.price)}</span>
                      </div>

                      {!isService && (cartItem ? (
                        <div className="menu-qty-control" aria-label={`Quantidade de ${product.name}`} onClick={(event) => event.stopPropagation()}>
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
                          onClick={(event) => {
                            event.stopPropagation();
                            requirePhone(() => animateAndAdd(null, product));
                          }}
                          disabled={unavailable}
                          aria-label={`Adicionar ${product.name}`}
                        >
                          +
                        </button>
                      ))}
                    </article>
                  );
                })}
              </section>
            </>
          )}
        </main>

        {!catalogUnavailable && !communityCategories.includes(activeCategory) && (cart.length > 0 || pendingAppointments.length > 0) && (() => {
          const hasCart = cart.length > 0;
          const hasAppt = pendingAppointments.length > 0;
          const bothActive = hasCart && hasAppt;
          return (
            <footer className="cart-bar cart-bar--active">
              <div className="cart-bar-info">
                <div className="cart-bar-icon" aria-hidden="true">
                  <span className="cart-bar-count">
                    {bothActive ? "🛒📅" : hasCart ? totalItems : "📅"}
                  </span>
                </div>
                <div className="cart-bar-text">
                  <span>
                    {bothActive
                      ? `${totalItems} ${totalItems === 1 ? "produto" : "produtos"} · ${pendingAppointments.length} ${pendingAppointments.length === 1 ? "agendamento" : "agendamentos"}`
                      : hasCart
                        ? `${totalItems} ${totalItems === 1 ? "item selecionado" : "itens selecionados"}`
                        : `${pendingAppointments.length} ${pendingAppointments.length === 1 ? "agendamento" : "agendamentos"}`}
                  </span>
                  {hasCart && <strong>{money(total)}</strong>}
                </div>
              </div>
              {bothActive ? (
                <div className="cart-bar-dual-cta">
                  <button className="cart-bar-cta cart-bar-cta--secondary" onClick={() => { setShowAppointmentsSheet(true); refreshMyAppointments(phone); }}>
                    Agendamentos
                  </button>
                  <button className="cart-bar-cta" onClick={() => navigateTo("cart")}>
                    Pedido
                  </button>
                </div>
              ) : hasCart ? (
                <button className="cart-bar-cta" onClick={() => navigateTo("cart")}>
                  Ver pedido
                </button>
              ) : (
                <button className="cart-bar-cta" onClick={() => { setShowAppointmentsSheet(true); refreshMyAppointments(phone); }}>
                  Ver agendamentos
                </button>
              )}
            </footer>
          );
        })()}

        {showAppointmentsSheet && (
          <section className="booking-modal" role="dialog" aria-modal="true" aria-label="Agendamentos">
            <div className="booking-modal-overlay" onClick={() => setShowAppointmentsSheet(false)} />
            <div className="booking-sheet">
              <div className="booking-header">
                <div>
                  <span className="eyebrow">Meus agendamentos</span>
                  <h2>Na fila da Farmavet</h2>
                </div>
                <button className="booking-close-btn" onClick={() => setShowAppointmentsSheet(false)} aria-label="Fechar">✕</button>
              </div>
              {myApptsLoading && (
                <p className="my-appts-loading">Atualizando status…</p>
              )}
              {pendingAppointments.length === 0 ? (
                <p style={{ padding: "1.5rem", color: "var(--text-secondary, #666)" }}>Nenhum agendamento ainda.</p>
              ) : (
                <ul className="appointments-list">
                  {pendingAppointments.map((appt) => {
                    const statusLabel = APPOINTMENT_STATUS_LABEL[appt.status] ?? appt.status ?? "Agendado";
                    const statusCls = `my-appt-status my-appt-status--${appt.status ?? "agendado"}`;
                    const isConcluido = appt.status === "concluido";
                    const isCancelado = appt.status === "cancelado";
                    return (
                      <li key={appt.id} className={`appointments-list-item${isConcluido ? " appointments-list-item--done" : ""}${isCancelado ? " appointments-list-item--cancelled" : ""}`}>
                        <div className="appointments-list-service">{appt.servico_nome ?? appt.serviceName}</div>
                        <div className="appointments-list-detail">
                          <span>{appt.pet_nome ?? appt.petNome}</span>
                          <span>{appt.data} às {appt.hora_inicio ?? appt.horaInicio}</span>
                          <span>com {appt.profissional}</span>
                        </div>
                        <div className="my-appt-footer">
                          <span className={statusCls}>{statusLabel}</span>
                          {(isConcluido || isCancelado) && (
                            <button
                              className="appointments-list-remove"
                              onClick={() => setPendingAppointments((prev) => {
                                const updated = prev.filter((a) => a.id !== appt.id);
                                try { localStorage.setItem("farmavet_my_appointments", JSON.stringify(updated)); } catch {}
                                return updated;
                              })}
                              aria-label="Remover da lista"
                            >✕</button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        )}

        {bookingState?.open && (
          <section className="booking-modal" role="dialog" aria-modal="true" aria-label="Agendar serviço">
            <div className="booking-modal-overlay" onClick={() => !bookingState.submitting && setBookingState(null)} />
            <div className="booking-sheet">
              {bookingState.done ? (
                <div className="booking-done">
                  <span className="booking-done-icon">✅</span>
                  <h2>Agendamento confirmado!</h2>
                  <p>
                    <strong>{bookingState.form.pet_nome}</strong> está na agenda.<br />
                    {bookingState.date} às {bookingState.selectedSlot?.hora_inicio} com {bookingState.selectedSlot?.profissional}.
                  </p>
                  <button className="booking-close-btn" onClick={() => setBookingState(null)}>Fechar</button>
                </div>
              ) : (
                <>
                  <div className="booking-header">
                    <div>
                      <span className="eyebrow">Agendamento</span>
                      <h2>{bookingState.product?.name}</h2>
                    </div>
                    <button className="booking-close-btn" onClick={() => setBookingState(null)} aria-label="Fechar">✕</button>
                  </div>

                  {bookingState.step === "form" && (
                    <div className="booking-step">
                      <p className="booking-step-label">Responsável e pet</p>

                      {/* ── Bloco de telefone com lookup ── */}
                      <div className="booking-tel-lookup">
                        <label>Celular
                          <div className="booking-tel-row">
                            <input
                              type="tel"
                              value={bookingState.form.cliente_telefone}
                              onBeforeInput={handleBookingPhoneBeforeInput}
                              onPaste={handleBookingPhonePaste}
                              onChange={handleBookingPhoneChange}
                              placeholder="(11) 99999-9999"
                              inputMode="tel"
                              autoComplete="tel"
                              maxLength={15}
                            />
                            <button
                              type="button"
                              className="booking-lookup-btn"
                              disabled={bookingState.petsSearching || phoneDigits(bookingState.form.cliente_telefone).length !== 11}
                              onClick={async () => {
                                const telDigitado = bookingState.form.cliente_telefone;
                                const telNormalizado = phoneDigits(telDigitado);
                                if (telNormalizado.length !== 11) {
                                  updateBooking({ error: "Informe um celular com 11 dígitos: DDD + número.", foundPets: null });
                                  return;
                                }
                                console.log("[BUSCAR PETS] tel digitado no modal:", JSON.stringify(telDigitado));
                                console.log("[BUSCAR PETS] tel normalizado (phoneDigits):", JSON.stringify(telNormalizado), "| length:", telNormalizado.length);
                                console.log("[BUSCAR PETS] endpoint chamado: GET /api/pets/lookup?tel=" + encodeURIComponent(telNormalizado));
                                updateBooking({ petsSearching: true, foundPets: null, error: "" });
                                try {
                                  const pets = await lookupPetsByPhone(telNormalizado);
                                  console.log("[BUSCAR PETS] resposta do backend:", pets?.length ?? "erro", "pet(s)");
                                  updateBooking({ petsSearching: false, foundPets: pets || [] });
                                } catch (err) {
                                  console.log("[BUSCAR PETS] ERRO na chamada:", err?.message);
                                  updateBooking({ petsSearching: false, foundPets: [] });
                                }
                              }}
                            >
                              {bookingState.petsSearching ? "…" : "Buscar pets"}
                            </button>
                          </div>
                        </label>

                        {bookingState.form.cliente_telefone && phoneDigits(bookingState.form.cliente_telefone).length !== 11 && (
                          <p className="booking-error">Informe um celular com 11 dígitos: DDD + número.</p>
                        )}

                        {/* Grid de pets encontrados */}
                        {Array.isArray(bookingState.foundPets) && (
                          <div className="booking-pet-found">
                            {bookingState.foundPets.length > 0 ? (
                              <>
                                <p className="booking-found-label">Selecione um pet cadastrado ou preencha os dados abaixo:</p>
                                <div className="booking-pet-grid">
                                  {bookingState.foundPets.map((p) => (
                                    <button
                                      key={p.id}
                                      type="button"
                                      className={`booking-pet-option${bookingState.form.pet_id === p.id ? " booking-pet-option--selected" : ""}`}
                                      onClick={() => updateBooking({
                                        form: {
                                          ...bookingState.form,
                                          pet_id: p.id,
                                          pet_nome: p.nome,
                                          pet_tipo: p.tipo,
                                          pet_porte: p.porte || "medio",
                                          cliente_nome: p.responsavel_nome,
                                          cliente_telefone: formatPhone(p.responsavel_tel),
                                          observacoes: p.observacoes || "",
                                        },
                                      })}
                                    >
                                      <span className="booking-pet-opt-avatar">{PET_TIPO_AVATAR[p.tipo] ?? "🐾"}</span>
                                      <span className="booking-pet-opt-name">{p.nome}</span>
                                      <span className="booking-pet-opt-detail">
                                        {PET_TIPO_LABEL[p.tipo] ?? p.tipo}
                                        {p.porte ? ` · ${PET_PORTE_LABEL[p.porte] ?? p.porte}` : ""}
                                      </span>
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    className={`booking-pet-option booking-pet-option--new${!bookingState.form.pet_id ? " booking-pet-option--selected" : ""}`}
                                    onClick={() => updateBooking({
                                      form: { ...bookingState.form, pet_id: "", pet_nome: "", pet_tipo: "cao", pet_porte: "medio", observacoes: "" },
                                    })}
                                  >
                                    <span className="booking-pet-opt-avatar">＋</span>
                                    <span className="booking-pet-opt-name">Novo pet</span>
                                  </button>
                                </div>
                              </>
                            ) : (
                              <p className="booking-found-label booking-found-none">Nenhum pet cadastrado para este número. Preencha os dados abaixo.</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── Dados do responsável ── */}
                      <label>Nome do responsável
                        <input
                          value={bookingState.form.cliente_nome}
                          onChange={(e) => updateBooking({ form: { ...bookingState.form, cliente_nome: e.target.value } })}
                          placeholder="Seu nome"
                        />
                      </label>

                      {/* ── Dados do pet ── */}
                      <label>Nome do pet
                        <input
                          value={bookingState.form.pet_nome}
                          onChange={(e) => updateBooking({ form: { ...bookingState.form, pet_nome: e.target.value, pet_id: "" } })}
                          placeholder="Nome do seu pet"
                        />
                      </label>
                      <div className="booking-row">
                        <label>Tipo
                          <select
                            value={bookingState.form.pet_tipo}
                            onChange={(e) => updateBooking({ form: { ...bookingState.form, pet_tipo: e.target.value } })}
                          >
                            {Object.entries(PET_TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </label>
                        <label>Porte
                          <select
                            value={bookingState.form.pet_porte}
                            onChange={(e) => updateBooking({ form: { ...bookingState.form, pet_porte: e.target.value } })}
                          >
                            <option value="pequeno">Pequeno</option>
                            <option value="medio">Médio</option>
                            <option value="grande">Grande</option>
                          </select>
                        </label>
                      </div>
                      <label>Observações (opcional)
                        <textarea
                          value={bookingState.form.observacoes}
                          onChange={(e) => updateBooking({ form: { ...bookingState.form, observacoes: e.target.value } })}
                          placeholder="Alergias, comportamento, preferências..."
                          rows={2}
                        />
                      </label>

                      {bookingState.form.pet_id && (
                        <p className="booking-pet-linked">✅ Vinculando ao pet cadastrado: <strong>{bookingState.form.pet_nome}</strong></p>
                      )}

                      <button
                        className="booking-next-btn"
                        disabled={!bookingState.form.cliente_nome || !bookingState.form.pet_nome || !bookingState.form.cliente_telefone}
                        onClick={() => {
                          const servicoTipo = guessServiceType(bookingState.product);
                          updateBooking({ step: "slots" });
                          bookingLoadSlots(bookingState.date, servicoTipo);
                        }}
                      >
                        Escolher horário →
                      </button>
                    </div>
                  )}

                  {bookingState.step === "slots" && (
                    <div className="booking-step">
                      <p className="booking-step-label">Escolha data e horário</p>
                      <label>Data
                        <input
                          type="date"
                          value={bookingState.date}
                          min={saoPauloDateKey()}
                          onChange={(e) => {
                            const servicoTipo = guessServiceType(bookingState.product);
                            updateBooking({ date: e.target.value, selectedSlot: null });
                            bookingLoadSlots(e.target.value, servicoTipo);
                          }}
                        />
                      </label>

                      {bookingState.slotsLoading && <p className="booking-loading">Carregando horários...</p>}
                      {bookingState.error && <p className="booking-error">{bookingState.error}</p>}

                      {!bookingState.slotsLoading && bookingState.slots.length > 0 && (
                        <div className="slot-grid">
                          {bookingState.slots.map((slot) => {
                            const key = `${slot.hora_inicio}-${slot.profissional}`;
                            const isSelected =
                              bookingState.selectedSlot?.hora_inicio === slot.hora_inicio &&
                              bookingState.selectedSlot?.profissional === slot.profissional;
                            return (
                              <button
                                key={key}
                                className={`slot-btn${!slot.available ? " slot-btn--full" : ""}${isSelected ? " slot-btn--selected" : ""}`}
                                disabled={!slot.available}
                                onClick={() => updateBooking({ selectedSlot: slot, error: "" })}
                              >
                                <span className="slot-time">{slot.hora_inicio}</span>
                                <span className="slot-prof">{slot.profissional}</span>
                                <span className="slot-cap">{slot.booked}/{slot.capacity}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="booking-step-nav">
                        <button className="booking-back-btn" onClick={() => updateBooking({ step: "form" })}>← Voltar</button>
                        <button
                          className="booking-next-btn"
                          disabled={!bookingState.selectedSlot}
                          onClick={() => updateBooking({ step: "confirm" })}
                        >
                          Confirmar →
                        </button>
                      </div>
                    </div>
                  )}

                  {bookingState.step === "confirm" && (
                    <div className="booking-step">
                      <p className="booking-step-label">Confirme o agendamento</p>
                      <div className="booking-summary">
                        <div><span>Serviço</span><strong>{bookingState.product?.name}</strong></div>
                        <div><span>Pet</span><strong>{bookingState.form.pet_nome} ({bookingState.form.pet_porte})</strong></div>
                        <div><span>Responsável</span><strong>{bookingState.form.cliente_nome}</strong></div>
                        <div><span>Celular</span><strong>{bookingState.form.cliente_telefone}</strong></div>
                        <div><span>Data</span><strong>{bookingState.date}</strong></div>
                        <div><span>Horário</span><strong>{bookingState.selectedSlot?.hora_inicio} – {bookingState.selectedSlot?.hora_fim}</strong></div>
                        <div><span>Profissional</span><strong>{bookingState.selectedSlot?.profissional}</strong></div>
                        {bookingState.form.observacoes && (
                          <div><span>Obs.</span><strong>{bookingState.form.observacoes}</strong></div>
                        )}
                      </div>
                      {bookingState.error && <p className="booking-error">{bookingState.error}</p>}
                      <div className="booking-step-nav">
                        <button className="booking-back-btn" onClick={() => updateBooking({ step: "slots" })}>← Horário</button>
                        <button
                          className="booking-next-btn"
                          disabled={bookingState.submitting}
                          onClick={bookingSubmit}
                        >
                          {bookingState.submitting ? "Enviando..." : "Confirmar agendamento"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        )}

        {phonePrompt && (
          <section className="booking-modal" role="dialog" aria-modal="true" aria-label="Identificação necessária">
            <div className="booking-modal-overlay" onClick={() => setPhonePrompt(null)} />
            <div className="booking-sheet phone-prompt-sheet">
              <div className="booking-header">
                <h3>Informe seu celular</h3>
                <button className="booking-close" onClick={() => setPhonePrompt(null)}>✕</button>
              </div>
              <p className="phone-prompt-hint">
                Precisamos do seu número para confirmar o agendamento ou pedido.
              </p>
              <input
                className="phone-prompt-input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                autoFocus
              />
              <button
                className="booking-next-btn phone-prompt-confirm"
                disabled={phoneDigits(phone).length !== 11}
                onClick={() => {
                  const fn = phonePrompt.run;
                  const currentPhone = phone;
                  setPhonePrompt(null);
                  fn(currentPhone);
                }}
              >
                Continuar
              </button>
              <button
                className="phone-prompt-skip"
                onClick={() => setPhonePrompt(null)}
              >
                Só quero navegar por enquanto
              </button>
            </div>
          </section>
        )}

        {selectedProduct && (
          <section
            className="product-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-detail-title"
            onTouchStart={handleProductDetailTouchStart}
            onTouchMove={handleProductDetailTouchMove}
          >
            <div className="product-detail-backdrop" onClick={closeSelectedProduct} />

            <article className="product-detail-sheet">
              <button className="product-detail-close" onClick={closeSelectedProduct} aria-label="Fechar produto">
                {"<"}
              </button>

              <div className="product-detail-media" data-cat={selectedProduct.category}>
                <ProductImage
                  src={selectedProduct.image}
                  alt={selectedProduct.name}
                  category={selectedProduct.category}
                />
                {serviceCategories.includes(selectedProduct.category) && (
                  <span className="detail-service-chip">
                    {categoryIcons[selectedProduct.category]} Serviço profissional
                  </span>
                )}
              </div>

              <div className="product-detail-copy">
                <span>{selectedProduct.categoryLabel}</span>
                <h2 id="product-detail-title">{selectedProduct.name}</h2>
                <p>{selectedProduct.description}</p>
                <strong>{money(selectedProduct.price)}</strong>
              </div>

              <div className="product-detail-actions">
                {serviceCategories.includes(selectedProduct.category) ? (
                  <button
                    className="product-detail-primary"
                    onClick={() => {
                      closeSelectedProduct();
                      requirePhone((currentPhone) => setBookingState({
                        open: true,
                        product: selectedProduct,
                        step: "form",
                        form: {
                          pet_id: "",
                          cliente_nome: "",
                          cliente_telefone: currentPhone,
                          pet_nome: "",
                          pet_tipo: "cao",
                          pet_porte: "medio",
                          observacoes: "",
                        },
                        foundPets: null,
                        petsSearching: false,
                        date: saoPauloDateKey(),
                        slots: [],
                        slotsLoading: false,
                        selectedSlot: null,
                        submitting: false,
                        done: false,
                        error: "",
                      }));
                    }}
                  >
                    📅 Agendar
                  </button>
                ) : (
                  <button
                    className="product-detail-primary"
                    onClick={() => addSelectedProductToCart(selectedProduct)}
                    disabled={selectedProduct.stock === 0}
                  >
                    {selectedProduct.stock === 0 ? "Indisponível" : "Adicionar ao carrinho"}
                  </button>
                )}
                <button className="product-detail-secondary" onClick={closeSelectedProduct}>
                  Fechar
                </button>
              </div>
            </article>
          </section>
        )}

        {!catalogUnavailable && activeOrders.length > 0 && (
          <button
            className="orders-footer-btn"
            onClick={() => navigateTo("orders", "/pedidos")}
          >
            Acompanhar pedidos feitos
          </button>
        )}
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
            <div className="empty-cart-visual" aria-hidden="true">
              <span></span>
              <strong>0</strong>
            </div>

            <div className="empty-cart-copy">
              <span className="eyebrow">Nada por aqui</span>
              <h2>Seu carrinho está vazio</h2>
              <p>Escolha produtos e servicos para pets e revise seu pedido aqui.</p>
            </div>

            <button onClick={() => goBack("catalogo")}>Escolher produtos</button>
          </section>
        ) : (
          <>
            <section className="cart-list">
              {cart.map((item) => (
                <article className="cart-item" key={item.id}>
                  <div className="cart-item-media">
                    <ProductImage
                      className="cart-item-image"
                      src={item.image}
                      alt={item.name}
                      category={item.category}
                    />
                  </div>

                  <div className="cart-item-info">
                    <div className="cart-item-copy">
                      <h3>{item.name}</h3>
                      <span>{money(item.price)}</span>
                    </div>

                    <div className="cart-item-actions">
                      <div className="qty-control" aria-label={`Quantidade de ${item.name}`}>
                        <button onClick={() => decreaseFromCart(item.id)} aria-label={`Diminuir ${item.name}`}>-</button>
                        <strong>{item.quantity}</strong>
                        <button onClick={() => addToCart(item)} aria-label={`Adicionar mais ${item.name}`}>+</button>
                      </div>

                      <button
                        className="remove-btn"
                        onClick={() => removeFromCart(item.id)}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <section className="cart-summary">
              <div className="cart-total-row">
                <span>Total</span>
                <strong>{money(total)}</strong>
              </div>

              <button onClick={() => navigateTo("payment")}>Finalizar pedido</button>
            </section>
          </>
        )}
      </main>
    );
  }

  if (screen === "orders") {
    return (
      <main className="app-shell cart-page orders-page">
        <header className="cart-header">
          <button onClick={() => navigateTo("catalogo", "/")} aria-label="Voltar">
            {"<"}
          </button>
          <div>
            <span className="eyebrow">Acompanhamento</span>
            <h1>Meus pedidos</h1>
          </div>
        </header>

        {activeOrders.length === 0 ? (
          <section className="empty-cart">
            <div className="empty-cart-copy">
              <span className="eyebrow">Nenhum pedido</span>
              <h2>Sem pedidos em andamento</h2>
              <p>Quando um Pix for confirmado, o pedido aparece aqui para acompanhamento.</p>
            </div>

            <button onClick={() => navigateTo("catalogo", "/")}>Fazer pedido</button>
          </section>
        ) : (
          <section className="orders-list">
            {activeOrders.map((order) => (
              <button
                className={`saved-order-card status-${order.status}`}
                key={order.statusToken}
                onClick={() => openSavedOrder(order.statusToken)}
                type="button"
              >
                <div>
                  <span>Senha</span>
                  <strong>{order.number ?? "---"}</strong>
                </div>
                <div>
                  <strong>{order.statusLabel ?? "Atualizando status"}</strong>
                  <span>{orderModeLabel(order.mode)} • {money(order.total ?? 0)}</span>
                </div>
              </button>
            ))}
          </section>
        )}

        {orderError && <p className="payment-error">{orderError}</p>}
      </main>
    );
  }

  if (screen === "payment") {
    if (pixCharge) {
      return (
        <main className="app-shell cart-page payment-page pix-waiting-page">
          <header className="cart-header">
            <button
              onClick={() => {
                setPixCharge(null);
                setPixStatusMessage("");
                goBack("cart");
              }}
              aria-label="Voltar"
            >
              {"<"}
            </button>
            <div>
              <span className="eyebrow">Pagamento Pix</span>
              <h1>Aguardando pagamento</h1>
              <p className="pix-header-subtitle">Confirme os dados e finalize sua compra</p>
            </div>
          </header>

          <section className="pix-waiting-card">
            <div className="pix-payment-summary">
              <span>Valor total a pagar</span>
              <strong>{money(pixOrderTotal)}</strong>
            </div>

            <div className="pix-qr-box">
              {pixQrDataUrl ? (
                <img
                  src={pixQrDataUrl}
                  alt="QR Code Pix"
                />
              ) : (
                <div className="pix-qr-placeholder" aria-hidden="true">
                  <strong>PIX</strong>
                  <span>QR indisponível</span>
                </div>
              )}
            </div>

            <div className="pix-copy-box">
              <label htmlFor="pix-copy-code">Código Pix</label>
              <div className="pix-copy-line">
                <input
                  id="pix-copy-code"
                  aria-label="Código Pix copia e cola"
                  readOnly
                  onFocus={(event) => event.currentTarget.select()}
                  value={pixCharge.pixCopiaECola || pixCharge.payload || ""}
                />
                <button
                  type="button"
                  aria-label="Copiar código Pix"
                  onClick={copyPixCode}
                >
                  Copiar
                </button>
              </div>
            </div>

            <button
              className="pix-copy-main-btn"
              onClick={copyPixCode}
            >
              Copiar código PIX
            </button>

            <div className="pix-status-line">
              <span>Status do pagamento:</span>
              <strong>{pixStatusMessage || "Aguardando pagamento"}</strong>
            </div>

            {pixCharge?.sandbox && (
              <div className="pix-test-badge">
                Pix em modo de teste
              </div>
            )}

            {orderError && <p className="payment-error">{orderError}</p>}

          </section>

          <div className="pix-action-row">
            <button
              className="pix-cancel-btn"
              onClick={async () => {
                setOrderError("");
                const orderId = lastOrder?.id;
                const token = trackingToken;
                resetOrderFlow();
                navigateTo("catalogo");

                if (!orderId || !token) return;

                try {
                  await cancelOrder(orderId, token);
                } catch (error) {
                  console.warn("Falha ao cancelar pedido pendente:", error);
                }
              }}
            >
              Cancelar pedido
            </button>
            <button
              className="pix-continue-btn"
              onClick={() => {
                setPixCharge(null);
                setPixStatusMessage("");
                navigateTo("catalogo");
              }}
            >
              Continuar comprando
            </button>
          </div>
        </main>
      );
    }

    return (
      <main className="app-shell cart-page payment-page">
        <header className="cart-header">
          <button onClick={() => goBack("cart")} aria-label="Voltar">
            {"<"}
          </button>
          <div>
            <span className="eyebrow">Pagamento</span>
            <h1>Como deseja pagar?</h1>
          </div>
        </header>

        <section className="payment-total">
          <span>Total do pedido</span>
          <strong>{money(orderTotal)}</strong>
          <p>{totalItems} {totalItems === 1 ? "item" : "itens"} no carrinho</p>
        </section>

        <section className="fulfillment-methods">
          <div className="fulfillment-heading">
            <span className="eyebrow">Recebimento</span>
            <strong>Como quer receber?</strong>
          </div>

          <div className="fulfillment-options">
            {fulfillmentOptions.map((option) => (
              <button
                key={option.id}
                className={fulfillmentMode === option.id ? "active" : ""}
                onClick={() => {
                  setFulfillmentMode(option.id);
                  if (option.id === "pickup") setOrderError("");
                }}
                type="button"
              >
                <span></span>
                <strong>{option.title}</strong>
                <em>{option.description}</em>
              </button>
            ))}
          </div>

          {fulfillmentMode === "delivery" && (
            <div className="delivery-address-fields">
              <label className="delivery-cep-field">
                CEP
                <div>
                  <input
                    value={deliveryCep}
                    inputMode="numeric"
                    placeholder="00000-000"
                    onChange={(event) => setDeliveryCep(formatCep(event.target.value))}
                  />
                  <button
                    type="button"
                    onClick={searchCep}
                    disabled={isSearchingCep}
                  >
                    {isSearchingCep ? "Buscando" : "Buscar"}
                  </button>
                </div>
              </label>

              <label className="delivery-address-field">
                Endereço
                <input
                  value={deliveryAddress}
                  placeholder="Rua, bairro, cidade"
                  onChange={(event) => setDeliveryAddress(event.target.value)}
                />
              </label>

              <div className="delivery-address-grid">
                <label className="delivery-address-field">
                  Número
                  <input
                    value={deliveryNumber}
                    inputMode="numeric"
                    placeholder="123"
                    onChange={(event) => setDeliveryNumber(event.target.value)}
                  />
                </label>

                <label className="delivery-address-field">
                  Complemento
                  <input
                    value={deliveryAddressNote}
                    placeholder="Apto, bloco"
                    onChange={(event) => setDeliveryAddressNote(event.target.value)}
                  />
                </label>
              </div>
            </div>
          )}
        </section>

        <section className="payment-methods">
          {["Pagar agora", "Pagar na entrega/retirada", "Cartão online"].map((section) => (
            <div className="payment-method-group" key={section}>
              <strong>{section}</strong>
              {paymentMethods
                .filter((method) => method.section === section)
                .map((method) => (
                  <button
                    key={method.id}
                    className={selectedPayment === method.id ? "active" : ""}
                    onClick={() => {
                      setSelectedPayment(method.id);
                      setPaymentNotice(method.id === "card_online" ? "Pagamento por cartão online em breve." : "");
                    }}
                    type="button"
                  >
                    <span></span>
                    <strong>{method.title}</strong>
                    <em>{method.description}</em>
                    {method.id === "card_online" && <small>Em desenvolvimento</small>}
                  </button>
                ))}
            </div>
          ))}
        </section>

        <section className="payment-actions">
          <button onClick={finishOrder} disabled={cart.length === 0 || isSubmittingOrder}>
            {isSubmittingOrder ? "Confirmando..." : "Confirmar pagamento"}
          </button>
          {paymentNotice && <p className="payment-notice">{paymentNotice}</p>}
          {orderError && <p className="payment-error">{orderError}</p>}
        </section>
      </main>
    );
  }

  if (screen === "tracking") {
    const order = trackedOrder || lastOrder;
    const currentStep = Math.max(0, orderStatusSteps.indexOf(order?.status || "received"));
    const isPreparing = order?.status === "preparing";
    const isReady = order?.status === "ready";
    const isFinished = order?.status === "finished";
    const statusCopy = orderStatusText(order);

    return (
      <main className="app-shell success-page tracking-page">
        <section className={`order-success ${isPreparing ? "is-preparing" : ""} ${isReady ? "is-ready" : ""} ${isFinished ? "is-finished" : ""}`}>
          <div className="tracking-status-card">
            <span className="eyebrow">{isFinished ? "Pedido encerrado" : "Status atualizado automaticamente"}</span>
            <strong>{statusCopy.title}</strong>
            <p>{statusCopy.body}</p>
          </div>

          <div className="tracking-number">
            <span>Sua senha</span>
            <strong>{order?.number ?? "---"}</strong>
          </div>

          {!isFinished && (
            <div className="tracking-live-note">
              <span></span>
              <strong>Atualiza sozinho a cada poucos segundos</strong>
            </div>
          )}

          <div className="order-timeline">
            {orderStatusSteps.map((status, index) => (
              <div className={index <= currentStep ? "active" : ""} key={status}>
                <span></span>
                <strong>{timelineLabel(status, order)}</strong>
              </div>
            ))}
          </div>

          <div className="success-details">
            <div>
              <span>Total</span>
              <strong>{money(order?.total ?? 0)}</strong>
            </div>
            <div>
              <span>Pagamento</span>
              <strong>{paymentStatusLabel(order)}</strong>
            </div>
          </div>

          {orderError && <p className="payment-error">{orderError}</p>}

          <div className="tracking-finished-actions">
            <button
              onClick={() => {
                resetOrderFlow();
                navigateTo("catalogo");
              }}
            >
              Fazer novo pedido
            </button>
            {activeOrders.length > 0 && (
              <button
                className="secondary-finish-btn"
                onClick={() => navigateTo("orders", "/pedidos")}
              >
                Ver meus pedidos
              </button>
            )}
            {isFinished && (
              <button
                className="secondary-finish-btn"
                onClick={() => {
                  resetOrderFlow();
                  navigateTo("login", "/");
                }}
              >
                Sair
              </button>
            )}
          </div>
        </section>
      </main>
    );
  }

  if (screen === "kitchen") {
    return (
      <main className="app-shell kitchen-page">
        <header className="cart-header">
          <button onClick={() => navigateTo("catalogo", "/")} aria-label="Voltar">
            {"<"}
          </button>
          <div>
            <span className="eyebrow">Cozinha</span>
            <h1>Pedidos em preparo</h1>
          </div>
        </header>

        {orderError && <p className="payment-error">{orderError}</p>}

        <section className="kitchen-list">
          {kitchenOrders.length === 0 ? (
            <div className="kitchen-empty">
              <strong>Nenhum pedido pendente</strong>
              <span>Novos pedidos aparecem aqui automaticamente.</span>
            </div>
          ) : (
            kitchenOrders.map((order) => (
              <article
                className={`kitchen-order status-${order.status}`}
                key={order.id}
                onClick={() => advanceKitchenStatus(order)}
              >
                <header>
                  <button
                    className="kitchen-password"
                    onClick={(event) => {
                      event.stopPropagation();
                      advanceKitchenStatus(order);
                    }}
                    aria-label={`Avançar pedido ${order.number}`}
                  >
                    <span>Senha</span>
                    <strong>{order.number}</strong>
                  </button>
                  <em>{order.statusLabel}</em>
                  <small>{paymentStatusLabel(order)} · {orderModeLabel(order.mode)}</small>
                </header>

                <ul>
                  {order.items.map((item) => (
                    <li key={`${order.id}-${item.productId}`}>
                      <span>{item.quantity}x {item.name}</span>
                    </li>
                  ))}
                </ul>

                <div className="kitchen-next-action">
                  <strong>{nextKitchenLabel(order.status, order.mode)}</strong>
                  <span>Toque no pedido ou na senha para avançar.</span>
                </div>

                <div className="kitchen-actions" onClick={(event) => event.stopPropagation()}>
                  <button onClick={() => changeKitchenStatus(order.id, "ready")}>
                    {order.mode === "delivery" ? "Saiu para entrega" : (kitchenStatuses.ready || "Pronto para retirada")}
                  </button>
                  {order.status === "ready" && (
                    <button onClick={() => changeKitchenStatus(order.id, "finished")}>
                      {kitchenStatuses.finished || "Finalizado"}
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </section>
      </main>
    );
  }

  if (screen === "admin") {
    const todayKey = saoPauloDateKey();
    const currentMonthKey = todayKey.slice(0, 7);
    const selectedPeriodOrders = adminOrders.filter((order) => {
      const parsedDate = parseServerDate(order.createdAt);
      const orderDate = Number.isNaN(parsedDate.getTime()) ? "" : saoPauloDateKey(parsedDate);
      if (!orderDate) return false;
      if (adminReportStartDate && orderDate < adminReportStartDate) return false;
      if (adminReportEndDate && orderDate > adminReportEndDate) return false;
      return true;
    });
    const scopedAdminOrders = adminReportStartDate || adminReportEndDate ? selectedPeriodOrders : adminOrders;
    const visibleAdminOrders = adminOrderFilter === "all"
      ? scopedAdminOrders
      : scopedAdminOrders.filter((order) => order.status === adminOrderFilter);
    const openAdminOrders = scopedAdminOrders.filter((order) => order.status !== "finished");
    const paidAdminOrders = scopedAdminOrders.filter((order) => order.paymentStatus === "paid" || order.statusPagamento === "pago");
    const pendingAdminOrders = scopedAdminOrders.filter((order) => order.paymentStatus !== "paid" && order.statusPagamento !== "pago");
    const adminRevenue = paidAdminOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const averageTicket = paidAdminOrders.length ? adminRevenue / paidAdminOrders.length : 0;
    const ordersToday = scopedAdminOrders.filter((order) => (order.createdAt || "").slice(0, 10) === todayKey);
    const ordersThisMonth = scopedAdminOrders.filter((order) => (order.createdAt || "").slice(0, 7) === currentMonthKey);
    const revenueToday = ordersToday.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const revenueThisMonth = ordersThisMonth.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const reportPeriodOrders = scopedAdminOrders;
    const reportPeriodRevenue = scopedAdminOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const activePeriodLabel = adminReportStartDate || adminReportEndDate
      ? `${adminReportStartDate || "início"} até ${adminReportEndDate || "hoje"}`
      : "Todo o histórico carregado";
    const adminModuleCards = [
      {
        id: "vendas",
        icon: "🛒",
        label: "Vendas",
        description: "Acompanhar pedidos, status, valores e período.",
        metric: openAdminOrders.length,
        metricLabel: "em aberto"
      },
      {
        id: "produtos",
        icon: "📦",
        label: "Produtos",
        description: "Cadastrar itens, preços, estoque e imagens.",
        metric: adminDashboard?.totalProducts ?? adminProducts.length,
        metricLabel: "cadastrados"
      },
      {
        id: "servicos",
        icon: "✂️",
        label: "Serviços",
        description: "Gerenciar serviços agendáveis e preços.",
        metric: adminProducts.filter((p) => p.tipo === "servico").length,
        metricLabel: "serviços ativos"
      },
      {
        id: "relatorios",
        icon: "📊",
        label: "Relatórios",
        description: "Consultar produto, recebimento ou intervalo.",
        metric: money(adminRevenue),
        metricLabel: "no período"
      },
      {
        id: "promocoes",
        icon: "🏷",
        label: "Promoções",
        description: "Organizar chamadas e destaques comerciais.",
        metric: adminDashboard?.totalPromotions ?? adminPromotions.length,
        metricLabel: "cadastradas"
      },
      {
        id: "agenda",
        icon: "📅",
        label: "Agenda",
        description: "Visualizar e gerenciar agendamentos de serviços.",
        metric: adminAppointments.filter((a) => a.status === "agendado" || a.status === "confirmado").length,
        metricLabel: "pendentes hoje"
      },
      {
        id: "pets",
        icon: "🐾",
        label: "Pets",
        description: "Cadastro, ficha e histórico de cada pet.",
        metric: adminPets.filter((p) => p.ativo).length,
        metricLabel: "cadastrados"
      },
      {
        id: "painel-ops",
        icon: "⚙️",
        label: "Painel Ops",
        description: "Operacional em tempo real — clínica e banho.",
        metric: adminAppointments.filter((a) => a.status === "em_atendimento").length,
        metricLabel: "em atendimento"
      },
    ];
    const statusBuckets = [
      {
        id: "awaiting_payment",
        label: "Abertos",
        className: "danger",
        orders: scopedAdminOrders.filter((order) => order.status === "awaiting_payment")
      },
      {
        id: "received",
        label: "Recebidos",
        className: "info",
        orders: scopedAdminOrders.filter((order) => order.status === "received")
      },
      {
        id: "preparing",
        label: "Produção",
        className: "warning",
        orders: scopedAdminOrders.filter((order) => order.status === "preparing")
      },
      {
        id: "ready",
        label: "Entrega/retirada",
        className: "primary",
        orders: scopedAdminOrders.filter((order) => order.status === "ready")
      },
      {
        id: "finished",
        label: "Finalizados",
        className: "success",
        orders: scopedAdminOrders.filter((order) => order.status === "finished")
      }
    ];
    const productSales = Object.values(scopedAdminOrders.reduce((acc, order) => {
      (order.items || []).forEach((item) => {
        const key = item.productId || item.id || item.name;
        const current = acc[key] || { name: item.name, quantity: 0, total: 0 };
        current.quantity += Number(item.quantity || 0);
        current.total += Number(item.price || 0) * Number(item.quantity || 0);
        acc[key] = current;
      });
      return acc;
    }, {})).sort((a, b) => b.total - a.total);
    const productReportRows = Object.values(scopedAdminOrders.reduce((acc, order) => {
      const paymentText = `${order.formaPagamento || ""} ${order.paymentMethod || ""} ${order.textoFormaPagamento || ""}`.toLowerCase();
      const paymentColumn = paymentText.includes("pix")
        ? "pix"
        : paymentText.includes("cart")
          ? "card"
          : paymentText.includes("dinheiro")
            ? "cash"
            : "other";
      const isOpen = order.status !== "finished";

      (order.items || []).forEach((item) => {
        const key = item.productId || item.id || item.name;
        const itemTotal = Number(item.price || 0) * Number(item.quantity || 0);
        const current = acc[key] || {
          name: item.name,
          quantity: 0,
          total: 0,
          pix: 0,
          card: 0,
          cash: 0,
          other: 0,
          open: 0
        };
        current.quantity += Number(item.quantity || 0);
        current.total += itemTotal;
        current[paymentColumn] += itemTotal;
        if (isOpen) current.open += itemTotal;
        acc[key] = current;
      });
      return acc;
    }, {})).sort((a, b) => b.total - a.total);
    const paymentSales = Object.values(scopedAdminOrders.reduce((acc, order) => {
      const label = order.textoFormaPagamento || order.paymentMethod || "Não informado";
      const current = acc[label] || { label, quantity: 0, total: 0 };
      current.quantity += 1;
      current.total += Number(order.total || 0);
      acc[label] = current;
      return acc;
    }, {})).sort((a, b) => b.total - a.total);

    return (
      <main className="app-shell admin-page">
        <header className="cart-header">
          <button
            onClick={() => {
              if (adminToken) {
                handleAdminLogout();
              } else {
                navigateTo("login", "/");
              }
            }}
            aria-label="Voltar"
          >
            {"<"}
          </button>
          <div>
            <span className="eyebrow">Administração</span>
            <h1>Painel de controle</h1>
          </div>
          {adminToken && (
            <div className="admin-header-right">
              {adminError && adminTab !== "painel-ops" && (
                <div className="admin-header-error" role="alert">
                  <span>⚠</span>
                  <span>{adminError}</span>
                </div>
              )}
              <button className="admin-exit-btn" onClick={handleAdminLogout}>
                Sair
              </button>
            </div>
          )}
        </header>

        {!adminToken ? (
          <section className="admin-login-card">
            <div className="admin-login-copy">
              <span className="eyebrow">Acesso restrito</span>
              <h2>Entre para controlar vendas, produtos e promoções.</h2>
              <p>Use o login administrativo do sistema.</p>
            </div>

            <form className="admin-login-form" onSubmit={handleAdminLogin}>
              <label>Usuário</label>
              <input
                value={adminCredentials.username}
                onChange={(event) => setAdminCredentials((current) => ({ ...current, username: event.target.value }))}
                autoComplete="username"
              />

              <label>Senha</label>
              <input
                type="password"
                value={adminCredentials.password}
                onChange={(event) => setAdminCredentials((current) => ({ ...current, password: event.target.value }))}
                autoComplete="current-password"
              />

              <button type="submit" disabled={adminLoading}>
                {adminLoading ? "Entrando..." : "Entrar"}
              </button>
            </form>

            {adminError && <p className="payment-error">{adminError}</p>}
          </section>
        ) : (
          <>
            {adminTab === "painel-ops" && (
              <div style={{ position: "fixed", inset: 0, zIndex: 200, overflow: "hidden" }}>
                <PainelServicos onSair={() => setAdminTab("inicio")} />
              </div>
            )}

            <section className="admin-hero-panel">
              <div>
                <span className="eyebrow">Administração</span>
                <h2>{adminTab === "inicio" ? "O que você quer fazer agora?" : adminTabs.find((tab) => tab.id === adminTab)?.label}</h2>
                <p>{adminTab === "inicio" ? "Escolha uma área. A tela só abre os dados depois do clique." : adminTabs.find((tab) => tab.id === adminTab)?.description}</p>
              </div>
              <button onClick={() => loadAdminData(adminToken)} disabled={adminLoading}>
                {adminLoading ? "Atualizando..." : "Atualizar painel"}
              </button>
            </section>

            {adminTab === "inicio" && (
            <section className="admin-summary-grid">
              <div className="admin-summary-card">
                <span>Pedidos totais</span>
                <strong>{adminDashboard?.totalOrders ?? 0}</strong>
                <small>{openAdminOrders.length} em aberto</small>
              </div>
              <div className="admin-summary-card">
                <span>Faturamento pago</span>
                <strong>{money(adminRevenue)}</strong>
                <small>Ticket médio {money(averageTicket)}</small>
              </div>
              <div className="admin-summary-card">
                <span>Produtos ativos</span>
                <strong>{adminDashboard?.totalProducts ?? 0}</strong>
                <small>{adminDashboard?.lowStock ?? 0} com estoque baixo</small>
              </div>
              <div className="admin-summary-card">
                <span>Pagamentos pendentes</span>
                <strong>{adminDashboard?.pendingPayments ?? pendingAdminOrders.length}</strong>
                <small>{adminDashboard?.totalPromotions ?? 0} promoções cadastradas</small>
              </div>
            </section>
            )}

            <section className={adminTab === "inicio" ? "admin-main-grid admin-main-grid-home" : "admin-main-grid"}>
              {adminTab !== "inicio" && (
              <aside className="admin-side-menu">
                <div>
                  <span className="eyebrow">Menu</span>
                  <strong>Administração</strong>
                </div>
                <nav className="admin-tabs" aria-label="Menu administrativo">
                  {adminTabs.map((tab) => (
                    <button
                      key={tab.id}
                      className={adminTab === tab.id ? "active" : ""}
                      onClick={() => {
                        setAdminTab(tab.id);
                        if (tab.id === "agenda") loadAgenda(adminAgendaDate, adminAgendaTipo);
                        if (tab.id === "pets")   loadPets();
                      }}
                    >
                      <span>{tab.icon}</span>
                      <strong>{tab.label}</strong>
                      <small>{tab.description}</small>
                    </button>
                  ))}
                </nav>
              </aside>
              )}

              <section className={`admin-content-stack ${adminTab === "relatorios" ? "admin-content-reports" : ""} ${adminTab === "agenda" || adminTab === "pets" ? "admin-content-agenda" : ""}`}>
                {adminTab !== "inicio" && adminTab !== "relatorios" && adminTab !== "agenda" && adminTab !== "pets" && adminTab !== "painel-ops" && (
                <div className="admin-section-title">
                  <div>
                    <span className="eyebrow">Área selecionada</span>
                    <h2>{adminTabs.find((tab) => tab.id === adminTab)?.label}</h2>
                  </div>
                  <p>{adminTabs.find((tab) => tab.id === adminTab)?.description}</p>
                </div>
                )}

                {adminTab === "vendas" && (
                  <section className="admin-period-panel">
                    <div>
                      <span className="eyebrow">Período de análise</span>
                      <strong>{activePeriodLabel}</strong>
                    </div>
                    <div className="admin-period-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setAdminReportStartDate("");
                          setAdminReportEndDate("");
                          setAdminPeriodOpen(false);
                        }}
                      >
                        Tudo
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAdminReportStartDate(todayKey);
                          setAdminReportEndDate(todayKey);
                          setAdminPeriodOpen(false);
                        }}
                      >
                        Hoje
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAdminReportStartDate(`${currentMonthKey}-01`);
                          setAdminReportEndDate(todayKey);
                          setAdminPeriodOpen(false);
                        }}
                      >
                        Este mês
                      </button>
                      <button type="button" className="admin-calendar-btn" onClick={() => setAdminPeriodOpen((current) => !current)}>
                        Calendário
                      </button>
                    </div>
                    {adminPeriodOpen && (
                      <div className="admin-date-filters">
                        <label>
                          Data inicial
                          <input type="date" value={adminReportStartDate} onChange={(event) => setAdminReportStartDate(event.target.value)} />
                        </label>
                        <label>
                          Data final
                          <input type="date" value={adminReportEndDate} onChange={(event) => setAdminReportEndDate(event.target.value)} />
                        </label>
                      </div>
                    )}
                  </section>
                )}

            {adminTab === "inicio" && (
              <section className="admin-home-grid">
                {adminModuleCards.map((card) => (
                  <button className="admin-home-card" key={card.id} onClick={() => { setAdminTab(card.id); if (card.id === "agenda") loadAgenda(adminAgendaDate, adminAgendaTipo); if (card.id === "pets") loadPets(); }}>
                    <div className="ahc-body">
                      <strong className="ahc-label">{card.label}</strong>
                      <em className="ahc-desc">{card.description}</em>
                    </div>
                    <div className="ahc-metric">
                      <strong>{card.metric}</strong>
                      <small>{card.metricLabel}</small>
                    </div>
                  </button>
                ))}
              </section>
            )}

            {adminTab === "resumo" && (
              <section className="admin-panel">
                <div className="admin-panel-head">
                  <div>
                    <span className="eyebrow">Vendas recentes</span>
                    <h2>Pedidos mais novos</h2>
                  </div>
                  <button onClick={() => loadAdminData(adminToken)}>Atualizar</button>
                </div>

                {adminLoading && <p className="admin-muted">Carregando painel...</p>}

                <div className="admin-order-list">
                  {adminOrders.slice(0, 8).map((order) => (
                    <article className="admin-order-row" key={order.id}>
                      <strong>#{order.number}</strong>
                      <span>{order.statusLabel} · {orderModeLabel(order.mode)}</span>
                      <em>{money(order.total)}</em>
                      <small>{paymentStatusLabel(order)}</small>
                    </article>
                  ))}
                  {adminOrders.length === 0 && <p className="admin-muted">Nenhuma venda registrada ainda.</p>}
                </div>
              </section>
            )}

            {adminTab === "vendas" && (
              <section className="admin-panel">
                <div className="admin-panel-head">
                  <div>
                    <span className="eyebrow">Controle de vendas</span>
                    <h2>Pedidos cadastrados</h2>
                  </div>
                  <select value={adminOrderFilter} onChange={(event) => setAdminOrderFilter(event.target.value)}>
                    <option value="all">Todos</option>
                    <option value="awaiting_payment">Aguardando pagamento</option>
                    <option value="received">Recebido</option>
                    <option value="preparing">Em preparo</option>
                    <option value="ready">Pronto</option>
                    <option value="finished">Finalizado</option>
                  </select>
                </div>

                <section className="admin-status-grid">
                  {statusBuckets.map((bucket) => (
                    <button
                      type="button"
                      key={bucket.id}
                      className={`admin-status-tile ${bucket.className} ${adminOrderFilter === bucket.id ? "active" : ""}`}
                      onClick={() => setAdminOrderFilter(bucket.id)}
                    >
                      <span>{bucket.label}</span>
                      <strong>{bucket.orders.length}</strong>
                    </button>
                  ))}
                </section>

                <div className="admin-matrix-wrap">
                  <table className="admin-matrix-table admin-orders-matrix">
                    <thead>
                      <tr>
                        <th>Pedido</th>
                        <th>Cliente</th>
                        <th>Status</th>
                        <th>Recebimento</th>
                        <th>Entrega</th>
                        <th>Total</th>
                        <th>Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleAdminOrders.map((order) => (
                        <tr key={order.id} className={`order-status-${order.status}`}>
                          <td>#{order.number}</td>
                          <td>
                            <span className="admin-customer-cell">
                              <strong>{order.phone || "Sem celular"}</strong>
                              {order.customerEmail && <small>{order.customerEmail}</small>}
                            </span>
                          </td>
                          <td><span className={`admin-status-pill ${order.status}`}>{order.statusLabel}</span></td>
                          <td>{paymentStatusLabel(order)}</td>
                          <td>{orderModeLabel(order.mode)}</td>
                          <td>{money(order.total)}</td>
                          <td>{formatDateTime(order.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <section className="admin-mini-grid admin-legacy-sales-summary">
                  <div>
                    <span>Vendas em aberto</span>
                    <strong>{openAdminOrders.length}</strong>
                  </div>
                  <div>
                    <span>Hoje</span>
                    <strong>{money(revenueToday)}</strong>
                  </div>
                  <div>
                    <span>Este mês</span>
                    <strong>{money(revenueThisMonth)}</strong>
                  </div>
                </section>

                <div className="admin-order-table admin-legacy-order-cards">
                  <div className="admin-table-header">
                    <span>Pedido</span>
                    <span>Valor / entrega</span>
                    <span>Recebimento / data</span>
                  </div>
                  {visibleAdminOrders.map((order) => (
                    <article className="admin-order-card" key={order.id}>
                      <div>
                        <strong>#{order.number}</strong>
                        <span>{order.statusLabel}</span>
                        <small>{order.customerEmail ? `${order.phone || "Sem celular"} · ${order.customerEmail}` : (order.phone || "Sem celular")}</small>
                      </div>
                      <div>
                        <strong>{money(order.total)}</strong>
                        <span>{orderModeLabel(order.mode)}</span>
                      </div>
                      <div>
                        <span>{paymentStatusLabel(order)}</span>
                        <small>{formatDateTime(order.createdAt)}</small>
                      </div>
                    </article>
                  ))}
                  {visibleAdminOrders.length === 0 && <p className="admin-muted">Nenhum pedido encontrado para este filtro.</p>}
                </div>
              </section>
            )}

            {adminTab === "produtos" && (
              <div className="pf-layout">

                {/* ── Formulário horizontal ── */}
                <form className="admin-panel pf-form" onSubmit={saveProduct}>
                  <div className="admin-panel-head">
                    <div>
                      <span className="eyebrow">Catálogo</span>
                      <h2>{editingProductId ? "Editar produto" : "Novo produto"}</h2>
                    </div>
                  </div>

                  <div className="pf-horiz-body">

                    {/* Coluna imagem */}
                    <div className="pf-col-img">
                      {/* Card de preview — clique abre seletor de arquivo */}
                      <label className="pf-img-card" htmlFor="pf-img-file">
                        {productDraft.image ? (
                          <img
                            src={productDraft.image}
                            alt=""
                            className="pf-img-preview"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              if (e.currentTarget.nextElementSibling) {
                                e.currentTarget.nextElementSibling.style.display = "flex";
                              }
                            }}
                          />
                        ) : null}
                        <span className="pf-img-placeholder" style={productDraft.image ? { display: "none" } : {}}>
                          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                          </svg>
                          <span>Adicionar<br />imagem</span>
                        </span>
                      </label>

                      {/* Rodapé: botão + status (filename + limpar) */}
                      <div className="pf-img-footer">
                        <label className="pf-img-btn" htmlFor="pf-img-file">
                          {adminLoading ? "Enviando…" : "Enviar imagem"}
                        </label>
                        <div className="pf-img-status">
                          <span className="pf-img-filename">
                            {productDraft.image
                              ? productDraft.image.split("/").pop()
                              : "Nenhuma imagem"}
                          </span>
                          {productDraft.image && (
                            <button
                              type="button"
                              className="pf-img-clear"
                              title="Remover imagem"
                              onClick={() => setProductDraft((c) => ({ ...c, image: "" }))}
                            >×</button>
                          )}
                        </div>
                      </div>

                      {/* Input de arquivo (oculto, compartilhado) */}
                      <input
                        id="pf-img-file"
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          try {
                            setAdminLoading(true);
                            const result = await uploadProductImage(file, adminToken);
                            setProductDraft((c) => ({ ...c, image: result.path }));
                          } catch (err) {
                            setAdminError(err.message);
                          } finally {
                            setAdminLoading(false);
                          }
                        }}
                      />
                    </div>

                    {/* Coluna campos */}
                    <div className="pf-col-fields">
                      <div className="pf-fields-grid">
                        <div className="pf-field-full">
                          <label>Nome</label>
                          <input value={productDraft.name} onChange={(e) => setProductDraft((c) => ({ ...c, name: e.target.value }))} placeholder="Ex: Ração Premium Cães Adultos" />
                        </div>
                        <div className="pf-field-full">
                          <label>Descrição</label>
                          <textarea value={productDraft.description} onChange={(e) => setProductDraft((c) => ({ ...c, description: e.target.value }))} placeholder="Descreva o produto brevemente…" />
                        </div>
                        <div>
                          <label>Preço (R$)</label>
                          <input type="number" step="0.01" value={productDraft.price} onChange={(e) => setProductDraft((c) => ({ ...c, price: e.target.value }))} />
                        </div>
                        <div>
                          <label>Estoque (unid.)</label>
                          <input type="number" value={productDraft.stock} onChange={(e) => setProductDraft((c) => ({ ...c, stock: e.target.value }))} />
                        </div>
                      </div>

                      <div className="pf-toggles">
                        <label className={`pf-toggle-pill pf-toggle-ativo ${productDraft.ativo ? "on" : "off"}`}>
                          <input type="checkbox" checked={productDraft.ativo} onChange={(e) => setProductDraft((c) => ({ ...c, ativo: e.target.checked }))} />
                          {productDraft.ativo ? "Ativo" : "Inativo"}
                        </label>
                        <label className={`pf-toggle-pill ${productDraft.promo ? "on" : ""}`}>
                          <input type="checkbox" checked={productDraft.promo} onChange={(e) => setProductDraft((c) => ({ ...c, promo: e.target.checked }))} />
                          Promoção
                        </label>
                        <label className={`pf-toggle-pill ${productDraft.combo ? "on" : ""}`}>
                          <input type="checkbox" checked={productDraft.combo} onChange={(e) => setProductDraft((c) => ({ ...c, combo: e.target.checked }))} />
                          Combo
                        </label>
                      </div>

                      <div className="pf-form-footer">
                        {editingProductId && (
                          <button type="button" className="pf-btn-cancel" onClick={() => { setEditingProductId(""); setProductDraft(emptyProductDraft()); }}>
                            Cancelar
                          </button>
                        )}
                        <button type="submit" className="pf-btn-save" disabled={adminLoading}>
                          {adminLoading ? "Salvando…" : editingProductId ? "Salvar alterações" : "Cadastrar produto"}
                        </button>
                      </div>
                    </div>

                  </div>
                </form>

                {/* ── Lista em tabela ── */}
                <section className="admin-panel pft-panel">
                  <div className="admin-panel-head pft-head-bar">
                    <div>
                      <span className="eyebrow">Produtos físicos</span>
                      <h2>Lista cadastrada</h2>
                    </div>
                    <div className="pft-toolbar">
                      <div className="pf-search-bar pf-search-bar--inline">
                        <input
                          type="search"
                          placeholder="Buscar produto…"
                          value={adminProductSearch}
                          onChange={(e) => setAdminProductSearch(e.target.value)}
                        />
                      </div>
                      <button onClick={() => loadAdminData(adminToken)}>↻ Atualizar</button>
                    </div>
                  </div>

                  <div className="pft-table">
                    <div className="pft-head-row">
                      <span></span>
                      <span>Nome</span>
                      <span>Categoria</span>
                      <span>Preço</span>
                      <span>Estoque</span>
                      <span>Status</span>
                      <span></span>
                    </div>

                    {adminProducts
                      .filter((p) => p.tipo !== "servico")
                      .filter((p) => !adminProductSearch || p.name.toLowerCase().includes(adminProductSearch.toLowerCase()))
                      .map((product) => (
                        <div className={`pft-row${product.ativo === false ? " pft-row--inactive" : ""}`} key={product.id}>
                          <img className="pft-img" src={product.image} alt={product.name} />
                          <span className="pft-name">{product.name}</span>
                          <span className="pft-cat">{product.categoryLabel}</span>
                          <span className="pft-price">{money(product.price)}</span>
                          <span className="pft-stock">{product.stock}</span>
                          <span className="pft-status">
                            {product.ativo === false
                              ? <span className="admin-badge-inactive">Inativo</span>
                              : <span className="pft-badge-active">Ativo</span>
                            }
                          </span>
                          <div className="pft-actions">
                            <button className="pft-btn pft-btn-edit" onClick={() => startEditingProduct(product)}>Editar</button>
                            <button className="pft-btn pft-btn-del" onClick={() => removeAdminProduct(product.id)}>Excluir</button>
                          </div>
                        </div>
                      ))}

                    {adminProducts.filter((p) => p.tipo !== "servico").length === 0 && !adminError && (
                      <p className="admin-muted pft-empty">Nenhum produto cadastrado.</p>
                    )}
                    {adminProductSearch && adminProducts.filter((p) => p.tipo !== "servico").filter((p) => p.name.toLowerCase().includes(adminProductSearch.toLowerCase())).length === 0 && (
                      <p className="admin-muted pft-empty">Nenhum produto encontrado para "{adminProductSearch}".</p>
                    )}
                  </div>
                </section>

              </div>
            )}

            {adminTab === "servicos" && (
              <div className="pf-layout">

                {/* ── Formulário de serviço ── */}
                <form className="admin-panel pf-form" onSubmit={saveService}>
                  <div className="admin-panel-head">
                    <div>
                      <span className="eyebrow">Catálogo</span>
                      <h2>{editingServiceId ? "Editar serviço" : "Novo serviço"}</h2>
                    </div>
                  </div>

                  <div className="pf-horiz-body">

                    {/* Coluna imagem — mesmo padrão de Produtos */}
                    <div className="pf-col-img">
                      <label className="pf-img-card" htmlFor="sf-img-file">
                        {serviceDraft.image ? (
                          <img
                            src={serviceDraft.image}
                            alt=""
                            className="pf-img-preview"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              if (e.currentTarget.nextElementSibling) {
                                e.currentTarget.nextElementSibling.style.display = "flex";
                              }
                            }}
                          />
                        ) : null}
                        <span className="pf-img-placeholder" style={serviceDraft.image ? { display: "none" } : {}}>
                          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                          </svg>
                          <span>Adicionar<br />imagem</span>
                        </span>
                      </label>

                      <div className="pf-img-footer">
                        <label className="pf-img-btn" htmlFor="sf-img-file">
                          {adminLoading ? "Enviando…" : "Enviar imagem"}
                        </label>
                        <div className="pf-img-status">
                          <span className="pf-img-filename">
                            {serviceDraft.image
                              ? serviceDraft.image.split("/").pop()
                              : "Nenhuma imagem"}
                          </span>
                          {serviceDraft.image && (
                            <button
                              type="button"
                              className="pf-img-clear"
                              title="Remover imagem"
                              onClick={() => setServiceDraft((c) => ({ ...c, image: "" }))}
                            >×</button>
                          )}
                        </div>
                      </div>

                      <input
                        id="sf-img-file"
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          try {
                            setAdminLoading(true);
                            const result = await uploadProductImage(file, adminToken);
                            setServiceDraft((c) => ({ ...c, image: result.path }));
                          } catch (err) {
                            setAdminError(err.message);
                          } finally {
                            setAdminLoading(false);
                          }
                        }}
                      />
                    </div>

                    {/* Coluna campos */}
                    <div className="pf-col-fields">
                      <div className="pf-fields-grid">
                        <div className="pf-field-full">
                          <label>Nome</label>
                          <input
                            value={serviceDraft.name}
                            onChange={(e) => setServiceDraft((c) => ({ ...c, name: e.target.value }))}
                            placeholder="Ex: Banho completo cão pequeno porte"
                          />
                        </div>
                        <div className="pf-field-full">
                          <label>Descrição</label>
                          <textarea
                            value={serviceDraft.description}
                            onChange={(e) => setServiceDraft((c) => ({ ...c, description: e.target.value }))}
                            placeholder="Descreva o serviço brevemente…"
                          />
                        </div>
                        <div className="pf-field-full">
                          <label>Tipo</label>
                          <select
                            value={serviceDraft.category}
                            onChange={(e) => setServiceDraft((c) => ({
                              ...c,
                              category: e.target.value,
                              categoryLabel: categoryLabelFor(e.target.value) || e.target.value,
                            }))}
                          >
                            <option value="banho_tosa">Banho & Tosa</option>
                            <option value="clinica">Clínica</option>
                            <option value="comunidade">Comunidade</option>
                          </select>
                        </div>
                        <div>
                          <label>Preço (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={serviceDraft.price}
                            onChange={(e) => setServiceDraft((c) => ({ ...c, price: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="pf-toggles">
                        <label className={`pf-toggle-pill pf-toggle-ativo ${serviceDraft.ativo ? "on" : "off"}`}>
                          <input
                            type="checkbox"
                            checked={serviceDraft.ativo}
                            onChange={(e) => setServiceDraft((c) => ({ ...c, ativo: e.target.checked }))}
                          />
                          {serviceDraft.ativo ? "Ativo" : "Inativo"}
                        </label>
                      </div>

                      <div className="pf-form-footer">
                        {editingServiceId && (
                          <button
                            type="button"
                            className="pf-btn-cancel"
                            onClick={() => { setEditingServiceId(""); setServiceDraft(emptyServiceDraft()); }}
                          >
                            Cancelar
                          </button>
                        )}
                        <button type="submit" className="pf-btn-save" disabled={adminLoading}>
                          {editingServiceId ? "Salvar serviço" : "Cadastrar serviço"}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>

                {/* ── Tabela de serviços ── */}
                <section className="admin-panel pft-panel">
                  <div className="admin-panel-head pft-head-bar">
                    <div>
                      <span className="eyebrow">Serviços agendáveis</span>
                      <h2>Lista cadastrada</h2>
                    </div>
                    <div className="pft-toolbar">
                      <div className="pf-search-bar pf-search-bar--inline">
                        <input
                          type="search"
                          placeholder="Buscar serviço…"
                          value={adminServiceSearch}
                          onChange={(e) => setAdminServiceSearch(e.target.value)}
                        />
                      </div>
                      <button onClick={() => loadAdminData(adminToken)}>↻ Atualizar</button>
                    </div>
                  </div>

                  <div className="pft-table">
                    <div className="pft-head-row sft-head-row">
                      <span></span>
                      <span>Nome</span>
                      <span>Tipo</span>
                      <span>Preço</span>
                      <span>Status</span>
                      <span></span>
                    </div>

                    {adminProducts
                      .filter((p) => p.tipo === "servico")
                      .filter((p) => !adminServiceSearch || p.name.toLowerCase().includes(adminServiceSearch.toLowerCase()))
                      .map((service) => (
                        <div
                          className={`pft-row sft-row${service.ativo === false ? " pft-row--inactive" : ""}`}
                          key={service.id}
                        >
                          <img
                            className="pft-img"
                            src={service.image}
                            alt={service.name}
                            onError={(e) => { e.currentTarget.style.opacity = "0"; }}
                          />
                          <span className="pft-name">{service.name}</span>
                          <span className="pft-cat">{service.categoryLabel}</span>
                          <span className="pft-price">{money(service.price)}</span>
                          <span className="pft-status">
                            {service.ativo === false
                              ? <span className="admin-badge-inactive">Inativo</span>
                              : <span className="pft-badge-active">Ativo</span>}
                          </span>
                          <div className="pft-actions">
                            <button className="pft-btn pft-btn-edit" onClick={() => startEditingService(service)}>Editar</button>
                            <button className="pft-btn pft-btn-del" onClick={() => removeAdminService(service.id)}>Excluir</button>
                          </div>
                        </div>
                      ))}

                    {adminProducts.filter((p) => p.tipo === "servico").length === 0 && !adminError && (
                      <div className="pft-empty">Nenhum serviço cadastrado.</div>
                    )}
                    {adminServiceSearch && adminProducts.filter((p) => p.tipo === "servico").filter((p) => p.name.toLowerCase().includes(adminServiceSearch.toLowerCase())).length === 0 && (
                      <p className="admin-muted pft-empty">Nenhum serviço encontrado para "{adminServiceSearch}".</p>
                    )}
                  </div>
                </section>

              </div>
            )}

            {adminTab === "relatorios" && (
              <section className="admin-panel">
                <div className="admin-panel-head admin-report-heading">
                  <div>
                    <span className="eyebrow">Relatórios sob demanda</span>
                    <h2>Escolha o relatório que deseja consultar</h2>
                  </div>
                </div>

                <div className="admin-report-menu">
                  <button className={adminReportMode === "periodo" ? "active" : ""} onClick={() => setAdminReportMode("periodo")}>
                    <strong>Vendas por período</strong>
                    <span>Informe data inicial e final para apurar vendas.</span>
                  </button>
                  <button className={adminReportMode === "produto" ? "active" : ""} onClick={() => setAdminReportMode("produto")}>
                    <strong>Vendas por produto</strong>
                    <span>Veja os produtos com maior quantidade e valor vendido.</span>
                  </button>
                  <button className={adminReportMode === "recebimento" ? "active" : ""} onClick={() => setAdminReportMode("recebimento")}>
                    <strong>Modo de recebimento</strong>
                    <span>Compare Pix, cartão, dinheiro e outros meios.</span>
                  </button>
                  <button className={adminReportMode === "abertos" ? "active" : ""} onClick={() => setAdminReportMode("abertos")}>
                    <strong>Vendas em aberto</strong>
                    <span>Liste pedidos que ainda não foram finalizados.</span>
                  </button>
                </div>

                {!adminReportMode && (
                  <div className="admin-empty-state">
                    <strong>Selecione uma opção acima</strong>
                    <span>Os dados aparecem somente depois que você escolhe o relatório.</span>
                  </div>
                )}

                {adminReportMode === "periodo" && (
                  <section className="admin-report-result">
                    <div className="admin-report-toolbar">
                      <strong>{activePeriodLabel}</strong>
                      <button type="button" className="admin-calendar-btn" aria-label="Selecionar intervalo" onClick={() => setAdminPeriodOpen((current) => !current)}>
                        Calendário
                      </button>
                    </div>

                    <div className={adminPeriodOpen ? "admin-date-filters" : "admin-date-filters admin-report-date-legacy"}>
                      <label>
                        Data inicial
                        <input type="date" value={adminReportStartDate} onChange={(event) => setAdminReportStartDate(event.target.value)} />
                      </label>
                      <label>
                        Data final
                        <input type="date" value={adminReportEndDate} onChange={(event) => setAdminReportEndDate(event.target.value)} />
                      </label>
                    </div>

                    <div className="admin-report-list admin-report-period-summary">
                      <article>
                        <span>Pedidos no período</span>
                        <strong>{reportPeriodOrders.length}</strong>
                        <small>{activePeriodLabel}</small>
                      </article>
                      <article>
                        <span>Total vendido</span>
                        <strong>{money(reportPeriodRevenue)}</strong>
                        <small>Soma dos pedidos filtrados</small>
                      </article>
                    </div>

                    <div className="admin-matrix-wrap">
                      <table className="admin-matrix-table admin-orders-matrix">
                        <thead>
                          <tr>
                            <th>Pedido</th>
                            <th>Status</th>
                            <th>Recebimento</th>
                            <th>Entrega</th>
                            <th>Total</th>
                            <th>Data</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportPeriodOrders.map((order) => (
                            <tr key={order.id} className={`order-status-${order.status}`}>
                              <td>#{order.number}</td>
                              <td><span className={`admin-status-pill ${order.status}`}>{order.statusLabel}</span></td>
                              <td>{paymentStatusLabel(order)}</td>
                              <td>{orderModeLabel(order.mode)}</td>
                              <td>{money(order.total)}</td>
                              <td>{formatDateTime(order.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="admin-order-table admin-report-date-legacy">
                      {reportPeriodOrders.map((order) => (
                        <article className="admin-order-card" key={order.id}>
                          <div>
                            <strong>#{order.number}</strong>
                            <span>{order.statusLabel}</span>
                          </div>
                          <div>
                            <strong>{money(order.total)}</strong>
                            <span>{orderModeLabel(order.mode)}</span>
                          </div>
                          <div>
                            <span>{paymentStatusLabel(order)}</span>
                            <small>{formatDateTime(order.createdAt)}</small>
                          </div>
                        </article>
                      ))}
                      {reportPeriodOrders.length === 0 && <p className="admin-muted">Nenhuma venda encontrada no período informado.</p>}
                    </div>
                  </section>
                )}

                {adminReportMode === "produto" && (
                  <section className="admin-report-result">
                    <div className="admin-matrix-wrap">
                      <table className="admin-matrix-table">
                        <thead>
                          <tr>
                            <th>Produto</th>
                            <th>Qtd.</th>
                            <th>Total</th>
                            <th>Pix</th>
                            <th>Cartão</th>
                            <th>Dinheiro</th>
                            <th>Outros</th>
                            <th>Aberto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productReportRows.map((item) => (
                            <tr key={item.name}>
                              <td>{item.name}</td>
                              <td>{item.quantity}</td>
                              <td>{money(item.total)}</td>
                              <td>{money(item.pix)}</td>
                              <td>{money(item.card)}</td>
                              <td>{money(item.cash)}</td>
                              <td>{money(item.other)}</td>
                              <td>{money(item.open)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {productReportRows.length === 0 && <p className="admin-muted">Sem produtos vendidos nos pedidos carregados.</p>}
                  </section>
                )}

                {adminReportMode === "recebimento" && (
                  <section className="admin-report-result">
                    <div className="admin-matrix-wrap">
                      <table className="admin-matrix-table admin-payment-matrix">
                        <thead>
                          <tr>
                            <th>Recebimento</th>
                            <th>Pedidos</th>
                            <th>Total</th>
                            <th>Média</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paymentSales.map((item) => (
                            <tr key={item.label}>
                              <td>{item.label}</td>
                              <td>{item.quantity}</td>
                              <td>{money(item.total)}</td>
                              <td>{money(item.quantity ? item.total / item.quantity : 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="admin-report-date-legacy admin-ranked-list">
                    {paymentSales.map((item) => (
                      <article key={item.label}>
                        <span>{item.quantity}</span>
                        <div>
                          <strong>{item.label}</strong>
                          <small>{item.quantity} pedido(s)</small>
                        </div>
                        <em>{money(item.total)}</em>
                      </article>
                    ))}
                    </div>
                    {paymentSales.length === 0 && <p className="admin-muted">Sem recebimentos registrados.</p>}
                  </section>
                )}

                {adminReportMode === "abertos" && (
                  <section className="admin-report-result">
                    <div className="admin-matrix-wrap">
                      <table className="admin-matrix-table admin-orders-matrix">
                        <thead>
                          <tr>
                            <th>Pedido</th>
                            <th>Status</th>
                            <th>Recebimento</th>
                            <th>Entrega</th>
                            <th>Total</th>
                            <th>Data</th>
                          </tr>
                        </thead>
                        <tbody>
                          {openAdminOrders.slice(0, 50).map((order) => (
                            <tr key={order.id} className={`order-status-${order.status}`}>
                              <td>#{order.number}</td>
                              <td><span className={`admin-status-pill ${order.status}`}>{order.statusLabel}</span></td>
                              <td>{paymentStatusLabel(order)}</td>
                              <td>{orderModeLabel(order.mode)}</td>
                              <td>{money(order.total)}</td>
                              <td>{formatDateTime(order.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="admin-report-date-legacy admin-order-list">
                    {openAdminOrders.slice(0, 20).map((order) => (
                      <article className="admin-order-row" key={order.id}>
                        <strong>#{order.number}</strong>
                        <span>{order.statusLabel} · {orderModeLabel(order.mode)}</span>
                        <em>{money(order.total)}</em>
                        <small>{formatDateTime(order.createdAt)}</small>
                      </article>
                    ))}
                    </div>
                    {openAdminOrders.length === 0 && <p className="admin-muted">Nenhuma venda em aberto.</p>}
                  </section>
                )}
              </section>
            )}

            {adminTab === "relatorios-antigo" && (
              <section className="admin-report-grid">
                <section className="admin-panel">
                  <div className="admin-panel-head">
                    <div>
                      <span className="eyebrow">Período</span>
                      <h2>Vendas por período</h2>
                    </div>
                  </div>
                  <div className="admin-report-list">
                    <article>
                      <span>Hoje</span>
                      <strong>{money(revenueToday)}</strong>
                      <small>{ordersToday.length} pedido(s)</small>
                    </article>
                    <article>
                      <span>Este mês</span>
                      <strong>{money(revenueThisMonth)}</strong>
                      <small>{ordersThisMonth.length} pedido(s)</small>
                    </article>
                    <article>
                      <span>Total carregado</span>
                      <strong>{money(adminOrders.reduce((sum, order) => sum + Number(order.total || 0), 0))}</strong>
                      <small>{adminOrders.length} pedido(s)</small>
                    </article>
                  </div>
                </section>

                <section className="admin-panel">
                  <div className="admin-panel-head">
                    <div>
                      <span className="eyebrow">Produtos</span>
                      <h2>Vendas por produto</h2>
                    </div>
                  </div>
                  <div className="admin-ranked-list">
                    {productSales.slice(0, 8).map((item, index) => (
                      <article key={item.name}>
                        <span>{index + 1}</span>
                        <div>
                          <strong>{item.name}</strong>
                          <small>{item.quantity} unidade(s)</small>
                        </div>
                        <em>{money(item.total)}</em>
                      </article>
                    ))}
                    {productSales.length === 0 && <p className="admin-muted">Sem produtos vendidos no período carregado.</p>}
                  </div>
                </section>

                <section className="admin-panel">
                  <div className="admin-panel-head">
                    <div>
                      <span className="eyebrow">Recebimento</span>
                      <h2>Vendas por modo de recebimento</h2>
                    </div>
                  </div>
                  <div className="admin-ranked-list">
                    {paymentSales.map((item) => (
                      <article key={item.label}>
                        <span>{item.quantity}</span>
                        <div>
                          <strong>{item.label}</strong>
                          <small>{item.quantity} pedido(s)</small>
                        </div>
                        <em>{money(item.total)}</em>
                      </article>
                    ))}
                    {paymentSales.length === 0 && <p className="admin-muted">Sem recebimentos registrados.</p>}
                  </div>
                </section>

                <section className="admin-panel">
                  <div className="admin-panel-head">
                    <div>
                      <span className="eyebrow">Abertos</span>
                      <h2>Vendas em aberto</h2>
                    </div>
                  </div>
                  <div className="admin-order-list">
                    {openAdminOrders.slice(0, 10).map((order) => (
                      <article className="admin-order-row" key={order.id}>
                        <strong>#{order.number}</strong>
                        <span>{order.statusLabel} · {orderModeLabel(order.mode)}</span>
                        <em>{money(order.total)}</em>
                        <small>{formatDateTime(order.createdAt)}</small>
                      </article>
                    ))}
                    {openAdminOrders.length === 0 && <p className="admin-muted">Nenhuma venda em aberto.</p>}
                  </div>
                </section>
              </section>
            )}

            {adminTab === "promocoes" && (
              <section className="admin-split">
                <form className="admin-panel admin-form" onSubmit={savePromotion}>
                  <div className="admin-panel-head">
                    <div>
                      <span className="eyebrow">Promoções</span>
                      <h2>{editingPromotionId ? "Editar promoção" : "Nova promoção"}</h2>
                    </div>
                    {editingPromotionId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPromotionId("");
                          setPromotionDraft(emptyPromotionDraft());
                        }}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>

                  <label>Tag</label>
                  <input value={promotionDraft.tag} onChange={(event) => setPromotionDraft((current) => ({ ...current, tag: event.target.value }))} />

                  <label>Título</label>
                  <input value={promotionDraft.title} onChange={(event) => setPromotionDraft((current) => ({ ...current, title: event.target.value }))} />

                  <label>Descrição</label>
                  <textarea value={promotionDraft.description} onChange={(event) => setPromotionDraft((current) => ({ ...current, description: event.target.value }))} />

                  <label>Destaque</label>
                  <input value={promotionDraft.highlight} onChange={(event) => setPromotionDraft((current) => ({ ...current, highlight: event.target.value }))} />

                  <button type="submit" disabled={adminLoading}>
                    {editingPromotionId ? "Salvar promoção" : "Cadastrar promoção"}
                  </button>
                </form>

                <section className="admin-panel">
                  <div className="admin-panel-head">
                    <div>
                      <span className="eyebrow">Vitrine</span>
                      <h2>Promoções ativas</h2>
                    </div>
                    <button onClick={() => loadAdminData(adminToken)}>Atualizar</button>
                  </div>

                  <div className="admin-list">
                    {adminPromotions.map((promotion) => (
                      <article className="admin-list-item" key={promotion.id}>
                        <div className="admin-promo-copy">
                          <strong>{promotion.title}</strong>
                          <span>{promotion.tag}</span>
                          <small>{promotion.description}</small>
                        </div>
                        <div className="admin-list-actions">
                          <button onClick={() => startEditingPromotion(promotion)}>Editar</button>
                          <button onClick={() => removeAdminPromotion(promotion.id)}>Excluir</button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </section>
            )}

            {adminTab === "agenda" && (() => {
              const todayStr = saoPauloDateKey();
              const isToday = adminAgendaDate === todayStr;
              const nowStr = saoPauloTimeHHMM();
              const clockStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

              const atrasados = isToday
                ? adminAppointments.filter(
                    (a) => ["agendado", "confirmado"].includes(a.status) && a.hora_inicio < nowStr
                  ).length
                : 0;

              const kpi = {
                em_atendimento: adminAppointments.filter((a) => a.status === "em_atendimento").length,
                agendado: adminAppointments.filter((a) => ["agendado", "confirmado"].includes(a.status)).length,
                concluido: adminAppointments.filter((a) => a.status === "concluido").length,
                cancelado: adminAppointments.filter((a) => a.status === "cancelado").length,
                profissionais: new Set(adminAppointments.map((a) => a.profissional).filter(Boolean)).size,
              };

              const sortedAppts = [...adminAppointments].sort((a, b) => {
                const t = a.hora_inicio.localeCompare(b.hora_inicio);
                return t !== 0 ? t : (a.profissional || "").localeCompare(b.profissional || "");
              });

              function shiftDay(delta) {
                const d = new Date(adminAgendaDate + "T12:00:00");
                d.setDate(d.getDate() + delta);
                const nd = d.toISOString().slice(0, 10);
                setAdminAgendaDate(nd);
                loadAgenda(nd, adminAgendaTipo);
              }

              return (
                <section className="agenda-page">

                  {/* ── Toolbar ── */}
                  <div className="agenda-toolbar">
                    <div className="agenda-date-nav">
                      <button className="agenda-nav-btn" onClick={() => shiftDay(-1)} aria-label="Dia anterior">◀</button>
                      <div className="agenda-date-display">
                        <span className="agenda-date-label">{formatAgendaDate(adminAgendaDate)}</span>
                        {isToday && <span className="agenda-today-pill">Hoje</span>}
                      </div>
                      <button className="agenda-nav-btn" onClick={() => shiftDay(1)} aria-label="Próximo dia">▶</button>
                    </div>
                    <div className="agenda-toolbar-right">
                      {!isToday && (
                        <button className="agenda-goto-today" onClick={() => { setAdminAgendaDate(todayStr); loadAgenda(todayStr, adminAgendaTipo); }}>
                          Hoje
                        </button>
                      )}
                      <input
                        type="date"
                        className="agenda-date-input"
                        value={adminAgendaDate}
                        onChange={(e) => { setAdminAgendaDate(e.target.value); loadAgenda(e.target.value, adminAgendaTipo); }}
                        aria-label="Selecionar data"
                      />
                      <button
                        className="agenda-refresh-btn"
                        onClick={() => loadAgenda(adminAgendaDate, adminAgendaTipo)}
                        disabled={adminAgendaLoading}
                        aria-label="Atualizar agenda"
                      >
                        {adminAgendaLoading ? "⟳" : "↻"}
                      </button>
                    </div>
                  </div>

                  {/* ── Filtro por tipo de serviço ── */}
                  <div className="agenda-service-chips" role="group" aria-label="Filtrar por serviço">
                    <button
                      className={`agenda-chip${adminAgendaTipo === "" ? " agenda-chip--active" : ""}`}
                      onClick={() => { setAdminAgendaTipo(""); loadAgenda(adminAgendaDate, ""); }}
                    >
                      Todos
                    </button>
                    {Object.entries(SERVICE_TYPE_LABEL).map(([id, label]) => (
                      <button
                        key={id}
                        className={`agenda-chip agenda-chip--svc-${id}${adminAgendaTipo === id ? " agenda-chip--active" : ""}`}
                        onClick={() => { setAdminAgendaTipo(id); loadAgenda(adminAgendaDate, id); }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {adminAgendaError && !adminError && <p className="agenda-error-msg">{adminAgendaError}</p>}

                  {/* ── Painel TV ── */}
                  <div className="adm-tv-outer">
                    <div className="adm-tv-panel">

                      <header className="adm-tv-top">
                        <strong className="adm-tv-title">
                          {adminAgendaTipo ? SERVICE_TYPE_LABEL[adminAgendaTipo] : "Agenda Completa"}
                        </strong>
                        <span className="adm-tv-date">▦ {formatAgendaDate(adminAgendaDate)}</span>
                        <time className="adm-tv-clock">{clockStr}</time>
                      </header>

                      <div className="adm-tv-table-wrap">
                        {adminAgendaLoading ? (
                          <div className="agenda-empty-state">
                            <span className="agenda-empty-icon agenda-spin">⟳</span>
                            <strong>Carregando agenda...</strong>
                          </div>
                        ) : adminAppointments.length === 0 ? (
                          <div className="agenda-empty-state">
                            <span className="agenda-empty-icon">📅</span>
                            <strong>Nenhum agendamento</strong>
                            <p>
                              {adminAgendaTipo
                                ? `Sem ${SERVICE_TYPE_LABEL[adminAgendaTipo].toLowerCase()} em ${formatAgendaDate(adminAgendaDate)}.`
                                : `Agenda livre em ${formatAgendaDate(adminAgendaDate)}.`}
                            </p>
                          </div>
                        ) : (
                          <table className="adm-tv-table">
                            <thead>
                              <tr>
                                <th>Horário</th>
                                <th>Pet</th>
                                <th>Consulta / Serviço</th>
                                <th>Tutor</th>
                                <th>Profissional</th>
                                <th>Status</th>
                                <th aria-label="Ações" />
                              </tr>
                            </thead>
                            <tbody>
                              {sortedAppts.map((appt, idx) => {
                                const isAtrasado = isToday && appt.hora_inicio < nowStr && ["agendado", "confirmado"].includes(appt.status);
                                const rowStatus = isAtrasado ? "atrasado" : appt.status;
                                const canAdvance = !!APPOINTMENT_NEXT_STATUS[appt.status];
                                const canCancel = appt.status !== "cancelado" && appt.status !== "concluido";
                                return (
                                  <tr key={appt.id} className={`${idx % 2 ? "adm-tv-alt " : ""}adm-tv-row-${rowStatus}`}>
                                    <td className="adm-tv-hour">
                                      <span className="adm-tv-hour-pill">{appt.hora_inicio}</span>
                                    </td>
                                    <td className="adm-tv-pet">
                                      {appt.pet_tipo === "cao" ? "🐕" : appt.pet_tipo === "gato" ? "🐈" : "🐾"}{" "}
                                      {appt.pet_nome}
                                      {appt.pet_porte && <span className="adm-tv-porte"> · {appt.pet_porte}</span>}
                                    </td>
                                    <td>{appt.servico_nome}</td>
                                    <td className="adm-tv-tutor">{appt.cliente_nome || appt.cliente_telefone || "—"}</td>
                                    <td className="adm-tv-pro">{appt.profissional || "—"}</td>
                                    <td className="adm-tv-status">
                                      {canAdvance ? (
                                        <button
                                          className={`adm-badge adm-badge--${rowStatus}`}
                                          onClick={() => handleAgendaStatusChange(appt, APPOINTMENT_NEXT_STATUS[appt.status])}
                                          title="Clique para avançar o status"
                                        >
                                          {isAtrasado ? "Atrasado" : (APPOINTMENT_STATUS_LABEL[appt.status] ?? appt.status)}
                                        </button>
                                      ) : (
                                        <span className={`adm-badge adm-badge--static adm-badge--${appt.status}`}>
                                          {APPOINTMENT_STATUS_LABEL[appt.status] ?? appt.status}
                                        </span>
                                      )}
                                    </td>
                                    <td className="adm-tv-actions">
                                      {canCancel && (
                                        <button
                                          className="adm-tv-btn-cancel"
                                          onClick={() => handleAgendaDelete(appt)}
                                          title="Cancelar agendamento"
                                        >✕</button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>

                    {/* ── KPI footer ── */}
                    <footer className="adm-tv-kpi-bar">
                      <div className="adm-tv-kpi-item">
                        <span className="adm-tv-kpi-label">Atendendo</span>
                        <span className="adm-tv-kpi-num adm-kpi-atend">{kpi.em_atendimento}</span>
                      </div>
                      <div className="adm-tv-kpi-sep" />
                      <div className="adm-tv-kpi-item">
                        <span className="adm-tv-kpi-label">Aguardando</span>
                        <span className="adm-tv-kpi-num adm-kpi-agrd">{kpi.agendado}</span>
                      </div>
                      {atrasados > 0 && (
                        <>
                          <div className="adm-tv-kpi-sep" />
                          <div className="adm-tv-kpi-item">
                            <span className="adm-tv-kpi-label">Atrasados</span>
                            <span className="adm-tv-kpi-num adm-kpi-atras">{atrasados}</span>
                          </div>
                        </>
                      )}
                      <div className="adm-tv-kpi-sep" />
                      <div className="adm-tv-kpi-item">
                        <span className="adm-tv-kpi-label">Concluídos</span>
                        <span className="adm-tv-kpi-num adm-kpi-conc">{kpi.concluido}</span>
                      </div>
                      {kpi.cancelado > 0 && (
                        <>
                          <div className="adm-tv-kpi-sep" />
                          <div className="adm-tv-kpi-item">
                            <span className="adm-tv-kpi-label">Cancelados</span>
                            <span className="adm-tv-kpi-num adm-kpi-cancel">{kpi.cancelado}</span>
                          </div>
                        </>
                      )}
                      <div className="adm-tv-kpi-sep" />
                      <div className="adm-tv-kpi-item">
                        <span className="adm-tv-kpi-label">Profissionais</span>
                        <span className="adm-tv-kpi-num adm-kpi-prof">{kpi.profissionais}</span>
                      </div>
                      <div className="adm-tv-kpi-brand">🐾 Farmavet</div>
                    </footer>
                  </div>

                </section>
              );
            })()}

            {adminTab === "pets" && (
              <section className="admin-pets-page">

                {/* ── Cabeçalho ── */}
                <div className="pets-page-header">
                  <div>
                    <span className="eyebrow">Cadastro</span>
                    <h2>Pets</h2>
                  </div>
                  <p>Ficha de cada animal atendido na Farmavet.</p>
                </div>

                <div className="admin-split">

                  {/* ── Formulário ── */}
                  <form className="admin-panel admin-form" onSubmit={savePet}>
                    <div className="admin-panel-head">
                      <div>
                        <span className="eyebrow">Ficha</span>
                        <h2>{editingPetId ? "Editar pet" : "Novo pet"}</h2>
                      </div>
                      {editingPetId && (
                        <button type="button" onClick={() => { setEditingPetId(""); setPetDraft(emptyPetDraft()); }}>
                          Cancelar
                        </button>
                      )}
                    </div>

                    <div className="pets-form-section-label">Dados do pet</div>

                    <label>Nome do pet *
                      <input required value={petDraft.nome} onChange={(e) => setPetDraft((d) => ({ ...d, nome: e.target.value }))} placeholder="Ex: Rex" />
                    </label>

                    <div className="pets-form-row">
                      <label>Tipo *
                        <select value={petDraft.tipo} onChange={(e) => setPetDraft((d) => ({ ...d, tipo: e.target.value }))}>
                          {Object.entries(PET_TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </label>
                      <label>Porte
                        <select value={petDraft.porte} onChange={(e) => setPetDraft((d) => ({ ...d, porte: e.target.value }))}>
                          <option value="">—</option>
                          {Object.entries(PET_PORTE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </label>
                    </div>

                    <div className="pets-form-row">
                      <label>Raça
                        <input value={petDraft.raca} onChange={(e) => setPetDraft((d) => ({ ...d, raca: e.target.value }))} placeholder="Ex: Labrador" />
                      </label>
                      <label>Sexo
                        <select value={petDraft.sexo} onChange={(e) => setPetDraft((d) => ({ ...d, sexo: e.target.value }))}>
                          <option value="">—</option>
                          <option value="macho">Macho</option>
                          <option value="femea">Fêmea</option>
                        </select>
                      </label>
                    </div>

                    <div className="pets-form-row">
                      <label>Data de nascimento
                        <input type="date" value={petDraft.data_nascimento} onChange={(e) => setPetDraft((d) => ({ ...d, data_nascimento: e.target.value }))} />
                      </label>
                      <label>Cor / pelagem
                        <input value={petDraft.cor} onChange={(e) => setPetDraft((d) => ({ ...d, cor: e.target.value }))} placeholder="Ex: caramelo" />
                      </label>
                    </div>

                    <div className="pets-form-section-label">Responsável</div>

                    <label>Nome do responsável *
                      <input required value={petDraft.responsavel_nome} onChange={(e) => setPetDraft((d) => ({ ...d, responsavel_nome: e.target.value }))} placeholder="Nome completo" />
                    </label>

                    <div className="pets-form-row">
                      <label>Telefone *
                        <input required type="tel" inputMode="tel" value={petDraft.responsavel_tel} onChange={(e) => setPetDraft((d) => ({ ...d, responsavel_tel: formatPhone(e.target.value) }))} placeholder="(11) 99999-9999" />
                      </label>
                      <label>E-mail
                        <input type="email" value={petDraft.responsavel_email} onChange={(e) => setPetDraft((d) => ({ ...d, responsavel_email: e.target.value }))} placeholder="Opcional" />
                      </label>
                    </div>

                    <label>Observações
                      <textarea rows={3} value={petDraft.observacoes} onChange={(e) => setPetDraft((d) => ({ ...d, observacoes: e.target.value }))} placeholder="Alergias, comportamento, medicações…" />
                    </label>

                    <button type="submit" disabled={adminPetsLoading}>
                      {editingPetId ? "Salvar alterações" : "Cadastrar pet"}
                    </button>
                  </form>

                  {/* ── Lista de pets ── */}
                  <section className="admin-panel pets-list-panel">
                    <div className="admin-panel-head">
                      <div>
                        <span className="eyebrow">Cadastrados</span>
                        <h2>Pets ativos</h2>
                      </div>
                      <button onClick={() => loadPets(adminPetsBusca, adminPetsTipo)} disabled={adminPetsLoading}>
                        {adminPetsLoading ? "…" : "Atualizar"}
                      </button>
                    </div>

                    {/* Busca + filtro tipo */}
                    <div className="pets-search-row">
                      <input
                        className="pets-search-input"
                        type="search"
                        placeholder="Buscar por nome, responsável ou telefone…"
                        value={adminPetsBusca}
                        onChange={(e) => {
                          setAdminPetsBusca(e.target.value);
                          loadPets(e.target.value, adminPetsTipo);
                        }}
                      />
                      <select
                        className="pets-tipo-select"
                        value={adminPetsTipo}
                        onChange={(e) => {
                          setAdminPetsTipo(e.target.value);
                          loadPets(adminPetsBusca, e.target.value);
                        }}
                      >
                        <option value="">Todos os tipos</option>
                        {Object.entries(PET_TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>

                    {adminPetsError && !adminError && <p className="pets-error">{adminPetsError}</p>}

                    {!adminPetsLoading && adminPets.length === 0 && (
                      <p className="pets-empty">Nenhum pet encontrado.</p>
                    )}

                    <div className="pets-list">
                      {adminPets.map((pet) => (
                        <article key={pet.id} className={`pet-card${selectedPet?.id === pet.id ? " pet-card--expanded" : ""}`}>
                          <div className="pet-card-main">
                            <div className="pet-avatar-col">
                              <span className="pet-avatar">{PET_TIPO_AVATAR[pet.tipo] ?? "🐾"}</span>
                            </div>
                            <div className="pet-card-info">
                              <strong className="pet-card-name">{pet.nome}</strong>
                              <span className="pet-card-tipo">
                                {PET_TIPO_LABEL[pet.tipo] ?? pet.tipo}
                                {pet.raca ? ` · ${pet.raca}` : ""}
                                {pet.porte ? ` · ${PET_PORTE_LABEL[pet.porte] ?? pet.porte}` : ""}
                              </span>
                              <span className="pet-card-responsavel">📱 {pet.responsavel_nome} — {formatPhone(pet.responsavel_tel)}</span>
                              {pet.observacoes && <span className="pet-card-obs">{pet.observacoes}</span>}
                            </div>
                            <div className="pet-card-actions">
                              <button className="pet-btn-history" onClick={() => openPetHistory(pet)} title="Ver histórico" disabled={petHistoryLoading === pet.id}>
                                {petHistoryLoading === pet.id ? "…" : selectedPet?.id === pet.id ? "▲" : "Histórico"}
                              </button>
                              <button onClick={() => startEditingPet(pet)}>Editar</button>
                              <button onClick={() => removeAdminPet(pet.id)}>Desativar</button>
                            </div>
                          </div>

                          {/* Histórico expandido */}
                          {selectedPet?.id === pet.id && (
                            <div className="pet-history">
                              <div className="pet-history-header">
                                <span className="eyebrow">Histórico de atendimentos</span>
                              </div>
                              {(selectedPet.historico || []).length === 0 ? (
                                <p className="pet-history-empty">Nenhum atendimento registrado ainda.</p>
                              ) : (
                                <div className="pet-history-list">
                                  {(selectedPet.historico || []).map((appt) => (
                                    <div key={appt.id} className={`pet-history-item pet-history-item--${appt.status}`}>
                                      <span className="pet-history-date">{appt.data}</span>
                                      <span className="pet-history-service">{appt.servico_nome}</span>
                                      <span className="pet-history-prof">{appt.profissional}</span>
                                      <span className={`pet-history-status agenda-status--${appt.status}`}>
                                        {APPOINTMENT_STATUS_LABEL[appt.status] ?? appt.status}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  </section>

                </div>
              </section>
            )}

              </section>
            </section>

          </>
        )}
      </main>
    );
  }

  return (
    <main className="home-stage">
      <div className="home-wrap">

        {/* ── 1. Hero da marca ──────────────────────────────────────────── */}
        <header className="home-hero">
          <div className="home-hero-deco-a" aria-hidden="true" />
          <div className="home-hero-deco-b" aria-hidden="true" />

          <div className={`home-hero-logo ${showFarmavetLogo ? "" : "fallback"}`}>
            {showFarmavetLogo ? (
              <img src="/logoFarmavet.jpeg" alt="Farmavet" onError={() => setShowFarmavetLogo(false)} />
            ) : (
              <span>FV</span>
            )}
          </div>

          <p className="home-hero-tagline">PetShop e Clínica Veterinária</p>

          <div className="home-hero-pill">
            <span className="home-hero-dot" aria-hidden="true" />
            Atendimento disponível
          </div>
        </header>

        {/* ── 2. Telefone (opcional, pré-preenche agendamentos) ────────── */}
        <div className="home-phone-strip">
          <label htmlFor="home-phone-input">Seu celular</label>
          <input
            id="home-phone-input"
            value={phone}
            inputMode="tel"
            autoComplete="tel"
            placeholder="(11) 99999-9999"
            aria-label="Número de celular"
            onChange={(event) => setPhone(formatPhone(event.target.value))}
          />
        </div>

        <button className="home-visitor-btn" onClick={() => openCatalogAt("produtos")}>
          Explorar sem identificar →
        </button>

        {/* ── 3. Campanha especial (opcional) ──────────────────────────── */}
        {activeCampaign && (
          <button
            className={`home-campaign${activeCampaign.image ? " home-campaign--image" : ""}`}
            style={{
              ...(activeCampaign.accent ? { "--campaign-accent": activeCampaign.accent } : {}),
              ...(activeCampaign.image ? { "--campaign-image": `url(${activeCampaign.image})` } : {}),
            }}
            onClick={() => openCatalogAt(activeCampaign.targetCategory)}
          >
            <div className="home-campaign-text">
              <span className="home-campaign-label">Campanha especial</span>
              <strong>{activeCampaign.title}</strong>
              <p>{activeCampaign.subtitle}</p>
            </div>
            <span className="home-campaign-cta">{activeCampaign.buttonLabel} ›</span>
          </button>
        )}

        {/* ── 4. Escolha de serviços e produtos ────────────────────────── */}
        <section className="home-intent">
          <h2 className="home-intent-heading">O que você precisa hoje?</h2>

          <div className="home-cards">
            <button className="home-card home-card--produtos" onClick={() => openCatalogAt("produtos")}>
              <span className="home-card-icon">🐾</span>
              <div className="home-card-text">
                <strong>Comprar produtos pet</strong>
                <small>Ração, higiene e acessórios</small>
              </div>
              <span className="home-card-arrow">›</span>
            </button>

            <button className="home-card home-card--banho" onClick={() => openCatalogAt("banho_tosa")}>
              <span className="home-card-icon">🛁</span>
              <div className="home-card-text">
                <strong>Banho e tosa</strong>
                <small>Agendar cuidados para seu pet</small>
              </div>
              <span className="home-card-arrow">›</span>
            </button>

            <button className="home-card home-card--clinica" onClick={() => openCatalogAt("clinica")}>
              <span className="home-card-icon">🩺</span>
              <div className="home-card-text">
                <strong>Clínica veterinária</strong>
                <small>Consultas e exames</small>
              </div>
              <span className="home-card-arrow">›</span>
            </button>

            <button className="home-card home-card--comunidade" onClick={() => openCatalogAt("comunidade")}>
              <span className="home-card-icon">🤝</span>
              <div className="home-card-text">
                <strong>Comunidade Pet</strong>
                <small>Adoção, eventos e campanhas</small>
              </div>
              <span className="home-card-arrow">›</span>
            </button>
          </div>
        </section>

        <div className="home-bottom-spacer" />

      </div>
    </main>
  );
}
