/**
 * React-PDF renderer for a restaurant purchase order addressed to a single
 * supplier (one supplier = one PDF). Pure presentational: receives an
 * already-fetched `OrderPdfData` payload and returns a `<Document>` tree.
 */
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

export interface OrderPdfParty {
  name: string;
  vat?: string | null;
  fiscal_code?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface OrderPdfLine {
  position: number;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes?: string | null;
}

export interface OrderPdfData {
  order_id: string;
  order_short_id: string;
  issued_at: string;
  expected_delivery_date?: string | null;
  restaurant: OrderPdfParty;
  supplier: OrderPdfParty;
  lines: OrderPdfLine[];
  subtotal: number;
  order_notes?: string | null;
}

const PRIMARY = "#8b2a30";

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
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

function fmtQty(n: number): string {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(n);
}

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#111827",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
    paddingBottom: 8,
    marginBottom: 10,
  },
  issuerBlock: { flex: 1 },
  issuerName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: PRIMARY,
    marginBottom: 2,
  },
  docMeta: {
    textAlign: "right",
    fontSize: 8,
    color: "#4b5563",
  },
  small: { fontSize: 8, color: "#4b5563" },
  title: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginVertical: 8,
    color: PRIMARY,
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
    backgroundColor: PRIMARY,
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
  col_name: { width: "44%" },
  col_qty: { width: "10%", textAlign: "right" },
  col_um: { width: "8%" },
  col_price: { width: "16%", textAlign: "right" },
  col_sub: { width: "16%", textAlign: "right" },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  totalsBox: {
    width: "40%",
    borderWidth: 1,
    borderColor: PRIMARY,
    padding: 6,
  },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  notesBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    padding: 6,
  },
  footer: {
    marginTop: 18,
    fontSize: 7,
    color: "#6b7280",
    textAlign: "center",
  },
});

function PartyBlock({ label, party }: { label: string; party: OrderPdfParty }) {
  const addressLine = [
    party.address,
    [party.postal_code, party.city, party.province].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(" — ");
  return (
    <View style={styles.partyBox}>
      <Text style={styles.partyLabel}>{label}</Text>
      <Text style={styles.partyName}>{party.name}</Text>
      {addressLine ? <Text style={styles.small}>{addressLine}</Text> : null}
      {party.vat ? <Text style={styles.small}>P.IVA {party.vat}</Text> : null}
      {party.fiscal_code ? (
        <Text style={styles.small}>C.F. {party.fiscal_code}</Text>
      ) : null}
      {party.phone ? <Text style={styles.small}>Tel. {party.phone}</Text> : null}
      {party.email ? <Text style={styles.small}>{party.email}</Text> : null}
    </View>
  );
}

export function OrderPdfDocument(data: OrderPdfData) {
  return (
    <Document title={`Ordine ${data.order_short_id}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.issuerBlock}>
            <Text style={styles.issuerName}>{data.restaurant.name}</Text>
            {data.restaurant.address ? (
              <Text style={styles.small}>
                {[
                  data.restaurant.address,
                  [
                    data.restaurant.postal_code,
                    data.restaurant.city,
                    data.restaurant.province,
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
                data.restaurant.vat ? `P.IVA ${data.restaurant.vat}` : null,
                data.restaurant.fiscal_code
                  ? `C.F. ${data.restaurant.fiscal_code}`
                  : null,
                data.restaurant.phone ? `Tel. ${data.restaurant.phone}` : null,
                data.restaurant.email,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
          <View>
            <Text style={styles.docMeta}>
              Ordine n. {data.order_short_id}
            </Text>
            <Text style={styles.docMeta}>
              Emesso il {fmtItDate(data.issued_at)}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>ORDINE D&apos;ACQUISTO</Text>
        <Text style={styles.meta}>
          Consegna prevista: {fmtItDateOnly(data.expected_delivery_date)}
        </Text>

        <View style={styles.partiesRow}>
          <PartyBlock label="Committente (Ristorante)" party={data.restaurant} />
          <PartyBlock label="Fornitore" party={data.supplier} />
        </View>

        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.col_pos]}>#</Text>
            <Text style={[styles.th, styles.col_name]}>Prodotto</Text>
            <Text style={[styles.th, styles.col_qty]}>Q.tà</Text>
            <Text style={[styles.th, styles.col_um]}>U.M.</Text>
            <Text style={[styles.th, styles.col_price]}>Prezzo unit.</Text>
            <Text style={[styles.th, styles.col_sub]}>Subtotale</Text>
          </View>
          {data.lines.map((line) => (
            <View
              key={`${line.position}-${line.product_name}`}
              style={styles.trow}
              wrap={false}
            >
              <Text style={[styles.td, styles.col_pos]}>{line.position}</Text>
              <Text style={[styles.td, styles.col_name]}>
                {line.product_name}
                {line.notes ? ` — ${line.notes}` : ""}
              </Text>
              <Text style={[styles.td, styles.col_qty]}>
                {fmtQty(line.quantity)}
              </Text>
              <Text style={[styles.td, styles.col_um]}>{line.unit}</Text>
              <Text style={[styles.td, styles.col_price]}>
                {fmtEur(line.unit_price)}
              </Text>
              <Text style={[styles.td, styles.col_sub]}>
                {fmtEur(line.subtotal)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsRow}>
          <View style={styles.totalsBox}>
            <View style={styles.totalLine}>
              <Text>Totale ordine</Text>
              <Text>{fmtEur(data.subtotal)}</Text>
            </View>
          </View>
        </View>

        {data.order_notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.partyLabel}>Note</Text>
            <Text style={styles.small}>{data.order_notes}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>
          Documento generato tramite GastroBridge · {fmtItDate(data.issued_at)}
        </Text>
      </Page>
    </Document>
  );
}

export default OrderPdfDocument;
