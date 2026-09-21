import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  component: TermosPage,
  head: () => ({
    meta: [
      { title: "Termos de Uso | Solatto" },
      { name: "description", content: "Leia os termos de uso da loja Solatto." },
      { property: "og:title", content: "Termos de Uso | Solatto" },
      { property: "og:type", content: "website" },
    ],
  }),
});

function TermosPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between">
          <Link to="/" className="text-lg font-bold uppercase tracking-[0.18em] sm:text-xl sm:tracking-[0.22em]">
            Solatto
          </Link>
          <Link to="/" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
            Voltar à loja
          </Link>
        </div>
      </header>

      <section className="border-b border-border bg-foreground px-4 py-14 text-background sm:px-6 sm:py-20">
        <div className="mx-auto max-w-[780px]">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest opacity-60">Legal</p>
          <h1 className="text-3xl font-bold leading-tight sm:text-5xl">Termos de Uso</h1>
          <p className="mt-4 opacity-70 text-sm">Última atualização: setembro de 2026</p>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-[780px] space-y-10 text-muted-foreground leading-relaxed">

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">1. Aceitação dos termos</h2>
            <p>Ao acessar e utilizar o site da Solatto, você concorda com estes Termos de Uso. Caso não concorde com alguma disposição, pedimos que não utilize nossos serviços.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">2. Sobre a Solatto</h2>
            <p>A Solatto é uma empresa fabricante e comercializante de calçados, inscrita no CNPJ 51.987.195/0001-46, com sede em Franca — SP. Atendemos clientes nos segmentos varejo e dropshipping em todo o território nacional.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">3. Cadastro e conta</h2>
            <p>Para realizar compras, é necessário criar uma conta informando dados verdadeiros e atualizados. O usuário é responsável pela confidencialidade de sua senha e por todas as atividades realizadas em sua conta.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">4. Pedidos e pagamento</h2>
            <p>Os preços exibidos são em reais (BRL) e podem ser alterados sem aviso prévio. O pedido só é confirmado após a compensação do pagamento. Aceitamos pagamento via Pix.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">5. Prazo e entrega</h2>
            <p>O prazo de entrega é calculado no momento da compra conforme o CEP informado. A Solatto não se responsabiliza por atrasos causados pelos Correios ou transportadoras, mas se compromete a apoiar o cliente em caso de extravio.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">6. Trocas e devoluções</h2>
            <p>O cliente tem direito à troca ou devolução em até 7 dias após o recebimento do produto, conforme o Código de Defesa do Consumidor (Lei nº 8.078/1990), desde que o produto esteja sem uso e na embalagem original. Para iniciar o processo, entre em contato pelo WhatsApp ou pelo e-mail <a href="mailto:solattoecom@gmail.com" className="underline underline-offset-4 hover:text-foreground">solattoecom@gmail.com</a>.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">7. Propriedade intelectual</h2>
            <p>Todo o conteúdo do site — textos, imagens, logotipos e layout — é de propriedade exclusiva da Solatto e protegido pela legislação de direitos autorais. É proibida a reprodução sem autorização prévia e por escrito.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">8. Limitação de responsabilidade</h2>
            <p>A Solatto não se responsabiliza por danos decorrentes do uso indevido do site, interrupções temporárias de serviço ou falhas de terceiros (operadoras, provedores de pagamento).</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">9. Alterações nos termos</h2>
            <p>Reservamo-nos o direito de modificar estes termos a qualquer momento. As alterações entram em vigor imediatamente após a publicação no site. O uso continuado do site após as alterações implica aceitação dos novos termos.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">10. Contato</h2>
            <p>Dúvidas sobre estes termos podem ser enviadas para <a href="mailto:solattoecom@gmail.com" className="underline underline-offset-4 hover:text-foreground">solattoecom@gmail.com</a> ou via WhatsApp <a href="https://wa.me/5516999136670" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">+55 16 99913-6670</a>.</p>
          </div>

        </div>
      </section>

      <section className="border-t border-border px-4 py-10 text-center sm:px-6">
        <Link to="/" className="inline-flex cursor-pointer items-center rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-colors hover:bg-foreground/85">
          Voltar à loja
        </Link>
      </section>
    </main>
  );
}
