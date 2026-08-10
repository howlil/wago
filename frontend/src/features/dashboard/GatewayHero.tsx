import { Braces, LockKeyhole, MessageCircleMore, ServerCog } from "lucide-react";

const capabilityItems = [
  { icon: ServerCog, label: "Self-hosted" },
  { icon: MessageCircleMore, label: "Single account" },
  { icon: Braces, label: "HTTP API" },
];

export function GatewayHero() {
  return (
    <section className="relative mb-4 overflow-hidden rounded-[24px] border border-[#1f6048] bg-[#123e2f] text-white shadow-[0_22px_55px_rgba(18,62,47,0.16)] sm:mb-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,rgba(89,212,158,0.22),transparent_28rem),linear-gradient(135deg,rgba(255,255,255,0.035),transparent_45%)]" />
      <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border border-white/8" />
      <div className="pointer-events-none absolute -right-2 -top-12 h-44 w-44 rounded-full border border-white/8" />

      <div className="relative grid gap-7 px-5 py-6 sm:px-7 sm:py-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)] lg:items-center lg:px-8 lg:py-8">
        <div className="max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/7 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#cceadd]">
            <LockKeyhole size={12} />
            Local-first gateway control
          </div>
          <h2 className="m-0 max-w-2xl text-[28px] font-bold leading-[1.08] tracking-[-0.045em] text-white sm:text-[34px] lg:text-[38px]">
            Operate WhatsApp from one clean control surface.
          </h2>
          <p className="mt-3 mb-0 max-w-2xl text-[12px] leading-5 text-[#c6ddd3] sm:text-[13px] sm:leading-6">
            Pair your account, manage gateway credentials, approve recipients and send messages without hiding the
            underlying API workflow.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {capabilityItems.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-[10px] font-semibold text-[#e4f2ec]"
              >
                <Icon size={12} />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d3024]/80 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.16)] backdrop-blur">
          <div className="flex items-center justify-between border-b border-white/8 pb-3">
            <div>
              <p className="m-0 text-[9px] font-bold uppercase tracking-[0.12em] text-[#88bca5]">Gateway surface</p>
              <p className="mt-1 mb-0 text-[12px] font-semibold text-white">Simple by design</p>
            </div>
            <div className="flex gap-1.5" aria-hidden="true">
              <span className="h-2 w-2 rounded-full bg-white/15" />
              <span className="h-2 w-2 rounded-full bg-white/15" />
              <span className="h-2 w-2 rounded-full bg-[#54c793]" />
            </div>
          </div>
          <div className="mt-3 space-y-2 font-mono text-[10px]">
            <div className="flex items-center justify-between rounded-lg bg-white/[0.055] px-3 py-2.5">
              <span className="text-[#b5d4c6]">GET /health</span>
              <span className="font-sans font-bold text-[#6fdaa9]">ready</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-white/[0.055] px-3 py-2.5">
              <span className="text-[#b5d4c6]">GET /whatsapp/status</span>
              <span className="font-sans font-bold text-[#d8eee4]">live</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-white/[0.055] px-3 py-2.5">
              <span className="text-[#b5d4c6]">POST /messages/send</span>
              <span className="font-sans font-bold text-[#d8eee4]">protected</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
