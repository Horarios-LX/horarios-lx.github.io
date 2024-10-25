function makeTime(s) {
    return new Date(s * 1000).toTimeString().split(' ')[0].split(":").slice(0, 2).join(":").replaceAll("00:", "24:").replaceAll("01:", "25:").replaceAll("02:", "26:").replaceAll("03:", "27:")
}


function createBusmarker(lat, lng, rotation, map) {
    var busIcon = L.divIcon({
        className: "marker",
        html: "<div class=\"vehicle-marker\" style=\"transform: translate(-50%, -50%) rotate(" + rotation + "deg) scale(50%)\"><object data=\"/static/bus.svg\" type=\"image/svg+xml\"></object></div>",
        iconSize: [8, 8],
        iconAnchor: [0, 0]
    });
    L.marker([lat, lng], {
        icon: busIcon
    }).addTo(map);
}