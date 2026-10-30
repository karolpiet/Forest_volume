// Translations (English text is the key). The language is shared with karolpiet.github.io
// through localStorage 'lang'; without a saved choice the browser language decides.
(function (root) {
  const ALS = (root.ALS = root.ALS || {});

  const PL = {
    "Yield tables: silvaR package (Socha et al.). Code licensed under GPL-3.": "Tablice zasobności: pakiet silvaR (Socha i in.). Kod na licencji GPL-3.",
    "{t} table": "tablica {t}",
    "outside the area": "poza obszarem",
    "no yield table for this species": "brak tablicy dla tego gatunku",
    "no age in the description": "brak wieku w opisie",
    "young stand (under 10 years or 5 m)": "młody drzewostan (poniżej 10 lat lub 5 m)",
    "Today by yield tables: ≈ {v} m³": "Na dziś wg tablic zasobności: ≈ {v} m³",
    "(for the {p}% of the area described in BDL)": "(dla {p}% obszaru opisanego w BDL)",
    "C) Yield tables by species": "C) Tablice zasobności wg gatunku",
    "Species and age from the Forest Data Bank, top height from the laser data, volume from the Szymkiewicz yield tables (silvaR models), scaled by the canopy cover. Then grown to {now}.": "Gatunek i wiek z Banku Danych o Lasach, wysokość górna z lidaru, miąższość z tablic zasobności Szymkiewicza (modele silvaR), przeskalowana przez pokrycie koronami. Potem przyrost do {now} r.",
    "The scan date is unknown, so the laser heights are taken as of the year of the stand description.": "Data skaningu jest nieznana, więc przyjmuję wysokości z lidaru na rok opisu taksacyjnego.",
    "Stand · species · age": "Wydzielenie · gatunek · wiek",
    "m³ at scan → today": "m³ w roku skanu → dziś",
    "{a}→{b} y": "{a}→{b} lat",
    "top height {h0}→{h1} m, {ha} ha": "wys. górna {h0}→{h1} m, {ha} ha",
    "Total ({ha} ha)": "Razem ({ha} ha)",
    "Scan year used: {y}.": "Przyjęty rok skanu: {y}.",
    "Place or parcel ID, e.g. Wierzchowiska": "Miejscowość lub nr działki, np. Wierzchowiska",
    "Looking for the place…": "Szukam miejscowości…",
    "The place search did not answer. Try again in a moment.": "Wyszukiwarka miejscowości nie odpowiedziała. Spróbuj za chwilę.",
    "Nothing found. Check the spelling or type a parcel ID.": "Nic nie znaleziono. Sprawdź pisownię albo wpisz numer działki.",
    "Which place did you mean?": "Którą miejscowość masz na myśli?",
    "Forest Data Bank (BDL): non-state forest": "Bank Danych o Lasach (BDL): las niepaństwowy",
    "{a} y in {y}": "{a} lat w {y}",
    "From the forest management plan of a non-state forest (year of the description in the table). Hectares are approximate.": "Z planu urządzenia lasu niepaństwowego (rok opisu podany w tabeli). Hektary są przybliżone.",
    "This forest has no description in the Forest Data Bank.": "Ten las nie ma opisu w Banku Danych o Lasach.",
    "Checking when the laser scan was made…": "Sprawdzam, kiedy był skaning laserowy…",
    "Laser scan date: unknown (2011–2023 depending on the region)": "Data skaningu laserowego: nieznana (2011–2023, zależnie od regionu)",
    "Laser scan: {date}": "Skaning laserowy: {date}",
    "the forest has grown for {n} more years since then": "od tamtej pory las rósł jeszcze {n} lat",
    "Calculator": "Kalkulator",
    "Accuracy": "Dokładność",
    "Data sources": "Źródła danych",
    "Surface and terrain models": "Modele pokrycia i terenu",
    "from airborne laser scanning (ISOK)": "z lotniczego skaningu laserowego (ISOK)",
    "parcel locator (ULDK) and county registers (KIEG)": "usługa lokalizacji działek (ULDK) i ewidencje powiatowe (KIEG)",
    "Forest subcompartments, species and age": "Wydzielenia leśne, gatunki i wiek",
    "Orthophoto and base map": "Ortofotomapa i mapa podkładowa",
    "All of it is free public data. The calculation runs in your browser; nothing you draw or upload is sent anywhere except the area’s bounding box to fetch the elevation data.": "To wszystko są bezpłatne dane publiczne. Obliczenia dzieją się w Twojej przeglądarce; to, co narysujesz lub wczytasz, nigdzie nie trafia, poza prostokątem obszaru potrzebnym do pobrania danych wysokościowych.",
    "how much timber grows in the forest": "ile drewna rośnie w lesie",
    "Find your forest": "Znajdź swój las",
    "…or pick it on the map:": "…albo wskaż go na mapie:",
    "An approximate estimate for orientation only. It does not replace a field measurement or the official forest management plan.": "Przybliżony szacunek, tylko do orientacji. Nie zastępuje pomiaru w terenie ani planu urządzenia lasu.",
    "Data:": "Dane:",
    "State Forests – Forest Data Bank": "Lasy Państwowe – Bank Danych o Lasach",
    "source code": "kod źródłowy",
    "Type the parcel ID or click your forest on the map. You can also draw its outline.": "Wpisz numer działki albo kliknij swój las na mapie. Możesz też narysować jego granicę.",
    "The page downloads the national laser scanning models from Geoportal and measures the height of every tree.": "Strona pobiera z Geoportalu krajowe modele ze skaningu laserowego i mierzy wysokość każdego drzewa.",
    "You get an approximate volume of timber in cubic metres, with an honest range.": "Dostajesz przybliżoną ilość drewna w metrach sześciennych, z uczciwym zakresem.",
    "Timber in this forest (approx.)": "Drewno w tym lesie (szacunek)",
    "most likely between {lo} and {hi} m³": "najpewniej od {lo} do {hi} m³",
    "{ha} ha of forest": "{ha} ha lasu",
    "trees ~{h} m tall": "drzewa ok. {h} m",
    "No trees taller than 5 m were found in this area.": "Na tym obszarze nie ma drzew wyższych niż 5 m.",
    "The forest in numbers": "Las w liczbach",
    "Two ways of counting": "Dwa sposoby liczenia",
    "A adds up the volume of every tree top found; in dense stands crowns merge, so it is usually too low. B works from canopy height and closure in 20 m squares and is the steadier number. The truth is usually close to or between them.": "A sumuje miąższość każdego znalezionego drzewa; w gęstym lesie korony się zlewają, więc zwykle wychodzi za mało. B liczy z wysokości i zwarcia koron w kwadratach 20 m i jest stabilniejsza. Prawda leży zwykle blisko nich albo pomiędzy.",
    "How far can you trust this?": "Na ile można temu ufać?",
    "It is an estimate, not a measurement: expect an error of at least ±25%.": "To szacunek, nie pomiar: licz się z błędem co najmniej ±25%.",
    "Methods A and B assume Scots pine. Method C uses the species from the Forest Data Bank, but only where a stand description exists.": "Metody A i B zakładają sosnę zwyczajną. Metoda C bierze gatunek z Banku Danych o Lasach, ale tylko tam, gdzie jest opis drzewostanu.",
    "The laser scan is a few years old (2011–2023 depending on the region); trees cut or grown since then are not seen.": "Skaning laserowy ma kilka lat (2011–2023, zależnie od regionu); drzew wyciętych lub przyrostu od tamtej pory nie widać.",
    "Buildings and other tall objects inside the area are counted as trees.": "Budynki i inne wysokie obiekty w obszarze liczą się jako drzewa.",
    "For a sale or valuation of timber, ask a forester to measure it in the field.": "Do sprzedaży lub wyceny drewna potrzebny jest pomiar w terenie, np. przez leśnika.",
    "According to the Forest Data Bank, {p}% of the stands here are dominated by species other than pine ({sp}). The pine formulas can be well off for them.": "Według Banku Danych o Lasach w {p}% tutejszych drzewostanów panuje inny gatunek niż sosna ({sp}). Wzory dla sosny mogą tu mocno odbiegać od prawdy.",
    'Forest on a parcel': 'Las na działce',
    'How much forest, how many trees and how much timber on any parcel in Poland, computed from airborne laser scanning.':
      'Ile lasu, ile drzew i ile drewna na dowolnej działce w Polsce, policzone z lotniczego skaningu laserowego.',
    'Type a parcel ID, or zoom in and click a parcel, a State Forests subcompartment or compartment, or draw your own shape. The canopy height is computed in your browser from the national surface and terrain models (GUGiK NMPT 0.5 m − NMT 1 m).':
      'Wpisz numer działki albo przybliż mapę i kliknij działkę, wydzielenie lub oddział Lasów Państwowych, możesz też narysować własny kształt. Wysokość drzew liczy się w Twojej przeglądarce z krajowych modeli pokrycia i terenu (GUGiK NMPT 0,5 m − NMT 1 m).',
    'Parcel ID, e.g. 140905_5.0031.129/6': 'Nr działki, np. 140905_5.0031.129/6',
    'Find': 'Szukaj',
    'What do you want to select on the map?': 'Co chcesz zaznaczyć na mapie?',
    'Cadastral parcel': 'Działka ewidencyjna',
    'Subcompartment (BDL)': 'Wydzielenie (BDL)',
    'Compartment (BDL)': 'Oddział (BDL)',
    'Draw your own shape': 'Narysuj własny kształt',
    'Upload KML / GPX / GeoJSON': 'Wczytaj KML / GPX / GeoJSON',
    'How it works': 'Jak to działa',
    'Hide or show the panel': 'Ukryj lub pokaż panel',
    'Zoom in and click a parcel, or try {ex}.': 'Przybliż mapę i kliknij działkę albo sprawdź przykład {ex}.',
    'Click inside a State Forests subcompartment (the BDL layer shows them).': 'Kliknij w wydzielenie Lasów Państwowych (pokazuje je warstwa BDL).',
    'Click inside a State Forests compartment: all its subcompartments are taken together.': 'Kliknij w oddział Lasów Państwowych: zostaną policzone wszystkie jego wydzielenia razem.',
    'Click to add corners, double-click (or click the first corner) to finish. {undo}': 'Klikaj, aby dodać narożniki, zakończ podwójnym kliknięciem (albo klikając pierwszy narożnik). {undo}',
    'Undo last point': 'Cofnij ostatni punkt',
    'Orthophoto (Geoportal)': 'Ortofotomapa (Geoportal)',
    'Canopy height in view (zoom 16+)': 'Wysokość drzew w widoku (zoom 16+)',
    'Canopy height of the selected area': 'Wysokość drzew zaznaczonego obszaru',
    'Tree tops (computed)': 'Wierzchołki drzew (policzone)',
    'Cadastral parcels': 'Działki ewidencyjne',
    'Forest subcompartments (BDL)': 'Wydzielenia leśne (BDL)',
    'Canopy height': 'Wysokość drzew',
    'Zoom in to see parcel boundaries': 'Przybliż, aby zobaczyć granice działek',
    'Some counties show parcels only when zoomed in further': 'W niektórych powiatach działki widać dopiero po większym przybliżeniu',
    'Zoom in closer to pick an area.': 'Przybliż mapę, aby wybrać obszar.',
    'Looking up the Forest Data Bank (BDL)…': 'Szukam w Banku Danych o Lasach (BDL)…',
    'No State Forests subcompartment here. The BDL publishes shapes only for State Forests; for a private forest pick the parcel or draw the area.':
      'Tu nie ma wydzielenia Lasów Państwowych. BDL udostępnia kształty tylko dla Lasów Państwowych; dla lasu prywatnego wybierz działkę albo narysuj obszar.',
    'The BDL service did not answer: {msg}': 'Usługa BDL nie odpowiedziała: {msg}',
    'Looking up the parcel in the GUGiK register…': 'Szukam działki w rejestrze GUGiK…',
    'Drawn area': 'Narysowany obszar',
    'Several parcels match, pick one:': 'Pasuje kilka działek, wybierz jedną:',
    'Finding trees…': 'Szukam drzew…',
    'Tree top': 'Wierzchołek drzewa',
    'Height': 'Wysokość',
    'Expected crown': 'Spodziewana korona',
    'Est. DBH': 'Szac. pierśnica',
    '(pine)': '(sosna)',
    'Est. stem volume': 'Szac. miąższość pnia',
    'Tree heights [m]': 'Wysokości drzew [m]',
    '{a}–{b} m: {n} trees': '{a}–{b} m: {n} drzew',
    'No elevation data for this area.': 'Brak danych wysokościowych dla tego obszaru.',
    'Elevation data cover only {p}% of this area ({ha} ha). The numbers below refer to that part.':
      'Dane wysokościowe obejmują tylko {p}% tego obszaru ({ha} ha). Liczby poniżej dotyczą tej części.',
    'Timber volume estimate (stem wood over bark)': 'Szacunkowa miąższość (grubizna w korze)',
    '{lo}–{hi} m³ per ha of forest': '{lo}–{hi} m³ na ha lasu',
    'Area': 'Powierzchnia',
    'Forest (canopy ≥ 5 m)': 'Las (drzewa ≥ 5 m)',
    'Shrubs / regeneration 2–5 m': 'Krzewy / odnowienia 2–5 m',
    'Tree tops detected (> 5 m)': 'Wykryte wierzchołki drzew (> 5 m)',
    'Tree height: mean / median': 'Wysokość drzew: średnia / mediana',
    'Tree height: 10–90% / max': 'Wysokość drzew: 10–90% / maks.',
    'Estimated mean DBH': 'Szacunkowa średnia pierśnica',
    'A) sum of detected trees': 'A) suma wykrytych drzew',
    'B) from canopy height & closure': 'B) z wysokości i zwarcia koron',
    'An estimate, not a measurement. The national surface model is coarser than a raw point cloud, so trees in dense stands merge and the tree count is usually too low; method B is the steadier number. The models assume pine; broadleaves and spruce differ. The scanning year depends on the region.':
      'To szacunek, nie pomiar. Krajowy model pokrycia jest mniej szczegółowy niż surowa chmura punktów, więc w gęstych drzewostanach korony się zlewają i drzew wychodzi zwykle za mało; metoda B jest stabilniejsza. Modele zakładają sosnę; dla buka, dębu czy świerka wyniki będą inne. Rok nalotu zależy od regionu.',
    'Forest Data Bank (BDL)': 'Bank Danych o Lasach (BDL)',
    'Forest Data Bank (BDL), RDLP {r}': 'Bank Danych o Lasach (BDL), RDLP {r}',
    'Asking bdl.lasy.gov.pl for forest subcompartments…': 'Pytam bdl.lasy.gov.pl o wydzielenia…',
    'No State Forests subcompartments in this area (probably a private forest).': 'Brak wydzieleń Lasów Państwowych na tym obszarze (prawdopodobnie las prywatny).',
    'Forest address': 'Adres leśny',
    'ha here · species · age': 'ha tutaj · gatunek · wiek',
    'Dominant species and stand age from the official forest inventory.': 'Gatunek panujący i wiek drzewostanu z urzędowego opisu taksacyjnego.',
    'The BDL service did not answer right now, so stand descriptions are missing.': 'Usługa BDL teraz nie odpowiada, więc brakuje opisów drzewostanów.',
    'How it works (title)': 'Jak to działa',
    'HELP': `<p class="note">1. Granica działki pochodzi z rejestru GUGiK (ULDK), a wydzielenia i oddziały z Banku Danych o Lasach.<br>
      2. Dla wybranego obszaru strona pobiera z Geoportalu numeryczny model pokrycia terenu (NMPT, 0,5 m) i model terenu (NMT, 1 m). Oba powstały z lotniczego skaningu laserowego.<br>
      3. Wysokość drzew = pokrycie − teren. Piksele ≥ 5 m to las, 2–5 m to krzewy i odnowienia.<br>
      4. Wierzchołki drzew to lokalne maksima wygładzonej wysokości, szukane w oknie rosnącym z wysokością drzewa.<br>
      5. Miąższość: A) suma wykrytych drzew (zależność wysokość–pierśnica dla sosny), B) wysokość × zwarcie × 28 m²/ha pierśnicowego pola przekroju w kwadratach 20 m.</p>
      <p class="note">Ograniczenia: rok nalotu zależy od regionu (mniej więcej 2011–2023), budynki i inne wysokie obiekty liczą się jako drzewa, a miąższość to szacunek (w najlepszym razie ±25%). Jednorazowo liczy się obszar do {max} km².</p>`,
    'Parcel {nr}, {region}, {commune}': 'Działka {nr}, {region}, {commune}',
    'Subcompartment {adr}': 'Wydzielenie {adr}',
    'Compartment {key}': 'Oddział {key}',
    '{n} y': '{n} lat',
    'The GUGiK parcel service (ULDK) did not respond. Try again in a moment or draw the area by hand.': 'Usługa działek GUGiK (ULDK) nie odpowiedziała. Spróbuj za chwilę albo narysuj obszar ręcznie.',
    'Parcel not found ({id}).': 'Nie znaleziono działki ({id}).',
    'Unsupported file type .{ext} (use KML, GPX or GeoJSON)': 'Nieobsługiwany typ pliku .{ext} (użyj KML, GPX albo GeoJSON)',
    'No polygon found in {name}': 'Brak poligonu w pliku {name}',
    'The elevation data service did not respond. Try again in a moment.': 'Usługa danych wysokościowych nie odpowiedziała. Spróbuj za chwilę.',
    'Elevation data ({m}): {msg}': 'Dane wysokościowe ({m}): {msg}',
    'This area is too large for an on-the-fly calculation (bounding box {a} km², limit {max} km²). Draw a smaller part of it.':
      'Ten obszar jest za duży do policzenia na bieżąco (prostokąt {a} km², limit {max} km²). Narysuj mniejszą część.',
    'Downloading the surface and terrain models from Geoportal…': 'Pobieram z Geoportalu modele pokrycia i terenu…',
    'Computing canopy height…': 'Liczę wysokość drzew…',
  };

  const DE = {
    "Yield tables: silvaR package (Socha et al.). Code licensed under GPL-3.": "Ertragstafeln: Paket silvaR (Socha u. a.). Code unter der Lizenz GPL-3.",
    "{t} table": "Tafel {t}",
    "outside the area": "außerhalb der Fläche",
    "no yield table for this species": "keine Ertragstafel für diese Baumart",
    "no age in the description": "kein Alter in der Beschreibung",
    "young stand (under 10 years or 5 m)": "junger Bestand (unter 10 Jahren oder 5 m)",
    "Today by yield tables: ≈ {v} m³": "Heute nach Ertragstafeln: ≈ {v} m³",
    "(for the {p}% of the area described in BDL)": "(für die {p} % der Fläche mit BDL-Beschreibung)",
    "C) Yield tables by species": "C) Ertragstafeln nach Baumart",
    "Species and age from the Forest Data Bank, top height from the laser data, volume from the Szymkiewicz yield tables (silvaR models), scaled by the canopy cover. Then grown to {now}.": "Baumart und Alter aus der Forstdatenbank, Oberhöhe aus den Laserdaten, Vorrat aus den Ertragstafeln von Szymkiewicz (silvaR-Modelle), skaliert mit der Kronenbedeckung. Dann fortgeschrieben bis {now}.",
    "The scan date is unknown, so the laser heights are taken as of the year of the stand description.": "Das Scandatum ist unbekannt, daher gelten die Laserhöhen für das Jahr der Bestandesbeschreibung.",
    "Stand · species · age": "Bestand · Baumart · Alter",
    "m³ at scan → today": "m³ beim Scan → heute",
    "{a}→{b} y": "{a}→{b} J.",
    "top height {h0}→{h1} m, {ha} ha": "Oberhöhe {h0}→{h1} m, {ha} ha",
    "Total ({ha} ha)": "Summe ({ha} ha)",
    "Scan year used: {y}.": "Verwendetes Scanjahr: {y}.",
    "Place or parcel ID, e.g. Wierzchowiska": "Ort oder Flurstücks-ID, z. B. Wierzchowiska",
    "Looking for the place…": "Suche den Ort…",
    "The place search did not answer. Try again in a moment.": "Die Ortssuche hat nicht geantwortet. Versuchen Sie es gleich noch einmal.",
    "Nothing found. Check the spelling or type a parcel ID.": "Nichts gefunden. Prüfen Sie die Schreibweise oder geben Sie eine Flurstücks-ID ein.",
    "Which place did you mean?": "Welchen Ort meinen Sie?",
    "Forest Data Bank (BDL): non-state forest": "Forstdatenbank (BDL): Nichtstaatswald",
    "{a} y in {y}": "{a} J. im Jahr {y}",
    "From the forest management plan of a non-state forest (year of the description in the table). Hectares are approximate.": "Aus dem Forsteinrichtungsplan eines Nichtstaatswaldes (Jahr der Beschreibung in der Tabelle). Die Hektarangaben sind ungefähr.",
    "This forest has no description in the Forest Data Bank.": "Dieser Wald hat keine Beschreibung in der Forstdatenbank.",
    "Checking when the laser scan was made…": "Prüfe, wann der Laserscan gemacht wurde…",
    "Laser scan date: unknown (2011–2023 depending on the region)": "Datum des Laserscans: unbekannt (2011–2023 je nach Region)",
    "Laser scan: {date}": "Laserscan: {date}",
    "the forest has grown for {n} more years since then": "seitdem ist der Wald {n} Jahre weitergewachsen",
    "Calculator": "Rechner",
    "Accuracy": "Genauigkeit",
    "Data sources": "Datenquellen",
    "Surface and terrain models": "Oberflächen- und Geländemodelle",
    "from airborne laser scanning (ISOK)": "aus luftgestütztem Laserscanning (ISOK)",
    "parcel locator (ULDK) and county registers (KIEG)": "Flurstücksdienst (ULDK) und Kreiskataster (KIEG)",
    "Forest subcompartments, species and age": "Forstliche Unterabteilungen, Baumarten und Alter",
    "Orthophoto and base map": "Orthofoto und Grundkarte",
    "All of it is free public data. The calculation runs in your browser; nothing you draw or upload is sent anywhere except the area’s bounding box to fetch the elevation data.": "Alles sind kostenlose öffentliche Daten. Die Berechnung läuft in Ihrem Browser; was Sie zeichnen oder hochladen, wird nirgendwohin gesendet, außer dem umgebenden Rechteck der Fläche zum Abruf der Höhendaten.",
    "how much timber grows in the forest": "wie viel Holz im Wald wächst",
    "Find your forest": "Finden Sie Ihren Wald",
    "…or pick it on the map:": "…oder wählen Sie ihn auf der Karte:",
    "An approximate estimate for orientation only. It does not replace a field measurement or the official forest management plan.": "Eine grobe Schätzung, nur zur Orientierung. Sie ersetzt weder eine Messung im Gelände noch die amtliche Forsteinrichtung.",
    "Data:": "Daten:",
    "State Forests – Forest Data Bank": "Staatsforsten – Forstdatenbank (BDL)",
    "source code": "Quellcode",
    "Type the parcel ID or click your forest on the map. You can also draw its outline.": "Geben Sie die Flurstücksnummer ein oder klicken Sie Ihren Wald auf der Karte an. Sie können auch seinen Umriss zeichnen.",
    "The page downloads the national laser scanning models from Geoportal and measures the height of every tree.": "Die Seite lädt die nationalen Laserscanning-Modelle vom Geoportal und misst die Höhe jedes Baumes.",
    "You get an approximate volume of timber in cubic metres, with an honest range.": "Sie erhalten den ungefähren Holzvorrat in Kubikmetern, mit einer ehrlichen Spanne.",
    "Timber in this forest (approx.)": "Holz in diesem Wald (Schätzung)",
    "most likely between {lo} and {hi} m³": "wahrscheinlich zwischen {lo} und {hi} m³",
    "{ha} ha of forest": "{ha} ha Wald",
    "trees ~{h} m tall": "Bäume ca. {h} m hoch",
    "No trees taller than 5 m were found in this area.": "In dieser Fläche wurden keine Bäume über 5 m gefunden.",
    "The forest in numbers": "Der Wald in Zahlen",
    "Two ways of counting": "Zwei Rechenwege",
    "A adds up the volume of every tree top found; in dense stands crowns merge, so it is usually too low. B works from canopy height and closure in 20 m squares and is the steadier number. The truth is usually close to or between them.": "A addiert das Volumen jeder gefundenen Baumspitze; in dichten Beständen verschmelzen Kronen, daher ist der Wert meist zu niedrig. B rechnet mit Bestandeshöhe und Kronenschluss in 20-m-Quadraten und ist stabiler. Die Wahrheit liegt meist nahe daran oder dazwischen.",
    "How far can you trust this?": "Wie verlässlich ist das?",
    "It is an estimate, not a measurement: expect an error of at least ±25%.": "Es ist eine Schätzung, keine Messung: rechnen Sie mit mindestens ±25 % Fehler.",
    "Methods A and B assume Scots pine. Method C uses the species from the Forest Data Bank, but only where a stand description exists.": "Die Methoden A und B gehen von Waldkiefer aus. Methode C nutzt die Baumart aus der Forstdatenbank, aber nur dort, wo eine Bestandesbeschreibung existiert.",
    "The laser scan is a few years old (2011–2023 depending on the region); trees cut or grown since then are not seen.": "Der Laserscan ist einige Jahre alt (2011–2023 je nach Region); seither gefällte Bäume oder Zuwachs sind nicht erfasst.",
    "Buildings and other tall objects inside the area are counted as trees.": "Gebäude und andere hohe Objekte in der Fläche zählen als Bäume.",
    "For a sale or valuation of timber, ask a forester to measure it in the field.": "Für Verkauf oder Bewertung von Holz lassen Sie es von einem Förster im Gelände messen.",
    "According to the Forest Data Bank, {p}% of the stands here are dominated by species other than pine ({sp}). The pine formulas can be well off for them.": "Laut Forstdatenbank dominiert in {p} % der Bestände hier eine andere Baumart als Kiefer ({sp}). Die Kiefernformeln können dort deutlich danebenliegen.",
    'Forest on a parcel': 'Wald auf dem Flurstück',
    'How much forest, how many trees and how much timber on any parcel in Poland, computed from airborne laser scanning.':
      'Wie viel Wald, wie viele Bäume und wie viel Holz auf jedem Flurstück in Polen, berechnet aus luftgestütztem Laserscanning.',
    'Type a parcel ID, or zoom in and click a parcel, a State Forests subcompartment or compartment, or draw your own shape. The canopy height is computed in your browser from the national surface and terrain models (GUGiK NMPT 0.5 m − NMT 1 m).':
      'Geben Sie eine Flurstücksnummer ein oder zoomen Sie hinein und klicken Sie auf ein Flurstück, eine Unterabteilung oder Abteilung der Staatsforsten, oder zeichnen Sie eine eigene Fläche. Die Baumhöhe wird in Ihrem Browser aus den nationalen Oberflächen- und Geländemodellen berechnet (GUGiK NMPT 0,5 m − NMT 1 m).',
    'Parcel ID, e.g. 140905_5.0031.129/6': 'Flurstücks-ID, z. B. 140905_5.0031.129/6',
    'Find': 'Suchen',
    'What do you want to select on the map?': 'Was möchten Sie auf der Karte auswählen?',
    'Cadastral parcel': 'Katasterflurstück',
    'Subcompartment (BDL)': 'Unterabteilung (BDL)',
    'Compartment (BDL)': 'Abteilung (BDL)',
    'Draw your own shape': 'Eigene Fläche zeichnen',
    'Upload KML / GPX / GeoJSON': 'KML / GPX / GeoJSON laden',
    'How it works': 'So funktioniert es',
    'Hide or show the panel': 'Bereich ein- oder ausblenden',
    'Zoom in and click a parcel, or try {ex}.': 'Zoomen Sie hinein und klicken Sie auf ein Flurstück, oder probieren Sie {ex}.',
    'Click inside a State Forests subcompartment (the BDL layer shows them).': 'Klicken Sie in eine Unterabteilung der Staatsforsten (die BDL-Ebene zeigt sie).',
    'Click inside a State Forests compartment: all its subcompartments are taken together.': 'Klicken Sie in eine Abteilung der Staatsforsten: alle ihre Unterabteilungen werden zusammen berechnet.',
    'Click to add corners, double-click (or click the first corner) to finish. {undo}': 'Klicken Sie, um Eckpunkte zu setzen; Doppelklick (oder Klick auf den ersten Punkt) beendet die Fläche. {undo}',
    'Undo last point': 'Letzten Punkt entfernen',
    'Orthophoto (Geoportal)': 'Orthofoto (Geoportal)',
    'Canopy height in view (zoom 16+)': 'Baumhöhe im Ausschnitt (Zoom 16+)',
    'Canopy height of the selected area': 'Baumhöhe der gewählten Fläche',
    'Tree tops (computed)': 'Baumspitzen (berechnet)',
    'Cadastral parcels': 'Flurstücke',
    'Forest subcompartments (BDL)': 'Forstliche Unterabteilungen (BDL)',
    'Canopy height': 'Baumhöhe',
    'Zoom in to see parcel boundaries': 'Hineinzoomen, um Flurstücksgrenzen zu sehen',
    'Some counties show parcels only when zoomed in further': 'In manchen Kreisen erscheinen die Flurstücke erst bei stärkerem Zoom',
    'Zoom in closer to pick an area.': 'Zoomen Sie näher heran, um eine Fläche zu wählen.',
    'Looking up the Forest Data Bank (BDL)…': 'Suche in der Forstdatenbank (BDL)…',
    'No State Forests subcompartment here. The BDL publishes shapes only for State Forests; for a private forest pick the parcel or draw the area.':
      'Hier gibt es keine Unterabteilung der Staatsforsten. Die BDL veröffentlicht Flächen nur für den Staatswald; für Privatwald wählen Sie das Flurstück oder zeichnen die Fläche.',
    'The BDL service did not answer: {msg}': 'Der BDL-Dienst hat nicht geantwortet: {msg}',
    'Looking up the parcel in the GUGiK register…': 'Suche das Flurstück im GUGiK-Register…',
    'Drawn area': 'Gezeichnete Fläche',
    'Several parcels match, pick one:': 'Mehrere Flurstücke passen, bitte eines wählen:',
    'Finding trees…': 'Suche Bäume…',
    'Tree top': 'Baumspitze',
    'Height': 'Höhe',
    'Expected crown': 'Erwartete Krone',
    'Est. DBH': 'Gesch. BHD',
    '(pine)': '(Kiefer)',
    'Est. stem volume': 'Gesch. Stammvolumen',
    'Tree heights [m]': 'Baumhöhen [m]',
    '{a}–{b} m: {n} trees': '{a}–{b} m: {n} Bäume',
    'No elevation data for this area.': 'Für diese Fläche gibt es keine Höhendaten.',
    'Elevation data cover only {p}% of this area ({ha} ha). The numbers below refer to that part.':
      'Höhendaten decken nur {p} % dieser Fläche ab ({ha} ha). Die Werte unten beziehen sich auf diesen Teil.',
    'Timber volume estimate (stem wood over bark)': 'Geschätzter Holzvorrat (Derbholz mit Rinde)',
    '{lo}–{hi} m³ per ha of forest': '{lo}–{hi} m³ je ha Wald',
    'Area': 'Fläche',
    'Forest (canopy ≥ 5 m)': 'Wald (Bäume ≥ 5 m)',
    'Shrubs / regeneration 2–5 m': 'Sträucher / Verjüngung 2–5 m',
    'Tree tops detected (> 5 m)': 'Erkannte Baumspitzen (> 5 m)',
    'Tree height: mean / median': 'Baumhöhe: Mittel / Median',
    'Tree height: 10–90% / max': 'Baumhöhe: 10–90 % / max.',
    'Estimated mean DBH': 'Geschätzter mittlerer BHD',
    'A) sum of detected trees': 'A) Summe der erkannten Bäume',
    'B) from canopy height & closure': 'B) aus Höhe und Kronenschluss',
    'An estimate, not a measurement. The national surface model is coarser than a raw point cloud, so trees in dense stands merge and the tree count is usually too low; method B is the steadier number. The models assume pine; broadleaves and spruce differ. The scanning year depends on the region.':
      'Eine Schätzung, keine Messung. Das nationale Oberflächenmodell ist gröber als eine rohe Punktwolke, daher verschmelzen Kronen in dichten Beständen und die Baumzahl ist meist zu niedrig; Methode B ist stabiler. Die Modelle gehen von Kiefer aus; Laubholz und Fichte weichen ab. Das Befliegungsjahr hängt von der Region ab.',
    'Forest Data Bank (BDL)': 'Forstdatenbank (BDL)',
    'Forest Data Bank (BDL), RDLP {r}': 'Forstdatenbank (BDL), RDLP {r}',
    'Asking bdl.lasy.gov.pl for forest subcompartments…': 'Frage bdl.lasy.gov.pl nach Unterabteilungen…',
    'No State Forests subcompartments in this area (probably a private forest).': 'Keine Unterabteilungen der Staatsforsten auf dieser Fläche (wahrscheinlich Privatwald).',
    'Forest address': 'Forstadresse',
    'ha here · species · age': 'ha hier · Baumart · Alter',
    'Dominant species and stand age from the official forest inventory.': 'Hauptbaumart und Bestandesalter aus der amtlichen Forsteinrichtung.',
    'The BDL service did not answer right now, so stand descriptions are missing.': 'Der BDL-Dienst antwortet gerade nicht, daher fehlen die Bestandesbeschreibungen.',
    'How it works (title)': 'So funktioniert es',
    'HELP': `<p class="note">1. Die Flurstücksgrenze kommt aus dem GUGiK-Register (ULDK), Unterabteilungen und Abteilungen aus der Forstdatenbank (BDL).<br>
      2. Für die gewählte Fläche lädt die Seite das digitale Oberflächenmodell (NMPT, 0,5 m) und das Geländemodell (NMT, 1 m) vom Geoportal. Beide stammen aus luftgestütztem Laserscanning.<br>
      3. Baumhöhe = Oberfläche − Gelände. Pixel ≥ 5 m zählen als Wald, 2–5 m als Sträucher und Verjüngung.<br>
      4. Baumspitzen sind lokale Maxima der geglätteten Höhe, gesucht in einem Fenster, das mit der Baumhöhe wächst.<br>
      5. Holzvorrat: A) Summe der erkannten Bäume (Höhen-Durchmesser-Beziehung der Kiefer), B) Höhe × Kronenschluss × 28 m²/ha Grundfläche in 20-m-Quadraten.</p>
      <p class="note">Grenzen: das Befliegungsjahr hängt von der Region ab (etwa 2011–2023), Gebäude und andere hohe Objekte zählen als Bäume, und der Vorrat ist eine Schätzung (bestenfalls ±25 %). Auf einmal werden bis zu {max} km² berechnet.</p>`,
    'Parcel {nr}, {region}, {commune}': 'Flurstück {nr}, {region}, {commune}',
    'Subcompartment {adr}': 'Unterabteilung {adr}',
    'Compartment {key}': 'Abteilung {key}',
    '{n} y': '{n} J.',
    'The GUGiK parcel service (ULDK) did not respond. Try again in a moment or draw the area by hand.': 'Der GUGiK-Flurstücksdienst (ULDK) hat nicht geantwortet. Versuchen Sie es gleich noch einmal oder zeichnen Sie die Fläche.',
    'Parcel not found ({id}).': 'Flurstück nicht gefunden ({id}).',
    'Unsupported file type .{ext} (use KML, GPX or GeoJSON)': 'Nicht unterstützter Dateityp .{ext} (KML, GPX oder GeoJSON verwenden)',
    'No polygon found in {name}': 'Kein Polygon in {name} gefunden',
    'The elevation data service did not respond. Try again in a moment.': 'Der Höhendatendienst hat nicht geantwortet. Versuchen Sie es gleich noch einmal.',
    'Elevation data ({m}): {msg}': 'Höhendaten ({m}): {msg}',
    'This area is too large for an on-the-fly calculation (bounding box {a} km², limit {max} km²). Draw a smaller part of it.':
      'Diese Fläche ist für eine Berechnung im Browser zu groß (Rechteck {a} km², Grenze {max} km²). Zeichnen Sie einen kleineren Teil.',
    'Downloading the surface and terrain models from Geoportal…': 'Lade Oberflächen- und Geländemodell vom Geoportal…',
    'Computing canopy height…': 'Berechne Baumhöhe…',
  };

  const EN_EXTRA = {
    'How it works (title)': 'How it works',
    'HELP': `<p class="note">1. The parcel boundary comes from the GUGiK cadastral register (ULDK); subcompartments and compartments from the Forest Data Bank (BDL).<br>
      2. For the selected area the page downloads the national digital surface model (NMPT, 0.5 m) and terrain model (NMT, 1 m) from Geoportal. Both come from airborne laser scanning.<br>
      3. Canopy height = surface − terrain. Pixels ≥ 5 m count as forest, 2–5 m as shrubs and regeneration.<br>
      4. Tree tops are local maxima of the smoothed canopy height, searched in a window that grows with tree height.<br>
      5. Timber volume: A) sum over detected trees (pine height–diameter relation), B) canopy height × closure × 28 m²/ha basal area in 20 m cells.</p>
      <p class="note">Limits: the scanning year differs between regions (roughly 2011–2023), buildings and other tall objects inside the area count as canopy, and the volume is an estimate (±25% at best). The largest area computed at once is {max} km².</p>`,
  };

  const DICT = { pl: PL, de: DE, en: EN_EXTRA };
  const LOCALE = { en: 'en-GB', pl: 'pl-PL', de: 'de-DE' };

  let lang = 'en';
  try {
    const saved = localStorage.getItem('lang');
    if (DICT[saved]) lang = saved;
    else if (/^pl/i.test(navigator.language)) lang = 'pl';
    else if (/^de/i.test(navigator.language)) lang = 'de';
  } catch (e) {}

  ALS.T = (s, v = {}) => ((DICT[lang] && DICT[lang][s]) || s).replace(/\{(\w+)\}/g, (_, k) => (k in v ? v[k] : '{' + k + '}'));
  ALS.lang = () => lang;
  ALS.locale = () => LOCALE[lang];

  // static texts: data-i18n (text), data-i18n-ph (placeholder), data-i18n-aria (aria-label)
  ALS.applyStatic = () => {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.dataset.en = el.dataset.en || el.textContent;
      el.textContent = ALS.T(el.dataset.en);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      el.dataset.en = el.dataset.en || el.placeholder;
      el.placeholder = ALS.T(el.dataset.en);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      el.dataset.enAria = el.dataset.enAria || el.getAttribute('aria-label');
      el.setAttribute('aria-label', ALS.T(el.dataset.enAria));
    });
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
  };

  const listeners = [];
  ALS.onLang = (fn) => listeners.push(fn);
  ALS.setLang = (l) => {
    if (!DICT[l] || l === lang) return;
    lang = l;
    try { localStorage.setItem('lang', l); } catch (e) {}
    ALS.applyStatic();
    listeners.forEach(fn => fn(l));
  };
})(typeof window !== 'undefined' ? window : globalThis);
