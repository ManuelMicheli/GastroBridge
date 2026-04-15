/**
 * React-PDF renderer for Documento di Trasporto (DDT).
 *
 * Pure presentational component: receives an already-fetched `DdtPdfData`
 * payload and returns a `<Document>` tree. Never imports server utilities,
 * never fetches. Rendering to buffer happens in `lib/supplier/ddt/render.ts`.
 *
 * Italian UI strings throughout — DDT is a domestic legal-transport document.
 */
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

export type DdtCausale =
  | "sale"
  | "consignment"
  | "return"
  | "transfer"
  | "sample"
  | "cancel";

const CAUSALE_LABEL: Record<DdtCausale, string> = {
  sale: "Vendita",
  consignment: "Conto deposito",
  return: "Reso",
  transfer: "Trasferimento interno",
  sample: "Campione gratuito",
  cancel: "Annullo",
};

export interface DdtParty {
  name: string;
  vat?: string | null;
  fiscal_code?: string | null;
  rea?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  province?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface DdtLineRow {
  position: number;
  product_name: string;
  sku?: string | null;
  unit: string;
  quantity: number;
  lot_code?: string | null;
  expiry_date?: string | null; // ISO yyyy-mm-dd
  notes?: string | null;
}

export interface DdtTemplate {
  logo_url?: string | null;
  primary_color?: string | null;
  header_html?: string | null;
  footer_html?: string | null;
  conditions_text?: string | null;
}

export interface DdtPdfData {
  number: number;
  year: number;
  causale: DdtCausale;
  issued_at: string; // ISO
  supplier: DdtParty;
  recipient: DdtParty;
  lines: DdtLineRow[];
  vettore?: string | null;
  colli?: number | null;
  peso_kg?: number | null;
  notes?: string | null;
  template?: DdtTemplate | null;
  copia?: boolean;
}

const DEFAULT_PRIMARY = "#1f2937";

function fmtItDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Rome",
  }).format(d);
}

function fmtItDateOnly(ymd: string | null | undefined): string {
  if (!ymd) return "";
  // ymd is "YYYY-MM-DD"; avoid timezone drift by splitting manually.
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

function fmtQty(n: number): string {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(n);
}

function createStyles(primary: string) {
  return StyleSheet.create({
    page: {
      padding: 36,
      fontFamily: "Helvetica",
      fontSize: 9,
      color: "#111827",
      position: "relative",
    },
    watermark: {
      position: "absolute",
      top: 320,
      left: 120,
      transform: "rotate(-30deg)",
      fontSize: 110,
      fontFamily: "Helvetica-Bold",
      color: "#9ca3af",
      opacity: 0.15,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      borderBottomWidth: 2,
      borderBottomColor: primary,
      paddingBottom: 8,
      marginBottom: 10,
    },
    logo: {
      width: 90,
      height: 60,
      objectFit: "contain",
      marginRight: 14,
    },
    supplierBlock: {
      flex: 1,
    },
    supplierName: {
      fontSize: 13,
      fontFamily: "Helvetica-Bold",
      color: primary,
      marginBottom: 2,
    },
    small: { fontSize: 8, color: "#4b5563" },
    title: {
      fontSize: 14,
      fontFamily: "Helvetica-Bold",
      textAlign: "center",
      marginVertical: 8,
      color: primary,
    },
    meta: {
      textAlign: "center",
      fontSize: 10,
      marginBottom: 10,
    },
    partiesRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 10,
    },
    partyBox: {
      flex: 1,
      borderWidth: 1,
      borderColor: "#d1d5db",
      padding: 6,
    },
    partyLabel: {
      fontSize: 7,
      color: "#6b7280",
      textTransform: "uppercase",
      marginBottom: 2,
    },
    partyName: { fontSize: 10, fontFamily: "Helvetica-Bold" },
    table: {
      marginTop: 4,
      borderWidth: 1,
      borderColor: "#d1d5db",
    },
    thead: {
      flexDirection: "row",
      backgroundColor: primary,
      color: "#ffffff",
      fontFamily: "Helvetica-Bold",
      fontSize: 8,
    },
    trow: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: "#e5e7eb",
      fontSize: 8,
    },
    th: { padding: 4 },
    td: { padding: 4 },
    col_pos: { width: "6%" },
    col_name: { width: "34%" },
    col_sku: { width: "12%" },
    col_qty: { width: "10%", textAlign: "right" },
    col_um: { width: "8%" },
    col_lot: { width: "16%" },
    col_exp: { width: "14%" },
    footer: {
      marginTop: 14,
      flexDirection: "row",
      gap: 10,
    },
    footerBox: {
      flex: 1,
      borderWidth: 1,
      borderColor: "#d1d5db",
      padding: 6,
    },
    signaturesRow: {
      flexDirection: "row",
      marginTop: 24,
      gap: 10,
    },
    signatureBox: {
      flex: 1,
      borderTopWidth: 1,
      borderTopColor: "#6b7280",
      paddingTop: 4,
      fontSize: 8,
      textAlign: "center",
      color: "#4b5563",
    },
    conditions: {
      marginTop: 10,
      fontSize: 7,
      color: "#6b7280",
    },
  });
}

