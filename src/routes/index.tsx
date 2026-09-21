import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Heart,
  MapPin,
  Search,
  ShoppingBag,
  User,
  X,
} from "lucide-react";

import social1 from "@/assets/social-foto-1.jpeg.asset.json";
import social2 from "@/assets/social-foto-2.jpeg.asset.json";
import social3 from "@/assets/social-foto-3.jpeg.asset.json";
import oxford1 from "@/assets/oxford-foto-1.jpeg.asset.json";
import oxford2 from "@/assets/oxford-foto-2.jpeg.asset.json";
import oxford3 from "@/assets/oxford-foto-3.jpeg.asset.json";
import infantil1 from "@/assets/infantil-foto-1.jpeg.asset.json";
import infantil2 from "@/assets/infantil-foto-2.jpeg.asset.json";
import infantil3 from "@/assets/infantil-foto-3.jpeg.asset.json";
import heroVideo from "@/assets/hero-calcando-sapato.mp4.asset.json";
import { Button } from "@/components/ui/button";
import { ProductGrid } from "@/components/ProductGrid";
import { ShippingCalculator } from "@/components/ShippingCalculator";
import { CouponInput } from "@/components/CouponInput";
import type { ShippingOption } from "@/lib/shipping.functions";
import type { DiscountResult } from "@/lib/coupon.functions";
import { assinarNewsletter } from "@/lib/newsletter.functions";
import { supabase } from "@/integrations/supabase/external";
import { useIsAdmin } from "@/hooks/useIsAdmin";

import { signOut, useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { isValidEmail } from "@/lib/validate";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Solatto | Calçados para todos os caminhos" },
      {
        name: "description",
        content: "Descubra tênis, sapatos e sandálias Solatto com design, conforto e personalidade.",
      },
      { property: "og:title", content: "Solatto | Calçados para todos os caminhos" },
      {
        property: "og:description",
        content: "Uma nova experiência em calçados, feita para acompanhar o seu ritmo.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.solatto.com.br/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "canonical", href: "https://www.solatto.com.br/" },
    ],
  }),
  component: Index,
});

const faqs = [
  ["Como escolher o tamanho ideal?", "Consulte nossa tabela de medidas em cada produto e compare com um calçado que você já usa."],
  ["Qual é o prazo de entrega?", "O prazo varia conforme o seu CEP e aparece no carrinho antes da finalização da compra."],
  ["Posso trocar meu calçado?", "Sim. Você pode solicitar a primeira troca em até 30 dias após o recebimento."],
  ["Quais são as formas de pagamento?", "Aceitamos Pix e os principais cartões de crédito, com parcelamento em até 10 vezes."],
  ["Como conservar meus calçados?", "Use um pano macio e levemente úmido. Evite máquinas de lavar e deixe secar sempre à sombra."],
];

const categories = [
  {
    name: "Social",
    description: "Couro marrom com detalhe metálico",
    images: [social2.url, social1.url, social3.url],
  },
  {
    name: "Oxford",
    description: "Clássico preto com cadarço",
    images: [infantil3.url, infantil1.url, infantil2.url],
  },
  {
    name: "Infantil",
    description: "Conforto e elegância para os pequenos",
    images: [oxford3.url, oxford2.url, oxford1.url],
  },
];

const headerLinks: [string, string][] = [
  ["calçados", "#categorias"],
  ["novidades", "#novidades"],
  ["coleções", "#categorias"],
  ["ajuda", "#faq"],
];

const headerCategories: { label: string; href: string; desktopOnly?: boolean }[] = [
  { label: "Social", href: "#categorias" },
  { label: "Oxford", href: "#categorias" },
  { label: "Infantil", href: "#categorias" },
  { label: "Lançamentos", href: "#novidades", desktopOnly: true },
  { label: "Mais vendidos", href: "#novidades", desktopOnly: true },
  { label: "Promoções", href: "#novidades", desktopOnly: true },
];

