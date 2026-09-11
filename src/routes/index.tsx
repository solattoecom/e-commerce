import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  ChevronUp,
  Heart,
  MapPin,
  Search,
  ShoppingBag,
  Store,
  Truck,
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
import { Input } from "@/components/ui/input";
import { ProductGrid } from "@/components/ProductGrid";
import { ShippingCalculator } from "@/components/ShippingCalculator";
import type { ShippingOption } from "@/lib/shipping.functions";
import { supabase } from "@/integrations/supabase/external";
import { useIsAdmin } from "@/hooks/useIsAdmin";

import { deleteMyAccount } from "@/lib/account.functions";
import { signIn, signOut, signUpWithType, useAuth, type ClientType } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";

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
      { name: "twitter:card", content: "summary_large_image" },
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
  onProfile,
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
  onProfile: () => void;
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
          <button
            type="button"
            aria-label="Nossa localização"
            onClick={() => {}}
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <MapPin className="size-[18px]" />
          </button>
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
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onProfile();
                  }}
                  className="block w-full cursor-pointer px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                >
                  Meu perfil
                </button>
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
          {headerCategories.map(({ label, href, desktopOnly }) => (
            <a
              key={label}
              href={href}
              className={`shrink-0 cursor-pointer whitespace-nowrap text-foreground/70 transition-colors hover:text-foreground ${
                desktopOnly ? "hidden sm:inline" : ""
              }`}
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

function ProfileDialog({
  userId,
  email,
  onClose,
  onDeleted,
}: {
  userId: string;
  email: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [dados, setDados] = useState<{ nome: string; sobrenome: string; email: string; tipo: string | null } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: perfil }, { data: tipo }] = await Promise.all([
        supabase.from("profiles").select("nome, sobrenome").eq("id", userId).maybeSingle(),
        supabase.from("user_client_types").select("tipo").eq("user_id", userId).maybeSingle(),
      ]);
      if (!active) return;
      setDados({
        nome: perfil?.nome ?? "",
        sobrenome: perfil?.sobrenome ?? "",
        email,
        tipo: tipo?.tipo ?? null,
      });
    })();
    return () => {
      active = false;
    };
  }, [userId, email]);

  const salvar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dados) return;
    setSalvando(true);
    setErro(null);
    setMsg(null);
    try {
      const { error: perfilErro } = await supabase
        .from("profiles")
        .update({ nome: dados.nome.trim(), sobrenome: dados.sobrenome.trim() })
        .eq("id", userId);
      if (perfilErro) throw new Error(perfilErro.message);

      if (dados.email.trim() && dados.email.trim() !== email) {
        const { error: emailErro } = await supabase.auth.updateUser({ email: dados.email.trim() });
        if (emailErro) throw new Error(emailErro.message);
        setMsg("Dados salvos. Confirme o novo e-mail pelo link enviado.");
      } else {
        setMsg("Dados salvos.");
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    setExcluindo(true);
    setErro(null);
    try {
      await deleteMyAccount();
      await supabase.auth.signOut();
      onDeleted();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível excluir a conta.");
      setExcluindo(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-foreground/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Meu perfil</h2>
          <button type="button" onClick={onClose} aria-label="Fechar perfil" className="cursor-pointer rounded-full p-2 hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={salvar} className="space-y-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-muted-foreground">Nome</span>
              <Input
                value={dados?.nome ?? ""}
                onChange={(event) => setDados((atual) => (atual ? { ...atual, nome: event.target.value } : atual))}
                required
              />
            </label>
            <label className="space-y-1">
              <span className="text-muted-foreground">Sobrenome</span>
              <Input
                value={dados?.sobrenome ?? ""}
                onChange={(event) => setDados((atual) => (atual ? { ...atual, sobrenome: event.target.value } : atual))}
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-muted-foreground">E-mail</span>
            <Input
              type="email"
              value={dados?.email ?? ""}
              onChange={(event) => setDados((atual) => (atual ? { ...atual, email: event.target.value } : atual))}
              required
            />
          </label>
          <div className="space-y-1">
            <span className="text-muted-foreground">Tipo de conta</span>
            <p className="rounded-md border border-border bg-muted/50 px-3 py-2 capitalize text-muted-foreground">
              {dados?.tipo ?? "—"}
            </p>
          </div>

          {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
          {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}

          <Button type="submit" disabled={salvando || !dados} className="w-full bg-foreground text-background hover:bg-foreground/85">
            {salvando ? "Salvando…" : "Salvar alterações"}
          </Button>
        </form>

        <div className="mt-5 border-t border-border pt-4">
          {confirmar ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Excluir a conta apaga seus dados definitivamente.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={excluir}
                  disabled={excluindo}
                  className="flex-1 cursor-pointer rounded-md border border-red-600 bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-red-600 hover:text-white disabled:opacity-70"
                >
                  {excluindo ? "Excluindo…" : "Confirmar exclusão"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmar(false)}
                  className="flex-1 cursor-pointer rounded-md bg-muted px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted/70"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmar(true)}
              className="w-full cursor-pointer rounded-md border border-red-600 bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-red-600 hover:text-white"
            >
              Excluir conta
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const accountTypes = [
  { id: "varejo", name: "Varejo", description: "Compre para você, com entrega em todo o Brasil.", Icon: Store },
  { id: "atacado", name: "Atacado", description: "Compras em volume com condições especiais.", Icon: Building2 },
  { id: "dropshipping", name: "Dropshipping", description: "Venda sem estoque, nós enviamos por você.", Icon: Truck },
] as const;

type AccountType = (typeof accountTypes)[number];

function Index() {
  const { user, loading } = useAuth();
  const [showAccess, setShowAccess] = useState(true);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [form, setForm] = useState({ nome: "", sobrenome: "", email: "", senha: "" });
  const [activeIndex, setActiveIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [busca, setBusca] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);
  const [frete, setFrete] = useState<ShippingOption | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const cart = useCart(user?.id ?? null);
  const wishlist = useWishlist(user?.id ?? null);
  const navigate = useNavigate();

  const handleAddToCart = async (produtoId: string, variacaoId: string | null = null) => {
    if (!user) {
      setShowAccess(true);
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

  useEffect(() => {
    if (!loading && user) setShowAccess(false);
  }, [loading, user]);

  const closeAccess = () => {
    setShowAccess(false);
    setAccountType(null);
    setShowLogin(false);
    setErro(null);
    setAviso(null);
  };

  const mascararEmail = (email: string) => {
    const [nome = "", dominio = ""] = email.split("@");
    const visivel = nome.slice(0, 2);
    return `${visivel}${"*".repeat(Math.max(nome.length - visivel.length, 3))}@${dominio}`;
  };

  const traduzErro = (message: string) => {
    if (/already registered|already been registered/i.test(message)) return "Este e-mail já possui uma conta. Tente entrar.";
    if (/Invalid login credentials/i.test(message)) return "E-mail ou senha incorretos.";
    if (/pwned|compromised/i.test(message)) return "Escolha uma senha mais segura.";
    if (/at least/i.test(message)) return "A senha precisa ter pelo menos 8 caracteres.";
    if (/not confirmed|confirmation/i.test(message))
      return "Conta criada. Confirme o e-mail que enviamos para entrar.";
    return "Não foi possível concluir. Tente novamente.";

  };

  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accountType) return;
    setBusy(true);
    setErro(null);
    setAviso(null);
    try {
      await signUpWithType({ ...form, tipo: accountType.id as ClientType });
      const email = form.email.trim();
      setAviso(`Confirme o e-mail enviado para ${mascararEmail(email)}.`);
      setForm({ nome: "", sobrenome: "", email, senha: "" });
      setAccountType(null);
      setShowLogin(true);
    } catch (error) {
      setErro(traduzErro(error instanceof Error ? error.message : ""));
    } finally {
      setBusy(false);
    }
  };

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setErro(null);
    try {
      await signIn(form.email, form.senha);
      setForm({ nome: "", sobrenome: "", email: "", senha: "" });
      setRefreshKey((value) => value + 1);
      closeAccess();
    } catch (error) {
      setErro(traduzErro(error instanceof Error ? error.message : ""));
    } finally {
      setBusy(false);
    }
  };


  return (
    <div className="min-h-screen bg-background text-foreground">
      <StickyHeader
        visible={scrolled && !showAccess}
        user={user}
        onEnter={() => setShowAccess(true)}
        onSignOut={() => signOut()}
        onProfile={() => setShowProfile(true)}
        busca={busca}
        onBuscaChange={setBusca}
        cartCount={cart.count}
        onOpenCart={() => (user ? setShowCart(true) : setShowAccess(true))}
        wishlistCount={wishlist.count}
        onOpenWishlist={() => (user ? setShowWishlist(true) : setShowAccess(true))}
      />
      {showProfile && user ? (
        <ProfileDialog
          userId={user.id}
          email={user.email ?? ""}
          onClose={() => setShowProfile(false)}
          onDeleted={() => {
            setShowProfile(false);
            setRefreshKey((value) => value + 1);
          }}
        />
      ) : null}
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
                <ShippingCalculator
                  itens={cart.items.reduce((sum, item) => sum + item.quantidade, 0)}
                  subtotal={cart.total}
                  onSelect={setFrete}
                />
              ) : null}
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{Number(cart.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
              </div>
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
              <div className="mb-3 mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="text-lg font-semibold">
                  {Number(cart.total + (frete?.valor ?? 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
              <Button
                className="h-12 w-full rounded-md bg-foreground text-background hover:bg-foreground/90"
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
      {showAccess && (
        <div className="fixed inset-0 z-50 grid min-h-[100dvh] place-items-center overflow-hidden bg-black px-5 py-8">
          <video
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl"
            autoPlay
            loop
            muted
            playsInline
            src={heroVideo.url}
          />
          <div className="absolute inset-0 bg-foreground/45" />
          <div className="relative z-10 grid w-full max-w-[1100px] items-center md:grid-cols-[0.95fr_1.05fr]">
            <div className="access-panel max-w-md text-primary-foreground">
              <p className="mb-8 text-2xl font-bold uppercase tracking-[0.24em]">Solatto</p>

              {!accountType && !showLogin ? (
                <>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] opacity-80">Bem-vindo à sua nova jornada</p>
                  <h1 className="mb-5 text-4xl font-semibold leading-[1.05] tracking-normal sm:text-5xl">Como você quer comprar?</h1>
                  <p className="mb-8 max-w-sm text-sm leading-6 opacity-85">Escolha o tipo de cadastro para continuar.</p>
                  <div className="grid gap-3">
                    {accountTypes.map((type) => {
                      const { id, name, description, Icon } = type;
                      return (
                      <Button
                        key={id}
                        type="button"
                        variant="ghost"
                        onClick={() => setAccountType(type)}
                        className="h-auto justify-start gap-4 rounded-md border border-primary-foreground/40 bg-primary-foreground/10 px-5 py-4 text-left text-primary-foreground transition-colors hover:bg-primary-foreground/20 hover:text-primary-foreground"
                      >
                        <Icon className="size-5 shrink-0" />
                        <span>
                          <span className="block text-sm font-semibold">{name}</span>
                          <span className="block text-xs opacity-80">{description}</span>
                        </span>
                      </Button>
                      );
                    })}
                  </div>
                </>
              ) : showLogin ? (
                <>
                  <Button variant="link" className="mb-3 h-auto px-0 text-xs text-primary-foreground/80 hover:text-primary-foreground" onClick={() => setShowLogin(false)}>
                    <ArrowLeft className="size-3" /> Voltar
                  </Button>
                  <h1 className="mb-2 text-3xl font-semibold leading-tight sm:text-4xl">Entrar na sua conta</h1>
                  <p className="mb-7 max-w-sm text-sm leading-6 opacity-85">Use seu e-mail e senha para continuar.</p>
                  <form className="grid gap-3" onSubmit={handleSignIn}>
                    <Input required type="email" aria-label="E-mail" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} className="h-12 border-border/70 bg-background/75 text-foreground backdrop-blur-sm placeholder:text-muted-foreground hover:border-border focus-visible:border-border focus-visible:ring-foreground/20" />
                    <Input required type="password" aria-label="Senha" placeholder="Senha" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} minLength={8} maxLength={72} className="h-12 border-border/70 bg-background/75 text-foreground backdrop-blur-sm placeholder:text-muted-foreground hover:border-border focus-visible:border-border focus-visible:ring-foreground/20" />
                    {aviso ? <p className="text-sm font-medium text-primary-foreground">{aviso}</p> : null}
                    {erro ? <p className="text-sm text-primary-foreground">{erro}</p> : null}
                    <Button type="submit" disabled={busy} className="h-12 rounded-md bg-background text-foreground shadow-none hover:bg-background/90 hover:text-foreground">{busy ? "Entrando…" : "Entrar"}</Button>
                  </form>
                </>
              ) : accountType ? (
                <>
                  <Button variant="link" className="mb-3 h-auto px-0 text-xs text-primary-foreground/80 hover:text-primary-foreground" onClick={() => setAccountType(null)}>
                    <ArrowLeft className="size-3" /> Voltar
                  </Button>
                  <h1 className="mb-2 text-3xl font-semibold leading-tight sm:text-4xl">Cadastro {accountType.name}</h1>
                  <p className="mb-7 max-w-sm text-sm leading-6 opacity-85">{accountType.description}</p>
                  <form className="grid gap-3" onSubmit={handleSignUp}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input required aria-label="Nome" placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={60} className="h-12 border-border/70 bg-background/75 text-foreground backdrop-blur-sm placeholder:text-muted-foreground hover:border-border focus-visible:border-border focus-visible:ring-foreground/20" />
                      <Input required aria-label="Sobrenome" placeholder="Sobrenome" value={form.sobrenome} onChange={(e) => setForm({ ...form, sobrenome: e.target.value })} maxLength={60} className="h-12 border-border/70 bg-background/75 text-foreground backdrop-blur-sm placeholder:text-muted-foreground hover:border-border focus-visible:border-border focus-visible:ring-foreground/20" />
                    </div>
                    <Input required type="email" aria-label="E-mail" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} className="h-12 border-border/70 bg-background/75 text-foreground backdrop-blur-sm placeholder:text-muted-foreground hover:border-border focus-visible:border-border focus-visible:ring-foreground/20" />
                    <Input required type="password" aria-label="Senha" placeholder="Senha" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} minLength={8} maxLength={72} className="h-12 border-border/70 bg-background/75 text-foreground backdrop-blur-sm placeholder:text-muted-foreground hover:border-border focus-visible:border-border focus-visible:ring-foreground/20" />
                    {erro ? <p className="text-sm text-primary-foreground">{erro}</p> : null}
                    <Button type="submit" disabled={busy} className="h-12 rounded-md bg-background text-foreground shadow-none hover:bg-background/90 hover:text-foreground">{busy ? "Criando…" : "Criar conta"}</Button>
                  </form>
                </>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                {!showLogin && !accountType ? (
                  <Button variant="link" className="h-auto px-0 text-xs text-primary-foreground hover:text-primary-foreground/80" onClick={() => setShowLogin(true)}>
                    Já tenho uma conta
                  </Button>
                ) : null}
                <Button variant="link" className="h-auto px-0 text-xs text-primary-foreground/75 hover:text-primary-foreground" onClick={closeAccess}>
                  Continuar como visitante
                </Button>
              </div>
            </div>
          </div>
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
              <div className="flex items-center gap-2 rounded-full bg-neutral-900/90 py-3 pl-4 pr-6 backdrop-blur">
                <svg viewBox="0 0 256 256" className="h-5 w-5" aria-hidden="true">
                  <path
                    fill="#ffffff"
                    d="M 128 192 L 128 256 L 64.5 256 L 32 223 L 0 192 L 0 128 L 64 128 Z M 256 192 L 256 256 L 192.5 256 L 160 223 L 128 192 L 128 128 L 192 128 Z M 128 64 L 128 128 L 64.5 128 L 32 95 L 0 64 L 0 0 L 64 0 Z M 256 64 L 256 128 L 192.5 128 L 160 95 L 128 64 L 128 0 L 192 0 Z"
                  />
                </svg>
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
                  onClick={() => setShowAccess(true)}
                  className="hero-readex cursor-pointer rounded-full bg-white px-6 py-3 text-sm font-normal text-black transition-colors hover:bg-neutral-200"
                >
                  entrar
                </button>
              )}
            </nav>
          </div>

          <div className="relative h-full w-full">
            <h1 className="hero-title absolute left-4 top-[18%] text-[14vw] font-medium text-white md:left-10 md:text-[13vw]">conforto</h1>
            <h1 className="hero-title absolute right-4 top-[38%] text-[14vw] font-medium text-white md:right-10 md:text-[13vw]">em cada</h1>
            <h1 className="hero-title absolute left-[18%] top-[58%] text-[14vw] font-medium text-white md:left-[28%] md:text-[13vw]">passo</h1>

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

        <section id="novidades" className="scroll-mt-28 bg-background py-16">
          <div className="mx-auto w-full max-w-[1440px] px-5 md:px-8">
            <div className="mb-10 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/60">Solatto essencial</p>
              <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-medium leading-tight sm:text-5xl">Feito no Brasil, pensado para acompanhar você.</h2>
              <p className="mt-4 text-sm text-muted-foreground">
                {user ? "Preços exclusivos do seu tipo de conta." : "Entre na sua conta para ver os preços do seu perfil."}
              </p>
            </div>
            <ProductGrid
              signedIn={Boolean(user)}
              refreshKey={refreshKey}
              search={busca}
              onAdd={handleAddToCart}
              wishlistIds={wishlist.ids}
              onToggleWishlist={user ? (id) => wishlist.toggle(id) : undefined}
            />
          </div>
        </section>

        <section id="faq" className="scroll-mt-28 py-20 max-[900px]:py-[60px]">
          <div className="mx-auto grid w-full max-w-[1100px] grid-cols-[1.6fr_1fr] items-stretch gap-[30px] px-5 max-[900px]:grid-cols-1 max-[900px]:gap-[60px]">
            <div className="c5-animated-gradient flex flex-col items-center justify-center rounded-[24px] px-10 py-20 text-center text-primary-foreground shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
              <h2 className="mb-[15px] text-[clamp(2.5rem,6vw,3.5rem)] font-normal leading-[1.1] tracking-normal">Seu próximo par<br />começa aqui.</h2>
              <p className="mb-[30px] text-[0.9rem] font-normal opacity-85">Novos caminhos pedem conforto de verdade.</p>
              <Button className="h-auto rounded-xl bg-foreground px-8 py-3.5 text-[0.95rem] font-semibold text-background shadow-[0_10px_20px_rgba(0,0,0,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-foreground hover:shadow-[0_14px_30px_rgba(0,0,0,0.4)]">Comprar agora</Button>
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
            <div><h3 className="mb-4 text-sm font-semibold">Institucional</h3><ul className="space-y-3 text-sm text-muted-foreground"><li><a href="#">Sobre nós</a></li><li><a href="#">Contato</a></li><li><a href="#">Trocas</a></li></ul></div>
            <div><h3 className="mb-4 text-sm font-semibold">Newsletter</h3><p className="mb-[15px] text-[0.85rem] text-muted-foreground">Receba novidades e lançamentos em primeira mão.</p><div className="flex gap-[10px] max-[480px]:flex-col"><Input type="email" placeholder="Seu melhor e-mail" className="h-11 flex-grow rounded-[10px] border-border bg-background px-4 text-[0.9rem] shadow-inner" /><Button className="h-11 rounded-[10px] bg-foreground px-7 text-[0.9rem] font-semibold text-background shadow-[0_12px_24px_rgba(0,0,0,0.18)] hover:-translate-y-0.5 hover:bg-foreground/90">Assinar</Button></div></div>
          </div>
          <div className="flex justify-between border-t border-border pb-[10px] pt-[25px] text-[0.85rem] text-muted-foreground max-[480px]:flex-col max-[480px]:items-center max-[480px]:gap-[15px]"><span>Todos os direitos reservados. © 2026</span><span>Solatto · Feito para caminhar</span></div>
        </div>
      </footer>
    </div>
  );
}