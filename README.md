# Energijos vartojimo sąmoningumo testas

Pilnai veikianti, mobiliesiems pritaikyta statinė internetinė programa gyviems mokymams ir dirbtuvėms. Dalyvis anonimiškai atsako į jam pritaikytus klausimus, gauna normalizuotą 0–100 rezultatą ir, kai testą baigia bent 5 žmonės, palygina jį su grupės vidurkiu. Moderatorius projektoriuje mato grupės rezultatą ir iki 3 daugiausia erdvės tobulėti turinčių klausimų.

Programa nėra moksliniu požiūriu validuota psichometrinė skalė. Sąsajoje rezultatas vadinamas **„Energijos vartojimo sąmoningumo testo rezultatu“**.

## Failų struktūra

```text
/
  index.html             Dalyvio testas
  results.html           Moderatoriaus / projektoriaus ekranas
  styles.css             Mobile-first dalyvio dizainas
  results.css            16:9 moderatoriaus dizainas
  config.js              Supabase ir renginio nustatymai
  questions.js           Vienintelis klausimų tekstų ir kategorijų šaltinis
  app.js                 Dalyvio eiga, šakojimas ir rezultatų atvaizdavimas
  pdf-export.js          Vieno A4 puslapio rezultatų PDF generavimas telefone
  results.js             Grupės ekrano automatinis atnaujinimas
  supabase-client.js     Saugūs RPC kvietimai ir demonstracinis režimas
  dev-server.mjs         Paprastas vietinis serveris testavimui
  tests/run-tests.mjs    Automatinės šakojimosi ir logikos patikros
  assets/og-assessment.png
  images/LEA-LOGOTIPAS-ŽALIAS.png
  supabase/schema.sql    Lentelė, RLS ir trys SECURITY DEFINER RPC funkcijos
```

## Kaip veikia programa

1. Dalyvis pasirenka pradinį savęs vertinimą nuo 1 iki 10. Jis į testo balą neįtraukiamas.
2. Dalyvis atsako į 8 klausimus apie būstą, energijos suvartojimą ir sąskaitų tvarkymą. Pagal šiuos atsakymus sudaromas tik jam taikomų klausimų sąrašas.
3. Visi gauna E1–E9 elektros vartojimo klausimus. H1–H9 klausimai pridedami pagal šildymo būdą, būsto tipą ir temperatūros reguliavimo galimybes.
4. Atsakymai vertinami: „Taip / reguliariai“ = 2, „Kartais / iš dalies“ = 1, „Ne“ = 0. Leidžiama „Netaikoma“ reikšmė išmetama iš maksimalaus balo.
5. Serveris iš naujo apskaičiuoja bendrą ir trijų kategorijų balus; frontend perduotu galutiniu balu nepasitikima.
6. Tas pats `workshop_id + session_id` pateikimas atnaujinamas, todėl pakartotinis testas nepadidina dalyvių skaičiaus.
7. Kai renginyje yra bent 5 baigti testai, atrakinamas grupės vidurkis, dalyvio percentilis ir moderatoriaus analitika. Individualiame rezultate taip pat palyginamas mėnesio elektros suvartojimas vienam būsto kvadratiniam metrui ir vienam namų ūkio nariui su kitų dalyvių vidurkiu.
8. Dalyvis gali atsisiųsti vieno puslapio PDF kortelę su LEA logotipu, atlikimo data, bendru balu, kategorijų rezultatais ir elektros suvartojimo palyginimu. PDF sukuriamas lokaliai telefone, nesiunčiant papildomų duomenų į išorinę paslaugą.

## 1. Sukurti Supabase projektą