function StickyHeader({
  visible,
  user,
  onEnter,
  onSignOut,
  busca,
  onBuscaChange,
  cartCount,
  onOpenCart,
  wishlistCount,
  onOpenWishlist,
}: {
  visible: boolean;
  user: { id?: string; email?: string } | null;
  onEnter: () => void;
  onSignOut: () => void;
  busca: string;
  onBuscaChange: (value: string) => void;
  cartCount: number;
  onOpenCart: () => void;
  wishlistCount: number;
  onOpenWishlist: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { isAdmin } = useIsAdmin(user?.id);
  

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!user) setMenuOpen(false);
  }, [user]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 border-b border-border bg-background/95 backdrop-blur transition-transform duration-300 ${
        visible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="mx-auto grid w-full max-w-[1180px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[auto_minmax(180px,1fr)_auto] sm:gap-x-4 sm:px-5 xl:flex">
        <a href="#inicio" className="min-w-0 truncate cursor-pointer text-lg font-bold uppercase tracking-[0.18em] sm:shrink-0 sm:text-xl sm:tracking-[0.22em]">
          Solatto
        </a>

        <nav className="hidden shrink-0 items-center gap-5 text-sm xl:flex">
          {headerLinks.map(([label, href]) => (
            <a key={label} href={href} className="cursor-pointer text-foreground/80 transition-colors hover:text-foreground">
              {label}
            </a>
          ))}
        </nav>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            document.getElementById("novidades")?.scrollIntoView({ behavior: "smooth" });
          }}
          className="col-span-2 row-start-2 flex h-10 w-full min-w-0 items-center gap-2 rounded-full border border-border bg-background pl-4 pr-1.5 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:h-11 xl:ml-auto xl:max-w-[340px] xl:flex-1"
        >

          <input
            type="search"
            aria-label="Buscar calçados"
            placeholder="O que você procura?"
            value={busca}
            onChange={(event) => onBuscaChange(event.target.value)}
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            aria-label="Buscar"
            className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <Search className="size-4" />
          </button>
        </form>

        <div className="col-start-2 row-start-1 flex shrink-0 items-center gap-1 sm:col-start-3 xl:ml-0">
          <button
            type="button"
            aria-label="Lista de desejos"
            onClick={onOpenWishlist}
            className="relative grid h-9 w-9 cursor-pointer place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <Heart className="size-[18px]" />
            {wishlistCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-[10px] font-semibold text-background">
                {wishlistCount}
              </span>
            ) : null}
          </button>
          <Link
            to="/sobre"
            aria-label="Nossa localização"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <MapPin className="size-[18px]" />
          </Link>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label="Minha conta"
              aria-haspopup={user ? "menu" : undefined}
              aria-expanded={user ? menuOpen : undefined}
              title={user ? user.email : "Entrar na sua conta"}
              onClick={() => (user ? setMenuOpen((open) => !open) : onEnter())}
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
            >
              <User className="size-[18px]" />
            </button>
            {user && menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-xl border border-border bg-background py-1 shadow-lg"
              >
                <p className="truncate px-3 py-2 text-xs text-muted-foreground">{user.email}</p>
                <Link
                  to="/perfil"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block w-full cursor-pointer px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                >
                  Meu perfil
                </Link>
                {isAdmin ? (
                  <Link
                    to="/admin"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="block w-full cursor-pointer px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                  >
                    Painel admin
                  </Link>
                ) : null}
                <Link
                  to="/pedidos"
                  className="block w-full cursor-pointer px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                  onClick={() => setMenuOpen(false)}
                >
                  Meus Pedidos
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onSignOut();
                  }}
                  className="block w-full cursor-pointer px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                >
                  Sair
                </button>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onOpenCart}
            aria-label="Abrir sacola"
            className="flex cursor-pointer items-center gap-1 rounded-full px-2 py-1.5 text-sm transition-colors hover:bg-muted"
          >
            <ShoppingBag className="size-[18px]" />
            <span className="text-muted-foreground">({cartCount})</span>
          </button>
        </div>
      </div>

      <div className="border-t border-border/70">
        <div className="mx-auto flex w-full max-w-[1180px] items-center gap-5 overflow-x-auto px-4 py-2 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-6 sm:px-5">
          {headerCategories.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="shrink-0 cursor-pointer whitespace-nowrap text-foreground/70 transition-colors hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </header>
  );
}

