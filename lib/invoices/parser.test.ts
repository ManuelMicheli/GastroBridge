import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { zipSync, strToU8 } from "fflate";
import { parseFatturaPA, parseFatturaElement, stripAttachments, parseDecimal, documentTypeLabel } from "./fatturapa.ts";
import { extractInvoiceDocuments, splitUpload, rootElementName } from "./archive.ts";
import { extractP7mContent, looksLikeP7m } from "./p7m.ts";
import { decodeXmlBytes } from "./decode.ts";
import { jsonToElement, parseXml, XmlParseError } from "./xml.ts";

const FIX = new URL("../../tests/fixtures/invoices/", import.meta.url);
const bytes = (name: string) => new Uint8Array(readFileSync(new URL(name, FIX)));
const text = (name: string) => decodeXmlBytes(bytes(name));

test("FPR12 with namespace prefix: header, parties, document data", () => {
  const { invoices, errors } = parseFatturaPA(text("IT01234567890_FPR01.xml"));
  assert.deepEqual(errors, []);
  assert.equal(invoices.length, 1);
  const inv = invoices[0]!;
  assert.equal(inv.formatVersion, "FPR12");
  assert.equal(inv.supplier.vatNumber, "01234567890");
  assert.equal(inv.supplier.vatCountry, "IT");
  assert.equal(inv.supplier.name, "Rossi Carni S.r.l.");
  assert.equal(inv.supplier.email, "amministrazione@rossicarni.example");
  assert.equal(inv.buyer.vatNumber, "09876543210");
  assert.equal(inv.buyer.name, "Trattoria da Mario S.r.l.");
  assert.equal(inv.transmission.recipientCode, "JKKZDGR");
  assert.equal(inv.documentType, "TD01");
  assert.equal(inv.number, "FT 2026/0815");
  assert.equal(inv.date, "2026-09-15");
  assert.equal(inv.totalAmount, 271.2);
  assert.deepEqual(inv.causale, ["Fornitura carni settembre & salumi"]);
  assert.equal(inv.orderRefs[0]?.id, "ORD-77");
});

test("FPR12 lines: codes, units, discounts, kinds, VAT", () => {
  const inv = parseFatturaPA(text("IT01234567890_FPR01.xml")).invoices[0]!;
  assert.equal(inv.lines.length, 4);
  const [gua, fil, sal, tra] = inv.lines;
  assert.deepEqual(gua!.itemCodes, [{ type: "INTERNO", value: "GUA-001" }]);
  assert.equal(gua!.quantity, 5);
  assert.equal(gua!.unit, "KG");
  assert.equal(gua!.unitPrice, 14.16);
  assert.equal(gua!.totalPrice, 70.8);
  assert.equal(gua!.vatRate, 10);
  assert.equal(gua!.kind, "goods");
  assert.deepEqual(fil!.discounts, [{ type: "SC", percent: 10, amount: null }]);
  assert.equal(fil!.totalPrice, 151.2);
  assert.equal(sal!.quantity, 2);
  assert.equal(tra!.kind, "accessory");
  assert.equal(tra!.saleType, "AC");
});

test("FPR12 DDT references, VAT summary, totals and payments (computed due date)", () => {
  const inv = parseFatturaPA(text("IT01234567890_FPR01.xml")).invoices[0]!;
  assert.deepEqual(inv.ddt, [{ number: "DDT 0456/2026", date: "2026-09-12", lineNumbers: [1, 2, 3] }]);
  assert.equal(inv.vatSummaries.length, 2);
  assert.equal(inv.totals.taxable, 246);
  assert.equal(inv.totals.vat, 25.2);
  assert.equal(inv.totals.gross, 271.2);
  assert.equal(inv.payments.length, 2);
  assert.equal(inv.payments[0]!.dueDate, "2026-10-15");
  assert.equal(inv.payments[0]!.method, "MP05");
  assert.equal(inv.payments[0]!.iban, "IT60X0542811101000000123456");
  assert.equal(inv.payments[1]!.dueDate, "2026-11-14"); // 2026-09-15 + 60 days
  assert.equal(inv.attachments.length, 1);
  assert.equal(inv.attachments[0]!.name, "fattura.pdf");
});

