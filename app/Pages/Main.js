
console.log("adios");

document.addEventListener('DOMContentLoaded', () => {
    updateDatalist(); // Cargar sugerencias al inicio

    // Analizar la URL actual
    const pathParts = window.location.pathname.split('/');
    // /summoner/LAN/Cristo/Salao
    // pathParts[0] = ""
    // pathParts[1] = "summoner"
    // pathParts[2] = "LAN"
    // pathParts[3] = "Cristo"
    // pathParts[4] = "Salao"

    if (pathParts[1] === 'summoner' && pathParts.length >= 5) {
        const region = pathParts[2];
        const gameName = decodeURIComponent(pathParts[3]);
        const tagline = decodeURIComponent(pathParts[4]);
        performSearch(region, gameName, tagline); // Realiza la búsqueda
    } else {
        // Si no hay invocador en la URL, asegúrate de que el formulario esté visible y limpio
        document.getElementById('Search01').value = '';
    }
});

async function performSearch(region, gameName, tagline) {
    const summonerInfoSection = document.getElementById('summoner-info');
    const profileIconImg = document.getElementById('profileIcon');
    const summonerNameH3 = document.getElementById('summonerName');
    const summonerLevelSpan = document.getElementById('summonerLevel');
    const errorMessageDiv = document.getElementById('error-message');
    const searchInput = document.getElementById('Search01'); // Referencia al input de búsqueda

    errorMessageDiv.style.display = 'none';
    summonerInfoSection.style.display = 'none';
    matchHistoryContainer.style.display = 'none';

    SearchMove();

    // Rellenar el campo de búsqueda con el valor actual si se ejecuta por URL
    if (searchInput.value !== `${gameName}#${tagline}`) {
        searchInput.value = `${gameName}#${tagline}`;
    }

    try {
        // CAMBIO: La URL de fetch ahora tiene '/api/'
        const res = await fetch(`/api/summoner/${region}/${encodeURIComponent(gameName)}/${encodeURIComponent(tagline)}`);

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`HTTP error! Status: ${res.status}, Message: ${errorText}`);
        }

        const data = await res.json();
        console.log("Datos del invocador recibidos:", data);

        if (data && data.name && data.summonerLevel && data.profileIconId !== undefined) {
            profileIconImg.src = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${data.profileIconId}.jpg`;
            summonerNameH3.textContent = data.name;
            summonerLevelSpan.textContent = data.summonerLevel;
            summonerInfoSection.style.display = 'block';

            fetchAndDisplayMatchHistory(data.puuid, region);
            
            //guardar sugerencia
            const fullRiotId = `${data.name}#${data.tagLine || 'SIN_TAG'}`;
            saveSearchToLocalStorage(fullRiotId);
            updateDatalist();


            const newUrl = `/summoner/${region}/${encodeURIComponent(data.name)}/${encodeURIComponent(data.tagLine || 'SIN_TAG')}`;
            // Puedes pasar 'data' como state si quieres evitar una llamada API si el usuario navega hacia atrás/adelante
            history.pushState(data, data.name, newUrl);
            document.title = `${data.name}#${data.tagLine || 'SIN_TAG'} - Apilol`; // Actualizar el título de la pestaña



        } else {
            errorMessageDiv.textContent = "Datos de invocador incompletos o inválidos.";
            errorMessageDiv.style.display = 'block';
            matchHistoryContainer.style.display = 'none';
        }
    } catch (err) {
        console.error("Error en la solicitud fetch:", err);
        errorMessageDiv.textContent = `Error al buscar invocador: ${err.message}`;
        errorMessageDiv.style.display = 'block';
        summonerInfoSection.style.display = 'none';
        matchHistoryContainer.style.display = 'none';
    }
}

// Historial

const matchHistoryContainer = document.getElementById('match-history');
const matchlistDiv = document.getElementById('match-list');

// Función para mapear la región de juego a la región continental
function getContinentalRegion(region) {
    const regionMap = {
        LAN: 'americas', LAS: 'americas', NA: 'americas', EUW: 'europe', EUNE: 'europe', KR: 'asia', JP: 'asia'
    };
    return regionMap[region.toUpperCase()];
}



