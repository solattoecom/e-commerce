import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, CreditCard, MapPin, Pencil, QrCode, Trash2, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useAddresses, type NewAddress } from "@/hooks/useAddresses";
import { quoteShipping, type ShippingOption } from "@/lib/shipping.functions";
import { createOrder, getOrderStatus } from "@/lib/checkout.functions";
import { CouponInput } from "@/components/CouponInput";
import type { DiscountResult } from "@/lib/coupon.functions";

export const Route = createFileRoute("/_authenticated/checkout")({
  component: CheckoutPage,
});

type Step = "endereco" | "entrega" | "pagamento" | "sucesso";

function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, total, loading: cartLoading, refresh: refreshCart, clearCart } = useCart(user?.id ?? null);
  const { addresses, loading: addrLoading, addAddress, removeAddress, updateAddress } = useAddresses(user?.id ?? null);
  const [editingAddr, setEditingAddr] = useState<string | null>(null);
  const [editAddr, setEditAddr] = useState<Partial<NewAddress>>({});

  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (!paid && !cartLoading && items.length === 0) {
      void navigate({ to: "/" });
    }
  }, [paid, cartLoading, items.length, navigate]);
  const [step, setStep] = useState<Step>("endereco");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddr, setShowNewAddr] = useState(false);
  const [newAddr, setNewAddr] = useState<Partial<NewAddress>>({ padrao: false });
  const [cepLoading, setCepLoading] = useState(false);

  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);
  const [desconto, setDesconto] = useState<DiscountResult | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<"pix" | "cartao" | "boleto">("pix");
  const [telefone, setTelefone] = useState("");
  const [card, setCard] = useState({ number: "", holder: "", expiry: "", cvv: "", cpf: "", telefone: "", parcelas: "1" });
  const [boletoCpf, setBoletoCpf] = useState("");
  const [boletoUrl, setBoletoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [pixQr, setPixQr] = useState<string | null>(null);
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [pixSecondsLeft, setPixSecondsLeft] = useState<number>(3600);

  useEffect(() => {
    if (!pixQr) return;
    setPixSecondsLeft(3600);
    const tick = setInterval(() => setPixSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(tick);
  }, [pixQr]);

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) ?? null;
  const itemCount = items.reduce((n, i) => n + i.quantidade, 0);
  const frete = selectedShipping?.valor ?? 0;
  const totalFinal = total - (desconto?.discount_amount ?? 0) + frete;
  const pixDesconto = totalFinal * 0.1;
  const totalPix = totalFinal - pixDesconto;
  const totalEfetivo = paymentMethod === "pix" ? totalPix : totalFinal;

  const calcParcela = (n: number) => {
    if (n <= 10) return totalFinal / n;
    const taxa = 0.0199;
    return totalFinal * (taxa * Math.pow(1 + taxa, n)) / (Math.pow(1 + taxa, n) - 1);
  };

  const handleCepBlur = async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json() as { logradouro?: string; bairro?: string; localidade?: string; uf?: string; erro?: boolean };
      if (!data.erro) {
        setNewAddr((prev) => ({
          ...prev,
          cep: digits,
          rua: data.logradouro ?? "",
          bairro: data.bairro ?? "",
          cidade: data.localidade ?? "",
          estado: data.uf ?? "",
        }));
      }
    } finally {
      setCepLoading(false);
    }
  };

  const handleSaveAddress = async () => {
    const addr = newAddr as NewAddress;
    if (!addr.cep || !addr.rua || !addr.numero || !addr.bairro || !addr.cidade || !addr.estado) {
      setErro("Preencha todos os campos obrigatórios do endereço.");
      return;
    }
    await addAddress(addr);
    setShowNewAddr(false);
    setNewAddr({ padrao: false });
    setErro(null);
  };

  const handleGoToShipping = async () => {
    if (!selectedAddressId || !selectedAddress) { setErro("Selecione um endereço."); return; }
    setErro(null);
    setShippingLoading(true);
    try {
      const quote = await quoteShipping({ cep: selectedAddress.cep, itens: itemCount, subtotal: total });
      setShippingOptions(quote.opcoes);
      setSelectedShipping(quote.opcoes[0] ?? null);
      setStep("entrega");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao calcular frete.");
    } finally {
      setShippingLoading(false);
    }
  };

  const handleGoToPayment = () => {
    if (!selectedShipping) { setErro("Selecione uma opção de entrega."); return; }
    setErro(null);
    setStep("pagamento");
  };

  const handlePay = async () => {
    if (!selectedAddressId || !selectedShipping) {
      setErro("Selecione endereço e frete antes de pagar.");
      return;
    }
    setBusy(true);
    setErro(null);
    try {
      const result = await createOrder({
        data: {
          address_id: selectedAddressId,
          shipping_option_id: selectedShipping.id,
          shipping_valor: selectedShipping.valor,
          shipping_nome: selectedShipping.nome,
          payment_method: paymentMethod,
          telefone: telefone.replace(/\D/g, ""),
          items: items.map((item) => ({
            produto_id: item.produto_id,
            variacao_id: item.variacao_id,
            nome: item.products?.nome ?? "",
            quantidade: item.quantidade,
            preco_unitario: item.products?.product_prices?.[0]?.preco ?? 0,
          })),
          subtotal: total,
          total: totalEfetivo,
          coupon_id: desconto?.coupon_id ?? null,
          desconto: desconto?.discount_amount ?? 0,
          ...(paymentMethod === "cartao" && {
            card_number: card.number,
            card_holder: card.holder,
            card_expiry: card.expiry,
            card_cvv: card.cvv,
            card_cpf: card.cpf,
            card_telefone: card.telefone.replace(/\D/g, ""),
            card_parcelas: Number(card.parcelas),
          }),
          ...(paymentMethod === "boleto" && { boleto_cpf: boletoCpf }),
        },
      });

      setOrderId(result.order_id);

      if (paymentMethod === "cartao") {
        if (result.status === "pago") {
          setPaid(true);
          await clearCart();
          setStep("sucesso");
        } else {
          setErro("Pagamento não confirmado. Verifique os dados do cartão e tente novamente.");
        }
        return;
      }

      if (paymentMethod === "boleto") {
        setPaid(true);
        await clearCart();
        setBoletoUrl(result.boleto_url ?? null);
        return;
      }

      if (paymentMethod === "pix") {
        setPixQr(result.pix_qr ?? null);
        setPixQrCode(result.pix_qr_code ?? null);
        let retries = 0;
        const interval = setInterval(async () => {
          try {
            const s = await getOrderStatus({ data: { order_id: result.order_id } });
            retries = 0;
            if (s.status === "pago") {
              clearInterval(interval);
              clearTimeout(timeout);
              setPaid(true);
              await clearCart();
              setStep("sucesso");
            }
          } catch {
            retries++;
            if (retries >= 5) clearInterval(interval);
          }
        }, 3000);
        const timeout = setTimeout(() => clearInterval(interval), 10 * 60 * 1000);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      setErro(msg);
      console.error("handlePay error:", e);
    } finally {
      setBusy(false);
    }
  };

  const steps: { id: Step; label: string }[] = [
    { id: "endereco", label: "Endereço" },
    { id: "entrega", label: "Entrega" },
    { id: "pagamento", label: "Pagamento" },
  ];
  const stepIndex = steps.findIndex((s) => s.id === step);

  if (step === "sucesso") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
        <div className="grid h-28 w-28 place-items-center rounded-full bg-foreground">
          <Check className="h-14 w-14 text-background stroke-[2.5]" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Pedido confirmado!</h1>
          <p className="text-sm text-muted-foreground font-mono">#{orderId?.slice(0, 8).toUpperCase()}</p>
        </div>
        <div className="max-w-sm space-y-3 rounded-xl border bg-muted/40 px-6 py-5 text-sm text-muted-foreground">
          <p className="text-base font-semibold text-foreground">Aguarde o despacho do seu produto.</p>
          <p>Assim que enviarmos o pedido, você receberá o código de rastreio para acompanhar a entrega.</p>
        </div>
        <Button className="bg-foreground text-background hover:bg-foreground/90" onClick={() => navigate({ to: "/pedidos" })}>
          Ver meus pedidos
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <button
        type="button"
        onClick={() => step === "endereco" ? navigate({ to: "/" }) : setStep(step === "pagamento" ? "entrega" : "endereco")}
        className="mb-6 flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Voltar
      </button>
      <div className="mb-8 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.id} className="flex flex-1 items-center gap-2">
            <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-medium ${i <= stepIndex ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>
              {i < stepIndex ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`text-sm ${i <= stepIndex ? "font-medium" : "text-muted-foreground"}`}>{s.label}</span>
            {i < steps.length - 1 && <div className={`h-px flex-1 ${i < stepIndex ? "bg-foreground" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      {erro && <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{erro}</p>}

      <div className="mb-6 rounded-lg border bg-muted/30 p-4 text-sm">
        <p className="font-medium">{itemCount} {itemCount === 1 ? "item" : "itens"} — Subtotal: R$ {total.toFixed(2).replace(".", ",")}</p>
        {desconto ? (
          <p className="text-muted-foreground text-sm">
            Cupom ({desconto.code}): -{Number(desconto.discount_amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        ) : null}
        {selectedShipping && <p className="text-muted-foreground">Frete: R$ {frete.toFixed(2).replace(".", ",")} — Total: R$ {totalFinal.toFixed(2).replace(".", ",")}</p>}
        {step === "pagamento" && paymentMethod === "pix" && (
          <p className="text-sm font-medium text-green-600">Desconto PIX 10%: -R$ {pixDesconto.toFixed(2).replace(".", ",")} → Total: R$ {totalPix.toFixed(2).replace(".", ",")}</p>
        )}
      </div>

      {step === "endereco" && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><MapPin className="h-5 w-5" /> Endereço de entrega</h2>
          {addrLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="space-y-2">
              {addresses.map((addr) => (
                <div key={addr.id} className={`rounded-lg border text-sm transition-colors ${selectedAddressId === addr.id ? "border-foreground bg-muted" : "border-border"}`}>
                  {editingAddr === addr.id ? (
                    <div className="space-y-3 p-4">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2 grid gap-1">
                          <Label htmlFor={`edit-rua-${addr.id}`}>Rua *</Label>
                          <Input id={`edit-rua-${addr.id}`} value={editAddr.rua ?? ""} onChange={(e) => setEditAddr((p) => ({ ...p, rua: e.target.value }))} />
                        </div>
                        <div className="grid gap-1">
                          <Label>Número *</Label>
                          <Input value={editAddr.numero ?? ""} onChange={(e) => setEditAddr((p) => ({ ...p, numero: e.target.value }))} />
                        </div>
                        <div className="grid gap-1">
                          <Label>Complemento</Label>
                          <Input value={editAddr.complemento ?? ""} onChange={(e) => setEditAddr((p) => ({ ...p, complemento: e.target.value }))} />
                        </div>
                        <div className="grid gap-1">
                          <Label>Bairro *</Label>
                          <Input value={editAddr.bairro ?? ""} onChange={(e) => setEditAddr((p) => ({ ...p, bairro: e.target.value }))} />
                        </div>
                        <div className="grid gap-1">
                          <Label>Cidade *</Label>
                          <Input value={editAddr.cidade ?? ""} onChange={(e) => setEditAddr((p) => ({ ...p, cidade: e.target.value }))} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-foreground text-background hover:bg-foreground/90" onClick={async () => {
                          const msg = await updateAddress(addr.id, editAddr);
                          if (msg) setErro(msg);
                          else setEditingAddr(null);
                        }}>Salvar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingAddr(null)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <button type="button" onClick={() => setSelectedAddressId(addr.id)} className="w-full p-4 text-left">
                        <p className="font-medium">{addr.rua}, {addr.numero}{addr.complemento ? `, ${addr.complemento}` : ""}</p>
                        <p className="text-muted-foreground">{addr.bairro} — {addr.cidade}/{addr.estado} — CEP {addr.cep.slice(0, 5)}-{addr.cep.slice(5)}</p>
                        {addr.padrao && <span className="text-xs text-muted-foreground">Padrão</span>}
                      </button>
                      <div className="absolute right-2 top-2 flex gap-1">
                        <button type="button" onClick={() => { setEditAddr({ rua: addr.rua, numero: addr.numero, complemento: addr.complemento ?? "", bairro: addr.bairro, cidade: addr.cidade, estado: addr.estado }); setEditingAddr(addr.id); }} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label="Editar endereço"><Pencil size={15} /></button>
                        <button type="button" onClick={async () => { if (selectedAddressId === addr.id) setSelectedAddressId(null); const msg = await removeAddress(addr.id); if (msg) setErro(msg); }} className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-muted transition-colors" aria-label="Remover endereço"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {showNewAddr ? (
            <div className="space-y-3 rounded-lg border p-4">
              <h3 className="font-medium">Novo endereço</h3>
              <div className="grid gap-2">
                <Label htmlFor="cep">CEP *</Label>
                <Input id="cep" placeholder="00000-000" value={newAddr.cep ?? ""} onChange={(e) => setNewAddr((p) => ({ ...p, cep: e.target.value }))} onBlur={(e) => handleCepBlur(e.target.value)} disabled={cepLoading} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2 grid gap-2">
                  <Label htmlFor="rua">Rua *</Label>
                  <Input id="rua" value={newAddr.rua ?? ""} onChange={(e) => setNewAddr((p) => ({ ...p, rua: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="numero">Número *</Label>
                  <Input id="numero" value={newAddr.numero ?? ""} onChange={(e) => setNewAddr((p) => ({ ...p, numero: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="complemento">Complemento</Label>
                  <Input id="complemento" value={newAddr.complemento ?? ""} onChange={(e) => setNewAddr((p) => ({ ...p, complemento: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bairro">Bairro *</Label>
                  <Input id="bairro" value={newAddr.bairro ?? ""} onChange={(e) => setNewAddr((p) => ({ ...p, bairro: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cidade">Cidade *</Label>
                  <Input id="cidade" value={newAddr.cidade ?? ""} onChange={(e) => setNewAddr((p) => ({ ...p, cidade: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="estado">Estado *</Label>
                  <Input id="estado" maxLength={2} value={newAddr.estado ?? ""} onChange={(e) => setNewAddr((p) => ({ ...p, estado: e.target.value.toUpperCase() }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="bg-foreground text-background hover:bg-foreground/90" onClick={handleSaveAddress}>Salvar endereço</Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowNewAddr(false); setErro(null); }}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowNewAddr(true)}>+ Adicionar endereço</Button>
          )}

          <Button className="w-full bg-foreground text-background hover:bg-foreground/90" disabled={!selectedAddressId || shippingLoading} onClick={handleGoToShipping}>
            {shippingLoading ? "Calculando frete..." : <><span>Continuar</span><ArrowRight className="ml-2 h-4 w-4" /></>}
          </Button>
        </div>
      )}

      {step === "entrega" && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Truck className="h-5 w-5" /> Opção de entrega</h2>
          <div className="space-y-2">
            {shippingOptions.map((opt) => (
              <button key={opt.id} type="button" onClick={() => setSelectedShipping(opt)}
                className={`w-full rounded-lg border p-4 text-left text-sm transition-colors ${selectedShipping?.id === opt.id ? "border-foreground bg-muted" : "border-border hover:bg-muted/50"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{opt.nome}</p>
                    <p className="text-muted-foreground">{opt.prazo}</p>
                  </div>
                  <p className="font-semibold">{opt.valor === 0 ? "Grátis" : `R$ ${opt.valor.toFixed(2).replace(".", ",")}`}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("endereco")}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
            <Button className="flex-1 bg-foreground text-background hover:bg-foreground/90" disabled={!selectedShipping} onClick={handleGoToPayment}>Continuar <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {step === "pagamento" && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><CreditCard className="h-5 w-5" /> Pagamento</h2>
          <CouponInput subtotal={total} onApply={setDesconto} />
          <div className="flex gap-2">
            {(["pix", "cartao", "boleto"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setPaymentMethod(m)}
                className={`flex-1 rounded-lg border p-3 text-sm font-medium transition-colors ${paymentMethod === m ? "border-foreground bg-muted" : "border-border hover:bg-muted/50"}`}>
                {m === "pix" ? "Pix" : m === "cartao" ? "Cartão de crédito" : "Boleto"}
              </button>
            ))}
          </div>

          {paymentMethod === "pix" && (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><QrCode className="h-4 w-4" /><span>QR Code gerado ao confirmar</span></div>
              {pixQr && (
                <div className="mt-3 space-y-3">
                  {pixQrCode && <img src={pixQrCode} alt="QR Code Pix" className="mx-auto h-48 w-48" />}
                  <p className="break-all font-mono text-xs">{pixQr}</p>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(pixQr).then(() => {
                      const el = document.getElementById("pix-copy-label");
                      if (el) { el.textContent = "Copiado!"; setTimeout(() => { el.textContent = "Copiar código Pix"; }, 2000); }
                    })}
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background py-2 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    <Copy className="h-4 w-4" />
                    <span id="pix-copy-label">Copiar código Pix</span>
                  </button>
                  <div className="space-y-1.5">
                    {pixSecondsLeft > 0 ? (
                      <>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Aguardando pagamento...</span>
                          <span className="font-mono tabular-nums">
                            {String(Math.floor(pixSecondsLeft / 60)).padStart(2, "0")}:{String(pixSecondsLeft % 60).padStart(2, "0")}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-foreground transition-all duration-1000"
                            style={{ width: `${(pixSecondsLeft / 3600) * 100}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <p className="text-center text-xs font-medium text-destructive">QR Code expirado. Gere um novo pedido.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {paymentMethod === "cartao" && (
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="card_number">Número do cartão</Label>
                <Input id="card_number" placeholder="0000 0000 0000 0000" maxLength={19} value={card.number} onChange={(e) => setCard((c) => ({ ...c, number: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="card_holder">Nome no cartão</Label>
                <Input id="card_holder" placeholder="NOME SOBRENOME" value={card.holder} onChange={(e) => setCard((c) => ({ ...c, holder: e.target.value.toUpperCase() }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="card_telefone">Telefone do titular (com DDD)</Label>
                <Input id="card_telefone" placeholder="(11) 99999-9999" maxLength={15} value={card.telefone} onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 11);
                  const fmt = v.length <= 10
                    ? v.replace(/(\d{2})(\d{4})(\d{0,4})/, (_, a, b, c) => c ? `(${a}) ${b}-${c}` : b ? `(${a}) ${b}` : a)
                    : v.replace(/(\d{2})(\d{5})(\d{0,4})/, (_, a, b, c) => c ? `(${a}) ${b}-${c}` : b ? `(${a}) ${b}` : a);
                  setCard((c) => ({ ...c, telefone: fmt }));
                }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label htmlFor="card_expiry">Validade</Label>
                  <Input id="card_expiry" placeholder="MM/AA" maxLength={5} value={card.expiry} onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                    const fmt = v.length > 2 ? `${v.slice(0, 2)}/${v.slice(2)}` : v;
                    setCard((c) => ({ ...c, expiry: fmt }));
                  }} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="card_cvv">CVV</Label>
                  <Input id="card_cvv" placeholder="000" maxLength={4} value={card.cvv} onChange={(e) => setCard((c) => ({ ...c, cvv: e.target.value }))} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="card_parcelas">Parcelas</Label>
                <select
                  id="card_parcelas"
                  value={card.parcelas}
                  onChange={(e) => setCard((c) => ({ ...c, parcelas: e.target.value }))}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
                    const valorParcela = calcParcela(n);
                    const totalComJuros = valorParcela * n;
                    const semJuros = n <= 10;
                    return (
                      <option key={n} value={String(n)}>
                        {n}x de R$ {valorParcela.toFixed(2).replace(".", ",")}
                        {semJuros ? " (sem juros)" : ` — total R$ ${totalComJuros.toFixed(2).replace(".", ",")}`}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="card_cpf">CPF do titular</Label>
                <Input
                  id="card_cpf"
                  placeholder="000.000.000-00"
                  maxLength={14}
                  value={card.cpf}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 11);
                    const fmt = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, d) => d ? `${a}.${b}.${c}-${d}` : c ? `${a}.${b}.${c}` : b ? `${a}.${b}` : a);
                    setCard((c) => ({ ...c, cpf: fmt }));
                  }}
                />
              </div>
            </div>
          )}

          {paymentMethod === "boleto" && (
            boletoUrl ? (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="font-medium">Boleto gerado com sucesso!</p>
                <p className="text-muted-foreground">Vencimento em 3 dias. O pedido será confirmado após a compensação bancária (até 2 dias úteis após o pagamento).</p>
                <a
                  href={boletoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:bg-foreground/90"
                >
                  Ver / imprimir boleto
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-2">
                  <Label htmlFor="boleto_cpf">CPF do pagador</Label>
                  <Input
                    id="boleto_cpf"
                    placeholder="000.000.000-00"
                    maxLength={14}
                    value={boletoCpf}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 11);
                      const fmt = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, d) => d ? `${a}.${b}.${c}-${d}` : c ? `${a}.${b}.${c}` : b ? `${a}.${b}` : a);
                      setBoletoCpf(fmt);
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Vencimento em 3 dias corridos. Compensação em até 2 dias úteis após o pagamento.</p>
              </div>
            )
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("entrega")}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
            {!boletoUrl && (
              <Button type="button" className="flex-1 bg-foreground text-background hover:bg-foreground/90" disabled={busy} onClick={handlePay}>
                {busy ? "Processando..." : `Pagar R$ ${totalEfetivo.toFixed(2).replace(".", ",")}`}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