1. Prisijunkite prie [supabase.com](https://supabase.com/) ir sukurkite naują projektą.
2. Projekto valdymo lange atidarykite **SQL Editor → New query**.
3. Nukopijuokite visą `supabase/schema.sql` turinį.
4. Įklijuokite jį į SQL Editor ir paspauskite **Run**.
5. Turėtų būti sukurta lentelė `workshop_submissions` ir funkcijos:
   - `submit_assessment`;
   - `get_group_summary`;
   - `get_score_percentile`.

Schema neleidžia viešam vartotojui tiesiogiai skaityti, keisti ar trinti lentelės duomenų. Naršyklė gali naudoti tik aiškiai suteiktas RPC funkcijas.

## 2. Rasti Project URL ir viešą raktą

1. Supabase projekte atidarykite **Project Settings → API** arba **Connect**.
2. Nukopijuokite **Project URL**.
3. Nukopijuokite viešą **anon** arba **publishable** raktą.

Niekada nenaudokite `service_role`, secret ar kito privataus rakto naršyklės kode.

## 3. Užpildyti config.js

Faile `config.js` nustatymų objektas `APP_CONFIG` turi šias reikšmes:

```js
window.APP_CONFIG = {
  SUPABASE_URL: window.ENERGY_GAME_CONFIG.supabaseUrl,
  SUPABASE_PUBLISHABLE_KEY: window.ENERGY_GAME_CONFIG.supabasePublishableKey,
  DEFAULT_WORKSHOP_ID: "mokymai-2026",
  RESULT_REFRESH_INTERVAL: 5000,
};
```

Supabase URL ir viešas `sb_publishable_...` raktas išsaugomi `ENERGY_GAME_CONFIG` objekto viršuje, o programa juos perima per `APP_CONFIG`. `DEFAULT_WORKSHOP_ID` naudojamas tik tada, kai URL nėra `?event=` parametro.

Renginio ID naudokite tik mažosiomis lotyniškomis raidėmis, skaičiais, brūkšneliu arba apatiniu brūkšniu, pavyzdžiui `eckes-2026`.

## 4. Patikrinti vietiniame kompiuteryje

Jei įdiegtas Node.js, projekto aplanke paleiskite:

```powershell
node dev-server.mjs
```

Atidarykite:

- dalyvio testą: `http://127.0.0.1:4173/index.html?event=bandomasis`;
- moderatoriaus ekraną: `http://127.0.0.1:4173/results.html?event=bandomasis`.

Jeigu Supabase dar neprijungta, programa veikia demonstraciniu režimu. Tokiu atveju rezultatai matomi tik toje pačioje naršyklėje ir nėra bendri keliems telefonams.

Automatinėms logikos patikroms:

```powershell
node tests/run-tests.mjs
```

## 5. Įkelti į GitHub

1. Sukurkite naują GitHub repozitoriją.
2. Įkelkite visus projekto failus ir aplankus, įskaitant `assets` bei `supabase`.
3. Įsitikinkite, kad `index.html` yra repozitorijos šakniniame aplanke.

## 6. Aktyvuoti GitHub Pages

1. GitHub repozitorijoje atidarykite **Settings → Pages**.
2. Ties **Build and deployment** pasirinkite **Deploy from a branch**.
3. Pasirinkite šaką `main` ir aplanką `/ (root)`.
4. Paspauskite **Save**.
5. Po kelių minučių GitHub parodys paskelbtos svetainės adresą.

Programai nereikia React, npm paketų ar build proceso.

## 7. Sukurti konkretaus renginio nuorodas

Tarkime, GitHub Pages adresas yra:

```text
https://organizacija.github.io/energijos-testas/
```

O renginio ID – `eckes-2026`.

Dalyviams skirta nuoroda:

```text
https://organizacija.github.io/energijos-testas/index.html?event=eckes-2026
```

Moderatoriui skirta nuoroda:

```text
https://organizacija.github.io/energijos-testas/results.html?event=eckes-2026
```

Iš dalyvio nuorodos sugeneruokite QR kodą. Abiejuose puslapiuose turi būti naudojamas tas pats `event` parametras.

## Privatumas ir saugumas

- Nerenkamas vardas, pavardė, el. paštas, telefono numeris ar prisijungimo duomenys.
- Atsitiktinis `session_id` saugomas tik naršyklės `localStorage` ir siunčiamas dubliavimosi prevencijai.
- Situacijos duomenys ir atsakymai saugomi Supabase, bet jų negalima viešai tiesiogiai `SELECT`-inti.
- `results.html` gauna tik dalyvių skaičių, grupės vidurkį ir iki 3 agreguotų klausimų rezultatų.
- Individualus palyginimo RPC negrąžina kitų dalyvių įrašų: tik balų ir energijos suvartojimo agreguotus vidurkius. Suvartojimo vidurkis rodomas tik turint bent 4 kitų dalyvių galiojančius duomenis.
- Nėra Google Analytics, Meta Pixel, reklamos ar kitų sekimo priemonių.

## Testuoti prieš renginį

1. Atlikite testą iki galo ir patikrinkite, ar gaunamas individualus rezultatas.
2. Atnaujinkite puslapį testo viduryje – turi būti tęsiama nuo tos pačios vietos.
3. Išjunkite internetą prieš pateikimą – atsakymai turi išlikti telefone ir būti išsiųsti atkūrus ryšį.
4. Užpildykite testą iš penkių skirtingų naršyklių arba įrenginių – moderatoriaus ekranas turi automatiškai atsirakinti.
5. Tame pačiame telefone paspauskite „Pradėti iš naujo“ ir pateikite rezultatą dar kartą – dalyvių skaičius neturi padidėti.
6. Patikrinkite, kad dalyvio ir moderatoriaus URL turi vienodą `event` reikšmę.

## Klausimų keitimas

Visi dalyviui rodomi situacijos ir vertinami klausimai laikomi `questions.js`. Klausimų tekstai nedubliuojami kituose JavaScript failuose. Keičiant klausimų kodus, sąlygas arba balų logiką būtina lygiagrečiai atnaujinti `supabase/schema.sql` serverio validaciją ir skaičiavimą.
