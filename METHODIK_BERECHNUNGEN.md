# Methodik der Berechnungen im GmbH-EV Vergleich

Stand: 12.05.2026  
Codebasis: aktueller Stand des Repos `felev-ev-compare`  
Zweck: exakte Beschreibung der im Code implementierten Rechenlogik, damit die Formeln fachlich geprüft werden können.

## 1. Geltungsbereich

Das Tool vergleicht drei Szenario-Typen:
- `Gewerbeleasing`
- `Ballonkredit neu`
- `Ballonkredit gebraucht`

Das Dokument beschreibt **nur** die aktuelle Implementierung im Code. Es ist keine steuerliche Neubewertung.

## 2. Eingaben und Normalisierung

### 2.1 Globale Steuerparameter

Die folgenden Werte kommen aus den Tax Settings:
- `baseAnnualProfit`
- `corporationTaxRate`
- `solidarityRate`
- `gewstMeasureRate`
- `berlinHebesatz`
- `gewstAddbackAllowance`
- `otherAnnualGewstAddbacks`
- `vatRate`
- `usedVatMode`
- `afaYears`

Default-Werte im Code:
- KSt: `15%`
- Soli auf KSt: `5,5%`
- GewSt-Messzahl: `3,5%`
- Berlin Hebesatz: `410`
- GewSt-Freibetrag: `200.000 EUR`
- USt: `19%`
- USt für Gebrauchtwagen default: `none`
- AfA default: `6 Jahre`

### 2.2 Szenario-Eingaben

Pro Szenario gibt es:
- Fahrzeugdaten
- optional Leasingdaten oder Kreditdaten
- optionale Felder mit `...Enabled`-Schalter

Wichtig:
- Ist ein optionales Feld deaktiviert, geht sein Wert **nicht** in die Berechnung ein.
- Fehlende oder alte Felder werden beim Laden normalisiert.
- `salePriceMode` wird auf `gross` oder `net` normalisiert.

## 3. Gemeinsame Hilfsfunktionen

### 3.1 `splitVat(gross, vatRate, vatMode)`

Wenn `vatMode = none` oder `vatRate <= 0`:

```text
gross = input
net = input
vat = 0
```

Sonst:

```text
net = gross / (1 + vatRate)
vat = gross - net
```

### 3.2 Verkaufspreis

`resolveSalePrice(car)` interpretiert den eingegebenen Betrag über `salePriceMode`.

Wenn `salePriceMode = gross`:
- der eingegebene Betrag wird als Brutto-Verkaufspreis gelesen
- daraus werden netto und USt mit `splitVat(...)` abgeleitet

Wenn `salePriceMode = net`:
- der eingegebene Betrag wird als Netto-Verkaufspreis gelesen
- Brutto = Netto * `(1 + vatRate)`
- bei `vatMode = none` bleibt Brutto = Netto

### 3.3 Privatnutzungssatz

`resolvePrivateUseRate(car)`:
- im Modus `auto-bev`:
  - `0,25%` bei `blpGross <= 100.000`
  - `0,5%` bei `blpGross > 100.000`
- im Modus `fixed-rate`:
  - der manuell eingegebene Satz

## 4. USt und Vorsteuer

Vorsteuer wird überall dort separat behandelt, wo der Code eine USt-relevante Ausgabe splitten kann.

Grundsatz:
- Brutto-Ausgaben erhöhen Cashflow.
- Vorsteuer reduziert `netCashOut`.
- Bei nicht abzugsfähiger USt bleibt der Bruttobetrag wirtschaftliche Basis.

### 4.1 Laufende Kosten

Aktuell getrennt erfasste laufende Kosten:
- Versicherung
- Laden
- Wartung
- Reifen

Je Position gilt:
- nur wenn `...Enabled = true`
- sonst Beitrag = `0`

Split-Logik im Code:
- Versicherung: `vatMode = none`
- Laden: `vatMode = regular`
- Wartung: `vatMode = regular`
- Reifen: `vatMode = regular`

