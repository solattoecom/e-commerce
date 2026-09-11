import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MapPin } from "lucide-react";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre a Solatto | Nossa História" },
      { name: "description", content: "Conheça a história da Solatto, nossa missão e onde nos encontrar em Franca/SP." },
    ],
  }),
  component: Sobre,
});

function Sobre() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1180px] items-center gap-4 px-4 py-3 sm:px-5">
          <Link
            to="/"
            aria-label="Voltar para a loja"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-[18px]" />
          </Link>
          <Link
            to="/"
            className="text-lg font-bold uppercase tracking-[0.18em] sm:text-xl sm:tracking-[0.22em]"
          >
            Solatto
          </Link>
        </div>
      </header>

      <main>
        <section className="border-b border-border px-5 py-16 text-center md:py-20">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-foreground/60">
            Nossa história
          </p>
          <h1 className="mx-auto max-w-xl text-3xl font-semibold leading-tight sm:text-4xl">
            Feitos para caminhar<br />ao seu lado.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            Desde nossa fundação em Franca, a Solatto acredita que cada par de calçados é mais do que um produto — é o começo de uma jornada.
          </p>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto grid w-full max-w-[1180px] grid-cols-1 md:grid-cols-2">
            <div className="flex flex-col justify-center gap-5 border-border px-5 py-12 md:border-r md:px-10">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/60">
                Quem somos
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                A Solatto nasceu do amor pelos calçados e pelo artesanato brasileiro. Com sede em Franca — SP, capital nacional do calçado — carregamos décadas de tradição em cada par que produzimos.
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Nossa missão é unir conforto, estilo e qualidade acessível para levar você mais longe em cada passo da vida. Cada detalhe é pensado para quem não abre mão de se sentir bem.
              </p>
              <div className="mt-2 flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-4 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0 text-foreground/60" />
                <div>
                  <p className="text-foreground/80">R. Romualdo Magalhães Pirro, 1050</p>
                  <p className="text-muted-foreground">Jd do Eden · Franca / SP · CEP 14402-130</p>
                </div>
              </div>
            </div>
            <div className="flex min-h-[280px] items-center justify-center bg-muted/30 md:min-h-[420px]">
              <div className="text-center text-muted-foreground">
                <div className="mb-2 text-5xl">📷</div>
                <p className="text-sm">Foto da empresa</p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="border-b border-border px-5 py-5 md:px-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/60">
              Como nos encontrar
            </p>
          </div>
          <div className="h-[320px] w-full md:h-[440px]">
            <iframe
              title="Localização Solatto"
              src="https://maps.google.com/maps?q=R+Romualdo+Magalhaes+Pirro+1050,+Jd+do+Eden,+Franca,+SP,+14402-130&output=embed&hl=pt"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center">
        <Link
          to="/"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Voltar para a loja
        </Link>
      </footer>
    </div>
  );
}