function CategoryCard({ name, description, images }: { name: string; description: string; images: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index === 0) return;
    const timer = window.setInterval(() => setIndex((current) => (current % (images.length - 1)) + 1), 1200);
    return () => window.clearInterval(timer);
  }, [index === 0, images.length]);

  return (
    <a
      href="#novidades"
      className="group relative aspect-square overflow-hidden bg-background"
      onMouseEnter={() => setIndex(1)}
      onMouseLeave={() => setIndex(0)}
      onFocus={() => setIndex(1)}
      onBlur={() => setIndex(0)}
    >
      {images.map((image, imageIndex) => (
        <img
          key={image}
          src={image}
          alt={`Calçado ${name} Solatto`}
          width={1200}
          height={1200}
          loading="lazy"
          className={`absolute inset-0 h-full w-full scale-[1.12] object-contain object-center transition-opacity duration-300 ${imageIndex === index ? "opacity-100" : "opacity-0"}`}
        />
      ))}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/85 to-transparent px-6 pb-7 pt-24 text-background">
        <h3 className="text-2xl font-semibold">{name}</h3>
        <p className="mt-1 text-sm text-background/80">{description}</p>
      </div>
    </a>
  );
}


function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const assinar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) { setErro("Digite um e-mail válido."); return; }
    setBusy(true);
    setMsg(null);
    setErro(null);
    try {
      await assinarNewsletter({ data: { email } });
      setMsg("Inscrito! Você receberá novidades em primeira mão.");
      setEmail("");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível inscrever.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold">Newsletter</h3>
      <p className="mb-[15px] text-[0.85rem] text-muted-foreground">Receba novidades e lançamentos em primeira mão.</p>
      <form onSubmit={assinar} noValidate className="flex gap-[10px] max-[900px]:flex-col">
        <input
          type="email"
          required
          placeholder="Seu melhor e-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 flex-grow rounded-[10px] border border-border bg-background px-4 text-[0.9rem] shadow-inner outline-none focus:border-foreground transition-colors"
        />
        <Button type="submit" disabled={busy} className="h-11 rounded-[10px] bg-foreground px-7 text-[0.9rem] font-semibold text-background shadow-[0_12px_24px_rgba(0,0,0,0.18)] hover:-translate-y-0.5 hover:bg-foreground/90 max-[900px]:w-full">
          {busy ? "..." : "Assinar"}
        </Button>
      </form>
      {msg ? <p className="mt-2 text-xs text-green-600">{msg}</p> : null}
      {erro ? <p className="mt-2 text-xs text-destructive">{erro}</p> : null}
      <div className="mt-5 flex items-center gap-3">
        <p className="text-xs text-muted-foreground">Siga a gente</p>
        <a
          href="https://www.instagram.com/solattoatacadovarejodrop"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram da Solatto"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        </a>
        <a
          href="https://www.facebook.com/solattocalcados"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Facebook da Solatto"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        </a>
      </div>
    </div>
  );
}

function Index() {
  const { user, loading, clientType } = useAuth();
  const [activeIndex, setActiveIndex] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [busca, setBusca] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);
  const [frete, setFrete] = useState<ShippingOption | null>(null);
  const [desconto, setDesconto] = useState<DiscountResult | null>(null);
