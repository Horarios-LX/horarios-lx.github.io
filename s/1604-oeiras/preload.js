const Atomic = { name: "Atomic", display: "Atomic (2 portas)", display_EN: "Atomic (2 doors)" };
const MercedesSprinter = { name: "Mercedes Sprinter", display: "Carrinha", display_EN: "Mini-bus" };
const MercedesConecto = { name: "Mercedes Conecto", display: "Conecto (3 portas)", display_EN: "Conecto (3 doors)" };
const MercedesCitaro = { name: "Mercedes Citaro K", display: "Citaro (2 portas)", display_EN: "Citaro (2 doors)" };
const Iveco = { name: "Iveco", display: "Carrinha", display_EN: "Mini-bus" };
const Zhongtong = { name: "Zhongtong", display: "Elétrico (2 portas)", display_EN: "Electric (2 doors)" };
const ECitygold = { name: "E-Citygold", display: "Elétrico (2 portas)", display_EN: "Electric (2 doors)" };

const getType = (id) => {
    let id2 = parseInt(id)
    if (id2 > 500 && id2 < 550) return Atomic;
    if (id2 > 730 && id2 < 750) return MercedesSprinter;
    if (id2 > 750 && id2 < 800) return MercedesConecto;
    if (id2 > 800 && id2 < 850) return MercedesCitaro;
    if (id2 > 1000 && id2 < 1500) return MercedesConecto;
    if (id2 > 1699 && id2 < 1800) return Iveco;
    if (id2 > 1799 && id2 < 1840) return MercedesCitaro;
    if (id2 > 1849 && id2 < 1870) return Zhongtong;
    if (id2 > 1869 && id2 < 1900) return ECitygold;
    if (id2 > 1899 && id2 < 1950) return Atomic;
    if (id2 === 1900) return MercedesCitaro;
    return null;
}

const stopInfo = {
    "id": "121270", "lat": "38.688615", "lines": ["1120", "1523", "1529", "1604", "1614", "1615"], "locality": "Oeiras", "name": "Oeiras (Estação) P8 Entrada Norte", "lineCols": {
        "1120": "#3D85C6",
        "1523": "#C61D23",
        "1529": "#C61D23",
        "1604": "#C61D23",
        "1614": "#C61D23",
        "1615": "#C61D23"
    }
}

let language = navigator.language || navigator.userLanguage;
if (!language.includes("pt-")) {
    language = "en"
} else {
    language = "pt"
};

function full_page_prompt() {
    if (confirm(language === "pt" ? "Está prestes a sair desta página. Clique \"OK\" para ver as partidas completas." : "You're about to leave this webpage. Click \"OK\" to view the full departures list.")) return window.location.href = "/partidas/?p=121270";
}