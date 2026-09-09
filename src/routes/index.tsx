import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  ChevronUp,
  Menu,
  Search,
  ShoppingBag,
  Store,
  Truck,
  UserRound,
  X,
} from "lucide-react";

import heroImage from "@/assets/solatto-hero-social.jpg";
import social1 from "@/assets/social-1.jpg.asset.json";
import social2 from "@/assets/social-2.jpg.asset.json";
import social3 from "@/assets/social-3.jpg.asset.json";
import oxford1 from "@/assets/oxford-areia-1.jpg.asset.json";
import oxford2 from "@/assets/oxford-areia-2.jpg.asset.json";
import oxford3 from "@/assets/oxford-areia-3.jpg.asset.json";
import infantil1 from "@/assets/infantil-1.jpg.asset.json";
import infantil2 from "@/assets/infantil-2.jpg.asset.json";
import infantil3 from "@/assets/infantil-3.jpg.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    images: [social1.url, social2.url, social3.url],
  },
  {
    name: "Oxford",
    description: "Clássico preto com cadarço",
    images: [oxford1.url, oxford2.url, oxford3.url],
  },
  {
    name: "Infantil",
    description: "Conforto e elegância para os pequenos",
    images: [infantil1.url, infantil2.url, infantil3.url],
  },
];

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
      className="group relative aspect-square overflow-hidden bg-[#F5EFE6]"
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
          className={`absolute inset-0 h-full w-full object-contain object-center transition-opacity duration-300 ${imageIndex === index ? "opacity-100" : "opacity-0"}`}
        />
      ))}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/85 to-transparent px-6 pb-7 pt-24 text-background">
        <h3 className="text-2xl font-semibold">{name}</h3>
        <p className="mt-1 text-sm text-background/80">{description}</p>
      </div>
    </a>
  );
}

const accountTypes = [
  { id: "varejo", name: "Varejo", description: "Compre para você, com entrega em todo o Brasil.", Icon: Store },
  { id: "atacado", name: "Atacado", description: "Compras em volume com condições especiais.", Icon: Building2 },
  { id: "dropshipping", name: "Dropshipping", description: "Venda sem estoque, nós enviamos por você.", Icon: Truck },
] as const;

type AccountType = (typeof accountTypes)[number];

