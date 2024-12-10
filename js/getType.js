function getVehicle(vec) {
    if (!vec) return "UNKNOWN"
    if(vehicleMeta.find(a => a.id === vec)) vec = vehicleMeta.find(a => a.id === vec)
    console.log(vec)
    if(vec.model && vec.model.toLowerCase().includes("conecto")) return "Conecto (3 portas)"
    if(vec.model && vec.model.includes("IS 56CI2DA - 5T")) return "Iveco (Carrinha)"
    if(vec.model && vec.model.includes("IS72CI2 DA 7T")) return "Iveco (Carrinha)"
    if(vec.model && vec.model.includes("citaro")) return "Citaro K (2 portas)"
    if(vec.model && vec.model.includes("TZ488XSPE351WH")) return "Elétrico (2 portas)"
    if(vec.model && vec.model.includes("E-Citygold CBNO20e")) return "Elétrico (2 portas)"
    if(vec.model && vec.model.includes("OC 500 LE")) return "Atomic (2 portas)"
    if(vec.model && vec.model.includes("OC 500")) return "Atomic (2 portas)"
    if(vec.model) return vec.model
    let v = vec.split("|")[1]
    v = parseInt(v)
    if (v === 1901) return "Autocarro com 3 portas"
    if (v < 730 || v > 800 && v < 900 || v > 1799 && v < 2000) return "Autocarro com 2 portas"
    if ((v > 729 && v < 750) || (v > 799 && v < 800) || (v > 1699 && v < 1800)|| (v > 12630 && v < 12651)) return "Carrinha"
    if (v > 749 && v < 1500) return "Autocarro com 3 portas"
    return "Desconhecido"
}