### 4.2 Gebrauchtwagen

Wenn `vatMode = none`:
- kein Vorsteuerabzug
- Bruttobetrag bleibt Kostenbasis
- AfA-Basis ist brutto

Wenn `vatMode = regular`:
- Vorsteuer wird aus Kaufpreis und abzugsfähigen Nebenkosten gezogen
- AfA-Basis ist netto

## 5. GewSt

### 5.1 GewSt aus dem steuerpflichtigen Gewinn

Funktion `calculateGewst(taxableProfit, settings)`:

1. `taxableProfit` wird auf mindestens `0` begrenzt
2. auf volle `100 EUR` **nach unten** abgerundet:

```text
roundedGewerbeertrag = floor(max(0, taxableProfit) / 100) * 100
```

3. GewSt:

```text
GewSt = roundedGewerbeertrag * gewstMeasureRate * (berlinHebesatz / 100)
```

Mit Defaults:

```text
GewSt = roundedGewerbeertrag * 3,5% * 410%
```

### 5.2 Steuerersparnis GewSt

Die Ersparnis wird als Differenz zwischen Gewinn vor Fahrzeug und Gewinn nach Fahrzeug gerechnet:

```text
gewstSaving = GewSt(base profit) - GewSt(after car)
```

### 5.3 GewSt-Hinzurechnung

Funktion `gewstAddback(currentScenarioBase, settings)`:

```text
other = max(0, otherAnnualGewstAddbacks)
allowance = gewstAddbackAllowance

before = max(0, other - allowance)
after = max(0, other + currentScenarioBase - allowance)

gewstAddback = (after - before) * 0.25
```

Das heißt:
- andere jährliche Hinzurechnungen werden zuerst auf den Freibetrag gerechnet
- dann wird die Szenario-Basis oben drauf addiert
- nur der Teil über dem Freibetrag wird zu `25%` hinzugerechnet

## 6. Körperschaftsteuer und Soli

### 6.1 KSt

```text
KSt = max(0, taxableProfit) * corporationTaxRate
```

### 6.2 Soli auf KSt

```text
Soli-Saving = KSt-Saving * solidarityRate
```

### 6.3 Steuerersparnis gesamt

Für jedes Jahr:

```text
KSt-Saving = KSt(base profit) - KSt(after car)
GewSt-Saving = GewSt(base profit) - GewSt(after car)
Total tax saving = KSt-Saving + Soli-Saving + GewSt-Saving
```

## 7. Privatnutzung

### 7.1 Jährlicher geldwerter Vorteil

```text
baseBenefitAnnual = BLP * privateUseRate * 12
```

`privateUseRate` ist:
- im BEV-Automatikmodus `0,25%` oder `0,5%`
- sonst der manuell gesetzte Wert

### 7.2 Arbeitsweg-Baustein

Der Code führt einen zusätzlichen Commute-Baustein:

```text
commuteBenefitAnnual = BLP * privateUseRate * commuteBase * commuteDistanceKm * commuteUnitCount
```

Dabei gilt:
- tägliche Methode, wenn `commuteDaysPerMonthEnabled = true`, `commuteDaysPerMonth > 0` und `commuteDaysPerMonth < 15`
  - `commuteBase = 0,002`
  - `commuteUnitCount = commuteDaysPerMonth * max(1, commuteMonthsPerYear)`
- sonst monatliche Methode
  - `commuteBase = 0,03`
  - `commuteUnitCount = commuteMonthsPerYear`

Gesamt:

```text
privateUseBenefitAnnual = baseBenefitAnnual + commuteBenefitAnnual
```

### 7.3 USt auf Privatnutzung

```text
privateUseVatAnnual = privateUseBenefitAnnual * vatRate
```

Der Betrag geht in den Cashflow ein, aber nicht als abzugsfähige Betriebsausgabe in den steuerlichen Gewinn.

## 8. Gewerbeleasing

### 8.1 Einzelwerte

Im Leasing werden verarbeitet:
- `monthlyRateGross`
- `specialPaymentGross`
- `feesGross`
- laufende Kosten

