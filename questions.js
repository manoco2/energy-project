(function () {
  const PROFILE_QUESTIONS = [
    {
      code: "S1", type: "choice", text: "Kokiame būste gyvenate?", icon: "🏠",
      options: [
        { value: "apartment", label: "Daugiabutyje" },
        { value: "house", label: "Individualiame name" },
        { value: "cottage", label: "Kotedže / namo dalyje" },
      ],
    },
    {
      code: "S2", type: "choice", text: "Kaip tiekiama šiluma į jūsų būstą?", icon: "🌡️",
      options: [
        { value: "district", label: "Iš centralizuotų šilumos tinklų" },
        { value: "individual", label: "Šildausi pats / individualiai" },
        { value: "local", label: "Vietinė pastato katilinė" },
        { value: "unknown", label: "Nežinau" },
      ],
    },
    {
      code: "S3", type: "choice", text: "Ar galite reguliuoti patalpų temperatūrą?", icon: "◒",
      options: [
        { value: "yes", label: "Taip" },
        { value: "no", label: "Ne" },
        { value: "unknown", label: "Nežinau" },
      ],
    },
    { code: "S4", type: "number", text: "Koks jūsų būsto plotas?", icon: "□", unit: "m²", min: 10, max: 1000, placeholder: "Pvz., 65" },
    { code: "S5", type: "number", text: "Kiek žmonių gyvena jūsų būste?", icon: "●", unit: "žm.", min: 1, max: 20, placeholder: "Pvz., 3" },
    {
      code: "S6", type: "choice", text: "Ar elektros energija naudojama pagrindiniam jūsų būsto šildymui?", icon: "⚡",
      options: [
        { value: "yes", label: "Taip" },
        { value: "no", label: "Ne" },
        { value: "unknown", label: "Nežinau" },
      ],
    },
    { code: "S7", type: "number-or-unknown", text: "Kiek vidutiniškai per mėnesį suvartojate elektros energijos?", icon: "📊", unit: "kWh", min: 1, max: 100000, placeholder: "Pvz., 180", unknownLabel: "Nežinau" },
    {
      code: "S8", type: "choice", text: "Kas jūsų namų ūkyje tvarko sąskaitas už energiją?", icon: "€",
      options: [
        { value: "self", label: "Aš pats" },
        { value: "another", label: "Kitas asmuo" },
        { value: "varies", label: "Įvairiai" },
      ],
    },
  ];

  const CATEGORIES = {
    electricity_awareness: { label: "Pažįstu savo elektros vartojimą", shortLabel: "Elektros vartojimo pažinimas" },
    electricity_management: { label: "Valdau elektros vartojimą", shortLabel: "Elektros vartojimo valdymas" },
    heating: { label: "Suprantu savo šilumos vartojimą", shortLabel: "Suprantu savo šilumos vartojimą" },
  };

  const always = () => true;
  const knowsHeating = (profile) => profile.S2 !== "unknown";
  const canRegulate = (profile) => knowsHeating(profile) && profile.S3 === "yes";
  const heatsIndividually = (profile) => profile.S2 === "individual";
  const apartmentHeating = (profile) => profile.S1 === "apartment" && ["district", "local"].includes(profile.S2);

  const QUESTIONS = [
    { code: "E1", category: "electricity_awareness", text: "Žinau, kokie prietaisai mano namuose sunaudoja daugiausia elektros energijos.", condition: always, allowNA: false },
    { code: "E2", category: "electricity_awareness", text: "Palyginu savo elektros energijos suvartojimą su ankstesniais mėnesiais ar metais.", condition: always, allowNA: false },
    { code: "E3", category: "electricity_awareness", text: "Peržiūriu savo elektros energijos suvartojimo palyginimą su panašiais vartotojais ar objektais, jei energijos tiekėjas tokį pateikia.", condition: always, allowNA: true, naLabel: "Tokio palyginimo negaunu" },
    { code: "E4", category: "electricity_awareness", text: "Jei pastebiu neįprastai padidėjusį elektros energijos suvartojimą, bandau išsiaiškinti jo priežastį.", condition: always, allowNA: false },
    { code: "E5", category: "electricity_awareness", text: "Suprantu, kokie mano kasdieniai veiksmai turi didžiausią įtaką elektros energijos suvartojimui namuose.", condition: always, allowNA: false },
    { code: "E6", category: "electricity_management", text: "Žinau, kaip pakeisti dažniausiai naudojamų buitinių prietaisų nustatymus ar režimus, kad jie naudotų mažiau energijos.", condition: always, allowNA: false },
    { code: "E7", category: "electricity_management", text: "Nenaudojamų prietaisų nepalieku veikti ar budėjimo režime, kai to nereikia.", condition: always, allowNA: false },
    { code: "E8", category: "electricity_management", text: "Žinau, kokią informaciją parodo buitinių prietaisų energijos etiketė ir moku ją suprasti.", condition: always, allowNA: false },
    { code: "E9", category: "electricity_management", text: "Rinkdamasis naują buitinį prietaisą atsižvelgiu į jo energijos klasę ir energijos suvartojimą.", condition: always, allowNA: true, naLabel: "Netaikoma / seniai nepirkau buitinio prietaiso" },
    { code: "H1", category: "heating", text: "Stebiu ir palyginu savo šildymo energijos suvartojimą arba išlaidas su ankstesniais laikotarpiais.", condition: knowsHeating, allowNA: false },
    { code: "H2", category: "heating", text: "Naudoju turimas temperatūros reguliavimo galimybes ir stengiuosi be reikalo neperšildyti patalpų.", condition: canRegulate, allowNA: false },
    { code: "H3", category: "heating", text: "Ilgesniam laikui išvykdamas iš namų sumažinu nustatytą patalpų temperatūrą.", condition: canRegulate, allowNA: false },
    { code: "H4", category: "heating", text: "Žinau, kaip mano turimi šildymo nustatymai ir jų pakeitimai veikia energijos suvartojimą.", condition: canRegulate, allowNA: false },
    { code: "H5", category: "heating", text: "Pasirūpinu savo šildymo įrangos technine priežiūra pagal jos poreikį.", condition: heatsIndividually, allowNA: false },
    { code: "H6", category: "heating", text: "Žinau, kas mano name atsakingas už šilumos tiekimą ir kas – už pastato vidaus šildymo sistemą.", condition: apartmentHeating, allowNA: false },
    { code: "H7", category: "heating", text: "Žinau, kur kreiptis, jei name per karšta, per šalta ar kyla problemų dėl šildymo sistemos veikimo.", condition: apartmentHeating, allowNA: false },
    { code: "H8", category: "heating", text: "Žinau, kokie viso namo sprendimai gali reikšmingai sumažinti šilumos energijos vartojimą.", hint: "Pavyzdžiui: šildymo sistemos balansavimas, šilumos punkto atnaujinimas ar pastato renovacija.", condition: apartmentHeating, allowNA: false },
    { code: "H9", category: "heating", text: "Žinau, kur ieškoti informacijos apie daugiabučio renovaciją ir jai skiriamą paramą.", condition: apartmentHeating, allowNA: false },
  ];

  function getApplicableQuestions(profile) {
    return QUESTIONS.filter((question) => question.condition(profile));
  }

  function scoreCodes(codes, answers) {
    const values = codes.map((code) => answers[code]).filter((value) => value !== null && value !== undefined);
    if (!values.length) return null;
    return Math.round((values.reduce((sum, value) => sum + Number(value), 0) / (values.length * 2)) * 100);
  }

  function calculateScores(applicableQuestions, answers) {
    const codes = applicableQuestions.map((question) => question.code);
    const byCategory = (category) => applicableQuestions.filter((question) => question.category === category).map((question) => question.code);
    return {
      total_score: scoreCodes(codes, answers),
      electricity_awareness_score: scoreCodes(byCategory("electricity_awareness"), answers),
      electricity_management_score: scoreCodes(byCategory("electricity_management"), answers),
      heating_score: scoreCodes(byCategory("heating"), answers),
    };
  }

  window.EnergyAssessment = {
    PROFILE_QUESTIONS, QUESTIONS, CATEGORIES, getApplicableQuestions, calculateScores,
    questionByCode: (code) => QUESTIONS.find((question) => question.code === code),
  };
})();