test("TD24 deferred invoice: ISO-8859-1, default namespace, multiple DDTs, comma decimals, SC line", () => {
  const raw = bytes("IT02345678901_TD24_latin1.xml");
  const xml = decodeXmlBytes(raw);
  assert.match(xml, /caffè incluso/);
  const inv = parseFatturaPA(xml).invoices[0]!;
  assert.equal(inv.documentType, "TD24");
  assert.equal(documentTypeLabel(inv.documentType), "Fattura differita (art. 21 c.4 lett. a)");
  assert.equal(inv.supplier.name, "Ortofrutta Bianchi & Figli S.n.c.");
  assert.equal(inv.ddt.length, 2);
  assert.deepEqual(inv.ddt[1], { number: "1244", date: "2026-09-24", lineNumbers: [3, 4] });
  assert.equal(inv.lines[0]!.quantity, 2); // "2,00"
  assert.equal(inv.lines[3]!.description, "Caffè in grani miscela bar 1 kg");
  assert.equal(inv.lines[4]!.kind, "discount");
  assert.equal(inv.stampDuty, 2);
  assert.equal(inv.totals.taxable, 105.6);
  assert.equal(inv.payments[0]!.method, "MP12");
});

test("Lotto: one header, two bodies; CDATA, entities, forfettario Natura", () => {
  const { invoices } = parseFatturaPA(text("IT03456789012_lotto.xml"));
  assert.equal(invoices.length, 2);
  assert.equal(invoices[0]!.bodyIndex, 0);
  assert.equal(invoices[1]!.bodyIndex, 1);
  assert.equal(invoices[0]!.supplier.name, "Giuseppe Verdi");
  assert.equal(invoices[0]!.causale[0], "Olio <EVO> & aceto");
  assert.equal(invoices[0]!.lines[0]!.natura, "N2.2");
  assert.equal(invoices[1]!.number, "13");
  assert.equal(invoices[1]!.payments[0]!.dueDate, null);
  assert.equal(invoices[0]!.buyer.taxCode, "09876543210");
});

test("Credit note TD04 with DatiFattureCollegate", () => {
  const inv = parseFatturaPA(text("IT01234567890_NC01.xml")).invoices[0]!;
  assert.equal(inv.documentType, "TD04");
  assert.deepEqual(inv.linkedInvoices, [{ id: "FT 2026/0815", date: "2026-09-15", lineNumbers: [] }]);
  assert.equal(inv.totals.taxable, 42.4);
});

test("Fattura semplificata FSM10", () => {
  const inv = parseFatturaPA(text("IT04567890123_semplificata.xml")).invoices[0]!;
  assert.equal(inv.simplified, true);
  assert.equal(inv.documentType, "TD07");
  assert.equal(inv.supplier.name, "Panificio Il Forno");
  assert.equal(inv.supplier.vatNumber, "04567890123");
  assert.equal(inv.buyer.vatNumber, "09876543210");
  assert.equal(inv.lines[0]!.totalPrice, 50);
  assert.equal(inv.totals.vat, 2);
});

test("p7m DER envelope → same invoice as the plain XML", () => {
  const p7m = bytes("IT01234567890_FPR01.xml.p7m");
  assert.equal(looksLikeP7m(p7m), true);
  const xml = decodeXmlBytes(extractP7mContent(p7m));
  assert.equal(xml, text("IT01234567890_FPR01.xml"));
});

test("p7m BER streamed (indefinite length + chunked OCTET STRING)", () => {
  const xml = decodeXmlBytes(extractP7mContent(bytes("IT02345678901_TD24_ber.xml.p7m")));
  const inv = parseFatturaPA(xml).invoices[0]!;
  assert.equal(inv.number, "318/B");
  assert.equal(inv.lines.length, 5);
});

test("archive: base64 p7m, double-signed p7m, metadata skipped", () => {
  const b64 = extractInvoiceDocuments("x.xml.p7m", bytes("IT01234567890_FPR01_base64.xml.p7m"));
  assert.equal(b64.documents.length, 1);
  assert.equal(b64.documents[0]!.sourceKind, "p7m_base64");
  const dbl = extractInvoiceDocuments("x.p7m.p7m", bytes("IT01234567890_FPR01_doppia.xml.p7m.p7m"));
  assert.equal(dbl.documents.length, 1);
  assert.equal(parseFatturaPA(dbl.documents[0]!.xml).invoices[0]!.number, "FT 2026/0815");
  const meta = extractInvoiceDocuments("IT01234567890_FPR01_MT_001.xml", bytes("IT01234567890_FPR01_MT_001.xml"));
  assert.equal(meta.documents.length, 0);
  assert.match(meta.skipped[0]!.reason, /metadati/);
});