// Función para obtener y mostrar el historial de partidas
async function fetchAndDisplayMatchHistory(puuid, region) {
    matchlistDiv.innerHTML = '<p>Cargando historial...</p>'; // Mensaje de carga
    matchHistoryContainer.style.display = 'block'; // Asegurarse de que el contenedor sea visible

    const continentalRegion = getContinentalRegion(region);
    if (!continentalRegion) {
        matchlistDiv.innerHTML = '<p style="color: red;">Región inválida para el historial de partidas.</p>';
        return;
    }

    try {
        const res = await fetch(`/api/match-history/${continentalRegion}/${puuid}`);
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`HTTP error! Status: ${res.status}, Message: ${errorText}`);
        }

        const matches = await res.json();
        console.log("Historial de partidas recibido:", matches);

        if (matches.length === 0) {
            matchlistDiv.innerHTML = '<p>No se encontraron partidas recientes.</p>';
            return;
        }

        matchlistDiv.innerHTML = ' '; // Limpiar el mensaje de carga


        let num = 1;
        matches.forEach(match => {
            
            const matchCard = document.createElement('div');

            matchCard.id = ('Cart'+num);
            matchCard.classList.add('match-card');
            matchCard.classList.add(match.win ? 'match-win' : 'match-loss'); // Clase para estilos de victoria/derrota
            
            const gameDate = new Date(match.gameCreation).toLocaleDateString('es-ES', {
                year: 'numeric', month: 'short', day: 'numeric'
            });
            const gameDurationMinutes = Math.floor(match.gameDuration / 60);
            const kda = `${match.kills}/${match.deaths}/${match.assists}`;

            let participantsHtml = '<div class="match-participants-grid">';

            const team1 = match.participants.slice(0, 5);
            const team2 = match.participants.slice(5, 10);


            participantsHtml += '<div class="team-column team-1">';
            team1.forEach(p => {
                
                const kda_p = `${p.kills}/${p.deaths}/${p.assists}`;
                participantsHtml += `
                    <div class="participant-row ${p.win ? 'participant-win' : 'participant-loss'}">
                        <img src="https://ddragon.leagueoflegends.com/cdn/14.11.1/img/champion/${p.championName}.png" alt="${p.championName}" class="participant-champion-icon">
                        <a class="participant-name" href="${p.profileUrl}" target="_blank">
                        ${p.riotIdGameName || p.summonerName} </a>
                        <span class="participant-kda">${kda_p}</span>
                    </div>
                `;
            });
            participantsHtml += '</div>'; // Cierra team-column team-1

            // Generar el HTML para el Equipo 2
            participantsHtml += '<div class="team-column team-2">';
            team2.forEach(p => {
                const kda_p = `${p.kills}/${p.deaths}/${p.assists}`;
                participantsHtml += `
                    <div class="participant-row ${p.win ? 'participant-win' : 'participant-loss'}">
                        <img src="https://ddragon.leagueoflegends.com/cdn/14.11.1/img/champion/${p.championName}.png" alt="${p.championName}" class="participant-champion-icon">
                        <a class="participant-name" href="${p.profileUrl}" target="_blank">
                        ${p.riotIdGameName || p.summonerName}</a>
                        <span class="participant-kda">${kda_p}</span>
                    </div>
                `;
            });
            participantsHtml += '</div>'; // Cierra team-column team-2

            participantsHtml += '</div>'; // Cierra match-participants-grid


            matchCard.innerHTML = `
                <div class="match-main-info">
                    <div class="match-outcome">${match.win ? 'VICTORIA' : 'DERROTA'}</div>
                        <div class="match-info">
                        <img src="https://ddragon.leagueoflegends.com/cdn/14.11.1/img/champion/${match.championName}.png" class="champion-icon">
                        <div class="match-details">
                            <span class="champion-name">${match.championName}</span>
                            <span class="game-mode">${match.gameMode}</span>
                            <span class="kda">${kda}</span>
                            <span class="date-duration">${gameDate} - ${gameDurationMinutes}m</span>
                        </div>
                    </div>
                </div>
                <div id = Parti${num} class="participants-section-${match.win ? 'VICTORIA' : 'DERROTA'}">
                    ${participantsHtml}
                </div>
            `;
            matchlistDiv.appendChild(matchCard);

            num ++;
            
        });

        

    } catch (err) {
        console.error("Error al obtener historial de partidas:", err);
        matchlistDiv.innerHTML = `<p style="color: red;">Error al cargar historial: ${err.message}</p>`;
    }
}





