import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  component: PrivacidadePage,
  head: () => ({
    meta: [
      { title: "Política de Privacidade | Solatto" },
      { name: "description", content: "Saiba como a Solatto coleta, usa e protege seus dados pessoais." },
      { property: "og:title", content: "Política de Privacidade | Solatto" },
      { property: "og:type", content: "website" },
    ],
  }),
});

function PrivacidadePage() {
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
          <h1 className="text-3xl font-bold leading-tight sm:text-5xl">Política de Privacidade</h1>
          <p className="mt-4 opacity-70 text-sm">Última atualização: setembro de 2026</p>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-[780px] space-y-10 text-muted-foreground leading-relaxed">

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">1. Quem somos</h2>
            <p>A Solatto (CNPJ 51.987.195/0001-46), com sede em Franca — SP, é a controladora dos dados pessoais coletados neste site, nos termos da Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">2. Dados que coletamos</h2>
            <p>Coletamos os seguintes dados pessoais:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Nome, sobrenome e e-mail — para criação de conta e comunicações</li>
              <li>Endereço de entrega — para processamento e envio de pedidos</li>
              <li>Telefone (WhatsApp) — para confirmação de pedidos</li>
              <li>Dados de navegação (cookies) — para funcionamento do site e análises</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">3. Como usamos seus dados</h2>
            <p>Utilizamos seus dados para:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Processar e entregar seus pedidos</li>
              <li>Enviar confirmações de compra e atualizações de entrega por e-mail</li>
              <li>Responder dúvidas e solicitações de suporte</li>
              <li>Enviar novidades e promoções, caso você assine nossa newsletter (com opção de cancelamento a qualquer momento)</li>
              <li>Cumprir obrigações legais e fiscais</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">4. Cookies</h2>
            <p>Utilizamos cookies essenciais para o funcionamento do site (autenticação e carrinho) e cookies analíticos para entender como os visitantes navegam. Você pode desativar cookies não essenciais nas configurações do seu navegador, mas isso pode afetar o funcionamento de algumas funcionalidades.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">5. Compartilhamento de dados</h2>
            <p>Não vendemos seus dados pessoais. Compartilhamos informações apenas com:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Transportadoras e Correios — para entrega dos pedidos</li>
              <li>Processador de pagamento (AbacatePay) — para processar transações Pix</li>
              <li>Supabase — para armazenamento seguro dos dados</li>
            </ul>
            <p>Todos os parceiros estão sujeitos a acordos de confidencialidade e só acessam os dados estritamente necessários.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">6. Retenção de dados</h2>
            <p>Mantemos seus dados pelo tempo necessário para cumprir as finalidades descritas nesta política e para atender obrigações legais (como registros fiscais, que devem ser mantidos por até 5 anos).</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">7. Seus direitos</h2>
            <p>Você tem direito a:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Acessar os dados que temos sobre você</li>
              <li>Corrigir dados incompletos ou incorretos</li>
              <li>Solicitar a exclusão dos seus dados (quando não houver obrigação legal de retenção)</li>
              <li>Revogar consentimentos dados anteriormente</li>
              <li>Portabilidade dos seus dados</li>
            </ul>
            <p>Para exercer qualquer desses direitos, entre em contato pelo e-mail <a href="mailto:solattoecom@gmail.com" className="underline underline-offset-4 hover:text-foreground">solattoecom@gmail.com</a>.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">8. Segurança</h2>
            <p>Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, perda ou destruição, incluindo criptografia em trânsito (HTTPS) e armazenamento seguro em servidores na nuvem.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">9. Alterações nesta política</h2>
            <p>Podemos atualizar esta Política de Privacidade periodicamente. Alterações relevantes serão comunicadas por e-mail ou mediante aviso em destaque no site.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">10. Contato</h2>
            <p>Para dúvidas sobre privacidade ou proteção de dados, entre em contato:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>E-mail: <a href="mailto:solattoecom@gmail.com" className="underline underline-offset-4 hover:text-foreground">solattoecom@gmail.com</a></li>
              <li>WhatsApp: <a href="https://wa.me/5516999136670" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">+55 16 99913-6670</a></li>
            </ul>
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
