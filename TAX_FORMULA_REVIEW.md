# Prüfdokument: Formeln im GmbH-EV Vergleich

Stand: 12.05.2026

Zweck: kurze fachliche Übersicht der aktuell implementierten Berechnungen im Web-Tool, damit die Formeln durch einen Steuerberater geprüft werden können.

## 1. Eingaben

Das Tool vergleicht mehrere Szenarien für eine GmbH in Berlin.

Globale Steuer- und Unternehmensparameter:
- Jahresgewinn vor Fahrzeugkosten
- Körperschaftsteuer
- Solidaritätszuschlag
- GewSt-Messzahl
- Berliner Hebesatz
- GewSt-Hinzurechnungsfreibetrag
- Sonstige GewSt-Hinzurechnungen pro Jahr
- USt-Satz
- USt-Modus für Gebrauchtwagen
- AfA-Dauer

Szenario-Parameter:
- Fahrzeugname und Zustand `new` / `used`
- Bruttolistenpreis
- Kaufpreis brutto
- Erstzulassung
- Monat des Nutzungsbeginns
- Private-use-Methode
- Privatnutzungssatz
- Arbeitsweg
- Laufende Kosten
- Leasingdaten oder Ballonkreditdaten

## 2. Steuerlogik

### 2.1 USt / Vorsteuer

Brutto- und Nettowerte werden mit dem hinterlegten USt-Satz getrennt:

```text
net = gross / (1 + vatRate)
vat = gross - net
```

Wenn bei einem Gebrauchtwagen `usedVatMode = none` gesetzt ist, wird kein Vorsteuerabzug angesetzt und der Bruttobetrag bleibt Kostenbasis.

### 2.2 GewSt

Die GewSt wird mit Berliner Hebesatz berechnet. Der aktuelle Code rundet den Gewerbeertrag vorher auf volle 100 EUR ab:

```text
roundedGewerbeertrag = floor(max(0, taxableProfit) / 100) * 100
GewSt = roundedGewerbeertrag * 3.5% * (Hebesatz / 100)
```

Für die Hinzurechnung wird ein allgemeiner jährlicher Betrag außerhalb des Fahrzeugs berücksichtigt. Der relevante Freibetrag beträgt 200.000 EUR.

### 2.3 KSt / Soli

Die Steuerersparnis wird als marginale Differenz zwischen Gewinn vor Fahrzeugkosten und Gewinn nach Fahrzeugkosten gerechnet.

```text
KSt-Saving = KSt(base profit) - KSt(after car)
Soli-Saving = KSt-Saving * 5.5%
GewSt-Saving = GewSt(base profit) - GewSt(after car)
Total tax saving = KSt-Saving + Soli-Saving + GewSt-Saving
```

## 3. Private Use

Die private Nutzung wird separat als geldwerter Vorteil ausgewiesen und nicht als Betriebsausgabe der GmbH behandelt.

Auto-BEV-Regel:
- bis 100.000 EUR Bruttolistenpreis: 0,25% pro Monat
- darüber: 0,5% pro Monat

Manueller Modus:
- frei einstellbarer monatlicher Prozentsatz

Jährlicher Vorteil:

```text
privateUseBenefitAnnual = BLP * privateUseRate * 12
```

Zusätzlich kann ein Arbeitsweg-Baustein aktiviert werden. Im aktuellen Code wird er so gerechnet:

```text
commuteBenefitAnnual = BLP * privateUseRate * 0.03 * distanceKm * commuteMonths
```

## 4. Laufende Fahrzeugkosten

Aktuell separat erfasste Kosten:
- Versicherung
- Laden
- Wartung
- Reifen

Jedes dieser Felder kann per Schalter aktiviert oder deaktiviert werden. Wenn deaktiviert, fließt es nicht in die Berechnung ein.

Für kostenpflichtige Positionen mit abziehbarer USt wird Vorsteuer berücksichtigt. Versicherung wird derzeit ohne Vorsteuer behandelt.

