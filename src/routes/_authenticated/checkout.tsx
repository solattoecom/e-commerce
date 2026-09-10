import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, CreditCard, MapPin, QrCode, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useAddresses, type NewAddress } from "@/hooks/useAddresses";
import { quoteShipping, type ShippingOption } from "@/lib/shipping.functions";
import { createOrder, getOrderStatus } from "@/lib/checkout.functions";

export const Route = createFileRoute("/_authenticated/checkout")({
  component: CheckoutPage,
});

type Step = "endereco" | "entrega" | "pagamento" | "sucesso";

function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, total, refresh: refreshCart } = useCart(user?.id ?? null);
  const { addresses, loading: addrLoading, addAddress, removeAddress } = useAddresses(user?.id ?? null);

  const [step, setStep] = useState<Step>("endereco");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddr, setShowNewAddr] = useState(false);
  const [newAddr, setNewAddr] = useState<Partial<NewAddress>>({ padrao: false });
  const [cepLoading, setCepLoading] = useState(false);

  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<"pix" | "cartao">("pix");
  const [telefone, setTelefone] = useState("");
  const [card, setCard] = useState({ number: "", holder: "", expiry: "", cvv: "" });
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [pixQr, setPixQr] = useState<string | null>(null);
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) ?? null;
  const itemCount = items.reduce((n, i) => n + i.quantidade, 0);
  const frete = selectedShipping?.valor ?? 0;
  const totalFinal = total + frete;

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
          total: totalFinal,
          ...(paymentMethod === "cartao" && {
            card_number: card.number,
            card_holder: card.holder,
            card_expiry: card.expiry,
            card_cvv: card.cvv,
          }),
        },
      });

      setOrderId(result.order_id);

      if (paymentMethod === "pix") {
        setPixQr(result.pix_qr ?? null);
        setPixQrCode(result.pix_qr_code ?? null);
        const interval = setInterval(async () => {
          const s = await getOrderStatus({ data: { order_id: result.order_id } });
          if (s.status === "pago") {
            clearInterval(interval);
            await refreshCart();
            setStep("sucesso");
          }
        }, 5000);
      } else {
        await refreshCart();
        setStep("sucesso");
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-green-100">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-semibold">Pedido confirmado!</h1>
        <p className="text-sm text-muted-foreground">
          Número: <span className="font-mono font-medium">{orderId?.slice(0, 8).toUpperCase()}</span>
        </p>
        <Button onClick={() => navigate({ to: "/pedidos" })}>Ver meus pedidos</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
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
        {selectedShipping && <p className="text-muted-foreground">Frete: R$ {frete.toFixed(2).replace(".", ",")} — Total: R$ {totalFinal.toFixed(2).replace(".", ",")}</p>}
      </div>

      {step === "endereco" && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><MapPin className="h-5 w-5" /> Endereço de entrega</h2>
          {addrLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="space-y-2">
              {addresses.map((addr) => (
                <div key={addr.id} className={`relative rounded-lg border text-sm transition-colors ${selectedAddressId === addr.id ? "border-foreground bg-muted" : "border-border"}`}>
                  <button type="button" onClick={() => setSelectedAddressId(addr.id)} className="w-full p-4 text-left">
                    <p className="font-medium">{addr.rua}, {addr.numero}{addr.complemento ? `, ${addr.complemento}` : ""}</p>
                    <p className="text-muted-foreground">{addr.bairro} — {addr.cidade}/{addr.estado} — CEP {addr.cep.slice(0, 5)}-{addr.cep.slice(5)}</p>
                    {addr.padrao && <span className="text-xs text-muted-foreground">Padrão</span>}
                  </button>
                  <button
                    type="button"
                    onClick={async () => { if (selectedAddressId === addr.id) setSelectedAddressId(null); const msg = await removeAddress(addr.id); if (msg) setErro(msg); }}
                    className="absolute right-3 top-3 text-xs text-foreground"
                  >
                    Remover
                  </button>
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
          <div className="grid gap-2">
            <Label htmlFor="telefone">Celular (WhatsApp)</Label>
            <Input id="telefone" placeholder="(11) 99999-9999" value={telefone} onChange={(e) => setTelefone(e.target.value)} maxLength={15} />
          </div>
          <div className="flex gap-2">
            {(["pix", "cartao"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setPaymentMethod(m)}
                className={`flex-1 rounded-lg border p-3 text-sm font-medium transition-colors ${paymentMethod === m ? "border-foreground bg-muted" : "border-border hover:bg-muted/50"}`}>
                {m === "pix" ? "Pix" : "Cartão de crédito"}
              </button>
            ))}
          </div>

          {paymentMethod === "pix" && (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><QrCode className="h-4 w-4" /><span>QR Code gerado ao confirmar</span></div>
              {pixQr && (
                <div className="mt-3 space-y-2">
                  {pixQrCode && <img src={pixQrCode} alt="QR Code Pix" className="mx-auto h-48 w-48" />}
                  <p className="break-all font-mono text-xs">{pixQr}</p>
                  <p className="text-center text-xs text-muted-foreground">Aguardando confirmação do pagamento...</p>
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
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label htmlFor="card_expiry">Validade</Label>
                  <Input id="card_expiry" placeholder="MM/AA" maxLength={5} value={card.expiry} onChange={(e) => setCard((c) => ({ ...c, expiry: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="card_cvv">CVV</Label>
                  <Input id="card_cvv" placeholder="000" maxLength={4} value={card.cvv} onChange={(e) => setCard((c) => ({ ...c, cvv: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("entrega")}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
            <Button type="button" className="flex-1 bg-foreground text-background hover:bg-foreground/90" disabled={busy} onClick={handlePay}>
              {busy ? "Processando..." : `Pagar R$ ${totalFinal.toFixed(2).replace(".", ",")}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
