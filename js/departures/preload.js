let url = window.location.href.split("?p=")
let stopId = url[1]

let stopInfo;

let vehicleMeta = fetch(API_BASE + "vehicles/").then(r => r.json());

if(CLOUDFLARED.then) {
    Promise.resolve(CLOUDFLARED).then(r => {
        CLOUDFLARED = r;
        stopInfo = fetch(CLOUDFLARED + "stop/" + stopId).then(r => r.json()).catch(e => fetch("https://api.carrismetropolitana.pt/stops/" + stopId).then(r => r.json()));
    })
} else {
    stopInfo = fetch(CLOUDFLARED + "stop/" + stopId).then(r => r.json()).catch(e => fetch("https://api.carrismetropolitana.pt/stops/" + stopId).then(r => r.json()));
}