// MANEJAR EL ENVÍO DEL FORMULARIO
document.getElementById("buscar").addEventListener("submit", (e) => {
    e.preventDefault();

    const summonerInfoSection = document.getElementById('summoner-info');
    const errorMessageDiv = document.getElementById('error-message');
    


    let fullRiotId = e.target.children.Search01.value;
    const region = document.getElementById('RTag').textContent.replace('#', '').trim();

    let gameName;
    let tagline;

    const hashIndex = fullRiotId.lastIndexOf('#');
    if (hashIndex !== -1) {
        gameName = fullRiotId.substring(0, hashIndex);
        tagline = fullRiotId.substring(hashIndex + 1);
        errorMessageDiv.style.display = 'none';
        summonerInfoSection.style.display = 'none';

    } else {
        errorMessageDiv.textContent = "Por favor, introduce el nombre completo del invocador con su tagline (ej: Nombre#Tag).";
        errorMessageDiv.style.display = 'block';
        return;
    }

    performSearch(region, gameName, tagline); // Llama a la función reutilizable

    
    
});

//// Funcion para guardar Sugerencias

const MAX_SUGGESTIONS = 10; // Límite de sugerencias guardadas

function getSavedSearches() {
    const saved = localStorage.getItem('riotIdSearches');
    return saved ? JSON.parse(saved) : [];
}

function saveSearchToLocalStorage(riotId) {
    let searches = getSavedSearches();

    // Eliminar si ya existe para moverlo al principio
    searches = searches.filter(item => item !== riotId);

    // Añadir al principio
    searches.unshift(riotId);

    // Limitar el número de sugerencias
    if (searches.length > MAX_SUGGESTIONS) {
        searches = searches.slice(0, MAX_SUGGESTIONS);
    }

    localStorage.setItem('riotIdSearches', JSON.stringify(searches));
}

function updateDatalist() {
    const datalist = document.getElementById('summonerSuggestions');
    datalist.innerHTML = ''; // Limpiar sugerencias anteriores
    const searches = getSavedSearches();

    searches.forEach(riotId => {
        const option = document.createElement('option');
        option.value = riotId;
        datalist.appendChild(option);
    });
}

// MANEJAR LA CARGA INICIAL DE LA PÁGINA (si la URL ya tiene un invocador)



// MANEJAR LOS BOTONES DE NAVEGACIÓN DEL NAVEGADOR (atrás/adelante)
window.addEventListener('popstate', (event) => {
    // 'event.state' contendrá los datos que pasamos a pushState.
    // Si tienes datos, puedes usarlos para evitar otra llamada a la API.
    if (event.state) {
        console.log("Navegación popstate con estado:", event.state);
        // Aquí podrías rellenar la interfaz con event.state directamente
        // sin hacer otra llamada a performSearch si los datos son suficientes.
        const data = event.state;
        const summonerInfoSection = document.getElementById('summoner-info');
        const profileIconImg = document.getElementById('profileIcon');
        const summonerNameH3 = document.getElementById('summonerName');
        const summonerLevelSpan = document.getElementById('summonerLevel');
        const searchInput = document.getElementById('Search01');

        profileIconImg.src = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${data.profileIconId}.jpg`;
        summonerNameH3.textContent = data.name;
        summonerLevelSpan.textContent = data.summonerLevel;
        summonerInfoSection.style.display = 'block';
        searchInput.value = `${data.name}#${data.tagLine || 'SIN_TAG'}`;
        document.getElementById('RTag').textContent = data.region || document.getElementById('RTag').textContent; // Asegúrate de que 'region' esté en tu 'data' si quieres actualizar RTag
        
    } else {
        // Si no hay estado (ej. al navegar a la raíz o una página externa)
        console.log("Navegación popstate sin estado.");
        document.getElementById('summoner-info').style.display = 'none';
        document.getElementById('error-message').style.display = 'none';
        document.getElementById('Search01').value = '';
    }
});







// Animaciones
const searchBox = document.getElementById('search');
const Tbox = document.getElementById('Tbox');
const back = document.getElementById('BackButon');
const summonerInfoSection = document.getElementById('summoner-info');
const border = document.getElementById('Border');

function SearchMove() {

    back.style.opacity = '100%';
    searchBox.style.marginTop = '6%';
    Tbox.style.marginTop = '2%';
    border.style.marginTop = '5%';


}

back.addEventListener('click', function(e){

    e.preventDefault();
    document.getElementById('Search01').value = '';
    searchBox.style.marginTop = '18%';
    Tbox.style.marginTop = '23%';
    summonerInfoSection.style.display = 'none';
    matchHistoryContainer.style.display = 'none';
    back.style.opacity = '0%';
    border.style.marginTop = '24%';

})

