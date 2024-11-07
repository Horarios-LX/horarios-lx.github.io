const schedulesButton = document.getElementById("schedules")
function preSearch() {
    schedulesButton.classList.add("disabled")
    schedulesButton.onclick = () => {}
}

let markersCache = {};

map = L.map("map").setView([38.7033459, -9.1638052], 12);

function postSearch(item, school) {
    if(!school) schedulesButton.classList.remove("disabled")
    if(!school) schedulesButton.onclick = () => window.location.href = "/" + (school ? "escola" : "partidas") + "/?p=" + item.id
    map.setView([item.lat, item.lon], 20)
    if(!school) {
        let marker = markersCache[item.id];
    setTimeout(() => { 
        selMarker = markers.getVisibleParent(marker)
        selMarker.spiderfy(); 
        marker.openPopup()
    }, 500)
    marker.openPopup()
}
}

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    minZoom: 9,
    attribution: '© OpenStreetMap',
    useCache: true,
    saveToCache: true,
    useOnlyCache: false
}).addTo(map);

(async () => {
    stops = await fetch(CLOUDFLARED + "stops").then(r => r.json())
    schools = await fetch(CLOUDFLARED + "schools").then(r => r.json())
    stops = stops.filter(a => a.lines.length > 0)
    let stopIcon = L.icon({
        iconUrl: "/static/blob.png",
        iconAnchor: [16, 16],
        popupAnchor: [0, -20]
    });

    markers = L.markerClusterGroup({
        maxClusterRadius: 100,
        iconCreateFunction: function(cluster) {
            var clusterSize = "smallest";
            if (cluster.getChildCount() >= 10) {
                clusterSize = "small";
            }
            if (cluster.getChildCount() >= 50) {
                clusterSize = "medium";
            }
            if (cluster.getChildCount() >= 250) {
                clusterSize = "large";
            }
            if (cluster.getChildCount() >= 500) {
                clusterSize = "massive";
            }
            return new L.DivIcon({
                html: '<div><span>' + cluster.getChildCount() + '</span></div>',
                className: 'marker-cluster marker-cluster-' + clusterSize,
                iconSize: [80, 80]
            });
        },
        spiderfyOnMaxZoom: true
    })

    stops.forEach(stop => {
        var marker = L.marker([stop.lat, stop.lon], {
            icon: stopIcon
        })
        let lines = stop.lines.reduce((acc, value) => acc + "<span class=\"line\" style=\"background-color: " + value.color + ";\">" + value.text + "</span>", "")

        const popupContent = `
        <div class="stop-popup" style="text-align: center;">
            <p>${stop.name}</p>
            <p class="lines">${lines}</p>
            <button onclick="window.location.href = '/partidas/?p=${stop.id}'">Ver mais</button>
        </div>
    `;

        marker.bindPopup(popupContent);
        markers.addLayer(marker)
        markersCache[stop.id] = marker;
    })

    map.addLayer(markers)
})()


getStops = () => stops;