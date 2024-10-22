let url = window.location.href.split("?p=")
let stopId = url[1]

let stopInfo;

stopInfo = fetch(CLOUDFLARED + "stops/" + stopId).then(r => r.json()).catch(e => fetch("https://api.carrismetropolitana.pt/stops/" + stopId).then(r => r.json()));