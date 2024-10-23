let loading = document.getElementById("loading")

let soundBtn = document.getElementById("sound")
let audio = document.createElement("audio")
audio.src = "https://storage.carrismetropolitana.pt/static/tts/live/stops/" + stopId + ".mp3"
soundBtn.appendChild(audio)

soundBtn.onclick = () => audio.play()

let departuresEl = document.getElementById("departures")

if (!stopInfo) stopInfo = fetch("https://api.carrismetropolitana.pt/stops/" + stopId).then(r => r.json())

stopInfo.then(stopInfo => {
    document.querySelector('meta[property="og:title"]').setAttribute("content", "HoráriosLX | " + stopInfo.name);
    document.getElementById("title").innerHTML = "<b>" + stopInfo.name + "</b>"
    document.getElementById("lines").innerHTML = stopInfo.lines.reduce((acc, value) => acc + "<span class=\"line " + (value.startsWith("1") ? (shortLines.includes(value) ? "short" : "long") : "unknown") + "\">" + value + "</span>", "")

    loading.remove()

    fetchBuses()

    setInterval(() => {
        fetchBuses()
    }, 30 * 1000)
})

let mapLibLoaded = false;

let vehicles;

let patternsCache = {}

let notesCache = {}

let selectedService;

let selectedDiv;

let divsCache = {};

function openMenu(id) {
    alert(id)
}

