import { QrCode } from "lucide-react";

type QrPairingCardProps = {
  qrImage: string;
};

export function QrPairingCard({ qrImage }: QrPairingCardProps) {
  return (
    <div className="grid gap-5 sm:max-w-[720px] sm:grid-cols-[minmax(0,1fr)_148px] sm:items-center">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#fff5dc] text-[#8a5a00]">
          <QrCode size={14} />
        </span>
        <div className="min-w-0">
          <strong className="block text-[13px] font-semibold text-wago-ink">Scan with WhatsApp</strong>
          <p className="mb-0 mt-0.5 max-w-[480px] text-[11px] leading-4 text-wago-muted">
            Linked devices → Link a device → scan this code. Keep this page open until the session connects.
          </p>
        </div>
      </div>
      <div className="flex justify-center sm:justify-start">
        <img
          className="aspect-square w-[148px] rounded-md border border-[#dce5e1] bg-white p-1.5"
          src={`data:image/svg+xml;utf8,${encodeURIComponent(qrImage)}`}
          alt="WhatsApp login QR"
        />
      </div>
    </div>
  );
}