const [tamSelecionado, setTamSelecionado] = useState<string | null>(null);
  const [tamanhos, setTamanhos] = useState<string[]>([]);
  const cart = useCart(user?.id ?? null);
  const wishlist = useWishlist(user?.id ?? null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from("product_variants")
      .select("tamanho, estoque, products!inner(ativo)")
      .gt("estoque", 0)
      .eq("products.ativo", true)
      .then(({ data }) => {
        if (!data) return;
        const unicos = [...new Set(data.map((v) => v.tamanho))].sort((a, b) =>
          a.localeCompare(b, "pt-BR", { numeric: true }),
        );
        setTamanhos(unicos);
      });
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem("openLogin") && !user && !loading) {
      sessionStorage.removeItem("openLogin");
      void navigate({ to: "/entrar" });
    }
  }, [user, loading, navigate]);

  const handleAddToCart = async (produtoId: string, variacaoId: string | null = null) => {
    if (!user) {
      void navigate({ to: "/entrar" });
      return;
    }
    await cart.addItem(produtoId, variacaoId);
    setShowCart(true);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.7);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);



  return (
    <div className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://www.solatto.com.br/#organization",
              "name": "Solatto",
              "url": "https://www.solatto.com.br/",
              "logo": "https://www.solatto.com.br/favicon.svg",
              "sameAs": [
                "https://www.instagram.com/solattoatacadovarejodrop",
                "https://www.facebook.com/solattocalcados"
              ],
            },
            {
              "@type": "WebSite",
              "@id": "https://www.solatto.com.br/#website",
              "url": "https://www.solatto.com.br/",
              "name": "Solatto",
              "description": "Calçados para todos os seus caminhos.",
              "publisher": { "@id": "https://www.solatto.com.br/#organization" },
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://www.solatto.com.br/#novidades?q={search_term_string}",
                "query-input": "required name=search_term_string",
              },
            },
          ],
        })}}
      />
      <StickyHeader
        visible={scrolled}
        user={user}
        onEnter={() => void navigate({ to: "/entrar" })}
        onSignOut={() => signOut()}
        busca={busca}
        onBuscaChange={setBusca}
        cartCount={cart.count}
        onOpenCart={() => (user ? setShowCart(true) : void navigate({ to: "/entrar" }))}
        wishlistCount={wishlist.count}
        onOpenWishlist={() => (user ? setShowWishlist(true) : void navigate({ to: "/entrar" }))}
      />
{showCart && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-foreground/40" onClick={() => setShowCart(false)}>
          <aside
            className="flex h-full w-full max-w-md flex-col bg-background shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold">Sua sacola</h2>
              <button type="button" onClick={() => setShowCart(false)} aria-label="Fechar sacola" className="cursor-pointer rounded-full p-2 hover:bg-muted">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {cart.items.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Sua sacola está vazia.</p>
              ) : (
                <ul className="grid gap-4">
                  {cart.items.map((item) => {
                    const image = [...(item.products?.product_images ?? [])].sort((a, b) => a.ordem - b.ordem)[0];
                    const preco = item.products?.product_prices?.[0]?.preco ?? 0;
                    return (
                      <li key={item.id} className="flex gap-3 border-b border-border pb-4">
                        <div className="size-20 shrink-0 overflow-hidden rounded-md bg-muted">
                          {image ? <img src={image.url} alt={item.products?.nome ?? ""} className="h-full w-full object-contain" /> : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.products?.nome}</p>
                          {item.product_variants?.tamanho ? (
                            <p className="text-xs text-muted-foreground">Numeração {item.product_variants.tamanho}</p>
                          ) : null}
                          <p className="text-sm text-muted-foreground">
                            {Number(preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <button type="button" aria-label="Diminuir" onClick={() => cart.setQuantity(item.id, item.quantidade - 1)} className="size-7 cursor-pointer rounded-full border border-border hover:bg-muted">−</button>
                            <span className="w-6 text-center text-sm">{item.quantidade}</span>
                            <button type="button" aria-label="Aumentar" onClick={() => { const estoque = item.product_variants?.estoque ?? Infinity; if (item.quantidade < estoque) cart.setQuantity(item.id, item.quantidade + 1); }} className="size-7 cursor-pointer rounded-full border border-border hover:bg-muted">+</button>
                            <button type="button" onClick={() => cart.removeItem(item.id)} className="ml-auto cursor-pointer text-xs text-muted-foreground underline">Remover</button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="border-t border-border px-5 py-4">
              {cart.items.length > 0 ? (
                <>
                  <ShippingCalculator
                    itens={cart.items.reduce((sum, item) => sum + item.quantidade, 0)}
                    subtotal={cart.total}
                    onSelect={setFrete}
                  />
                  <CouponInput subtotal={cart.total} onApply={setDesconto} />
                </>
              ) : null}
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{Number(cart.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
              </div>
              {desconto ? (
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cupom ({desconto.code})</span>
                  <span className="text-green-600 font-medium">
                    -{Number(desconto.discount_amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              ) : null}
              {frete ? (
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Frete ({frete.nome})</span>
                  <span>
                    {frete.valor === 0
                      ? "Grátis"
                      : Number(frete.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              ) : null}
              <div className="mb-1 mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="text-lg font-semibold">
                  {Number(cart.total - (desconto?.discount_amount ?? 0) + (frete?.valor ?? 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
              {clientType !== "dropshipping" && (
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="text-green-600 font-medium">No PIX (10% off)</span>
                  <span className="text-green-600 font-semibold">
                    {Number((cart.total - (desconto?.discount_amount ?? 0) + (frete?.valor ?? 0)) * 0.9).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              )}
              <Button
                disabled={cart.items.length === 0}
                className="h-12 w-full rounded-md bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => { setShowCart(false); void navigate({ to: "/checkout" }); }}
              >
                Finalizar compra
              </Button>
            </div>
          </aside>
        </div>
      )}
      {showWishlist && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-foreground/40" onClick={() => setShowWishlist(false)}>
          <aside
            className="flex h-full w-full max-w-md flex-col bg-background shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold">Lista de desejos</h2>
              <button type="button" onClick={() => setShowWishlist(false)} aria-label="Fechar lista de desejos" className="cursor-pointer rounded-full p-2 hover:bg-muted">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {wishlist.items.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Sua lista de desejos está vazia.</p>
              ) : (
                <ul className="grid gap-4">
                  {wishlist.items.map((item) => {
                    const image = [...(item.products?.product_images ?? [])].sort((a, b) => a.ordem - b.ordem)[0];
                    const preco = item.products?.product_prices?.[0]?.preco ?? 0;
                    const precoOriginal = item.products?.product_prices?.[0]?.preco_original;
                    return (
                      <li key={item.id} className="flex gap-3 border-b border-border pb-4">
                        <div className="size-20 shrink-0 overflow-hidden rounded-md bg-muted">
                          {image ? <img src={image.url} alt={item.products?.nome ?? ""} className="h-full w-full object-contain" /> : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.products?.nome}</p>
                          <p className="text-sm text-muted-foreground">
                            {Number(preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            {precoOriginal ? (
                              <span className="ml-2 text-xs line-through">
                                {Number(precoOriginal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </span>
                            ) : null}
                          </p>
                          <button
                            type="button"
                            onClick={() => wishlist.removeItem(item.id)}
                            className="mt-2 cursor-pointer text-xs text-muted-foreground underline"
                          >
                            Remover
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}
      <main id="inicio">
        <section className="relative h-screen w-full overflow-hidden bg-black">
          <video
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            src={heroVideo.url}
          />

          <div className="absolute left-0 right-0 top-0 z-20 px-6 pt-6 md:px-10">
            <nav className="flex items-center justify-between gap-4">
              <div className="flex items-center rounded-full bg-neutral-900/90 px-5 py-3 backdrop-blur">
                <span className="hero-readex text-sm font-normal tracking-tight text-white">solatto</span>
              </div>

              <div className="hidden items-center gap-1 rounded-full bg-neutral-900/90 px-3 py-2 backdrop-blur md:flex">
                {[
                  ["calçados", "#categorias"],
                  ["novidades", "#novidades"],
                  ["coleções", "#categorias"],
                  ["ajuda", "#faq"],
                ].map(([label, href]) => (
                  <a
                    key={label}
                    href={href}
                    className="hero-readex cursor-pointer rounded-full px-5 py-2 text-sm text-neutral-300 transition-colors hover:text-white"
                  >
                    {label}
                  </a>
                ))}
              </div>

              {user ? (
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="hero-readex cursor-pointer rounded-full bg-white px-6 py-3 text-sm font-normal text-black transition-colors hover:bg-neutral-200"
                >
                  sair
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void navigate({ to: "/entrar" })}
                  className="hero-readex cursor-pointer rounded-full bg-white px-6 py-3 text-sm font-normal text-black transition-colors hover:bg-neutral-200"
                >
                  entrar
                </button>
              )}
            </nav>
          </div>

          <div className="relative h-full w-full">
            <h1 className="sr-only">Solatto — Calçados para todos os caminhos</h1>
            <p className="hero-title absolute left-4 top-[18%] text-[14vw] font-medium text-white md:left-10 md:text-[13vw]">conforto</p>
            <p className="hero-title absolute right-4 top-[38%] text-[14vw] font-medium text-white md:right-10 md:text-[13vw]">em cada</p>
            <p className="hero-title absolute left-[18%] top-[58%] text-[14vw] font-medium text-white md:left-[28%] md:text-[13vw]">passo</p>

            <p className="hero-readex absolute left-6 top-[46%] max-w-[240px] text-[15px] leading-snug text-white/90 md:left-10">
              calçados feitos com cuidado, para levar você mais longe todos os dias
            </p>

            <div className="absolute right-6 top-[14%] md:right-24">
              <div className="flex items-center justify-end gap-3">
                <span className="hidden h-px w-24 rotate-[20deg] bg-white/40 md:block" />
                <span className="hero-readex text-4xl font-medium tracking-tight text-white md:text-5xl">+65mil</span>
              </div>
              <p className="hero-readex mt-1 text-right text-xs text-white/70 md:text-sm">clientes calçados</p>
            </div>

            <div className="absolute bottom-20 left-6 md:bottom-24 md:left-20">
              <div className="flex items-center gap-3">
                <span className="hero-readex text-4xl font-medium tracking-tight text-white md:text-5xl">+1,5mi</span>
                <span className="hidden h-px w-24 rotate-[-20deg] bg-white/40 md:block" />
              </div>
              <p className="hero-readex mt-1 text-xs text-white/70 md:text-sm">pares entregues</p>
            </div>

            <div className="absolute bottom-16 right-6 md:bottom-20 md:right-20">
              <div className="flex items-center justify-end gap-3">
                <span className="hidden h-px w-24 rotate-[-20deg] bg-white/40 md:block" />
                <span className="hero-readex text-4xl font-medium tracking-tight text-white md:text-5xl">+300mil</span>
              </div>
              <p className="hero-readex mt-1 text-right text-xs text-white/70 md:text-sm">avaliações positivas</p>
            </div>

            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-b from-transparent to-black" />
          </div>
        </section>


        <section id="categorias" className="scroll-mt-28 py-20">
          <div className="mx-auto w-full max-w-[1440px] px-5 md:px-8">
            <div className="mb-10 flex items-end justify-between gap-5">
              <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-foreground/60">Escolha o seu estilo</p><h2 className="text-3xl font-semibold sm:text-4xl">Feito para a vida em movimento.</h2></div>
              <a href="#novidades" className="hidden border-b border-foreground pb-1 text-sm md:block">Ver todos</a>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {categories.map((category) => (
                <CategoryCard key={category.name} {...category} />
              ))}
            </div>
          </div>
        </section>

        {tamanhos.length > 0 ? (
          <section className="border-y border-border bg-muted/30 py-12">
            <div className="mx-auto w-full max-w-[1440px] px-5 md:px-8">
              <div className="mb-6 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/60">Encontre o seu</p>
                <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Compre por tamanho</h2>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {tamanhos.map((tam) => (
                  <button
                    key={tam}
                    type="button"
                    onClick={() => {
                      setTamSelecionado((prev) => (prev === tam ? null : tam));
                      document.getElementById("novidades")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className={`min-w-[52px] cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                      tamSelecionado === tam
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background hover:border-foreground"
                    }`}
                  >
                    {tam}
                  </button>
                ))}
                {tamSelecionado ? (
                  <button
                    type="button"
                    onClick={() => setTamSelecionado(null)}
                    className="cursor-pointer rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                  >
                    Limpar
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <section id="novidades" className="scroll-mt-28 bg-background py-16">
          <div className="mx-auto w-full max-w-[1440px] px-5 md:px-8">
            <div className="mb-10 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/60">Solatto essencial</p>
              <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-medium leading-tight sm:text-5xl">
                {tamSelecionado
                  ? `Calçados no número ${tamSelecionado}`
                  : "Feito no Brasil, pensado para acompanhar você."}
              </h2>
              <p className="mt-4 text-sm text-muted-foreground">
                {user ? "Preços exclusivos do seu tipo de conta." : "Entre na sua conta para ver os preços do seu perfil."}
              </p>
            </div>
            <ProductGrid
              signedIn={Boolean(user)}
              refreshKey={refreshKey}
              search={busca}
              filterSize={tamSelecionado ?? undefined}
              onAdd={(produtoId, variacaoId) => { void handleAddToCart(produtoId, variacaoId); }}
              wishlistIds={wishlist.ids}
              {...(user ? { onToggleWishlist: (id: string) => { void wishlist.toggle(id); } } : {})}
            />
          </div>
        </section>

        <section id="faq" className="scroll-mt-28 py-20 max-[900px]:py-[60px]">
          <div className="mx-auto grid w-full max-w-[1100px] grid-cols-[1.6fr_1fr] items-stretch gap-[30px] px-5 max-[900px]:grid-cols-1 max-[900px]:gap-[60px]">
            <div className="c5-animated-gradient flex flex-col items-center justify-center rounded-[24px] px-10 py-20 text-center text-primary-foreground shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
              <h2 className="mb-[15px] text-[clamp(2.5rem,6vw,3.5rem)] font-normal leading-[1.1] tracking-normal">Seu próximo par<br />começa aqui.</h2>
              <p className="mb-[30px] text-[0.9rem] font-normal opacity-85">Novos caminhos pedem conforto de verdade.</p>
              <Button asChild className="h-auto rounded-xl bg-foreground px-8 py-3.5 text-[0.95rem] font-semibold text-background shadow-[0_10px_20px_rgba(0,0,0,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-foreground hover:shadow-[0_14px_30px_rgba(0,0,0,0.4)]"><a href="#categorias">Comprar agora</a></Button>
            </div>
            <div className="flex flex-col justify-center gap-3">
              {faqs.map(([question, answer], index) => {
                const active = activeIndex === index;
                return (
                  <div key={question} role="button" tabIndex={0} aria-expanded={active} onClick={() => setActiveIndex(active ? -1 : index)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setActiveIndex(active ? -1 : index); }} className={`cursor-pointer rounded-[10px] border bg-background px-5 py-[18px] transition-all duration-200 ${active ? "border-border shadow-[0_4px_12px_rgba(0,0,0,0.04)]" : "border-muted hover:border-border shadow-[0_2px_8px_rgba(0,0,0,0.02)]"}`}>
                    <div className="flex items-center justify-between gap-4 text-[0.9rem] font-normal text-foreground"><span>{question}</span>{active ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</div>
                    {active && <p className="mt-3 text-[0.9rem] leading-[1.6] text-muted-foreground">{answer}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background pt-16">
        <div className="mx-auto w-full max-w-[1100px] px-5">
          <div className="mb-[50px] grid grid-cols-[2fr_1fr_1fr_2fr] gap-10 max-[900px]:grid-cols-2 max-[480px]:grid-cols-1">
            <div><p className="text-xl font-bold uppercase tracking-[0.24em]">Solatto</p><p className="mt-5 max-w-xs text-sm leading-6 text-muted-foreground">Calçados criados para levar conforto, personalidade e confiança a cada destino.</p></div>
            <div><h3 className="mb-4 text-sm font-semibold">Navegação</h3><ul className="space-y-3 text-sm text-muted-foreground"><li><a href="#inicio">Início</a></li><li><a href="#categorias">Calçados</a></li><li><a href="#novidades">Novidades</a></li><li><a href="#faq">Dúvidas</a></li></ul></div>
            <div><h3 className="mb-4 text-sm font-semibold">Institucional</h3><ul className="space-y-3 text-sm text-muted-foreground"><li><Link to="/sobre">Sobre nós</Link></li><li><a href="mailto:solattoecom@gmail.com">Contato</a></li><li><Link to="/termos">Termos de uso</Link></li><li><Link to="/privacidade">Privacidade</Link></li></ul></div>
            <NewsletterForm />
          </div>
          <div className="flex justify-between border-t border-border pb-[10px] pt-[25px] text-[0.85rem] text-muted-foreground max-[480px]:flex-col max-[480px]:items-center max-[480px]:gap-[15px]"><span>Todos os direitos reservados. © 2026 · CNPJ 51.987.195/0001-46</span><span>Solatto · Feito para caminhar</span></div>
        </div>
      </footer>
    </div>
  );
}