document.addEventListener('click', function (e) {
    if(e.target.id === 'B1'){

        Aleatorizar();
    
    }

    function Aleatorizar(){

        
        
        const urls = [
            "/summoner/LAN/Cristo/salao",
            "/summoner/LAN/ÆGES/LAN",
            "/summoner/LAN/St1ff%20Y/LAN",
            "/summoner/LAN/BoySkrillero/LAN",
            "/summoner/LAN/FNC%20Revex/3005",
            "/summoner/LAN/kobi/Dior",
            "/summoner/LAN/jasotopu/1138",
            "/summoner/LAN/MC2005/123",
            "/summoner/LAN/lordxero/912"
        ];

        const randomIndex = Math.floor(Math.random() * urls.length);
        window.open(urls[randomIndex], "_blank");
        
    }


});

document.addEventListener('click', function (e) {
  if (e.target.id === 'Cart1') {
    const parti1 = document.getElementById('Parti1');
    const cart1 = document.getElementById('Cart1');

    const currentOpacity = window.getComputedStyle(parti1).opacity;
    const currentTransform = window.getComputedStyle(cart1).transform;

    parti1.style.opacity = (currentOpacity === '0') ? '1' : '0';
    
    if (currentTransform.includes('matrix')) {
      const values = currentTransform.match(/matrix.*\((.+)\)/)[1].split(', ');
      const x = parseFloat(values[4]); // valor de translateX en px
      cart1.style.transform = (x === 0) ? 'translateX(-105%)' : 'translateX(0%)';
    } else {
      cart1.style.transform = 'translateX(-105%)';
    }

  }
});


document.addEventListener('click', function (e) {
  if (e.target.id === 'Cart2') {
    const parti2 = document.getElementById('Parti2');
    const cart2 = document.getElementById('Cart2');

    const currentOpacity = window.getComputedStyle(parti2).opacity;
    const currentTransform = window.getComputedStyle(cart2).transform;

    parti2.style.opacity = (currentOpacity === '0') ? '1' : '0';
    
    if (currentTransform.includes('matrix')) {
      const values = currentTransform.match(/matrix.*\((.+)\)/)[1].split(', ');
      const x = parseFloat(values[4]); // valor de translateX en px
      cart2.style.transform = (x === 0) ? 'translateX(-105%)' : 'translateX(0%)';
    } else {
      cart2.style.transform = 'translateX(-105%)';
    }

  }
});


document.addEventListener('click', function (e) {
  if (e.target.id === 'Cart3') {
    const parti3 = document.getElementById('Parti3');
    const cart3 = document.getElementById('Cart3');

    const currentOpacity = window.getComputedStyle(parti3).opacity;
    const currentTransform = window.getComputedStyle(cart3).transform;

    parti3.style.opacity = (currentOpacity === '0') ? '1' : '0';
    
    if (currentTransform.includes('matrix')) {
      const values = currentTransform.match(/matrix.*\((.+)\)/)[1].split(', ');
      const x = parseFloat(values[4]); // valor de translateX en px
      cart3.style.transform = (x === 0) ? 'translateX(-105%)' : 'translateX(0%)';
    } else {
      cart3.style.transform = 'translateX(-105%)';
    }

  }
});


document.addEventListener('click', function (e) {
  if (e.target.id === 'Cart4') {
    const parti4 = document.getElementById('Parti4');
    const cart4 = document.getElementById('Cart4');

    const currentOpacity = window.getComputedStyle(parti4).opacity;
    const currentTransform = window.getComputedStyle(cart4).transform;

    parti4.style.opacity = (currentOpacity === '0') ? '1' : '0';
    
    if (currentTransform.includes('matrix')) {
      const values = currentTransform.match(/matrix.*\((.+)\)/)[1].split(', ');
      const x = parseFloat(values[4]); // valor de translateX en px
      cart4.style.transform = (x === 0) ? 'translateX(-105%)' : 'translateX(0%)';
    } else {
      cart4.style.transform = 'translateX(-105%)';
    }

  }
});


document.addEventListener('click', function (e) {
  if (e.target.id === 'Cart5') {
    const parti5 = document.getElementById('Parti5');
    const cart5 = document.getElementById('Cart5');

    const currentOpacity = window.getComputedStyle(parti5).opacity;
    const currentTransform = window.getComputedStyle(cart5).transform;

    parti5.style.opacity = (currentOpacity === '0') ? '1' : '0';
    
    if (currentTransform.includes('matrix')) {
      const values = currentTransform.match(/matrix.*\((.+)\)/)[1].split(', ');
      const x = parseFloat(values[4]); // valor de translateX en px
      cart5.style.transform = (x === 0) ? 'translateX(-105%)' : 'translateX(0%)';
    } else {
      cart5.style.transform = 'translateX(-105%)';
    }

  }
});