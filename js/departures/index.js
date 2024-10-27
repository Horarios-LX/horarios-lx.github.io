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
    fetch(API_BASE + "stops/" + stopId + "/realtime").then(r => r.json()).then(async departures => {
        vehicles = null;
        let now = Date.now() / 1000
        let tempDiv = document.createElement("div")
        departures = departures.filter(a => (a.estimated_arrival_unix > now || (!a.estimated_arrival_unix && a.scheduled_arrival_unix > (now - 30 * 60))) && !a.observed_arrival_unix)
        departures.sort((a, b) => (a.estimated_arrival_unix ? a.estimated_arrival_unix : a.scheduled_arrival_unix) - (b.estimated_arrival_unix ? b.estimated_arrival_unix : b.scheduled_arrival_unix))
        let divs = []
        departures = departures.slice(0, 40)
        vehicles = fetch(CLOUDFLARED + "vehicles").then(r => r.json()).catch(r => fetch(API_BASE + "vehicles").then(r => r.json()))
        await Promise.all(departures.map(async d => {
            if (!patternsCache[d.pattern_id]) {
                patternsCache[d.pattern_id] = fetch(CLOUDFLARED + "patterns/" + d.pattern_id).then(r => r.json()).then(r => r).catch(e => fetch("/caches/patterns/" + d.pattern_id + ".json").then(r => r.json()));
            }
            if (vehicles.then) vehicles = await Promise.resolve(vehicles);

            let vec = vehicles.find(a => a.trip_id === d.trip_id);
            if (!d.vehicle_id && vec) {
                d.vehicle_id = vec.id
            } else if (!vec) {
                vec = vehicles.find(a => a.vehicle_id === d.vehicle_id);
            }

            if (vec) {
                d.lat = vec.lat;
                d.lon = vec.lon;
                d.bearing = vec.bearing;
                d.stopIndex
                d.current_stop = vec.stop_id;
                pattern = patternsCache[d.pattern_id]
                if (pattern.then) pattern = await Promise.resolve(pattern);
                patternsCache[d.pattern_id] = pattern;
                let eta;
                if (vec.stop_sequence) {
                    busLocIndex = vec.stop_sequence - 1;
                    routeSection = pattern.path.filter(a => pattern.path.indexOf(a) >= (busLocIndex) && pattern.path.indexOf(a) < d.stop_sequence)
                    if (routeSection.length === 0 && (busLocIndex + 1) !== d.stop_sequence) return
                    let timeDif = routeSection.reduce((a, s) => a + (s.schedule ? s.schedule.travel_time : s.travel_time) * 60, 0)
                    eta = now + timeDif;
                } else {
                    busLoc = pattern.path.filter(a => a.id === vec.stop_id).sort((a, b) => Math.abs(a.index - d.stop_sequence) - Math.abs(b.index - d.stop_sequence))
                    if (busLoc.length > 1 && busLoc[0].index < busLoc[1].index) return
                    busLocIndex = pattern.path.indexOf(busLoc[0])
                    routeSection = pattern.path.filter(a => pattern.path.indexOf(a) >= busLocIndex && pattern.path.indexOf(a) < d.stop_sequence)
                    if (routeSection.length === 0 && (busLocIndex + 1) !== d.stop_sequence) return
                    let timeDif = routeSection.reduce((a, s) => a + (s.schedule ? s.schedule.travel_time : s.travel_time) * 60, 0)
                    eta = now + timeDif;
                    if (busLoc.length > 1) {
                        busLocIndex2 = pattern.path.indexOf(busLoc[1])
                        routeSection = pattern.path.filter(a => pattern.path.indexOf(a) > busLocIndex2 && pattern.path.indexOf(a) < d.stop_sequence)
                        if (routeSection.length !== 0 || (busLocIndex + 1) === d.stop_sequence) {
                            let timeDif1 = routeSection.reduce((a, s) => a + (s.schedule ? s.schedule.travel_time : s.travel_time) * 60, 0)
                            if (Math.abs(d.scheduled_arrival_unix - (now + timeDif1)) < Math.abs(d.scheduled_arrival_unix - eta)) {
                                timeDif = timeDif1;
                                eta = now + timeDif;
                                busLocIndex = busLocIndex2
                            }
                        }
                    }
                }
                if (busLocIndex === 0) d.status = "Início de serviço";

                /*
                TEMP FIX
                */

                if ((d.estimated_arrival_unix - d.scheduled_arrival_unix) > 30 * 60) d.estimated_arrival_unix -= 60 * 60;

                if (!d.estimated_arrival_unix) {
                    d.estimated_arrival_unix = eta
                    if (d.status && d.estimated_arrival_unix < d.scheduled_arrival_unix) d.estimated_arrival_unix = d.scheduled_arrival_unix
                    d.estimated_arrival = (new Date(d.estimated_arrival_unix * 1000).toTimeString().split(' ')[0])
                    //d.injected = true;
                }
                d.stop_index = busLocIndex + 1;
                d.delay = d.estimated_arrival_unix - d.scheduled_arrival_unix;
            }

            if (!patternsCache[d.pattern_id]) {
                patternsCache[d.pattern_id] = fetch("/caches/patterns/" + d.pattern_id + ".json").then(r => r.json());
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
                if ((d.current_stop === stopId || mins < 1) && !d.status) {
                    arrivalTime = "A chegar"
                } else {
                    arrivalTime = ((arrivalDif === 0 || !d.estimated_arrival.includes(":")) ? d.estimated_arrival.split(":").splice(0, 2).join(":") : "<span class=\"oldTime\">" + d.scheduled_arrival.split(":").splice(0, 2).join(":") + "</span>" + " | " + d.estimated_arrival.split(":").splice(0, 2).join(":")) //mins + " min" + (mins === 1 ? "" : "s")
                }
                if (d.status) {
                    arrivalSpan = ""
                } else if (arrivalDif > 2) {
                    arrivalSpan = "delayed"
                } else if (arrivalDif < -2) {
                    arrivalSpan = "early"
                } else if (d.estimated_arrival.includes(":")) {
                    arrivalSpan = "ontime"
                }
            }
            let bus = document.createElement("div")
            bus.className = "bus"
            bus.innerHTML = "<div class=\"info\"><p class=\"title " + (d.estimated_arrival ? (d.injected ? "injected" : "ontime") : "") + "\"><span class=\"line " + (d.line_id.startsWith("1") ? (shortLines.includes(d.line_id) ? "short" : "long") : "unknown") + "\">" + d.line_id + "</span>" + d.headsign + "</p><p class=\"schedule\">" + arrivalTime + "</p></div>"
            if (d.estimated_arrival) {
                bus.classList.add("running")
                bus.innerHTML += "<div class=\"details\"><p class=\"type\"><b>Tipo de veículo:</b> " + (d.vehicle_type || getVehicle(d.vehicle_id)) + "</b></p><p class=\"time " + arrivalSpan + "\">" + (d.status ? d.status : (Math.abs(arrivalDif) < 3 ? "No horário previsto" : Math.abs(arrivalDif) + " mins " + (arrivalDif < 0 ? "adiantado" : "atrasado"))) + "</p></div>"
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
        divs.filter(a => !a.observed_arrival_unix)
        divs.sort((a, b) => a.arrival - b.arrival)
        divs = divs.slice(0, 25)
        if (divs.length === 0) {
            departuresEl.classList.remove("departures-loading")
            departuresEl.innerHTML = "<p>Não há serviços previstos nesta paragem.</p>"
            return;
        }
        divs.map(a => tempDiv.appendChild(a.div))

        departuresEl.classList.remove("departures-loading")
        if (new Date().getHours() < 5) {
            departuresEl.innerHTML = tempDiv.outerHTML.replaceAll("24:", "00:").replaceAll("25:", "01:").replaceAll("26:", "02:").replaceAll("27:", "03:").replaceAll("23:", "(-1) 23:").replaceAll("22:", "(-1) 22:").replaceAll("21:", "(-1) 21:").replaceAll("20:", "(-1) 20:");
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
                Promise.resolve(loadDiv(div, pattern, node.id, departure))
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
    routeSection = pattern.path.filter(a => (pattern.path.indexOf(a) + 1) >= vec.stop_index && pattern.path.indexOf(a) < vec.stop_sequence)
    let timeDif = routeSection.reduce((a, s) => a + (s.schedule ? s.schedule.travel_time : s.travel_time) * 60, 0)
    let timeDelay = vec.delay
    let time = (vec.estimated_arrival_unix || vec.scheduled_arrival_unix) - timeDif;
    pattern.path.map(a => {
        let e = document.createElement("span")
        e.className = "stop"
        if (a.index < vec.stop_index) {
            e.classList.add("passed")
        }
        if (a.index === (vec.stop_sequence)) {
            e.id = "selectedStop"
        }
        if (a.index === (vec.stop_index)) {
            if (!e.id) e.classList.add("bus-loc");
            time += (a.schedule ? a.schedule.travel_time : a.travel_time) * 60
            eta = "<span class=\"" + arrivalSpan + "\">A chegar</span><span class=\"split\"> | </span>"
            if (a.index === 1) eta = eta.replaceAll("A chegar", "Partida")
        } else if (eta !== "") {
            time += (a.schedule ? a.schedule.travel_time : a.travel_time) * 60
            eta = (Math.abs(arrivalDif) > 2 ? "<span class=\"oldTime\">" + makeTime(time - timeDelay) + "</span><span class=\"split\"> | </span>" : "") + "<span class=\"" + arrivalSpan + "\">" + makeTime(time) + "</span><span class=\"split\"> - </span>"
        }
        e.innerHTML = eta + "<span>" + a.name + "</span>"
        let e2 = document.createElement("span")
        e2.className = "lines"
        if (a.index < vec.stop_index) e2.classList.add("passed")
        l = a.lines.filter(a => a !== pattern.line_id);
        e2.innerHTML = l.length === 0 ? "" : l.map(a => "<span class=\"line " + (shortLines.includes(a) ? "short" : "long") + "\">" + a + "</span>").join("")
        if (new Date().getHours() < 5) {
            e.innerHTML = e.innerHTML.replaceAll("24:", "00:").replaceAll("25:", "01:").replaceAll("26:", "02:").replaceAll("27:", "03:").replaceAll("23:", "(-1) 23:").replaceAll("22:", "(-1) 22:").replaceAll("21:", "(-1) 21:").replaceAll("20:", "(-1) 20:");
        } else {
            e.innerHTML = e.innerHTML.replaceAll("24:", "(+1) 00:").replaceAll("25:", "(+1) 01:").replaceAll("26:", "(+1) 02:").replaceAll("27:", "(+1) 03:");
        }
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
            mapLibLoaded = true;
        } else {
            setTimeout(() => genMap(map, pattern, vec))
        }
        map.onclick = (e) => e.stopImmediatePropagation()
        div.appendChild(map)
    }
    return div;
}

let shapesCache = {}

async function genMap(div, pattern, vehicle) {
    var selectedIcon = L.icon({
        iconUrl: (shortLines.includes(pattern.line_id) ? "/static/selShort.png" : "/static/selLong.png"),
        iconAnchor: [12, 41],
        popupAnchor: [0, -40]
    })

    div.classList.remove("loading")
    if (stopInfo.then) stopInfo = await Promise.resolve(stopInfo)
    map = L.map(div.id).setView([stopInfo.lat, stopInfo.lon], 16);

    let shape = pattern.shape_id

    var marker = L.marker([parseFloat(stopInfo.lat), parseFloat(stopInfo.lon)], { icon: selectedIcon }).addTo(map)

    marker.openPopup();

    let shapeInfo;
    if (shapesCache[shape]) shapeInfo = shapesCache[shape]
    else {
        shapeInfo = fetch(CLOUDFLARED + "shapes/" + shape).then(r => r.text())
        shapesCache[shape] = shapeInfo;
    }
    if (shapeInfo.then) shapeInfo = await Promise.resolve(shapeInfo);
    shapeInfo = shapeInfo.split("|")
    shapeInfo = shapeInfo.map(a => a.split("+"))

    L.geoJSON({
        "type": "Feature",
        "properties": {},
        "geometry": {
            "type": "LineString",
            "coordinates": shapeInfo
        }
    }, {
        style: function (feature) {
            return { color: pattern.color, weight: 5 };
        }
    }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        minZoom: 6,
        attribution: '© OpenStreetMap',
        useCache: true,
        saveToCache: true,
        useOnlyCache: false
    }).addTo(map);
    if (vehicle.lat) createBusmarker(vehicle.lat, vehicle.lon, vehicle.bearing, map)
}