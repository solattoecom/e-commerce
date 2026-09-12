import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/integrations/supabase/external"
import { notificarNovoProduto } from "@/lib/newsletter.functions"

type Categoria = { id: string; nome: string }
type Imagem = { id: string; url: string; ordem: number }
type Variante = { id: string; tamanho: string; estoque: number }
type Preco = { id: string; tipo: string; preco: number; preco_original: number | null }
type Produto = {
  id: string
  nome: string
  slug: string
  descricao: string | null
  categoria_id: string | null
  ativo: boolean
  categories: { nome: string } | null
  product_images: Imagem[]
  product_variants: Variante[]
  product_prices: Preco[]
}

const toSlug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

const TIPOS_PRECO = ["varejo", "atacado", "dropshipping"] as const

type TipoPreco = (typeof TIPOS_PRECO)[number]

type PrecoLocal = { preco: string; preco_original: string }

function imagemVazia(): Omit<Imagem, "id"> {
  return { url: "", ordem: 0 }
}

export function AdminProdutos() {
  const [view, setView] = useState<"list" | "edit">("list")
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [produtoAtual, setProdutoAtual] = useState<Produto | null>(null)

  const [nome, setNome] = useState("")
  const [slug, setSlug] = useState("")
  const [descricao, setDescricao] = useState("")
  const [categoriaId, setCategoriaId] = useState("")
  const [ativo, setAtivo] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  const [erroForm, setErroForm] = useState<string | null>(null)

  const [imagens, setImagens] = useState<Imagem[]>([])
  const [urlInput, setUrlInput] = useState("")
  const [uploadando, setUploadando] = useState(false)
  const [erroStorage, setErroStorage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [variantes, setVariantes] = useState<Variante[]>([])
  const [novaVariante, setNovaVariante] = useState<{ tamanho: string; estoque: string }>({ tamanho: "", estoque: "" })
  const [salvandoVariante, setSalvandoVariante] = useState<string | null>(null)

  const [precos, setPrecos] = useState<Record<TipoPreco, PrecoLocal>>({
    varejo: { preco: "", preco_original: "" },
    atacado: { preco: "", preco_original: "" },
    dropshipping: { preco: "", preco_original: "" },
  })
  const [salvandoPrecos, setSalvandoPrecos] = useState(false)

  const carregarProdutos = useCallback(async () => {
    setCarregando(true)
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, nome, slug, descricao, categoria_id, ativo, categories(nome), product_images(id, url, ordem), product_variants(id, tamanho, estoque), product_prices(id, tipo, preco, preco_original)",
      )
      .order("nome")
    if (error) setErro(error.message)
    else setProdutos((data ?? []) as unknown as Produto[])
    setCarregando(false)
  }, [])

  const carregarCategorias = useCallback(async () => {
    const { data } = await supabase.from("categories").select("id, nome").order("nome")
    setCategorias((data ?? []) as Categoria[])
  }, [])

  useEffect(() => {
    void carregarProdutos()
    void carregarCategorias()
  }, [carregarProdutos, carregarCategorias])

  function abrirNovo() {
    setProdutoAtual(null)
    setNome("")
    setSlug("")
    setDescricao("")
    setCategoriaId("")
    setAtivo(true)
    setImagens([])
    setVariantes([])
    setPrecos({
      varejo: { preco: "", preco_original: "" },
      atacado: { preco: "", preco_original: "" },
      dropshipping: { preco: "", preco_original: "" },
    })
    setErroForm(null)
    setErroStorage(null)
    setView("edit")
  }

  function abrirEditar(p: Produto) {
    setProdutoAtual(p)
    setNome(p.nome)
    setSlug(p.slug)
    setDescricao(p.descricao ?? "")
    setCategoriaId(p.categoria_id ?? "")
    setAtivo(p.ativo)
    setImagens([...(p.product_images ?? [])].sort((a, b) => a.ordem - b.ordem))
    setVariantes([...(p.product_variants ?? [])])
    const precosIniciais: Record<TipoPreco, PrecoLocal> = {
      varejo: { preco: "", preco_original: "" },
      atacado: { preco: "", preco_original: "" },
      dropshipping: { preco: "", preco_original: "" },
    }
    for (const pr of p.product_prices ?? []) {
      if (TIPOS_PRECO.includes(pr.tipo as TipoPreco)) {
        precosIniciais[pr.tipo as TipoPreco] = {
          preco: String(pr.preco),
          preco_original: pr.preco_original != null ? String(pr.preco_original) : "",
        }
      }
    }
    setPrecos(precosIniciais)
    setErroForm(null)
    setErroStorage(null)
    setView("edit")
  }

  function voltarLista() {
    setView("list")
    void carregarProdutos()
  }

  async function salvarBasico() {
    if (!nome.trim()) {
      setErroForm("Nome é obrigatório.")
      return
    }
    setSalvando(true)
    setErroForm(null)
    const slugFinal = slug.trim() || toSlug(nome)
    if (produtoAtual) {
      const { error } = await supabase
        .from("products")
        .update({
          nome: nome.trim(),
          slug: slugFinal,
          descricao: descricao.trim() || null,
          categoria_id: categoriaId || null,
          ativo,
        })
        .eq("id", produtoAtual.id)
      if (error) setErroForm(error.message)
      else {
        setSlug(slugFinal)
        setProdutoAtual((prev) => prev ? { ...prev, nome: nome.trim(), slug: slugFinal, descricao: descricao.trim() || null, categoria_id: categoriaId || null, ativo } : prev)
        void notificarNovoProduto({
          data: {
            nome: nome.trim(),
            descricao: descricao.trim() || null,
            slug: slugFinal,
            preco: precos.varejo.preco ? parseFloat(precos.varejo.preco) : null,
          },
        }).catch(() => {})
      }
    } else {
      const { data, error } = await supabase
        .from("products")
        .insert({
          nome: nome.trim(),
          slug: slugFinal,
          descricao: descricao.trim() || null,
          categoria_id: categoriaId || null,
          ativo,
        })
        .select("id, nome, slug, descricao, categoria_id, ativo, categories(nome), product_images(id, url, ordem), product_variants(id, tamanho, estoque), product_prices(id, tipo, preco, preco_original)")
        .single()
      if (error) setErroForm(error.message)
      else {
        setSlug(slugFinal)
        setProdutoAtual(data as unknown as Produto)
        void notificarNovoProduto({
          data: {
            nome: nome.trim(),
            descricao: descricao.trim() || null,
            slug: slugFinal,
            preco: (data as unknown as Produto).product_prices?.[0]?.preco ?? null,
          },
        }).catch(() => {})
      }
    }
    setSalvando(false)
  }

  async function excluirProduto() {
    if (!produtoAtual) return
    const confirmado = window.confirm(
      `Excluir "${produtoAtual.nome}"? Esta ação não pode ser desfeita.`,
    )
    if (!confirmado) return
    setExcluindo(true)
    setErroForm(null)
    await supabase.from("product_images").delete().eq("produto_id", produtoAtual.id)
    await supabase.from("product_variants").delete().eq("produto_id", produtoAtual.id)
    await supabase.from("product_prices").delete().eq("produto_id", produtoAtual.id)
    const { error } = await supabase.from("products").delete().eq("id", produtoAtual.id)
    setExcluindo(false)
    if (error) {
      setErroForm(
        error.message.includes("foreign key")
          ? "Este produto já aparece em pedidos, por isso não pode ser apagado. Marque como inativo."
          : error.message,
      )
      return
    }
    voltarLista()
  }


  async function uploadImagem(file: File) {
    if (!produtoAtual) return
    setUploadando(true)
    setErroStorage(null)
    const caminho = `${produtoAtual.slug}/${Date.now()}-${file.name}`
    const { error: upErro } = await supabase.storage.from("products").upload(caminho, file)
    if (upErro) {
      setErroStorage(upErro.message.includes("Bucket not found") || upErro.message.includes("bucket")
        ? "O bucket de imagens ainda não existe. Rode a migration de storage e tente novamente."
        : upErro.message)
      setUploadando(false)
      return
    }
    const { data: urlData } = supabase.storage.from("products").getPublicUrl(caminho)
    const ordem = imagens.length
    const { data: imgData, error: imgErro } = await supabase
      .from("product_images")
      .insert({ produto_id: produtoAtual.id, url: urlData.publicUrl, ordem })
      .select("id, url, ordem")
      .single()
    if (imgErro) setErroStorage(imgErro.message)
    else setImagens((prev) => [...prev, imgData as Imagem])
    setUploadando(false)
  }

  async function adicionarUrl() {
    if (!urlInput.trim() || !produtoAtual) return
    const ordem = imagens.length
    const { data, error } = await supabase
      .from("product_images")
      .insert({ produto_id: produtoAtual.id, url: urlInput.trim(), ordem })
      .select("id, url, ordem")
      .single()
    if (error) setErroStorage(error.message)
    else {
      setImagens((prev) => [...prev, data as Imagem])
      setUrlInput("")
    }
  }

  async function deletarImagem(id: string) {
    const { error } = await supabase.from("product_images").delete().eq("id", id)
    if (error) setErroStorage(error.message)
    else setImagens((prev) => prev.filter((img) => img.id !== id))
  }

  async function salvarVariante(v: Variante) {
    setSalvandoVariante(v.id)
    const { error } = await supabase
      .from("product_variants")
      .update({ tamanho: v.tamanho, estoque: v.estoque })
      .eq("id", v.id)
    if (error) setErroForm(error.message)
    setSalvandoVariante(null)
  }

  async function adicionarVariante() {
    if (!produtoAtual || !novaVariante.tamanho.trim()) return
    const { data, error } = await supabase
      .from("product_variants")
      .insert({
        produto_id: produtoAtual.id,
        tamanho: novaVariante.tamanho.trim(),
        estoque: parseInt(novaVariante.estoque) || 0,
      })
      .select("id, tamanho, estoque")
      .single()
    if (error) setErroForm(error.message)
    else {
      setVariantes((prev) => [...prev, data as Variante])
      setNovaVariante({ tamanho: "", estoque: "" })
    }
  }

  async function deletarVariante(id: string) {
    const { error } = await supabase.from("product_variants").delete().eq("id", id)
    if (error) setErroForm(error.message)
    else setVariantes((prev) => prev.filter((v) => v.id !== id))
  }

  async function salvarPrecos() {
    if (!produtoAtual) return
    setSalvandoPrecos(true)
    setErroForm(null)
    const upserts = TIPOS_PRECO.filter((t) => precos[t].preco !== "").map((t) => ({
      produto_id: produtoAtual.id,
      tipo: t,
      preco: parseFloat(precos[t].preco),
      preco_original: precos[t].preco_original !== "" ? parseFloat(precos[t].preco_original) : null,
    }))
    if (upserts.length > 0) {
      const { error } = await supabase
        .from("product_prices")
        .upsert(upserts, { onConflict: "produto_id,tipo" })
      if (error) setErroForm(error.message)
    }
    setSalvandoPrecos(false)
  }

  if (view === "list") {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {carregando ? "Carregando..." : `${produtos.length} produto(s)`}
          </p>
          <button
            type="button"
            onClick={abrirNovo}
            className="cursor-pointer rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/85"
          >
            Novo produto
          </button>
        </div>
        {erro ? <p className="mb-4 text-sm text-destructive">{erro}</p> : null}
        <section className="overflow-hidden rounded-2xl border border-border">
          {produtos.length === 0 && !carregando ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum produto cadastrado.</p>
          ) : null}
          <ul className="divide-y divide-border">
            {produtos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.categories?.nome ?? "Sem categoria"} · /{p.slug}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${p.ativo ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}
                  >
                    {p.ativo ? "ativo" : "inativo"}
                  </span>
                  <button
                    type="button"
                    onClick={() => abrirEditar(p)}
                    className="cursor-pointer rounded-full bg-muted px-4 py-2 text-xs font-medium transition-colors hover:bg-muted/70"
                  >
                    Editar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={voltarLista}
        className="mb-6 cursor-pointer text-sm underline underline-offset-4"
      >
        ← Voltar
      </button>

      <div className="flex flex-col gap-6">
        <section className="rounded-2xl border border-border p-5">
          <h2 className="mb-4 text-sm font-semibold">Dados básicos</h2>
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Nome *</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value)
                  if (!produtoAtual) setSlug(toSlug(e.target.value))
                }}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Descrição</label>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
                className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Categoria</label>
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
              >
                <option value="">Sem categoria</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
                className="h-4 w-4 cursor-pointer"
              />
              Ativo
            </label>
          </div>
          {erroForm ? <p className="mt-3 text-xs text-destructive">{erroForm}</p> : null}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={salvarBasico}
              disabled={salvando || excluindo}
              className="cursor-pointer rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/85 disabled:opacity-60"
            >
              {salvando ? "Salvando..." : produtoAtual ? "Salvar" : "Criar produto"}
            </button>
            {produtoAtual ? (
              <button
                type="button"
                onClick={excluirProduto}
                disabled={excluindo || salvando}
                className="cursor-pointer rounded-full border border-destructive px-5 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive hover:text-white disabled:opacity-60"
              >
                {excluindo ? "Excluindo..." : "Excluir produto"}
              </button>
            ) : null}
          </div>

        </section>

        {produtoAtual ? (
          <>
            <section className="rounded-2xl border border-border p-5">
              <h2 className="mb-4 text-sm font-semibold">Imagens</h2>
              {erroStorage ? (
                <p className="mb-3 text-xs text-destructive">{erroStorage}</p>
              ) : null}
              {imagens.length > 0 ? (
                <div className="mb-4 flex flex-wrap gap-2">
                  {imagens.map((img) => (
                    <div key={img.id} className="relative">
                      <img
                        src={img.url}
                        alt=""
                        className="h-[50px] w-[50px] rounded-lg border border-border object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => deletarImagem(img.id)}
                        className="absolute -right-1.5 -top-1.5 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Upload de arquivo</label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploadando}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        void uploadImagem(file)
                        e.target.value = ""
                      }
                    }}
                    className="text-xs text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium file:transition-colors hover:file:bg-muted/70 disabled:opacity-60"
                  />
                  {uploadando ? <p className="mt-1 text-xs text-muted-foreground">Enviando...</p> : null}
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Ou cole uma URL</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
                    />
                    <button
                      type="button"
                      onClick={adicionarUrl}
                      disabled={!urlInput.trim()}
                      className="cursor-pointer rounded-full bg-muted px-4 py-2 text-xs font-medium transition-colors hover:bg-muted/70 disabled:opacity-50"
                    >
                      Adicionar URL
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border p-5">
              <h2 className="mb-4 text-sm font-semibold">Numerações</h2>
              {variantes.length > 0 ? (
                <ul className="mb-4 flex flex-col gap-2">
                  {variantes.map((v) => (
                    <li key={v.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={v.tamanho}
                        onChange={(e) =>
                          setVariantes((prev) =>
                            prev.map((x) => (x.id === v.id ? { ...x, tamanho: e.target.value } : x)),
                          )
                        }
                        onBlur={() => salvarVariante(v)}
                        placeholder="Tamanho"
                        className="w-24 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
                      />
                      <input
                        type="number"
                        value={v.estoque}
                        onChange={(e) =>
                          setVariantes((prev) =>
                            prev.map((x) =>
                              x.id === v.id ? { ...x, estoque: parseInt(e.target.value) || 0 } : x,
                            ),
                          )
                        }
                        onBlur={() => salvarVariante(v)}
                        placeholder="Estoque"
                        className="w-24 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
                      />
                      <span className="text-xs text-muted-foreground">
                        {salvandoVariante === v.id ? "..." : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => deletarVariante(v.id)}
                        className="cursor-pointer text-xs text-destructive underline underline-offset-2"
                      >
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={novaVariante.tamanho}
                  onChange={(e) => setNovaVariante((prev) => ({ ...prev, tamanho: e.target.value }))}
                  placeholder="Tamanho"
                  className="w-24 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
                />
                <input
                  type="number"
                  value={novaVariante.estoque}
                  onChange={(e) => setNovaVariante((prev) => ({ ...prev, estoque: e.target.value }))}
                  placeholder="Estoque"
                  className="w-24 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
                />
                <button
                  type="button"
                  onClick={adicionarVariante}
                  disabled={!novaVariante.tamanho.trim()}
                  className="cursor-pointer rounded-full bg-muted px-4 py-2 text-xs font-medium transition-colors hover:bg-muted/70 disabled:opacity-50"
                >
                  + Adicionar
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-border p-5">
              <h2 className="mb-4 text-sm font-semibold">Preços</h2>
              <div className="flex flex-col gap-3">
                {TIPOS_PRECO.map((tipo) => (
                  <div key={tipo} className="flex flex-wrap items-center gap-3">
                    <span className="w-28 text-sm capitalize text-muted-foreground">{tipo}</span>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Preço</label>
                      <input
                        type="number"
                        step="0.01"
                        value={precos[tipo].preco}
                        onChange={(e) =>
                          setPrecos((prev) => ({ ...prev, [tipo]: { ...prev[tipo], preco: e.target.value } }))
                        }
                        placeholder="0,00"
                        className="w-32 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Preço original</label>
                      <input
                        type="number"
                        step="0.01"
                        value={precos[tipo].preco_original}
                        onChange={(e) =>
                          setPrecos((prev) => ({
                            ...prev,
                            [tipo]: { ...prev[tipo], preco_original: e.target.value },
                          }))
                        }
                        placeholder="0,00"
                        className="w-32 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={salvarPrecos}
                disabled={salvandoPrecos}
                className="mt-4 cursor-pointer rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/85 disabled:opacity-60"
              >
                {salvandoPrecos ? "Salvando..." : "Salvar preços"}
              </button>
            </section>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Crie o produto primeiro para gerenciar imagens, variantes e preços.
          </p>
        )}
      </div>
    </div>
  )
}
