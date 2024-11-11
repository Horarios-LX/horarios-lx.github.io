map = L.map("map", {
    renderer: L.canvas(),
}).setView([38.7033459, -9.1638052], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    minZoom: 9,
    attribution: '© OpenStreetMap',
    useCache: true,
    saveToCache: true,
    useOnlyCache: false
}).addTo(map);

let { rg, id } = new Proxy(new URLSearchParams(window.location.search), { get: (searchParams, prop) => searchParams.get(prop) });

let timeline = document.getElementById("timeline")

let tripIndexes = [];

let patternCache = [];

let lastIndex;

let routeSection;

let route;

const CustomCanvasLayer = L.Layer.extend({
    initialize: function () {
        this._data = []; // Store marker data
    },

    onAdd: function (map) {
        this._map = map;

        const canvas = L.DomUtil.create('canvas', 'leaflet-custom-layer');
        const size = this._map.getSize();
        canvas.width = size.x;
        canvas.height = size.y;
        canvas.style.position = 'absolute';

        this._canvas = canvas;
        this._ctx = canvas.getContext('2d');

        map.getPanes().overlayPane.appendChild(this._canvas);

        map.on('viewreset', this._reset, this);
        map.on('move', this._update, this);

        this._reset();
    },


    onRemove: function (map) {
        L.DomUtil.remove(this._canvas);
        map.off('viewreset', this._reset, this);
        map.off('move', this._update, this);
    },

    _reset: function () {
        const bounds = this._map.getBounds();
        const topLeft = this._map.latLngToLayerPoint(bounds.getNorthWest());
        const size = this._map.getSize();

        const buffer = 100;
        const expandedSize = size.add([buffer * 2, buffer * 2]);

        this._canvas.width = expandedSize.x;
        this._canvas.height = expandedSize.y;

        L.DomUtil.setPosition(this._canvas, topLeft.subtract([buffer, buffer]));

        this._redraw();
    },

    _update: function () {
        this._reset();
    },

    _redraw: function () {
        const ctx = this._ctx;
        const map = this._map;
        const buffer = 100;
        alpha = 1;
        const bounds = map.getBounds();
        const topLeft = map.latLngToLayerPoint(bounds.getNorthWest());
        ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
        if (routeSection) {
            ctx.strokeStyle = route.col;
            ctx.lineWidth = 10;
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            ctx.beginPath();
            for (let i = 0; i < routeSection.length - 1; i++) {
                pointA = routeSection[i]
                pointB = routeSection[i + 1]
                posA = map.latLngToLayerPoint(pointA.slice(0, 2));
                adjustedPosA = posA.subtract(topLeft).add([buffer, buffer]);
                posB = map.latLngToLayerPoint(pointB.slice(0, 2));
                adjustedPosB = posB.subtract(topLeft).add([buffer, buffer]);
                if((adjustedPosA.x < 0 && adjustedPosB.x < 0) || (adjustedPosA.x > ctx.width && adjustedPosB.x > ctx.width) || (adjustedPosA.y < 0 && adjustedPosB.y < 0) || (adjustedPosA.y > ctx.height && adjustedPosB.y > ctx.height)) continue;
                if(Math.abs(pointA[0] - pointB[0]) > 0.05 || Math.abs(pointA[1] - pointB[1]) > 0.05) continue;
                ctx.beginPath();
                ctx.moveTo(adjustedPosA.x, adjustedPosA.y);
                ctx.lineTo(adjustedPosB.x, adjustedPosB.y)
                ctx.strokeStyle = pointB[2] + Math.round(alpha * 255).toString("16").padStart(2, "0");
                ctx.stroke();
                ctx.moveTo(adjustedPosB.x, adjustedPosB.y)
            }
            ctx.stroke()
            alpha = 1
            ctx.globalAlpha = 1;
        
            const pos = map.latLngToLayerPoint(routeSection[routeSection.length - 1].slice(0, 2));
            const adjustedPos = pos.subtract(topLeft).add([buffer, buffer]);
            if (
                adjustedPos.x >= 0 &&
                adjustedPos.y >= 0 &&
                adjustedPos.x <= this._canvas.width &&
                adjustedPos.y <= this._canvas.height
            ) {

                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';

                ctx.fillStyle = route.col + Math.round(alpha * 255).toString(16).padStart(2, '0');
                ctx.beginPath();
                ctx.arc(adjustedPos.x - 20, adjustedPos.y + 5, 10, Math.PI / 2, Math.PI * 3 / 2)
                ctx.lineTo(adjustedPos.x + 20, adjustedPos.y - 5);
                ctx.arc(adjustedPos.x + 20, adjustedPos.y + 5, 10, Math.PI * 3 / 2, Math.PI / 2)
                ctx.lineTo(adjustedPos.x - 20, adjustedPos.y + 15);
                ctx.fill();

                ctx.fillStyle = "#ffffff" + Math.round(alpha * 255).toString(16).padStart(2, '0');
                ctx.fillText(route.text, adjustedPos.x, adjustedPos.y);
            }
        };
    },
});

