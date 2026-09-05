import { getDatabase, withTransaction } from "../../infrastructure/database.js";

export type RecipientIdentity = {
  phoneJid: string;
  lidJid: string;
  updatedAt: string;
};

type RecipientIdentityRow = {
  phone_jid: string;
  lid_jid: string;
  updated_at: number;
};

const database = getDatabase();
const selectByPhone = database.prepare("SELECT * FROM recipient_identities WHERE phone_jid = ?");
const deleteConflictingLid = database.prepare("DELETE FROM recipient_identities WHERE lid_jid = ? AND phone_jid <> ?");
const upsertIdentity = database.prepare(`
  INSERT INTO recipient_identities (phone_jid, lid_jid, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(phone_jid) DO UPDATE SET
    lid_jid = excluded.lid_jid,
    updated_at = excluded.updated_at
`);

function mapRow(row: RecipientIdentityRow): RecipientIdentity {
  return {
    phoneJid: row.phone_jid,
    lidJid: row.lid_jid,
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function getRecipientIdentity(phoneJid: string): RecipientIdentity | null {
  const row = selectByPhone.get(phoneJid) as RecipientIdentityRow | undefined;
  return row ? mapRow(row) : null;
}

export function rememberRecipientIdentity(phoneJid: string, lidJid: string): RecipientIdentity {
  return withTransaction(() => {
    const updatedAt = Date.now();
    deleteConflictingLid.run(lidJid, phoneJid);
    upsertIdentity.run(phoneJid, lidJid, updatedAt);
    return {
      phoneJid,
      lidJid,
      updatedAt: new Date(updatedAt).toISOString(),
    };
  });
}

export function resetRecipientIdentityStoreForTest(): void {
  database.prepare("DELETE FROM recipient_identities").run();
}