function fetchBuses() {
    fetch("https://api.carrismetropolitana.pt/stops/" + stopId + "/realtime").then(r => r.json()).then(async departures => {
        vehicles = null;
        let now = Date.now() / 1000
        let tempDiv = document.createElement("div")
        departures = departures.filter(a => (a.estimated_arrival_unix > now || (!a.estimated_arrival_unix && a.scheduled_arrival_unix > (now - 30 * 60))) && !a.observed_arrival_unix)
        departures.sort((a, b) => (a.estimated_arrival_unix ? a.estimated_arrival_unix : a.scheduled_arrival_unix) - (b.estimated_arrival_unix ? b.estimated_arrival_unix : b.scheduled_arrival_unix))
        let divs = []
        divs = divs.slice(0, 40)
        await Promise.all(departures.map(async d => {
            if (!d.injected && !patternsCache[d.pattern_id]) {
                patternsCache[d.pattern_id] = fetch("/caches/patterns/" + d.pattern_id + ".json").then(r => r.json());
            }
            if (!d.preFetched) {
                if (!vehicles) vehicles = fetch(CLOUDFLARED + "vehicles").then(r => r.json()).catch(e => fetch("https://api.carrismetropolitana.pt/vehicles").then(r => r.json()));
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
                        d.timestamp = vehicle.timestamp
                    }
                } else if (d.estimated_arrival) {
                    d.timestamp = vehicles.sort((a, b) => a.timestamp - b.timestamp)[0].timestamp
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
            if (d.estimated_arrival_unix < now && d.scheduled_arrival_unix < now) return;
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
                    arrivalTime = ((arrivalDif === 0 || !d.estimated_arrival.includes(":")) ? d.estimated_arrival.split(":").splice(0, 2).join(":") : "<span class=\"oldTime\">" + d.scheduled_arrival.split(":").splice(0, 2).join(":") + "</span>" + " | " + d.estimated_arrival.split(":").splice(0, 2).join(":")) //mins + " min" + (mins === 1 ? "" : "s")
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
            bus.innerHTML = "<div class=\"info\"><p class=\"title " + (d.estimated_arrival ? (d.injected ? "injected" : "ontime") : "") + "\"><span class=\"line " + (d.line_id.startsWith("1") ? (shortLines.includes(d.line_id) ? "short" : "long") : "unknown") + "\">" + d.line_id + "</span>" + d.headsign + "</p><p class=\"schedule\">" + arrivalTime + "</p></div>"
            if (d.estimated_arrival) {
                bus.classList.add("running")
                bus.innerHTML += "<div class=\"details\"><p class=\"type\"><b>Tipo de veículo:</b> " + (d.vehicle_type || getVehicle(d.vehicle_id)) + "</b></p><p class=\"time " + arrivalSpan + "\">" + (d.estimated_arrival.includes(":") ? (Math.abs(arrivalDif) < 3 ? "No horário previsto" : Math.abs(arrivalDif) + " mins " + (arrivalDif < 0 ? "adiantado" : "atrasado")) : d.estimated_arrival) + "</p></div>"
            }
            if (notesCache[d.vehicle_id] && notesCache[d.vehicle_id].then) notesCache[d.vehicle_id] = await Promise.resolve(notesCache[d.vehicle_id]);

            if (now > (d.timestamp + 5 * 60)) {
                if (!notesCache[d.vehicle_id]) notesCache[d.vehicle_id] = []
                let tsDif = Math.floor((now - d.timestamp) / 60);
                if (!notesCache[d.vehicle_id].find(a => a.includes("Erro:"))) notesCache[d.vehicle_id].push("Erro: este serviço não é atualizado há mais de " + (tsDif > 60 ? (Math.floor(tsDif / 60) + " hora" + (tsDif < 120 ? "" : "s") + ".") : (Math.floor(tsDif) + " mins.")));
            }
            if (notesCache[d.vehicle_id] && notesCache[d.vehicle_id].length > 0) {
                bus.innerHTML += "<div class=\"alerts\">" + notesCache[d.vehicle_id].map(a => "<p>⚠️ " + a + "</p>").join("") + "</div>"
            }
            bus.id = d.trip_id + "&" + d.stop_sequence
            divs.push({ arrival: (d.estimated_arrival_unix || d.scheduled_arrival_unix), div: bus })
        }))
        divs.sort((a, b) => a.arrival - b.arrival)
        divs = divs.slice(0, 25)
        divs.map(a => tempDiv.appendChild(a.div))
        if (departures.length === 0) {
            tempDiv.innerHTML = "<p>Não há serviços previstos nesta paragem.</p>"
        }

        departuresEl.classList.remove("departures-loading")
        if (new Date().getHours() < 5) {
            departuresEl.innerHTML = tempDiv.outerHTML.replaceAll("24:", "00:").replaceAll("25:", "01:").replaceAll("26:", "02:").replaceAll("27:", "03:").replaceAll("23:", "(-1) 23:").replaceAll("22:", "(-1) 22:").replaceAll("21:", "(-1) 21:");
        } else {
            departuresEl.innerHTML = tempDiv.outerHTML.replaceAll("24:", "(+1) 00:").replaceAll("25:", "(+1) 01:").replaceAll("26:", "(+1) 02:").replaceAll("27:", "(+1) 03:");
        }
        tempDiv.childNodes.forEach(node => {
            nodeEl = document.getElementById(node.id);
            if (node.id === selectedService) {
                selectedDiv = nodeEl.appendChild(selectedDiv)
                selectedDiv.querySelector("div.route").querySelector("#selectedStop").scrollIntoView({
                    behavior: 'instant',
                    block: 'center',
                    inline: 'nearest'
                });
            }
            nodeEl.onclick = async () => {
                if (selectedDiv) selectedDiv.classList.add("hidden");
                if (selectedService === node.id) {
                    selectedDiv = null;
                    selectedService = null;
                    return;
                };
                selectedService = node.id;
                let el = document.getElementById(node.id);
                let data = node.id.split("&")
                let departure = departures.find(a => a.trip_id === data[0] && a.stop_sequence.toString() === data[1])
                if (!departure) return console.error("EXCEPTION: Couldn't find a departure for Trip-id: " + data[0] + " & Stop-sequence: " + data[1]);
                let div = divsCache[node.id] || document.createElement("div")
                div.classList.add("schedule-expandable")
                let pattern = patternsCache[departure.pattern_id]
                div.classList.add("hidden")
                if (pattern.then) pattern = patternsCache[departure.pattern_id] = await Promise.resolve(pattern)
                let div2 = await Promise.resolve(loadDiv(div, pattern, node.id, departure))
                el.appendChild(div2)
                selectedDiv = div2;
                setTimeout(() => {
                    div2.classList.remove("hidden")
                    r = div2.getElementsByTagName('div')[0]
                    r.style.setProperty("--line-height", r.scrollHeight + "px")
                    setTimeout(() => {
                        r.querySelector("#selectedStop").scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                            inline: 'nearest'
                        });
                    })
                })
                divsCache[node.id] = div2;
            }
        })
    })
}