Jeder Teil wird mit `splitVat(...)` zerlegt, soweit USt-relevant.

### 8.2 Jahreswerte

Für jedes Jahr:

```text
grossCashOut = monthly.gross * months + firstYearGross + runningGross
vorsteuer = monthly.vat * months + firstYearVat + runningVat
deductibleExpense = monthly.net * months + firstYearNet + runningNet
netCashOut = grossCashOut - vorsteuer + privateUseVat
```

Wobei:
- `firstYearGross = special.gross + fees.gross`
- `firstYearVat = special.vat + fees.vat`
- `firstYearNet = special.net + fees.net`
- `running*` sind die anteiligen laufenden Kosten

### 8.3 GewSt-Hinzurechnung Leasing

Der Code setzt:

```text
leasePaymentNet = monthly.net * months + (year === 1 ? special.net : 0)
gewstAddbackBase = leasePaymentNet * 0.2
```

Danach:

```text
gewstAddback = gewstAddback(gewstAddbackBase, settings)
```

### 8.4 Steuerbasis Leasing

```text
taxableProfitAfterCar = baseAnnualProfit - deductibleExpense + gewstAddback
```

### 8.5 After-tax Cost Leasing

```text
afterTaxCost = grossCashOut - vorsteuer + privateUseVat - totalTaxSaving
```

## 9. Ballonkredit

### 9.1 Finanzierungsbasis

```text
financedPrincipal = max(0, purchasePriceGross - downPaymentGross)
```

`buildCreditSchedule(...)` erstellt den Zahlungsplan.

### 9.2 Kreditrate

`calculateCreditPayment(...)`:

```text
monthlyRate = annualInterestRate / 12
```

Wenn `monthlyRate = 0`:

```text
payment = (principalGross - balloonGross) / termMonths
```

Sonst:

```text
discountedBalloon = balloonGross / (1 + monthlyRate) ^ termMonths
payment = ((principalGross - discountedBalloon) * monthlyRate) / (1 - (1 + monthlyRate) ^ (-termMonths))
```

### 9.3 Monatlicher Plan

Für jeden Monat:

```text
interest = balance * monthlyRate
principal = min(paymentGross - interest, balance)
finalPayment = balloonGross nur im letzten Monat
balance = max(0, balance - principal)
```

### 9.4 AfA-Basis

Kaufpreis und Nebenkosten werden separat gesplittet:

```text
purchase = splitVat(purchasePriceGross, vatRate, vatMode)
acquisitionCosts = splitVat(acquisitionCostsGross, vatRate, "regular")
fees = splitVat(feesGross, vatRate, "regular")
```

AfA-Basis:

```text
afaBasis = purchase.net + acquisitionCosts.net
```

### 9.5 AfA-Dauer

- `credit-new`: immer `6 Jahre`
- `credit-used`: `max(1, car.afaYears)`

Jährliche AfA:

```text
annualAfa = afaBasis / afaYears
```

### 9.6 Verkauf / Restwert

Verkauf wird im Kredit-Szenario nur berechnet, wenn:
- `salePriceNetEnabled = true`
- `salePriceNet > 0`

Der Code interpretiert den Betrag über `salePriceMode`.

Der Verkauf ist im aktuellen Code **nicht vor dem Kreditende** angesetzt:

```text
saleAfterMonths = max(termMonths, saleAfterMonthsInput)
```

Falls kein eigenes Verkaufsmonat aktiviert ist, wird `termMonths` verwendet.

Restbuchwert zum Verkauf:

```text
saleRemainingBookValue = max(0, afaBasis - annualAfa * (saleAfterMonths / 12))
```

Steuerpflichtiger Veräußerungsgewinn:

```text
saleGainTaxable = salePrice.net - saleRemainingBookValue
```

### 9.7 Jahreswerte Kredit

Pro Jahr:

```text
grossCashOut = paymentGross * months + finalPayment + firstYearCash + runningGross - saleProceedsGross
vorsteuer = firstYearVat + runningVat
deductibleExpense = interest + afa + runningNet
netCashOut = grossCashOut - firstYearVat - runningVat + privateUseVat
gewstAddbackBase = interest
```

Mit:
- `firstYearCash = downPaymentGross + acquisitionCostsGross + feesGross` nur im ersten Jahr
- `firstYearVat = purchase.vat + acquisitionCosts.vat + fees.vat` nur im ersten Jahr
- `running*` sind die anteiligen laufenden Kosten
- `saleProceedsGross = salePrice.gross` nur im Verkaufsjahr

### 9.8 Steuerbasis Kredit

```text
taxableProfitAfterCar = baseAnnualProfit - deductibleExpense + gewstAddback + saleGainTaxable
```

### 9.9 After-tax Cost Kredit

```text
afterTaxCost = grossCashOut - firstYearVat - runningVat + privateUseVat - totalTaxSaving
```

## 10. Aggregation auf Szenario-Ebene

`summarizeScenario(...)` addiert alle Jahreszeilen:

```text
totalGrossCashOut = sum(grossCashOut)
totalVorsteuer = sum(vorsteuer)
totalPrivateUseVat = sum(privateUseVat)
totalNetCashOut = sum(netCashOut)
totalDeductibleExpense = sum(deductibleExpense)
totalGewstAddbackBase = sum(gewstAddbackBase)
totalGewstAddback = sum(gewstAddback)
totalSaleGainTaxable = sum(saleGainTaxable)
totalTaxSaving = sum(totalTaxSaving)
```

Weitere abgeleitete Werte:

```text
gewstAddbackRate = totalGewstAddback / totalDeductibleExpense   (falls totalDeductibleExpense > 0)
afterTaxTotalCost = totalNetCashOut - totalTaxSaving
afterTaxMonthlyEquivalent = afterTaxTotalCost / evaluationMonths
```

## 11. Evaluation-Horizont

`evaluationMonths`:
- Leasing: `termMonths`
- Kredit mit Verkauf: `max(termMonths, saleAfterMonths)`
- Kredit ohne Verkauf:
  - `max(termMonths, afaMonths)`

Wichtig:
- Die AfA kann nach Ende des Finanzierungszeitraums weiterlaufen.
- Daher können spätere Jahreszeilen negativ werden, wenn steuerlicher Effekt größer ist als laufender Cashflow.

## 12. Relevante Ausgabegrößen im UI

Das Tool zeigt u. a.:
- monatliche Rate brutto
- Brutto-Gesamtauszahlung
- Vorsteuer
- Netto-Cashflow
- abzugsfähige Kosten
- GewSt-Hinzurechnung
- Steuerersparnis
- geldwerten Vorteil
- After-tax Cost pro Jahr
- After-tax Monthly Equivalent

## 13. Fachliche Prüfpunkte

Für die externe Prüfung sind besonders wichtig:
- USt-Split bei Kauf, Leasing und laufenden Kosten
- `salePriceMode` gross/net
- Private-use BEV-Regel
- Arbeitsweg-Baustein
- GewSt-Rundung auf volle 100 EUR
- GewSt-Hinzurechnung mit 200.000 EUR-Freibetrag
- AfA-Basis bei gebrauchten Fahrzeugen ohne Vorsteuerabzug
- Restbuchwert und Veräußerungsgewinn bei Verkauf im Kredit-Szenario
- Behandlung von Jahren nach Kreditende

## 14. Kurzform der Kernformeln

```text
splitVat:
net = gross / (1 + vatRate)
vat = gross - net

GewSt:
floor(max(0, taxableProfit) / 100) * 100 * 3.5% * (Hebesatz / 100)

Private use:
BLP * privateUseRate * 12 + commute component

Leasing add-back:
leasePaymentNet * 20%

Kredit add-back:
interest

AfA:
purchase.net + acquisitionCosts.net

Sale gain:
salePrice.net - remainingBookValue

After-tax cost:
netCashOut - totalTaxSaving
```
