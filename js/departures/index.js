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
    document.getElementById("lines").innerHTML = stopInfo.lines.reduce((acc, value) => acc + "<span class=\"line\" style=\"background-color: " + (stopInfo.lineCols ? stopInfo.lineCols[value] : "#000000") + ";\">" + value + "</span>", "")

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

let divsCache = {}

let selected = {};

let now;

function fetchBuses() {
    fetch(API_BASE + "stops/" + stopId + "/realtime").then(r => r.json()).then(async departures => {
        vehicles = null;
        now = Date.now() / 1000
        let tempDiv = document.createElement("div")
        departures = departures.filter(a => (a.estimated_arrival_unix > now || (!a.estimated_arrival_unix && a.scheduled_arrival_unix > (now - 30 * 60))) && !a.observed_arrival_unix)
        departures.sort((a, b) => (a.estimated_arrival_unix ? a.estimated_arrival_unix : a.scheduled_arrival_unix) - (b.estimated_arrival_unix ? b.estimated_arrival_unix : b.scheduled_arrival_unix))
        let divs = []
        departures = departures.slice(0, 40)
        vehicles = fetch(CLOUDFLARED + "vehicles/" + stopId).then(r => r.json()).catch(r => fetch(API_BASE + "vehicles").then(r => r.json()))
        await Promise.all(departures.map(async d => {
            if(stopInfo.then) stopInfo = await stopInfo;
            if (!patternsCache[d.pattern_id]) {
                patternsCache[d.pattern_id] = fetch(CLOUDFLARED + "patterns/" + d.pattern_id).then(r => r.json()).then(r => r).catch(e => fetch("/caches/patterns/" + d.pattern_id + ".json").then(r => r.json()));
            }
            if (vehicles.then) vehicles = await Promise.resolve(vehicles);

            let vec = vehicles.find(a => a.trip_id === d.trip_id || a.tripId === d.trip_id);
            if (!d.vehicle_id && vec) {
                d.vehicle_id = vec.id
            } else if (!vec) {
                vec = vehicles.find(a => a.id === d.vehicle_id);
            } 
            if (!vec && d.estimated_arrival_unix) {
                d.estimated_arrival_unix = null;
                d.estimated_arrival = null;
            }
            // Invalidates time (and recalculates it) if the ETA given by the API is a timestamp in the past.
            if((d.estimated_arrival_unix && d.estimated_arrival_unix < (now - 60*60)) && !d.observed_arrival_unix && d.vehicle_id) {
                d.estimated_arrival_unix = null
                d.estimated_arrival = null
                console.error("INVALIDATING " + d.vehicle_id)
            };
            
            if(d.line_id === "1998") d.line_id = "CP";

            if (vec) {
                d.lat = vec.lat;
                d.lon = vec.lon;
                d.bearing = vec.bearing;
                d.stopIndex
                d.current_stop = vec.stopId;
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
                    busLocIndex = pattern.path.indexOf(pattern.path.find(a => a.id === vec.stopId))
                    prevBusLocIndex = pattern.path.indexOf(pattern.path.find(a => a.id === vec.prev_stop))
                    busLocIndex < prevBusLocIndex ? busLocIndex = prevBusLocIndex + 1 : busLocIndex = busLocIndex;
                    routeSection = pattern.path.filter(a => pattern.path.indexOf(a) >= busLocIndex && pattern.path.indexOf(a) < d.stop_sequence)
                    if (routeSection.length === 0 && (busLocIndex + 1) !== d.stop_sequence) return
                    let timeDif = routeSection.reduce((a, s) => a + (s.schedule ? s.schedule.travel_time : s.travel_time) * 60, 0)
                    eta = now + timeDif;
                }
                
                if (busLocIndex === 0) d.status = "Início de serviço";

                if (!d.estimated_arrival_unix) {
                    d.estimated_arrival_unix = eta
                    d.injected = true;
                }
                if (d.status && d.estimated_arrival_unix < d.scheduled_arrival_unix) d.estimated_arrival_unix = d.scheduled_arrival_unix
                d.estimated_arrival = (new Date(d.estimated_arrival_unix * 1000).toTimeString().split(' ')[0])
                d.stop_index = busLocIndex + 1;
                d.delay = d.estimated_arrival_unix - d.scheduled_arrival_unix;
            }

            if (!patternsCache[d.pattern_id]) {
                patternsCache[d.pattern_id] = fetch("/caches/patterns/" + d.pattern_id + ".json").then(r => r.json());
            }
            if (d.estimated_arrival_unix < now && d.scheduled_arrival_unix < now) return;
            if (!notesCache[d.vehicle_id] && d.vehicle_id) {
                notesCache[d.vehicle_id] = fetch(CLOUDFLARED + "notes/" + d.vehicle_id.split("|")[0] + "/" + d.vehicle_id.split("|")[1]).then(r => r.ok ? r.json() : []).catch(r => []);
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
                if ((d.stop_sequence === d.stop_index && mins < 5 || (mins < 2)) && !d.status) {
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
            bus.innerHTML = "<div class=\"info\"><p class=\"title " + (d.estimated_arrival ? (d.injected ? "injected" : "ontime") : "") + "\"><span class=\"line\" style=\"background-color: " + (stopInfo.lineCols ? stopInfo.lineCols[d.lineId || d.line_id] : "#000000") + ";\">" + (d.lineId || d.line_id) + "</span>" + d.headsign + "</p><p class=\"schedule\">" + arrivalTime + "</p></div>"
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
            departuresEl.innerHTML = tempDiv.outerHTML.replaceAll("24:", "00:").replaceAll("25:", "01:").replaceAll("26:", "02:").replaceAll("27:", "03:").replaceAll("28:", "04:").replaceAll("29:", "05:").replaceAll("30:", "06:").replaceAll("23:", "(-1) 23:").replaceAll("22:", "(-1) 22:").replaceAll("21:", "(-1) 21:").replaceAll("20:", "(-1) 20:");
        } else {
            departuresEl.innerHTML = tempDiv.outerHTML.replaceAll("24:", "(+1) 00:").replaceAll("25:", "(+1) 01:").replaceAll("26:", "(+2) 02:").replaceAll("27:", "(+3) 03:").replaceAll("28:", "(+1) 04:").replaceAll("29:", "(+1) 05:").replaceAll("30:", "(+1) 06:");
        }
        tempDiv.childNodes.forEach(async node => {
            nodeEl = document.getElementById(node.id);
            nodeEl.onclick = () => onclick(node, departures)
            if (divsCache[node.id]) {
                div = divsCache[node.id];
                div.onclick = () => onclick(node, departures)
                nodeEl.appendChild(div)
                if (selected.id !== node.id) {
                    div.classList.add("hidden")
                } else {
                    let data = node.id.split("&")
                    let departure = departures.find(a => a.trip_id === data[0] && a.stop_sequence.toString() === data[1])
                    if (!departure) return console.error("EXCEPTION: Couldn't find a departure for Trip-id: " + data[0] + " & Stop-sequence: " + data[1]);

                    let pattern = patternsCache[departure.pattern_id]
                    if (pattern.then) pattern = patternsCache[departure.pattern_id] = await Promise.resolve(pattern)
                    div.innerHTML = genDiv(pattern, node.id, departure);
                    r = div.getElementsByTagName('div')[0]
                    r.onscroll = () => {
                        selected.scroll = r.scrollTop
                    }
                    r.style.setProperty("--line-height", r.scrollHeight + "px")
                    div.classList.remove("hidden")
                    r.scrollTop = selected.scroll; 
                }
            }
        })
    })
}

async function onclick(node, departures) {
    if (selected.id === node.id) {
        selected.div.classList.add("hidden")
        selected = {}
        return;
    } else if (selected.id) {
        selected.div.classList.add("hidden")
    }
    let el = document.getElementById(node.id);
    let data = node.id.split("&")
    let departure = departures.find(a => a.trip_id === data[0] && a.stop_sequence.toString() === data[1])
    if (!departure) return console.error("EXCEPTION: Couldn't find a departure for Trip-id: " + data[0] + " & Stop-sequence: " + data[1]);
    let div = divsCache[node.id]
    if (!div) {
        div = document.createElement("div")
        el.appendChild(div)
        divsCache[node.id] = div;
    }
    let pattern = patternsCache[departure.pattern_id]
    if (pattern.then) pattern = patternsCache[departure.pattern_id] = await Promise.resolve(pattern)
    selected = { id: node.id, div: div }
    div.classList.add("schedule-expandable")
    div.classList.add("hidden")
    div.innerHTML = genDiv(pattern, node.id, departure)
    setTimeout(() => {
        div.classList.remove("hidden")
        r = div.getElementsByTagName('div')[0]
        r.onscroll = () => {
            selected.scroll = r.scrollTop
        }
        r.style.setProperty("--line-height", r.scrollHeight + "px")
        setTimeout(() => {
            r.querySelector("#selectedStop").scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            });
        })
    })
}

function genDiv(pattern, id, vec) {
    let tdiv = document.createElement("tdiv")
    let title = document.createElement("h2")
    title.innerHTML = (pattern.long_name.name || pattern.long_name);
    tdiv.appendChild(title)
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
    routeSection = pattern.path.filter(a => (pattern.path.indexOf(a)) >= (vec.stop_index - 1 || 0) && pattern.path.indexOf(a) < vec.stop_sequence)
    let timeDif = routeSection.reduce((a, s) => a + (s.schedule ? s.schedule.travel_time : s.travel_time) * 60, 0)
    let timeDelay = vec.delay
    let time = (vec.estimated_arrival_unix || vec.scheduled_arrival_unix) - timeDif;
    pattern.path.map(a => {
        let e = document.createElement("span")
        e.className = "stop"
        if (a.stop_sequence < (vec.stop_index - (1-pattern.path[0].stop_sequence))) {
            e.classList.add("passed")
        }
        if (a.stop_sequence === (vec.stop_sequence)) {
            e.id = "selectedStop"
        }
        if (!timeDelay) {
            time += (a.schedule ? a.schedule.travel_time : a.travel_time) * 60
            eta = "<span>" + makeTime(time) + "</span><span class=\"split\"> - </span>"
        } else if (a.id === (vec.current_stop) && a.stop_sequence === (vec.stop_index - (1-pattern.path[0].stop_sequence))) {
            if (!e.id) e.classList.add("bus-loc");
            time += (a.schedule ? a.schedule.travel_time : a.travel_time) * 60
            eta = (time - now < 2*60 ? "<span class=\"" + arrivalSpan + "\">A chegar</span>" : ((Math.abs(arrivalDif) > 2 ? "<span class=\"oldTime\">" + makeTime(time - timeDelay) + "</span><span class=\"split\"> | </span>" : "") + "<span class=\"" + arrivalSpan + "\">" + makeTime(time) + "</span>")) + "</span><span class=\"split\"> - </span>"
            if (a.stop_sequence === 1) eta = eta.replaceAll("A chegar", "Partida")
        } else if (eta !== "") {
            time += (a.schedule ? a.schedule.travel_time : a.travel_time) * 60
            eta = (Math.abs(arrivalDif) > 2 ? "<span class=\"oldTime\">" + makeTime(time - timeDelay) + "</span><span class=\"split\"> | </span>" : "") + "<span class=\"" + arrivalSpan + "\">" + makeTime(time) + "</span><span class=\"split\"> - </span>"
        }
        e.innerHTML = eta + "<span>" + a.name + "</span>"
        let e2 = document.createElement("span")
        e2.className = "lines"
        if (a.index < vec.stop_index) e2.classList.add("passed")
        l = a.lines.filter(a => a.text !== pattern.line_id);
        e2.innerHTML = l.length === 0 ? "" : l.map(a => "<span class=\"line\" style=\"background-color: " + (a.color) + ";\">" + (a.text || a) + "</span>").join("")
        if (new Date().getHours() < 5) {
            e.innerHTML = e.innerHTML.replaceAll("24:", "00:").replaceAll("25:", "01:").replaceAll("26:", "02:").replaceAll("27:", "03:").replaceAll("28:", "04:").replaceAll("29:", "05:").replaceAll("30:", "06:").replaceAll("23:", "(-1) 23:").replaceAll("22:", "(-1) 22:").replaceAll("21:", "(-1) 21:").replaceAll("20:", "(-1) 20:");
        } else {
            e.innerHTML = e.innerHTML.replaceAll("24:", "(+1) 00:").replaceAll("25:", "(+1) 01:").replaceAll("26:", "(+1) 02:").replaceAll("27:", "(+1) 03:").replaceAll("28:", "(+1) 04:").replaceAll("29:", "(+1) 05:").replaceAll("30:", "(+1) 06:");
        }
        route.appendChild(e)
        route.appendChild(e2)
    })
    route.id = id + "-route"
    route.style.setProperty('--pattern-color', pattern.color);
    tdiv.appendChild(route)
    return tdiv.outerHTML;
}