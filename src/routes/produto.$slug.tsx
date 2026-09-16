import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Truck, RefreshCw, Tag } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/external";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { quoteShipping, type ShippingQuote } from "@/lib/shipping.functions";
import { cadastrarAlertaEstoque } from "@/lib/stock-alerts.functions";
import { isValidEmail } from "@/lib/validate";

export const Route = createFileRoute("/produto/$slug")({
  component: ProductPage,
  head: ({ params }) => ({
    meta: [
      { title: `Calçado ${params.slug} | Solatto` },
      {
        name: "description",
        content:
          "Detalhes do calçado Solatto: fotos, numeração, descrição, características e avaliações de quem já comprou.",
      },
      { property: "og:title", content: `Calçado ${params.slug} | Solatto` },
      {
        property: "og:description",
        content: "Fotos, numeração, descrição e avaliações do calçado na loja Solatto.",
      },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => <Aviso titulo="Não foi possível abrir este calçado" />,
  notFoundComponent: () => <Aviso titulo="Calçado não encontrado" />,
});

type Produto = {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  categories: { nome: string } | null;
  product_images: { url: string; ordem: number }[];
  product_variants: { id: string; tamanho: string; estoque: number; cor: string | null; sku: string | null }[];
  product_prices?: { preco: number; preco_original: number | null }[];
};

type Avaliacao = {
  id: string;
  user_id: string;
  nota: number;
  comentario: string | null;
  autor_nome: string;
  criado_em: string;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Aviso({ titulo }: { titulo: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold">{titulo}</h1>
      <Link to="/" className="text-sm underline underline-offset-4">
        Voltar para a loja
      </Link>
    </main>
  );
}

function Estrelas({
  nota,
  onSelect,
  tamanho = "text-xl",
}: {
  nota: number;
  onSelect?: (n: number) => void;
  tamanho?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${tamanho}`}>
      {[1, 2, 3, 4, 5].map((n) =>
        onSelect ? (
          <button
            key={n}
            type="button"
            aria-label={`Dar nota ${n}`}
            onClick={() => onSelect(n)}
            className={`cursor-pointer leading-none transition-colors ${
              n <= nota ? "text-foreground" : "text-muted-foreground/40"
            }`}
          >
            ★
          </button>
        ) : (
          <span
            key={n}
            className={`leading-none ${n <= nota ? "text-foreground" : "text-muted-foreground/30"}`}
          >
            ★
          </span>
        ),
      )}
    </span>
  );
}

function ProductPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCart(user?.id ?? null);

  const [produto, setProduto] = useState<Produto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [foto, setFoto] = useState(0);
  const [tamanho, setTamanho] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [cep, setCep] = useState("");
  const [freteResultado, setFreteResultado] = useState<ShippingQuote | null>(null);
  const [freteErro, setFreteErro] = useState<string | null>(null);
  const [calculando, setCalculando] = useState(false);

  const [alertaNome, setAlertaNome] = useState("");
  const [alertaEmail, setAlertaEmail] = useState("");
  const [alertaEnviado, setAlertaEnviado] = useState(false);
  const [alertaSalvando, setAlertaSalvando] = useState(false);
  const [alertaErro, setAlertaErro] = useState<string | null>(null);

  const [aba, setAba] = useState<"produto" | "caracteristicas" | "avaliacoes">(
    typeof window !== "undefined" && window.location.hash === "#avaliacoes" ? "avaliacoes" : "produto"
  );

  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [minhaNota, setMinhaNota] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [podeAvaliar, setPodeAvaliar] = useState(false);
  const [relacionados, setRelacionados] = useState<Produto[]>([]);

  const signedIn = Boolean(user);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    const colunas = signedIn
      ? "id, nome, slug, descricao, categories(nome), product_images(url, ordem), product_variants(id, tamanho, estoque, cor, sku), product_prices(preco, preco_original)"
      : "id, nome, slug, descricao, categories(nome), product_images(url, ordem), product_variants(id, tamanho, estoque, cor, sku)";
    supabase
      .from("products")
      .select(colunas)
      .eq("slug", slug)
      .eq("ativo", true)
      .maybeSingle()
      .then(({ data }) => {
        if (!ativo) return;
        setProduto((data as unknown as Produto) ?? null);
        setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [slug, signedIn]);

  const carregarAvaliacoes = useCallback(async (produtoId: string) => {
    const { data } = await supabase
      .from("product_reviews")
      .select("id, user_id, nota, comentario, autor_nome, criado_em")
      .eq("produto_id", produtoId)
      .order("criado_em", { ascending: false });
    setAvaliacoes((data as unknown as Avaliacao[]) ?? []);
  }, []);

  useEffect(() => {
    if (produto) void carregarAvaliacoes(produto.id);
  }, [produto, carregarAvaliacoes]);

  useEffect(() => {
    const minha = avaliacoes.find((a) => a.user_id === user?.id);
    if (minha) setMinhaNota(minha.nota);
  }, [avaliacoes, user?.id]);

  useEffect(() => {
    if (!produto) return;
    const categoriaNome = produto.categories?.nome;
    supabase
      .from("products")
      .select("id, nome, slug, categories(nome), product_images(url, ordem), product_prices(preco, preco_original), product_reviews(nota)")
      .neq("id", produto.id)
      .limit(20)
      .then(({ data }) => {
        const lista = (data ?? []) as unknown as Produto[];
        const filtrados = categoriaNome
          ? lista.filter((p) => p.categories?.nome === categoriaNome)
          : lista;
        setRelacionados(filtrados.slice(0, 6));
      });
  }, [produto]);

  useEffect(() => {
    if (!user || !produto) return;
    supabase
      .from("order_items")
      .select("pedido_id, orders!inner(usuario_id, status)")
      .eq("produto_id", produto.id)
      .then(({ data }) => {
        const comprou = (data ?? []).some((item: unknown) => {
          const d = item as { orders: { usuario_id: string; status: string } };
          return (
            d.orders.usuario_id === user.id &&
            ["pago", "separando", "enviado", "entregue"].includes(d.orders.status)
          );
        });
        setPodeAvaliar(comprou);
      });
  }, [user, produto]);

  if (carregando) {
    return <Aviso titulo="Carregando calçado..." />;
  }
  if (!produto) {
    return <Aviso titulo="Calçado não encontrado" />;
  }

  const imagens = [...(produto.product_images ?? [])].sort((a, b) => a.ordem - b.ordem);
  const variantes = [...(produto.product_variants ?? [])].sort((a, b) =>
    a.tamanho.localeCompare(b.tamanho, "pt-BR", { numeric: true }),
  );
  const preco = produto.product_prices?.[0];

  const tamanhoSelecionadoObj = variantes.find((v) => v.id === tamanho);
  const tamanhoSelecionadoIndisponivel =
    tamanho !== null && (!tamanhoSelecionadoObj || tamanhoSelecionadoObj.estoque <= 0);

  async function cadastrarAlerta() {
    if (!produto || !tamanho) return;
    if (!isValidEmail(alertaEmail)) { setAlertaErro("Digite um e-mail válido."); return; }
    const tam = tamanhoSelecionadoObj?.tamanho ?? tamanho;
    setAlertaSalvando(true);
    setAlertaErro(null);
    try {
      await cadastrarAlertaEstoque({
        data: { produto_id: produto.id, tamanho: tam, nome: alertaNome, email: alertaEmail },
      });
      setAlertaEnviado(true);
    } catch (err) {
      setAlertaErro("Erro ao salvar. Tente novamente.");
      console.error(err);
    }
    setAlertaSalvando(false);
  }
  const media =
    avaliacoes.length > 0
      ? avaliacoes.reduce((soma, a) => soma + a.nota, 0) / avaliacoes.length
      : 0;

  async function comprar() {
    if (!signedIn) {
      sessionStorage.setItem("openLogin", "true");
      void navigate({ to: "/" });
      return;
    }
    if (!tamanho || tamanhoSelecionadoIndisponivel) {
      setAviso(tamanhoSelecionadoIndisponivel ? "Este tamanho está indisponível." : "Escolha a numeração antes de continuar.");
      return;
    }
    setAviso(null);
    await addItem(produto!.id, tamanhoSelecionadoObj?.id ?? tamanho);
    void navigate({ to: "/checkout" });
  }

  async function enviarAvaliacao() {
    if (!user || minhaNota < 1) return;
    setSalvando(true);
    const { data: perfil } = await supabase
      .from("profiles")
      .select("nome")
      .eq("id", user.id)
      .maybeSingle();
    await supabase.from("product_reviews").upsert(
      {
        produto_id: produto!.id,
        user_id: user.id,
        nota: minhaNota,
        autor_nome: perfil?.nome ?? "Cliente",
      },
      { onConflict: "produto_id,user_id" },
    );
    await carregarAvaliacoes(produto!.id);
    setSalvando(false);
  }

  async function apagarAvaliacao(id: string) {
    await supabase.from("product_reviews").delete().eq("id", id);
    setMinhaNota(0);
    await carregarAvaliacoes(produto!.id);
  }

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6">
      <Link
        to="/"
        className="mb-6 inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Voltar
      </Link>

      <nav className="mb-6 text-xs text-muted-foreground">
        <Link to="/" className="cursor-pointer hover:text-foreground">
          Início
        </Link>
        <span className="px-2">›</span>
        <span>{produto.categories?.nome ?? "Calçados"}</span>
        <span className="px-2">›</span>
        <span className="text-foreground">{produto.nome}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <div className="flex gap-4">
          <div className="hidden w-24 shrink-0 flex-col gap-3 sm:flex">
            {imagens.map((img, i) => (
              <button
                key={img.url}
                type="button"
                onClick={() => setFoto(i)}
                aria-label={`Ver foto ${i + 1}`}
                className={`aspect-square cursor-pointer overflow-hidden rounded-lg border bg-background transition-colors ${
                  i === foto ? "border-foreground" : "border-border hover:border-foreground/50"
                }`}
              >
                <img src={img.url} alt="" className="h-full w-full object-contain" />
              </button>
            ))}
          </div>
          <div
            className="relative flex-1 overflow-hidden rounded-2xl border border-border bg-background"
            onTouchStart={(e) => {
              (e.currentTarget as HTMLDivElement).dataset['touchX'] = String(e.touches[0]?.clientX ?? 0);
            }}
            onTouchEnd={(e) => {
              const startX = Number((e.currentTarget as HTMLDivElement).dataset['touchX'] ?? 0);
              const diff = startX - (e.changedTouches[0]?.clientX ?? 0);
              if (Math.abs(diff) > 40) setFoto((f) => (f + (diff > 0 ? 1 : -1) + imagens.length) % imagens.length);
            }}
          >
            <div className="aspect-square">
              {imagens.map((img, i) => (
                <img
                  key={img.url}
                  src={img.url}
                  alt={`${produto.nome} — foto ${i + 1}`}
                  className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${
                    i === foto ? "opacity-100" : "opacity-0"
                  }`}
                />
              ))}
            </div>
            {imagens.length > 1 ? (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
                {imagens.map((img, i) => (
                  <button
                    key={`p-${img.url}`}
                    type="button"
                    aria-label={`Foto ${i + 1}`}
                    onClick={() => setFoto(i)}
                    className={`h-1.5 cursor-pointer rounded-full transition-all ${
                      i === foto ? "w-6 bg-foreground" : "w-1.5 bg-foreground/30"
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-3">
            <Estrelas nota={Math.round(media)} tamanho="text-base" />
            <span className="text-xs text-muted-foreground">
              {avaliacoes.length > 0
                ? `${media.toFixed(1)} · ${avaliacoes.length} avaliação${avaliacoes.length > 1 ? "es" : ""}`
                : "Sem avaliações ainda"}
            </span>
          </div>

          <h1 className="mt-3 text-2xl font-semibold uppercase leading-tight sm:text-3xl">
            {produto.nome}
          </h1>
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {produto.categories?.nome}
          </p>

          <div className="mt-5">
            {preco ? (
              <div>
                <p className="flex items-baseline gap-3">
                  <span className="text-3xl font-semibold">{brl(Number(preco.preco))}</span>
                  {preco.preco_original ? (
                    <span className="text-sm text-muted-foreground line-through">
                      {brl(Number(preco.preco_original))}
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  <span className="text-green-600 font-medium">{brl(Number(preco.preco) * 0.9)} no PIX</span>
                  {" · "}ou 10x de {brl(Number(preco.preco) / 10)} sem juros
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Entre na sua conta para ver o preço</p>
            )}
          </div>

          <div className="mt-6">
            <p className="text-sm font-medium">
              Tamanho{" "}
              <span className="text-muted-foreground">{tamanhoSelecionadoObj?.tamanho ?? ""}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {variantes.map((variante) => {
                const comEstoque = variante.estoque > 0;
                const selecionado = tamanho === variante.id;
                return (
                  <button
                    key={variante.id}
                    type="button"
                    onClick={() => {
                      setAviso(null);
                      setAlertaEnviado(false);
                      setTamanho(variante.id);
                    }}
                    className={`min-w-12 cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors ${
                      selecionado
                        ? "border-foreground bg-foreground text-background"
                        : comEstoque
                          ? "border-border hover:border-foreground"
                          : "border-border text-muted-foreground/50 line-through hover:border-foreground/40"
                    }`}
                  >
                    {variante.tamanho}
                  </button>
                );
              })}
            </div>
          </div>

          {tamanhoSelecionadoIndisponivel ? (
            <div className="mt-6">
              <p className="text-lg font-bold uppercase">Produto indisponível</p>
              <p className="mt-0.5 text-xs uppercase tracking-widest text-muted-foreground">
                Avise-me quando chegar
              </p>
              {alertaEnviado ? (
                <p className="mt-3 text-sm text-green-600">
                  Pronto! Você será avisado quando o tamanho chegar.
                </p>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="Seu nome"
                    value={alertaNome}
                    onChange={(e) => setAlertaNome(e.target.value)}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
                  />
                  <input
                    type="email"
                    placeholder="Seu e-mail"
                    value={alertaEmail}
                    onChange={(e) => setAlertaEmail(e.target.value)}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
                  />
                  <button
                    type="button"
                    disabled={!alertaNome.trim() || !alertaEmail.trim() || alertaSalvando}
                    onClick={cadastrarAlerta}
                    className="cursor-pointer rounded-full border border-foreground px-6 py-2.5 text-sm font-semibold uppercase tracking-wide transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
                  >
                    {alertaSalvando ? "Salvando..." : "Avise-me"}
                  </button>
                  {alertaErro ? <p className="text-xs text-destructive">{alertaErro}</p> : null}
                </div>
              )}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={comprar}
                className="mt-6 w-full cursor-pointer rounded-full bg-foreground px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-background transition-colors hover:bg-foreground/90"
              >
                {signedIn ? "Comprar agora" : "Entrar para comprar"}
              </button>
              {aviso ? <p className="mt-2 text-xs text-destructive">{aviso}</p> : null}
            </>
          )}

          <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2"><Truck className="size-4 shrink-0 text-foreground" /> Envio para todo o Brasil.</li>
            <li className="flex items-center gap-2"><RefreshCw className="size-4 shrink-0 text-foreground" /> Troca fácil em até 7 dias úteis.</li>
            <li className="flex items-center gap-2"><Tag className="size-4 shrink-0 text-foreground" /> Frete grátis em compras acima de R$ 399.</li>
          </ul>

          <div className="mt-6">
            <p className="mb-2 text-sm font-medium">Calcular frete</p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                placeholder="00000-000"
                maxLength={9}
                value={cep}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 8);
                  setCep(v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v);
                  setFreteResultado(null);
                  setFreteErro(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void (async () => {
                      if (cep.replace(/\D/g, "").length !== 8) return;
                      setCalculando(true);
                      setFreteErro(null);
                      try {
                        const r = await quoteShipping({ data: { cep, itens: 1, subtotal: preco ? Number(preco.preco) : 0 } });
                        setFreteResultado(r);
                      } catch (err) {
                        setFreteErro((err as Error).message);
                      } finally {
                        setCalculando(false);
                      }
                    })();
                  }
                }}
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
              />
              <button
                type="button"
                disabled={calculando || cep.replace(/\D/g, "").length !== 8}
                onClick={async () => {
                  setCalculando(true);
                  setFreteErro(null);
                  try {
                    const r = await quoteShipping({ data: { cep, itens: 1, subtotal: preco ? Number(preco.preco) : 0 } });
                    setFreteResultado(r);
                  } catch (err) {
                    setFreteErro((err as Error).message);
                  } finally {
                    setCalculando(false);
                  }
                }}
                className="cursor-pointer rounded-xl border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-foreground disabled:opacity-50"
              >
                {calculando ? "..." : "OK"}
              </button>
            </div>
            {freteErro ? <p className="mt-2 text-xs text-destructive">{freteErro}</p> : null}
            {freteResultado ? (
              <div className="mt-3">
                <p className="mb-2 text-xs text-muted-foreground">
                  {freteResultado.cidade} — {freteResultado.uf}
                </p>
                <ul className="space-y-2">
                  {freteResultado.opcoes.map((op) => (
                    <li key={op.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
                      <span>
                        <span className="font-medium">{op.nome}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{op.prazo}</span>
                      </span>
                      <span className="font-semibold">
                        {op.valor === 0 ? "Grátis" : brl(op.valor)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

        </div>
      </div>

      <div className="mt-12 border-t border-border">
        <div className="flex border-b border-border">
          {(
            [
              ["produto", "Produto"],
              ["caracteristicas", "Características"],
              ["avaliacoes", `Avaliações${avaliacoes.length ? ` (${avaliacoes.length})` : ""}`],
            ] as const
          ).map(([chave, rotulo]) => (
            <button
              key={chave}
              type="button"
              onClick={() => setAba(chave)}
              className={`cursor-pointer px-6 py-4 text-sm font-medium transition-colors border-b-2 -mb-px ${
                aba === chave
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>

        <div className="py-8">
          {aba === "produto" ? (
            produto.descricao ? (
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground">{produto.descricao}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Sem descrição para este produto.</p>
            )
          ) : aba === "caracteristicas" ? (
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><span className="font-medium text-foreground">Categoria:</span> {produto.categories?.nome ?? "Calçados"}</li>
              <li><span className="font-medium text-foreground">Numerações:</span> {variantes.map((v) => v.tamanho).join(", ") || "sob consulta"}</li>
              {variantes[0]?.cor ? <li><span className="font-medium text-foreground">Cor:</span> {variantes[0].cor}</li> : null}
              {variantes[0]?.sku ? <li><span className="font-medium text-foreground">Código:</span> {variantes[0].sku}</li> : null}
            </ul>
          ) : (
            <>
              {podeAvaliar ? (
                <div className="mb-6 flex items-center gap-4">
                  <Estrelas nota={minhaNota} onSelect={setMinhaNota} />
                  <button
                    type="button"
                    disabled={minhaNota < 1 || salvando}
                    onClick={enviarAvaliacao}
                    className="cursor-pointer rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
                  >
                    {salvando ? "Enviando..." : "Avaliar"}
                  </button>
                </div>
              ) : signedIn ? (
                <p className="mb-6 text-sm text-muted-foreground">
                  Apenas clientes que compraram este calçado podem avaliá-lo.
                </p>
              ) : (
                <p className="mb-6 text-sm text-muted-foreground">
                  <Link to="/" className="cursor-pointer underline underline-offset-4">Entre na sua conta</Link>{" "}
                  para avaliar este calçado.
                </p>
              )}
              <ul className="space-y-6">
                {avaliacoes.length === 0 ? (
                  <li className="text-sm text-muted-foreground">Ainda não há avaliações para este calçado.</li>
                ) : null}
                {avaliacoes.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 border-b border-border pb-4 last:border-0">
                    <Estrelas nota={a.nota} tamanho="text-sm" />
                    <span className="text-sm font-medium">{a.autor_nome}</span>
                    <span className="text-xs text-muted-foreground">{new Date(a.criado_em).toLocaleDateString("pt-BR")}</span>
                    {a.user_id === user?.id ? (
                      <button
                        type="button"
                        onClick={() => apagarAvaliacao(a.id)}
                        className="cursor-pointer text-xs text-destructive underline underline-offset-4"
                      >
                        apagar
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {relacionados.length > 0 && (
        <section className="mt-12 border-t border-border pt-8 px-4 sm:px-6">
          <h2 className="mb-5 text-lg font-semibold">Clientes também compraram</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {relacionados.map((rel) => {
              const img = [...(rel.product_images ?? [])].sort((a, b) => a.ordem - b.ordem)[0];
              const preco = (rel.product_prices ?? [])[0];
              const reviews = (rel as unknown as { product_reviews?: { nota: number }[] }).product_reviews ?? [];
              const media = reviews.length > 0 ? reviews.reduce((s, r) => s + r.nota, 0) / reviews.length : 0;
              return (
                <Link
                  key={rel.id}
                  to="/produto/$slug"
                  params={{ slug: rel.slug }}
                  className="w-40 shrink-0 rounded-xl border border-border bg-background p-3 transition-colors hover:bg-muted/40"
                >
                  <div className="mb-2 aspect-square overflow-hidden rounded-lg bg-muted">
                    {img && <img src={img.url} alt={rel.nome} className="h-full w-full object-contain" />}
                  </div>
                  <p className="truncate text-xs font-medium">{rel.nome}</p>
                  {preco && <p className="mt-0.5 text-xs font-semibold">{Number(preco.preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>}
                  {reviews.length > 0 && (
                    <div className="mt-0.5 flex items-center gap-0.5">
                      {[1,2,3,4,5].map((n) => (
                        <span key={n} className={`text-xs ${n <= Math.round(media) ? "text-foreground" : "text-muted-foreground/30"}`}>★</span>
                      ))}
                      <span className="text-xs text-muted-foreground">({reviews.length})</span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
