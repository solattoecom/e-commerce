import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";

export const Route = createFileRoute("/sobre")({
  component: SobrePage,
  head: () => ({
    meta: [
      { title: "Sobre nós | Solatto" },
      {
        name: "description",
        content:
          "Conheça a história da Solatto, fábrica de calçados com tradição em qualidade e elegância.",
      },
      { property: "og:title", content: "Sobre nós | Solatto" },
      {
        property: "og:description",
        content:
          "Conheça a história da Solatto, fábrica de calçados com tradição em qualidade e elegância.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SobrePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Header simples */}
      <header className="border-b border-border px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between">
          <Link
            to="/"
            className="text-lg font-bold uppercase tracking-[0.18em] sm:text-xl sm:tracking-[0.22em]"
          >
            Solatto
          </Link>
          <Link to="/" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
            Voltar à loja
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-border bg-foreground px-4 py-16 text-background sm:px-6 sm:py-24">
        <div className="mx-auto max-w-[780px] text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest opacity-60">
            Nossa história
          </p>
          <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
            Feito à mão.<br className="hidden sm:block" /> Com propósito.
          </h1>
          <p className="mt-5 text-base leading-relaxed opacity-75 sm:text-lg">
            Desde o corte do couro até a sola, cada par Solatto nasce de um processo artesanal
            transmitido por gerações, unindo tradição e inovação no coração de São Paulo.
          </p>
        </div>
      </section>

      {/* História */}
      <section className="px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-[780px] space-y-10">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold sm:text-2xl">Como tudo começou</h2>
            <p className="leading-relaxed text-muted-foreground">
              A Solatto nasceu em 1987 na cidade de Franca — SP, polo calçadista reconhecido
              mundialmente pela excelência em couro. Seu fundador, Antônio Solatto, aprendeu o
              ofício com o pai ainda na adolescência e decidiu transformar a paixão pelo artesanato
              em um negócio familiar.
            </p>
            <p className="leading-relaxed text-muted-foreground">
              Com uma pequena bancada de trabalho e três funcionários, a fábrica produzia cerca de
              50 pares por semana — todos com a mesma atenção ao detalhe que define a marca até
              hoje. Os primeiros clientes eram sapatarias do interior paulista, conquistados pela
              qualidade do acabamento e pela durabilidade do produto.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold sm:text-2xl">Crescimento e expansão</h2>
            <p className="leading-relaxed text-muted-foreground">
              Nos anos 2000, a segunda geração da família assumiu a operação e modernizou a
              estrutura produtiva, mantendo os métodos artesanais na costura e no acabamento, mas
              incorporando maquinário de precisão europeu para otimizar etapas como o corte do
              cabedal e a vulcanização da sola.
            </p>
            <p className="leading-relaxed text-muted-foreground">
              A expansão para o dropshipping abriu caminho para que revendedores de
              todo o Brasil levassem os calçados Solatto aos seus clientes, sem abrir mão do padrão
              de qualidade que tornou a marca referência.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold sm:text-2xl">Nosso compromisso hoje</h2>
            <p className="leading-relaxed text-muted-foreground">
              Com mais de 35 anos de história, a Solatto produz milhares de pares por mês e
              distribui para todo o território nacional. Seguimos comprometidos com o couro de
              origem rastreável, os trabalhadores da nossa região e a satisfação de quem calça um
              produto feito para durar.
            </p>
          </div>
        </div>
      </section>

      {/* Divisor com estatísticas */}
      <section className="border-y border-border bg-muted/30 px-4 py-10 sm:px-6">
        <div className="mx-auto grid max-w-[780px] grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-8">
          {[
            { valor: "1987", label: "Fundação" },
            { valor: "+35", label: "Anos de história" },
            { valor: "100%", label: "Couro genuíno" },
            { valor: "Brasil", label: "Entrega nacional" },
          ].map(({ valor, label }) => (
            <div key={label} className="text-center">
              <p className="text-2xl font-bold sm:text-3xl">{valor}</p>
              <p className="mt-1 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Localização */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-[780px] px-4 sm:px-6">
          <div className="mb-6 flex items-center gap-2">
            <MapPin className="size-5 shrink-0 text-muted-foreground" />
            <h2 className="text-xl font-semibold sm:text-2xl">Nossa fábrica</h2>
          </div>
          <p className="mb-6 text-muted-foreground leading-relaxed">
            Venha nos visitar! Nossa fábrica está localizada em Franca — SP, referência nacional na
            produção de calçados de couro. Atendemos visitantes mediante agendamento.
          </p>
        </div>

        {/* Iframe do Google Maps — largura total */}
        <div className="border-y border-border">
          <iframe
            title="Localização da fábrica Solatto"
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d117955.56789!2d-47.4673!3d-20.5386!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94b0f15a0b4c9f8d%3A0x4f0f7d28b3d0b0a0!2sFranca%2C%20SP!5e0!3m2!1spt-BR!2sbr!4v1"
            width="100%"
            height="450"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="block w-full"
          />
        </div>

        <div className="mx-auto max-w-[780px] px-4 sm:px-6">
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Franca — SP · CEP 14400-000 ·{" "}
            <a
              href="https://maps.google.com/?q=Franca,SP"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Abrir no Google Maps
            </a>
          </p>
        </div>
      </section>

      {/* CTA final */}
      <section className="border-t border-border px-4 py-12 text-center sm:px-6">
        <p className="mb-4 text-muted-foreground">Quer conhecer nossos produtos?</p>
        <Link
          to="/"
          className="inline-flex cursor-pointer items-center rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-colors hover:bg-foreground/85"
        >
          Ver coleção
        </Link>
      </section>
    </main>
  );
}