function loadDiv(div, pattern, id, vec) {
    let title = document.createElement("h2")
    title.innerHTML = pattern.long_name;
    div.innerHTML = "";
    div.appendChild(title)
    let route = document.createElement("div")
    route.classList.add("route")
    let eta = "";
    arrivalDif = vec.estimated_arrival_unix - vec.scheduled_arrival_unix
    arrivalDif = Math.floor(arrivalDif / 60)
    if (arrivalDif > 2) {
        arrivalSpan = "delayed"
    } else if (arrivalDif < -2) {
        arrivalSpan = "early"
    } else {
        arrivalSpan = "ontime"
    }
    let time = vec.estimated_arrival_unix || vec.scheduled_arrival_unix
    let timeDif = time - vec.scheduled_arrival_unix
    time -= pattern.path.filter(a => a.index < vec.stop_sequence).reduce((acc, val) => acc += (val.travel_time || val.schedule.travel_time) * 60, 0)
    let busStopSeq = (pattern.path.find(a => a.id === vec.currentLocation) || { index: 0 }).index
    pattern.path.map(a => {
        let e = document.createElement("span")
        e.className = "stop"
        if (a.index < busStopSeq) {
            e.classList.add("passed")
        }
        if (a.id === stopId && a.index >= vec.stop_sequence) {
            e.id = "selectedStop"
        }
        if (a.id === vec.currentLocation) {
            if (!e.id) e.classList.add("bus-loc");
            eta = "<span class=\"" + arrivalSpan + "\">A chegar</span><span class=\"split\"> | </span>"
        } else if (eta !== "") {
            eta = (Math.abs(arrivalDif) > 2 ? "<span class=\"oldTime\">" + makeTime(time) + "</span><span class=\"split\"> | </span>" : "") + "<span class=\"" + arrivalSpan + "\">" + makeTime(time + timeDif) + "</span><span class=\"split\"> - </span>"
        }
        time += a.travel_time * 60 || a.schedule.travel_time * 60
        e.innerHTML = eta + "<span>" + a.name + "</span>"
        let e2 = document.createElement("span")
        e2.className = "lines"
        l = a.lines.filter(a => a !== pattern.line_id);
        e2.innerHTML = l.length === 0 ? "" : l.map(a => "<span class=\"line " + (shortLines.includes(a) ? "short" : "long") + "\">" + a + "</span>").join("")
        route.appendChild(e)
        route.appendChild(e2)
    })
    route.id = id + "-route"
    route.style.setProperty('--pattern-color', pattern.color);
    div.appendChild(route)
    if (((window.innerWidth > 0) ? window.innerWidth : screen.width) > 767) {
        let map = document.createElement("div")
        map.className = "route-map"
        map.classList.add("loading")
        map.id = id + "-map"
        map.innerHTML = '<object data="/static/logo.svg" type="image/svg+xml"></object>'
        if (!mapLibLoaded) {
            let link = document.createElement("link")
            link.href = "https://unpkg.com/leaflet@1.7.1/dist/leaflet.css"
            link.rel = "stylesheet"
            link.type = 'text/css'
            document.head.appendChild(link)
            let script = document.createElement("script")
            script.src = "https://unpkg.com/leaflet/dist/leaflet.js"
            script.onload = () => genMap(map, pattern, vec)
            document.head.appendChild(script)
        } else {
            genMap(map, pattern, vec)
        }
        map.onclick = (e) => e.stopImmediatePropagation()
        div.appendChild(map)
    }
    return div;
}

async function genMap(div, pattern, vehicle) {
    div.classList.remove("loading")
    if(stopInfo.then) stopInfo = await Promise.resolve(stopInfo)

    map = L.map(div.id).setView([stopInfo.lat, stopInfo.lon], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        minZoom: 9,
        attribution: '© OpenStreetMap',
        useCache: true,
        saveToCache: true,
        useOnlyCache: false
    }).addTo(map);

    let shape = pattern.shape_id
    
}

function makeTime(s) {
    return new Date(s * 1000).toTimeString().split(' ')[0].split(":").slice(0, 2).join(":").replaceAll("00:", "24:").replaceAll("01:", "25:").replaceAll("02:", "26:").replaceAll("03:", "27:")
}