test("archive: AdE-style zip with nested zip, p7m, xml, metadata and junk", () => {
  const inner = zipSync({ "IT02345678901_TD24_ber.xml.p7m": bytes("IT02345678901_TD24_ber.xml.p7m") });
  const zip = zipSync({
    "fatture/IT01234567890_FPR01.xml.p7m": bytes("IT01234567890_FPR01.xml.p7m"),
    "fatture/IT01234567890_FPR01_MT_001.xml": bytes("IT01234567890_FPR01_MT_001.xml"),
    "fatture/IT03456789012_lotto.xml": bytes("IT03456789012_lotto.xml"),
    "fatture/leggimi.txt": strToU8("ciao"),
    "__MACOSX/._x": strToU8("junk"),
    "annidato.zip": inner,
  });
  const res = extractInvoiceDocuments("download.zip", zip);
  assert.equal(res.documents.length, 3);
  const names = res.documents.map((d) => d.fileName).sort();
  assert.deepEqual(names, ["IT01234567890_FPR01.xml.p7m", "IT02345678901_TD24_ber.xml.p7m", "IT03456789012_lotto.xml"]);
  assert.equal(res.skipped.length, 2);
  const split = splitUpload("download.zip", zip);
  assert.equal(split.length, 5);
});

test("archive: unreadable inputs are reported, never thrown", () => {
  assert.match(extractInvoiceDocuments("a.xml", new Uint8Array()).skipped[0]!.reason, /vuoto/);
  assert.match(extractInvoiceDocuments("a.pdf", strToU8("%PDF-1.4 binary")).skipped[0]!.reason, /Formato/);
  const broken = bytes("IT01234567890_FPR01.xml.p7m").slice(0, 200);
  const r = extractInvoiceDocuments("rotto.p7m", broken);
  assert.equal(r.documents.length, 0);
  assert.equal(r.skipped.length, 1);
});

test("xml reader: malformed input, DOCTYPE skipped, numeric entities", () => {
  assert.throws(() => parseXml("<a><b></a>"), XmlParseError);
  const el = parseXml('<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><x>&e; &#233;&#x41;</x>');
  assert.equal(el.text, "&e; éA");
  assert.equal(rootElementName('<?xml version="1.0"?><!-- c --><p:FatturaElettronica>'), "FatturaElettronica");
  assert.equal(parseFatturaPA("<foo/>").errors[0], "Il documento non è una FatturaPA");
  assert.match(parseFatturaPA("<<<").errors[0]!, /XML non valido/);
});

test("JSON rendering (snake_case, as some SDI intermediaries deliver it)", () => {
  const payload = {
    fattura_elettronica_header: {
      cedente_prestatore: {
        dati_anagrafici: { id_fiscale_iva: { id_paese: "IT", id_codice: "01234567890" }, anagrafica: { denominazione: "Rossi Carni" } },
      },
      cessionario_committente: { dati_anagrafici: { id_fiscale_iva: { id_paese: "IT", id_codice: "09876543210" } } },
    },
    fattura_elettronica_body: [
      {
        dati_generali: { dati_generali_documento: { tipo_documento: "TD01", data: "2026-09-01", numero: "9", importo_totale_documento: 11 } },
        dati_beni_servizi: {
          dettaglio_linee: [{ numero_linea: 1, descrizione: "Guanciale", quantita: 1, unita_misura: "KG", prezzo_unitario: 10, prezzo_totale: 10, aliquota_iva: 10 }],
          dati_riepilogo: [{ aliquota_iva: 10, imponibile_importo: 10, imposta: 1 }],
        },
      },
    ],
  };
  const { invoices } = parseFatturaElement(jsonToElement("invoice", { payload }));
  assert.equal(invoices.length, 1);
  assert.equal(invoices[0]!.supplier.vatNumber, "01234567890");
  assert.equal(invoices[0]!.lines[0]!.description, "Guanciale");
  assert.equal(invoices[0]!.totals.gross, 11);
});

test("helpers: decimals and attachment stripping", () => {
  assert.equal(parseDecimal("1.234,56"), 1234.56);
  assert.equal(parseDecimal("12,5"), 12.5);
  assert.equal(parseDecimal("-2.00"), -2);
  assert.equal(parseDecimal(""), null);
  const stripped = stripAttachments(text("IT01234567890_FPR01.xml").replace(/(<Attachment>)/, `$1${"A".repeat(400)}`));
  assert.match(stripped, /allegato rimosso/);
  assert.equal(parseFatturaPA(stripped).invoices[0]!.number, "FT 2026/0815");
});
