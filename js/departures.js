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
    document.getElementById("title").innerHTML = "<b>" + stopInfo.name + "</b>"
    document.getElementById("lines").innerHTML = stopInfo.lines.reduce((acc, value) => acc + "<span class=\"line " + (value.startsWith("1") ? (shortLines.includes(value) ? "short" : "long") : "unknown") + "\">" + value + "</span>", "")
    
    loading.remove()

    fetchBuses()
})

function fetchBuses() {
    fetch("https://api.carrismetropolitana.pt/stops/" + stopId + "/realtime").then(r => r.json()).then(departures => {
        let now = Date.now() / 1000
        let tempDiv = document.createElement("div")
        departures = departures.filter(a => (a.estimated_arrival_unix > (now - 30 * 60) || a.scheduled_arrival_unix > (now - 30 * 60)) && !a.observed_arrival_unix)
        departures.forEach(d => {
            let bus = document.createElement("div")
            bus.className = "bus"
            bus.innerHTML = "<p class=\"title ontime\"><span class=\"line " + (d.line_id.startsWith("1") ? (shortLines.includes(d.line_id) ? "short" : "long") : "unknown") + "\">" + d.line_id + "</span>" + d.headsign + "</p><p class=\"schedule ontime\">A chegar</p>"
            tempDiv.appendChild(bus)
        })
        departuresEl.classList.remove("departures-loading")
        departuresEl.innerHTML = tempDiv.outerHTML;
        /*
        <div class="bus">
                <p class="title ontime"><span class="line long">1000</span>Oeiras (Estação Norte)</p><p class="schedule ontime">A chegar</p>
            </div>
            <div class="bus">
                <p class="title"><span class="line short">1000</span>Oeiras (Estação Norte)</p><p class="schedule ontime">A chegar</p>
            </div>
            <div class="bus">
                <p class="title ontime"><span class="line long">1000</span>Oeiras (Estação Norte)</p><p class="schedule ontime">A chegar</p>
            </div>
            */
    })
}