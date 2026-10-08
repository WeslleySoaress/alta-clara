import { IconeLua, IconeSirene, IconeSol } from "./Icones";

/**
 * Prévia do aplicativo num celular, com DADOS FICTÍCIOS. Ilustrativa:
 * exposta a leitores de tela como uma única imagem descrita.
 */
export function PreviaCelular({ className = "" }: { className?: string }) {
  return (
    <div role="img" aria-label="Prévia do aplicativo com dados fictícios: próxima dose às 14h, horários do dia e orientação de urgência." className={`relative ${className}`}>
      <div className="relative mx-auto w-[17rem] rounded-[2.6rem] bg-[#0b1233] p-2.5 shadow-forte ring-1 ring-white/20">
        <div className="absolute left-1/2 top-3.5 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-[#0b1233]" />
        <div aria-hidden="true" className="overflow-hidden rounded-[2.1rem] bg-[#f6f8fc] text-[#0e1b3d]">
          <div className="painel-vivo px-4 pb-5 pt-9">
            <p className="text-[0.62rem] font-bold uppercase tracking-widest text-white/80">Sábado · Dia 2 de 7</p>
            <p className="titulo mt-1 text-lg font-extrabold leading-tight text-white">O que preciso fazer hoje?</p>
            <div className="vidro mt-3 rounded-2xl p-3">
              <p className="text-[0.6rem] font-bold uppercase tracking-widest text-[#ffd166]">Próxima ação</p>
              <p className="titulo text-3xl font-extrabold text-white">14h</p>
              <p className="text-xs text-white/90">Medicamento demonstrativo A · 1 cápsula</p>
              <div className="mt-2 rounded-xl bg-white py-1.5 text-center text-[0.7rem] font-bold text-[#08786f]">Marquei como tomado</div>
            </div>
          </div>
          <div className="space-y-2 p-3">
            <div className="flex items-center gap-2 rounded-xl bg-white p-2 shadow-suave">
              <span className="grid size-7 place-items-center rounded-lg bg-[#fff1cc] text-[#7f4d00]">
                <IconeSol tamanho={16} />
              </span>
              <span className="text-[0.7rem] font-bold">8h</span>
              <span className="truncate text-[0.7rem]">Medicamento B</span>
              <span className="ml-auto rounded-full bg-[#d7f5ef] px-2 text-[0.6rem] font-bold text-[#08786f]">feito</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white p-2 shadow-suave">
              <span className="grid size-7 place-items-center rounded-lg bg-[#ece7ff] text-[#5b3fd1]">
                <IconeLua tamanho={16} />
              </span>
              <span className="text-[0.7rem] font-bold">22h</span>
              <span className="truncate text-[0.7rem]">Medicamento A</span>
            </div>
            <div className="flex items-start gap-2 rounded-xl border-2 border-[#b42318] bg-[#ffe4e0] p-2">
              <span className="text-[#b42318]">
                <IconeSirene tamanho={16} />
              </span>
              <span className="text-[0.62rem] font-bold leading-snug text-[#b42318]">Procure atendimento de urgência conforme a orientação recebida</span>
            </div>
          </div>
        </div>
      </div>

      {/* Selos flutuantes */}
      <div aria-hidden="true" className="flutuar absolute -left-6 top-16 hidden rounded-2xl bg-white px-3 py-2 text-xs font-bold text-[#0e1b3d] shadow-forte sm:block">
        <span className="mr-1.5 inline-block size-2 rounded-full bg-[#19d3c0]" />
        Revisado pela equipe
      </div>
      <div aria-hidden="true" className="flutuar-lento absolute -right-8 top-40 hidden rounded-2xl bg-white px-3 py-2 text-xs font-bold text-[#0e1b3d] shadow-forte sm:block">
        <span className="mr-1.5 inline-block size-2 rounded-full bg-[#7c5cff]" />
        Filha Joana ajuda
      </div>
      <div aria-hidden="true" className="flutuar absolute -left-4 bottom-10 hidden rounded-2xl bg-white px-3 py-2 text-xs font-bold text-[#0e1b3d] shadow-forte sm:block">
        <span className="mr-1.5 inline-block size-2 rounded-full bg-[#ff7a59]" />
        Lembrete às 22h
      </div>
    </div>
  );
}
