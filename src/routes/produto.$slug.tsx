import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Truck, RefreshCw, Tag } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/external";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";

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

  const [aba, setAba] = useState<"produto" | "caracteristicas" | "avaliacoes">("produto");

  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [minhaNota, setMinhaNota] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [podeAvaliar, setPodeAvaliar] = useState(false);

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
  const media =
    avaliacoes.length > 0
      ? avaliacoes.reduce((soma, a) => soma + a.nota, 0) / avaliacoes.length
      : 0;

  async function comprar() {
    if (!signedIn) {
      void navigate({ to: "/" });
      return;
    }
    if (variantes.length > 0 && !tamanho) {
      setAviso("Escolha a numeração antes de continuar.");
      return;
    }
    setAviso(null);
    await addItem(produto!.id, tamanho);
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
              const t = e.touches[0];
              (e.currentTarget as HTMLDivElement).dataset.touchX = String(t.clientX);
            }}
            onTouchEnd={(e) => {
              const startX = Number((e.currentTarget as HTMLDivElement).dataset.touchX ?? 0);
              const diff = startX - e.changedTouches[0].clientX;
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
              <p className="flex items-baseline gap-3">
                <span className="text-3xl font-semibold">{brl(Number(preco.preco))}</span>
                {preco.preco_original ? (
                  <span className="text-sm text-muted-foreground line-through">
                    {brl(Number(preco.preco_original))}
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Entre na sua conta para ver o preço</p>
            )}
          </div>

          {variantes.length > 0 ? (
            <div className="mt-6">
              <p className="text-sm font-medium">
                Tamanho{" "}
                <span className="text-muted-foreground">
                  {variantes.find((v) => v.id === tamanho)?.tamanho ?? ""}
                </span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {variantes.map((v) => {
                  const semEstoque = v.estoque <= 0;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={semEstoque}
                      onClick={() => {
                        setAviso(null);
                        setTamanho(v.id);
                      }}
                      className={`min-w-12 cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors ${
                        tamanho === v.id
                          ? "border-foreground bg-foreground text-background"
                          : "border-border hover:border-foreground"
                      } ${semEstoque ? "cursor-not-allowed opacity-40 line-through" : ""}`}
                    >
                      {v.tamanho}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={comprar}
            className="mt-6 w-full cursor-pointer rounded-full bg-foreground px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-background transition-colors hover:bg-foreground/90"
          >
            {signedIn ? "Comprar agora" : "Entrar para comprar"}
          </button>
          {aviso ? <p className="mt-2 text-xs text-destructive">{aviso}</p> : null}

          <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2"><Truck className="size-4 shrink-0 text-foreground" /> Envio para todo o Brasil.</li>
            <li className="flex items-center gap-2"><RefreshCw className="size-4 shrink-0 text-foreground" /> Troca fácil em até 7 dias úteis.</li>
            <li className="flex items-center gap-2"><Tag className="size-4 shrink-0 text-foreground" /> Frete grátis em compras acima de R$ 399.</li>
          </ul>

        </div>
      </div>

      <div className="mt-12 border-t border-border">
        <div className="flex gap-0 border-b border-border">
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
    </main>
  );
}
