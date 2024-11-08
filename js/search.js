const el = document.getElementById("search")
const autocoplete = document.getElementById('autocomplete');

el.addEventListener("focusin", () => {
    genAutocomplete()
});

el.addEventListener('input', function() {
    genAutocomplete()
});

let caches = {}

function filter(text) {
    if(!text) return ""
    return text.replaceAll("av ","avenida ").replaceAll("r ","rua ").replaceAll("(x)","").replaceAll("(","").replaceAll(")","").replaceAll("entrada","").replaceAll("ú","u").replaceAll("á","a").replaceAll("é","e").replaceAll("ó","o").replaceAll("à","a").replaceAll("ã","a")
}

async function genAutocomplete() {
    stops = getStops();
    preSearch()
    const query = el.value.toLowerCase();
    autocomplete.innerHTML = ''; // Clear previous suggestions

    if (query.length > 0) {
        autocoplete.classList.remove("hidden")
        let filteredSuggestions;
        filteredSuggestions = stops.filter(a => {
            sn = filter(a.name.toLowerCase())
            si = a.id;
            qw = filter(query.toLowerCase()).split(/\s+/)
            return qw.every(w => sn.includes(w) || si.startsWith(query))
        })
        if(query.toLowerCase().startsWith("escola")) {
            filteredSuggestions = filteredSuggestions.concat(schools.filter(a => {
                sn = filter(a.name.toLowerCase())
                si = a.id;
                qw = filter(query.toLowerCase()).split(/\s+/)
                return qw.every(w => sn.includes(w) || si.startsWith(query))
            }).map(a => ({ ...a, school: true })))
        }
        filteredSuggestions.sort((a, b) => {
            if(a.name.toLowerCase().startsWith(query.toLowerCase()) && b.name.toLowerCase().startsWith(query.toLowerCase())) return a.name.localeCompare(b.name);
            if(a.name.toLowerCase().startsWith(query.toLowerCase()) && !b.name.toLowerCase().startsWith(query.toLowerCase())) return -1;
            if(!a.name.toLowerCase().startsWith(query.toLowerCase()) && b.name.toLowerCase().startsWith(query.toLowerCase())) return 1;
            return a.name.localeCompare(b.name);
        })
        let b = true;
        filteredSuggestions = filteredSuggestions.slice(0, 100)
        filteredSuggestions.forEach(item => {
            b = !b
            const suggestionItem = document.createElement('div');
            const lines = document.createElement('div');
            lines.classList.add("lines")
            lines.innerHTML = (item.lines ? item.lines.reduce((acc, value) => acc + "<span class=\"line\" style=\"background-color: " + value.color + ";\">" + value.text + "</span>", "") : ("<span class=\"loc\">" + (item.loc ? "<b>" + item.loc + "</b>, " + item.mun : item.mun) + "</span>"))
            if(b) suggestionItem.classList.add("a") 
            suggestionItem.textContent = item.name;
            suggestionItem.addEventListener('click', () => {
                el.value = item.name; 
                autocomplete.innerHTML = '';
                postSearch(item, item.school)
            });
            suggestionItem.appendChild(lines)
            autocomplete.appendChild(suggestionItem);
        });
    } else {
        autocoplete.classList.add("hidden")
    }
}