customLayer = new CustomCanvasLayer().addTo(map);

async function main() {
    trip = await fetch(CLOUDFLARED + "vehicles/" + rg + "/" + id + "/trip").then(r => r.json());
    trip12h = await fetch(CLOUDFLARED + "vehicles/" + rg + "/" + id + "/trip/12h").then(r => r.json());
    trip = trip.filter(a => a[5] % 4 === 0)
    trip12h = trip12h.concat(trip)
    for(let i = 0; i < trip12h.length; i++) {
        if(!tripIndexes.find(a => a.i === trip12h[i][4]) || lastIndex !== trip12h[i][4]) tripIndexes.push({i: trip12h[i][4], a: i});
        lastIndex = trip12h[i][4];
    }
    console.log(tripIndexes)
    await Promise.all(tripIndexes.map(async p => {
        patternCache[p.i] = await fetch(CLOUDFLARED + "patterns/" + p.i).then(r => r.json());
    }))
    now = Math.floor(Date.now()/120000)*120
    let slider = timeline.querySelector("#slider");
    start = now - trip12h.length*120;
    timeline.querySelector("#start").innerHTML = parseTime(start)
    timeline.querySelector("#end").innerHTML = parseTime(now)
    slider.max = trip12h.length;
    slider.value = trip12h.length;
    timeline.querySelector("#current").innerHTML = parseTime(now)
    timeline.querySelector("#services").innerHTML = tripIndexes.map((a, i) => {
        return "<div style=\"background-color:" + patternCache[a.i].color + "3f; width:" + Math.round(((tripIndexes[i+1] ? tripIndexes[i+1].a : trip12h.length) - a.a)/trip12h.length*slider.max)/slider.max*100 + "%\"><span class=\"line\" style=\"background-color: " + patternCache[a.i].color + ";\">" + a.i.split("_")[0].replaceAll("1998","CP") + "</span></div>"
    }).reduce((acc, val) => acc + val, "")

    let r = tripIndexes.sort((a, b) => b.a - a.a).find(a => a.a <= slider.value)
        routeSection = trip12h.slice(r.a, slider.value)
        route = {text: r.i, col: routeSection[0][2]}
        customLayer._redraw()
    slider.addEventListener("input", function () {
        timeline.querySelector("#current").innerHTML = parseTime(start + slider.value*120)
        let r = tripIndexes.sort((a, b) => b.a - a.a).find(a => a.a <= slider.value)
        routeSection = trip12h.slice(r.a, slider.value)
        route = {text: r.i, col: routeSection[0][2]}
        customLayer._redraw()
    });
}

function parseTime(t) {
    h = Math.floor(t / 3600) % 24;
    t %= 3600;
    m = Math.floor(t / 60);
    return h.toString().padStart(2, "0") + ":" + m.toString().padStart(2, "0")
}

main();