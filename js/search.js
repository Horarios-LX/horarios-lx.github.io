const el = document.getElementById("search")
const autocoplete = document.getElementById('autocomplete');

el.addEventListener("focusin", () => {
    genAutocomplete()
});

el.addEventListener('input', function() {
    genAutocomplete()
});

let caches = {}

async function genAutocomplete() {
    preSearch()
    const query = el.value.toLowerCase();
    autocomplete.innerHTML = ''; // Clear previous suggestions

    if (query.length > 1) {
        autocoplete.classList.remove("hidden")
        let filteredSuggestions;
        let key = Object.keys(caches).find(a => query.startsWith(a.toLowerCase()));
        if(key) {
            filteredSuggestions = caches[key].filter(a => a.name.toLowerCase().startsWith(query.toLowerCase()) || a.name.toLowerCase().includes(query.toLowerCase()) || a.id.startsWith(query))
        } else {
            filteredSuggestions = (await fetch(CLOUDFLARED + "stop/autocomplete?stop=" + query).then(r => r.json()))
            caches[query.toLowerCase()] = filteredSuggestions;
        }
        filteredSuggestions.sort((a, b) => {
            if(a.name.toLowerCase().startsWith(query.toLowerCase()) && b.name.toLowerCase().startsWith(query.toLowerCase())) return a.name.localeCompare(b.name);
            if(a.name.toLowerCase().startsWith(query.toLowerCase()) && !b.name.toLowerCase().startsWith(query.toLowerCase())) return -1;
            if(!a.name.toLowerCase().startsWith(query.toLowerCase()) && b.name.toLowerCase().startsWith(query.toLowerCase())) return 1;
            return a.name.localeCompare(b.name);
        })
        let b = true;
        filteredSuggestions.forEach(item => {
            b = !b
            const suggestionItem = document.createElement('div');
            const lines = document.createElement('div');
            lines.classList.add("lines")
            lines.innerHTML = item.lines.reduce((acc, value) => acc + "<span class=\"line " + (value.startsWith("1") ? (shortLines.includes(value) ? "short" : "long") : "unknown") + "\">" + value + "</span>", "")
            if(b) suggestionItem.classList.add("a") 
            suggestionItem.textContent = item.name;
            suggestionItem.addEventListener('click', () => {
                el.value = item.name; 
                autocomplete.innerHTML = '';
                postSearch(item)
            });
            suggestionItem.appendChild(lines)
            autocomplete.appendChild(suggestionItem);
        });
    } else {
        autocoplete.classList.add("hidden")
    }
}