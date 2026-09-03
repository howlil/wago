type QrPairingCardProps = {
  qrImage: string;
};

export function QrPairingCard({ qrImage }: QrPairingCardProps) {
  return (
    <div className="grid gap-4 rounded-md border border-wago-line bg-wago-surface-subtle p-4 sm:max-w-[720px] sm:grid-cols-[minmax(0,1fr)_148px] sm:items-center">
      <div className="min-w-0">
        <strong className="block text-[13px] font-semibold text-wago-ink">Scan with WhatsApp</strong>
        <p className="mb-0 mt-1 max-w-[480px] text-xs leading-5 text-wago-muted">
          Linked devices → Link a device → scan this code. Keep this page open until the session connects.
        </p>
      </div>
      <div className="flex justify-center sm:justify-start">
        <img
          className="aspect-square w-[148px] rounded-md border border-wago-line bg-white p-1.5"
          src={`data:image/svg+xml;utf8,${encodeURIComponent(qrImage)}`}
          alt="WhatsApp login QR"
        />
      </div>
    </div>
  );
}