## 5. Szenario: Gewerbeleasing

Rechenlogik:
- monatliche Leasingrate brutto
- Sonderzahlung brutto
- Gebühren brutto
- laufende Kosten

Jahres-Cashflow:

```text
grossCashOut = monatlicheRateBrutto * Monate + SonderzahlungBrutto + GebührenBrutto + laufendeKostenBrutto
vorsteuer = Vorsteuer aus Leasing + Sonderzahlung + Gebühren + laufendeKosten
netCashOut = grossCashOut - vorsteuer
```

Abziehbare Kosten:

```text
deductibleExpense = monatlicheRateNetto * Monate + SonderzahlungNetto + laufendeKostenNetto
```

GewSt-Hinzurechnung beim Leasing:

```text
gewstAddbackBase = leasePaymentNet * 10%
gewstAddback = Anwendung des allgemeinen GewSt-Freibetrags und 25% Hinzurechnung auf den übersteigenden Anteil
```

Der nach Steuern ausgewiesene Jahreswert:

```text
afterTaxCost = grossCashOut - vorsteuer - totalTaxSaving
```

## 6. Szenario: Ballonkredit

Rechenlogik:
- Anzahlung
- Laufzeit
- Sollzinssatz
- Schlussrate / Ballon
- Kaufnebenkosten

Der Kreditplan wird als Annuität mit Schlussrate berechnet. Pro Monat werden Zins und Tilgung getrennt.

Finanzierte Summe:

```text
financedPrincipal = purchasePriceGross - downPaymentGross
```

AfA-Basis:

```text
afaBasis = purchaseNet + acquisitionCostsNet
```

AfA:
- neues Auto: 6 Jahre
- gebrauchtes Auto: globale AfA-Dauer aus den Tax Settings

Jährliche AfA:

```text
annualAfa = afaBasis / afaYears
```

Berechnung je Jahr:

```text
grossCashOut = Kreditrate + Schlussrate + Anzahlung + Kaufnebenkosten + laufendeKostenBrutto
vorsteuer = Vorsteuer aus Kauf + Nebenkosten + laufendeKosten
deductibleExpense = interest + afa + laufendeKostenNetto
```

GewSt-Hinzurechnung beim Kredit:

```text
gewstAddbackBase = interest
```

Der AfA-Zeitraum läuft auch nach Laufzeitende des Kredits weiter. Deshalb kann die Jahreszeile in späteren Jahren negativ werden, wenn der steuerliche Effekt größer ist als der laufende Cashflow.

## 7. Monats- und Jahresauswertung

Das Tool zeigt:
- Jahreswerte je Szenario
- Totals je Szenario
- After-tax equivalent pro Monat
- Gesamt-Cashflow brutto
- Vorsteuer
- Netto-Cashflow
- abzugsfähige Kosten
- GewSt-Hinzurechnung
- Steuerersparnis
- geldwerten Vorteil

Nach dem Kreditende bleibt in der Vergleichstabelle die AfA aktiv, bis der Abschreibungszeitraum ausgelaufen ist. Das ist gewollt.

## 8. Punkte zur fachlichen Prüfung

Bitte insbesondere diese Stellen prüfen:
- private-use BEV-Regel 0,25% / 0,5%
- Arbeitsweg-Baustein
- Behandlung von Gebrauchtwagen ohne abziehbare USt
- AfA-Basis bei Kaufnebenkosten
- GewSt-Hinzurechnung für Leasing und Zinsen
- Rounding auf volle 100 EUR bei der GewSt
- Behandlung von Jahren nach Kreditende, wenn AfA noch läuft

## 9. Kurzfassung

Das Tool berechnet:
- USt / Vorsteuer
- KSt
- Soli
- GewSt Berlin
- Leasing-Szenarien
- Ballonkredit-Szenarien für neue und gebrauchte E-Autos
- private Nutzung als geldwerten Vorteil
- Jahres- und Gesamtkosten nach Steuern