function Index() {
  const [showAccess, setShowAccess] = useState(true);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [form, setForm] = useState({ nome: "", sobrenome: "", email: "", senha: "" });
  const [mobileMenu, setMobileMenu] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const closeAccess = () => {
    setShowAccess(false);
    setAccountType(null);
    setShowLogin(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {showAccess && (
        <div className="c5-animated-gradient fixed inset-0 z-50 grid min-h-[100dvh] place-items-center overflow-hidden px-5 py-8">
          <div className="absolute inset-0 bg-foreground/35" />
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
                  <form
                    className="grid gap-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      closeAccess();
                    }}
                  >
                    <Input required type="email" aria-label="E-mail" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} className="h-12 border-primary-foreground/40 bg-background/75 text-foreground backdrop-blur-sm placeholder:text-muted-foreground" />
                    <Input required type="password" aria-label="Senha" placeholder="Senha" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} minLength={8} maxLength={72} className="h-12 border-primary-foreground/40 bg-background/75 text-foreground backdrop-blur-sm placeholder:text-muted-foreground" />
                    <Button type="submit" className="h-12 rounded-md bg-foreground text-background hover:bg-foreground/90">Entrar</Button>
                  </form>
                </>
              ) : accountType ? (
                <>
                  <Button variant="link" className="mb-3 h-auto px-0 text-xs text-primary-foreground/80 hover:text-primary-foreground" onClick={() => setAccountType(null)}>
                    <ArrowLeft className="size-3" /> Voltar
                  </Button>
                  <h1 className="mb-2 text-3xl font-semibold leading-tight sm:text-4xl">Cadastro {accountType.name}</h1>
                  <p className="mb-7 max-w-sm text-sm leading-6 opacity-85">{accountType.description}</p>
                  <form
                    className="grid gap-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      closeAccess();
                    }}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input required aria-label="Nome" placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={60} className="h-12 border-primary-foreground/40 bg-background/75 text-foreground backdrop-blur-sm placeholder:text-muted-foreground" />
                      <Input required aria-label="Sobrenome" placeholder="Sobrenome" value={form.sobrenome} onChange={(e) => setForm({ ...form, sobrenome: e.target.value })} maxLength={60} className="h-12 border-primary-foreground/40 bg-background/75 text-foreground backdrop-blur-sm placeholder:text-muted-foreground" />
                    </div>
                    <Input required type="email" aria-label="E-mail" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} className="h-12 border-primary-foreground/40 bg-background/75 text-foreground backdrop-blur-sm placeholder:text-muted-foreground" />
                    <Input required type="password" aria-label="Senha" placeholder="Senha" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} minLength={8} maxLength={72} className="h-12 border-primary-foreground/40 bg-background/75 text-foreground backdrop-blur-sm placeholder:text-muted-foreground" />
                    <Button type="submit" className="h-12 rounded-md bg-foreground text-background hover:bg-foreground/90">Criar conta</Button>
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

      <div className="bg-foreground py-2 text-center text-[11px] font-medium text-background">Frete grátis acima de R$ 399 · até 10x sem juros</div>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] w-full max-w-[1180px] items-center gap-8 px-5">
          <Button variant="ghost" size="icon" aria-label="Abrir menu" className="md:hidden" onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? <X /> : <Menu />}
          </Button>
          <a href="#inicio" className="text-xl font-bold uppercase tracking-[0.24em]">Solatto</a>
          <nav className={`${mobileMenu ? "flex" : "hidden"} absolute left-0 top-[72px] w-full flex-col gap-5 border-b border-border bg-background p-6 md:static md:flex md:w-auto md:flex-row md:border-0 md:p-0`}>
            <a href="#categorias" className="text-sm hover:text-primary">Calçados</a>
            <a href="#novidades" className="text-sm hover:text-primary">Novidades</a>
            <a href="#faq" className="text-sm hover:text-primary">Ajuda</a>
          </nav>
          <div className="ml-auto hidden max-w-xs flex-1 items-center rounded-full border border-border px-4 lg:flex">
            <Input aria-label="Buscar produtos" placeholder="O que você procura?" className="h-9 border-0 p-0 shadow-none focus-visible:ring-0" />
            <Search className="size-4 text-muted-foreground" />
          </div>
          <Button variant="ghost" size="icon" aria-label="Minha conta" onClick={() => setShowAccess(true)}><UserRound /></Button>
          <Button variant="ghost" size="icon" aria-label="Sacola de compras"><ShoppingBag /></Button>
        </div>
      </header>

      <main id="inicio">
        <section className="relative min-h-[620px] overflow-hidden bg-primary text-primary-foreground">
          <img src={heroImage} alt="Sapato social Solatto em couro preto" width={1600} height={900} className="absolute inset-0 h-full w-full object-cover object-[67%_center]" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/70 to-transparent" />
          <div className="relative mx-auto flex min-h-[620px] w-full max-w-[1180px] items-center px-5 py-20">
            <div className="max-w-lg animate-fade-in">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em]">Nova coleção · Movimento 26</p>
              <h1 className="text-5xl font-semibold leading-[0.98] tracking-normal sm:text-7xl">Conforto para todos os seus caminhos.</h1>
              <p className="mt-6 max-w-sm text-base leading-7 text-primary-foreground/85">Design contemporâneo, materiais selecionados e leveza para ir mais longe.</p>
              <Button className="mt-8 h-12 rounded-md bg-foreground px-7 text-background hover:bg-foreground/90">Conheça a coleção</Button>
            </div>
          </div>
        </section>

        <section id="categorias" className="py-20">
          <div className="mx-auto w-full max-w-[1180px] px-5">
            <div className="mb-10 flex items-end justify-between gap-5">
              <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">Escolha o seu estilo</p><h2 className="text-3xl font-semibold sm:text-4xl">Feito para a vida em movimento.</h2></div>
              <a href="#novidades" className="hidden border-b border-foreground pb-1 text-sm md:block">Ver todos</a>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {categories.map((category) => (
                <CategoryCard key={category.name} {...category} />
              ))}
            </div>
          </div>
        </section>

        <section id="novidades" className="bg-muted py-16 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Solatto essencial</p>
          <h2 className="mx-auto mt-4 max-w-2xl px-5 text-3xl font-medium leading-tight sm:text-5xl">Feito no Brasil, pensado para acompanhar você.</h2>
        </section>

        <section id="faq" className="py-20 max-[900px]:py-[60px]">
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