function PartyBlock({ label, party }: { label: string; party: DdtParty }) {
  const styles = createStyles(DEFAULT_PRIMARY);
  const addressLine = [
    party.address,
    [party.postal_code, party.city, party.province].filter(Boolean).join(" "),
    party.country,
  ]
    .filter(Boolean)
    .join(" — ");
  return (
    <View style={styles.partyBox}>
      <Text style={styles.partyLabel}>{label}</Text>
      <Text style={styles.partyName}>{party.name}</Text>
      {addressLine ? <Text style={styles.small}>{addressLine}</Text> : null}
      {party.vat ? (
        <Text style={styles.small}>P.IVA {party.vat}</Text>
      ) : null}
      {party.fiscal_code ? (
        <Text style={styles.small}>C.F. {party.fiscal_code}</Text>
      ) : null}
      {party.rea ? <Text style={styles.small}>REA {party.rea}</Text> : null}
      {party.phone ? <Text style={styles.small}>Tel. {party.phone}</Text> : null}
      {party.email ? <Text style={styles.small}>{party.email}</Text> : null}
    </View>
  );
}

export function DdtPdfDocument(data: DdtPdfData) {
  const primary = data.template?.primary_color || DEFAULT_PRIMARY;
  const styles = createStyles(primary);
  const causaleLabel = CAUSALE_LABEL[data.causale] ?? data.causale;
  const showWatermark = Boolean(data.copia);
  const logo = data.template?.logo_url;

  return (
    <Document title={`DDT ${data.number}/${data.year}`}>
      <Page size="A4" style={styles.page}>
        {showWatermark ? <Text style={styles.watermark}>COPIA</Text> : null}

        <View style={styles.headerRow}>
          {logo ? <Image src={logo} style={styles.logo} /> : null}
          <View style={styles.supplierBlock}>
            <Text style={styles.supplierName}>{data.supplier.name}</Text>
            {data.supplier.address ? (
              <Text style={styles.small}>
                {[
                  data.supplier.address,
                  [
                    data.supplier.postal_code,
                    data.supplier.city,
                    data.supplier.province,
                  ]
                    .filter(Boolean)
                    .join(" "),
                ]
                  .filter(Boolean)
                  .join(" — ")}
              </Text>
            ) : null}
            <Text style={styles.small}>
              {[
                data.supplier.vat ? `P.IVA ${data.supplier.vat}` : null,
                data.supplier.fiscal_code
                  ? `C.F. ${data.supplier.fiscal_code}`
                  : null,
                data.supplier.rea ? `REA ${data.supplier.rea}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>
          DOCUMENTO DI TRASPORTO N. {data.number}/{data.year}
        </Text>
        <Text style={styles.meta}>
          Causale: {causaleLabel} · Data emissione: {fmtItDate(data.issued_at)}
        </Text>

        <View style={styles.partiesRow}>
          <PartyBlock label="Mittente" party={data.supplier} />
          <PartyBlock label="Destinatario" party={data.recipient} />
        </View>

        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.col_pos]}>#</Text>
            <Text style={[styles.th, styles.col_name]}>Prodotto</Text>
            <Text style={[styles.th, styles.col_sku]}>SKU</Text>
            <Text style={[styles.th, styles.col_qty]}>Q.tà</Text>
            <Text style={[styles.th, styles.col_um]}>U.M.</Text>
            <Text style={[styles.th, styles.col_lot]}>Lotto</Text>
            <Text style={[styles.th, styles.col_exp]}>Scadenza</Text>
          </View>
          {data.lines.map((line) => (
            <View
              key={`${line.position}-${line.product_name}-${line.lot_code ?? ""}`}
              style={styles.trow}
              wrap={false}
            >
              <Text style={[styles.td, styles.col_pos]}>{line.position}</Text>
              <Text style={[styles.td, styles.col_name]}>
                {line.product_name}
                {line.notes ? ` — ${line.notes}` : ""}
              </Text>
              <Text style={[styles.td, styles.col_sku]}>{line.sku ?? ""}</Text>
              <Text style={[styles.td, styles.col_qty]}>
                {fmtQty(line.quantity)}
              </Text>
              <Text style={[styles.td, styles.col_um]}>{line.unit}</Text>
              <Text style={[styles.td, styles.col_lot]}>
                {line.lot_code ?? "—"}
              </Text>
              <Text style={[styles.td, styles.col_exp]}>
                {fmtItDateOnly(line.expiry_date)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <View style={styles.footerBox}>
            <Text style={styles.partyLabel}>Trasporto</Text>
            <Text style={styles.small}>
              Vettore: {data.vettore ?? "A cura del mittente"}
            </Text>
            <Text style={styles.small}>Colli: {data.colli ?? "—"}</Text>
            <Text style={styles.small}>
              Peso (kg):{" "}
              {data.peso_kg != null ? fmtQty(Number(data.peso_kg)) : "—"}
            </Text>
          </View>
          <View style={styles.footerBox}>
            <Text style={styles.partyLabel}>Note</Text>
            <Text style={styles.small}>{data.notes ?? "—"}</Text>
          </View>
        </View>

        <View style={styles.signaturesRow}>
          <Text style={styles.signatureBox}>Firma conducente</Text>
          <Text style={styles.signatureBox}>Firma destinatario</Text>
        </View>

        {data.template?.conditions_text ? (
          <Text style={styles.conditions}>{data.template.conditions_text}</Text>
        ) : null}
      </Page>
    </Document>
  );
}

export default DdtPdfDocument;
