import { QrCode } from "lucide-react";

type QrPairingCardProps = {
  qrImage: string;
};

export function QrPairingCard({ qrImage }: QrPairingCardProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_176px] sm:items-center">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#fff5dc] text-[#8a5a00]">
          <QrCode size={16} />
        </span>
        <div>
          <strong className="block text-sm font-semibold text-wago-ink">Scan with WhatsApp</strong>
          <p className="mb-0 mt-1 text-xs leading-5 text-wago-muted">
            Open Linked devices → Link a device, then scan this code. Keep this tab open until the session connects.
          </p>
        </div>
      </div>
      <div className="flex justify-center sm:justify-end">
        <img
          className="aspect-square w-[176px] rounded-md border border-[#dce5e1] bg-white p-1.5"
          src={`data:image/svg+xml;utf8,${encodeURIComponent(qrImage)}`}
          alt="WhatsApp login QR"
        />
      </div>
    </div>
  );
}
