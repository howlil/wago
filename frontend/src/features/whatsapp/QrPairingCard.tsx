import { QrCode } from "lucide-react";
import { cardBodyClass, sectionDescriptionClass, sectionTitleClass } from "../../shared/ui/classes.js";

type QrPairingCardProps = {
  qrImage: string;
};

export function QrPairingCard({ qrImage }: QrPairingCardProps) {
  return (
    <section className={`${cardBodyClass} grid gap-5 md:grid-cols-[minmax(0,1fr)_220px] md:items-center`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff5dc] text-[#8a5a00]">
          <QrCode size={19} />
        </span>
        <div>
          <h2 className={sectionTitleClass}>Scan WhatsApp QR</h2>
          <p className={sectionDescriptionClass}>
            Open WhatsApp → Linked devices → Link a device, then scan this code. Keep this tab open until the account is
            connected.
          </p>
        </div>
      </div>
      <img
        className="mx-auto aspect-square w-full max-w-[220px] rounded-xl border border-[#dce5e1] bg-white p-2"
        src={`data:image/svg+xml;utf8,${encodeURIComponent(qrImage)}`}
        alt="WhatsApp login QR"
      />
    </section>
  );
}
