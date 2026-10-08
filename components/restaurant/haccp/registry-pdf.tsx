/**
 * React-PDF "Registro di tracciabilità" (Reg. CE 178/2002) — landscape A4
 * table of received goods, for inspections or a product recall report.
 */
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type RegistryPdfRow = {
  receivedAt: string;
  supplier: string;
  product: string;
  lot: string;
  expiry: string;
  temperature: string;
  temperatureBad: boolean;
  qty: string;
  outcome: string;
  outcomeBad: boolean;
  ddt: string;
};

export type RegistryPdfData = {
  title: string;
  restaurantName: string;
  generatedAt: string;
  filtersLabel: string;
  rows: RegistryPdfRow[];
  truncated: boolean;
};

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 8.5, fontFamily: "Helvetica", color: "#111" },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  sub: { fontSize: 9, color: "#555", marginBottom: 2 },
  table: { marginTop: 10, borderTopWidth: 1, borderColor: "#222" },
  head: { flexDirection: "row", backgroundColor: "#EEE", borderBottomWidth: 1, borderColor: "#222" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#BBB" },
  cell: { paddingVertical: 3, paddingHorizontal: 3 },
  bold: { fontFamily: "Helvetica-Bold" },
  bad: { color: "#B91C1C", fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 16, left: 28, right: 28, fontSize: 7.5, color: "#777", flexDirection: "row", justifyContent: "space-between" },
});

const COLS: { key: keyof RegistryPdfRow; label: string; w: string }[] = [
  { key: "receivedAt", label: "Ricevuto", w: "11%" },
  { key: "supplier", label: "Fornitore", w: "14%" },
  { key: "product", label: "Prodotto", w: "20%" },
  { key: "lot", label: "Lotto", w: "10%" },
  { key: "expiry", label: "Scadenza", w: "8%" },
  { key: "temperature", label: "T °C", w: "6%" },
  { key: "qty", label: "Q.tà ric.", w: "8%" },
  { key: "outcome", label: "Esito", w: "13%" },
  { key: "ddt", label: "DDT", w: "10%" },
];

export function RegistryPdfDocument(data: RegistryPdfData) {
  return (
    <Document title={data.title}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.sub}>{data.restaurantName} — Reg. CE 178/2002, art. 18 (rintracciabilità)</Text>
        <Text style={styles.sub}>
          Generato il {data.generatedAt}
          {data.filtersLabel ? ` · Filtri: ${data.filtersLabel}` : ""}
        </Text>
        <View style={styles.table}>
          <View style={styles.head} fixed>
            {COLS.map((c) => (
              <Text key={c.key} style={[styles.cell, styles.bold, { width: c.w }]}>
                {c.label}
              </Text>
            ))}
          </View>
          {data.rows.length === 0 ? (
            <Text style={[styles.cell, { color: "#777" }]}>Nessuna registrazione per i filtri scelti.</Text>
          ) : (
            data.rows.map((r, i) => (
              <View key={i} style={styles.row} wrap={false}>
                {COLS.map((c) => {
                  const bad = (c.key === "temperature" && r.temperatureBad) || (c.key === "outcome" && r.outcomeBad);
                  return (
                    <Text key={c.key} style={[styles.cell, { width: c.w }, bad ? styles.bad : {}]}>
                      {String(r[c.key] ?? "")}
                    </Text>
                  );
                })}
              </View>
            ))
          )}
        </View>
        {data.truncated ? (
          <Text style={[styles.sub, { marginTop: 6 }]}>Elenco limitato alle registrazioni più recenti: restringi i filtri.</Text>
        ) : null}
        <View style={styles.footer} fixed>
          <Text>GastroBridge — registro generato dai ricevimenti merce</Text>
          <Text render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} di ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
