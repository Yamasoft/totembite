const PLACEHOLDER = {
  produtos:   "/images/cat-produtos.svg",
  banho_tosa: "/images/cat-banho.svg",
  clinica:    "/images/cat-clinica.svg",
  comunidade: "/images/cat-comunidade.svg",
};
const DEFAULT_PLACEHOLDER = "/images/cat-produtos.svg";

/**
 * Imagem de produto/serviço com fallback automático por categoria.
 * Quando a URL falha (404, rede), exibe o placeholder SVG da categoria.
 *
 * Props:
 *   src       — URL da imagem real (/images/produtos/nome.png ou URL do admin)
 *   alt       — texto alternativo
 *   category  — id da categoria ('produtos' | 'banho_tosa' | 'clinica' | 'comunidade')
 *   className — classe CSS aplicada ao <img>
 *   style     — estilos inline opcionais
 */
export function ProductImage({ src, alt, category, className, style }) {
  const fallback = PLACEHOLDER[category] ?? DEFAULT_PLACEHOLDER;
  return (
    <img
      className={className}
      style={style}
      src={src || fallback}
      alt={alt}
      onError={(e) => {
        e.target.src = fallback;
        e.target.onerror = null;
      }}
    />
  );
}
