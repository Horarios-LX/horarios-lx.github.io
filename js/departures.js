let url = window.location.href.split("?p=")
let stopId = url[1]

let loading = document.getElementById("loading")

let soundBtn = document.getElementById("sound")
let audio = document.createElement("audio")
audio.src = "https://storage.carrismetropolitana.pt/static/tts/live/stops/" + stopId + ".mp3"
soundBtn.appendChild(audio)

soundBtn.onclick = () => audio.play()

let departuresEl = document.getElementById("departures")

fetch("https://api.carrismetropolitana.pt/stops/" + stopId).then(r => r.json()).then(stopInfo => {
    document.querySelector('meta[property="og:title"]').setAttribute("content", "HoráriosLX | " + stopInfo.name);
    document.getElementById("title").innerHTML = "<b>" + stopInfo.name + "</b>"
    document.getElementById("lines").innerHTML = stopInfo.lines.reduce((acc, value) => acc + "<span class=\"line " + (value.startsWith("1") ? (shortLines.includes(value) ? "short" : "long") : "unknown") + "\">" + value + "</span>", "")

    loading.remove()

    fetchBuses()

    setInterval(() => {
        fetchBuses()
    }, 30 * 1000)
})

let vehicles;

let patternsCache = {}

let notesCache = {}

function fetchBuses() {
    fetch("https://api.carrismetropolitana.pt/stops/" + stopId + "/realtime").then(r => r.json()).then(async departures => {
        vehicles = null;
        let now = Date.now() / 1000
        let tempDiv = document.createElement("div")
        departures = departures.filter(a => (a.estimated_arrival_unix > now || (!a.estimated_arrival_unix && a.scheduled_arrival_unix > now)) && !a.observed_arrival_unix)
        departures.sort((a, b) => (a.estimated_arrival_unix ? a.estimated_arrival_unix : a.scheduled_arrival_unix) - (b.estimated_arrival_unix ? b.estimated_arrival_unix : b.scheduled_arrival_unix))
        departures = departures.slice(0, 25)
        let divs = []
        await Promise.all(departures.map(async d => {
            if (!d.injected && !patternsCache[d.pattern_id]) {
                patternsCache[d.pattern_id] = fetch("/caches/patterns/" + d.pattern_id + ".json").then(r => r.json());
            }
            if (!d.preFetched) {
                if (!vehicles) vehicles = fetch("https://api.carrismetropolitana.pt/vehicles").then(r => r.json());
                if (vehicles.then) vehicles = await Promise.resolve(vehicles)
                let b = vehicles.find(a => a.id === d.vehicle_id)
                if (b && b.trip_id !== d.trip_id) {
                    return;
                }
                let vehicle = vehicles.find(a => a.trip_id === d.trip_id || a.id === d.vehicle_id)
                if (vehicle) {
                    d.currentLocation = vehicle.stop_id;
                    if (!d.estimated_arrival) {
                        if (patternsCache[d.pattern_id].then) patternsCache[d.pattern_id] = await Promise.resolve(patternsCache[d.pattern_id])
                        let route = patternsCache[vehicle.pattern_id]
                        let rS = route.path.indexOf(route.path.find(a => a.id === vehicle.stop_id && a.index <= d.stop_sequence))
                        let rE = route.path.indexOf(route.path.find(a => a.id === stopId && a.index === d.stop_sequence))
                        d.currentStopIndex = rS;
                        if (rE < rS || rS < 0) d.observed_arrival_unix = Date.now()
                        let section = route.path.filter(a => route.path.indexOf(a) >= rS && route.path.indexOf(a) <= rE)
                        let time = 0;
                        section.forEach(arr => time += arr.schedule.travel_time)
                        if (rS > 0) {
                            d.estimated_arrival_unix = vehicle.timestamp + time * 60;
                            d.estimated_arrival = (new Date(d.estimated_arrival_unix * 1000).toTimeString().split(' ')[0])
                        }
                        d.vehicle_id = vehicle.id
                    }
                }
            }
            if (d.vehicle_id && !d.estimated_arrival) {
                if (patternsCache[d.pattern_id].then) patternsCache[d.pattern_id] = await Promise.resolve(patternsCache[d.pattern_id])
                d.estimated_arrival = "Início de serviço"
                let route = patternsCache[d.pattern_id]
                let rS = 0
                let rE = route.path.indexOf(route.path.find(a => a.id === stopId && a.index === d.stop_sequence))
                d.currentStopIndex = rS;
                let section = route.path.filter(a => route.path.indexOf(a) >= rS && route.path.indexOf(a) <= rE)
                let time = 0;
                section.forEach(arr => time += arr.schedule.travel_time)
                if (rS > 0) {
                    d.scheduled_arrival_unix = (now < d.scheduled_arrival_unix ? d.scheduled_arrival_unix : now) + time * 60;
                    d.scheduled_arrival = (new Date(d.scheduled_arrival_unix * 1000).toTimeString().split(' ')[0])
                }
                d.estimated_arrival_unix = d.scheduled_arrival_unix;
                d.injected = true;
            }
            if (!notesCache[d.vehicle_id] && d.vehicle_id) {
                notesCache[d.vehicle_id] = fetch(CLOUDFLARED + "notes/" + d.vehicle_id.split("|")[1]).then(r => r.ok ? r : { json: () => [] }).then(r => r.json());
            }
            let arrivalSpan = ""
            let arrivalTime = (d.estimated_arrival || d.scheduled_arrival).split(":").slice(0, 2).join(":")
            let arrivalDif;
            if (d.estimated_arrival_unix) {
                arrivalDif = d.estimated_arrival_unix - d.scheduled_arrival_unix
                arrivalDif = Math.floor(arrivalDif / 60)
                let dif = d.estimated_arrival_unix - now;
                mins = Math.floor(dif / 60)
                if (mins > 59) mins = "59+"
                if (d.current_stop === stopId || mins < 1) {
                    arrivalTime = "A chegar"
                } else {
                    arrivalTime = mins + " min" + (mins === 1 ? "" : "s")
                }
                if (arrivalDif > 2) {
                    arrivalSpan = "delayed"
                } else if (arrivalDif < -2) {
                    arrivalSpan = "early"
                } else if (d.estimated_arrival.includes(":")) {
                    arrivalSpan = "ontime"
                }
                if (!d.estimated_arrival.includes(":")) {
                    arrivalTime = d.scheduled_arrival.split(":").slice(0, 2).join(":")
                }
            }
            let bus = document.createElement("div")
            bus.className = "bus"
            bus.innerHTML = "<div class=\"info\"><p class=\"title " + (d.estimated_arrival ? (d.injected ? "injected" : "ontime") : "") + "\"><span class=\"line " + (d.line_id.startsWith("1") ? (shortLines.includes(d.line_id) ? "short" : "long") : "unknown") + "\">" + d.line_id + "</span>" + d.headsign + "</p><p class=\"schedule " + arrivalSpan + "\">" + arrivalTime + "</p></div>"
            if (d.estimated_arrival) {
                bus.classList.add("running")
                bus.innerHTML += "<div class=\"details\"><p class=\"type\"><b>Tipo de veículo:</b> " + (d.vehicle_type || getVehicle(d.vehicle_id)) + "</b></p><p class=\"time\">" + ((arrivalDif === 0 || !d.estimated_arrival.includes(":")) ? d.estimated_arrival.split(":").splice(0, 2).join(":") : "<span class=\"oldTime\">" + d.scheduled_arrival.split(":").splice(0, 2).join(":") + "</span>" + " | " + d.estimated_arrival.split(":").splice(0, 2).join(":")) + "</p></div>"
            }
            if (notesCache[d.vehicle_id] && notesCache[d.vehicle_id].then) notesCache[d.vehicle_id] = await Promise.resolve(notesCache[d.vehicle_id]);
            if (notesCache[d.vehicle_id] && notesCache[d.vehicle_id].length > 0) {
                bus.innerHTML += "<div class=\"alerts\">" + notesCache[d.vehicle_id].map(a => "<p>⚠️ " + a + "</p>").join("") + "</div>"
            }
            divs.push({ arrival: (d.estimated_arrival_unix || d.scheduled_arrival_unix), div: bus })
        }))
        divs.sort((a, b) => a.arrival - b.arrival)
        divs.map(a => tempDiv.appendChild(a.div))
        departuresEl.classList.remove("departures-loading")
        if (new Date().getHours() < 5) {
            departuresEl.innerHTML = tempDiv.outerHTML.replaceAll("24:", "00:").replaceAll("25:", "01:").replaceAll("26:", "02:").replaceAll("27:", "03:").replaceAll("23:", "(-1) 23:").replaceAll("22:", "(-1) 22:").replaceAll("21:", "(-1) 21:");
        } else {
            departuresEl.innerHTML = tempDiv.outerHTML.replaceAll("24:", "(+1) 00:").replaceAll("25:", "(+1) 01:").replaceAll("26:", "(+1) 02:").replaceAll("27:", "(+1) 03:");
        }
    })
}