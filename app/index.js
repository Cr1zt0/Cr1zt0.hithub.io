import express from "express";
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from "url";

// Define __dirname para módulos ES
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Carga las variables de entorno desde .env en el directorio raíz del proyecto
// (Asumiendo que .env está un nivel arriba de 'app')
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const apikey = process.env.RIOT_API_KEY;

// Verificación de la API Key
console.log("-----------------------------------------");
console.log("Estado de la API Key de Riot:");
console.log("Clave de API cargada en Node:", apikey ? "SÍ" : "NO");
if (apikey) {
    console.log("Fragmento de la clave:", apikey.substring(0, 5) + '...' + apikey.substring(apikey.length - 5));
} else {
    console.log("¡ADVERTENCIA! La clave de API de Riot no se ha cargado. Revisa tu archivo .env");
}
console.log("-----------------------------------------");


//server
const app = express();
app.set("port", 4000);


// 1. Servir archivos estáticos desde la carpeta 'Pages'
// Si Main.html y otros archivos están directamente aquí
app.use('/Pages', express.static(path.join(__dirname, 'Pages'))); // '/Pages' en la URL mapea a la carpeta real 'Pages'

// 2. Servir archivos estáticos desde la carpeta 'Resources'
// Si styles.css, Main.js, imágenes, etc., están directamente aquí



// 3. Ruta para la API de búsqueda
app.get('/api/summoner/:region/:gameName/:tagline', async (req, res) => {
    // ... (Tu código existente para la API de Riot Games) ...
    const { region, gameName, tagline } = req.params;

    console.log('Backend API - Buscando:', `${gameName}#${tagline}`, 'en Región de juego:', region);
    console.log('Backend API - API Key utilizada:', apikey ? apikey.substring(0, 5) + '...' : 'NO CARGADA');

    let puuid;
    let actualGameName;
    let actualTagLine;

    if (!apikey) {
        return res.status(500).send('API Key de Riot no cargada en el servidor.');
    }

    const continentalRegion = {
        LAN: 'americas', LAS: 'americas', NA: 'americas', EUW: 'europe', EUNE: 'europe', KR: 'asia', JP: 'asia'
    }[region.toUpperCase()];

    const specificRegionHost = {
        LAN: 'la1', LAS: 'la2', NA: 'na1', EUW: 'euw1', EUNE: 'eun1', KR: 'kr', JP: 'jp1'
    }[region.toUpperCase()];

    if (!continentalRegion || !specificRegionHost) {
        return res.status(400).send('Región inválida para el Riot ID o el invocador.');
    }

    try {
        const accountResponse = await fetch(`https://${continentalRegion}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagline)}`, {
            headers: { 'X-Riot-Token': apikey }
        });

        if (!accountResponse.ok) {
            const errorText = await accountResponse.text();
            console.error(`Backend API - Error Account API (${accountResponse.status}): ${errorText}`);
            return res.status(accountResponse.status).send(`Error al obtener Riot ID: ${errorText}`);
        }

        const accountData = await accountResponse.json();
        puuid = accountData.puuid;
        actualGameName = accountData.gameName;
        actualTagLine = accountData.tagLine;

    } catch (err) {
        console.error("Backend API - Error al consultar Riot Account API (catch block):", err);
        return res.status(500).send('Error interno del servidor al obtener Riot ID.');
    }

    try {
        const summonerResponse = await fetch(`https://${specificRegionHost}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`, {
            headers: { 'X-Riot-Token': apikey }
        });

        if (!summonerResponse.ok) {
            const errorText = await summonerResponse.text();
            console.error(`Backend API - Error Summoner API (${summonerResponse.status}): ${errorText}`);
            return res.status(summonerResponse.status).send(`Error al obtener datos de invocador: ${errorText}`);
        }

        const summonerData = await summonerResponse.json();



        const finalData = {
            ...summonerData,
            name: actualGameName,
            tagLine: actualTagLine,
        };

        res.json(finalData);

    } catch (err) {
        console.error("Backend API - Error al consultar Riot Summoner API (catch block):", err);
        res.status(500).send('Error interno del servidor al obtener datos de invocador.');
    }
});



app.get('/api/match-history/:continentalRegion/:puuid', async (req, res) => {
    const { continentalRegion, puuid } = req.params;
    const count = 5; // Número de partidas a obtener

    if (!apikey) {
        return res.status(500).send('API Key de Riot no cargada en el servidor.');
    }

    // Validación básica de la región continental
    const validContinentalRegions = ['americas', 'asia', 'europe'];
    if (!validContinentalRegions.includes(continentalRegion.toLowerCase())) {
        return res.status(400).send('Región continental inválida para el historial de partidas.');
    }

    try {
        // PASO 1: Obtener las IDs de las últimas partidas
        const matchIdsResponse = await fetch(`https://${continentalRegion}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?type=ranked&start=0&count=${count}`, { // Puedes cambiar 'type' a 'normal' o quitarlo para todos los tipos
            headers: { 'X-Riot-Token': apikey }
        });

        if (!matchIdsResponse.ok) {
            const errorText = await matchIdsResponse.text();
            console.error(`Backend API - Error Match IDs (${matchIdsResponse.status}): ${errorText}`);
            return res.status(matchIdsResponse.status).send(`Error al obtener IDs de partidas: ${errorText}`);
        }

        const matchIds = await matchIdsResponse.json();
        console.log(`Backend API - IDs de ${matchIds.length} partidas obtenidas.`);

        // PASO 2: Obtener detalles para cada partida
        const matchesDetails = await Promise.all(matchIds.map(async (matchId) => {
            const matchDetailsResponse = await fetch(`https://${continentalRegion}.api.riotgames.com/lol/match/v5/matches/${matchId}`, {
                headers: { 'X-Riot-Token': apikey }
            });

            if (!matchDetailsResponse.ok) {
                console.warn(`Backend API - Error al obtener detalles de la partida ${matchId} (${matchDetailsResponse.status}): ${await matchDetailsResponse.text()}`);
                return null; // Retorna null para partidas que fallaron, para filtrarlas después
            }
            return matchDetailsResponse.json();
        }));

        // Filtra los 'null' si hubo errores en alguna partida
        const validMatches = matchesDetails.filter(match => match !== null);

        // Formatear los datos para enviar al frontend
        // Solo enviamos los datos relevantes para el historial de partidas
        const formattedMatches = validMatches.map(match => {
            // El 'participant' que buscas es el del PUUID que se hizo la petición
            const mainParticipant = match.info.participants.find(p => p.puuid === puuid);

            if (!mainParticipant) {
                return null;
            }

            // Mapea la información de todos los participantes para enviarla al frontend
            const allParticipantsData = match.info.participants.map(p => ({
                summonerName: p.summonerName || 'Desconocido', // Puede que no siempre esté el nombre de invocador
                summonerTag: p.summonerTag || 'Desconocido',
                riotIdGameName: p.riotIdGameName || p.summonerName || 'Desconocido', // Nombre de Riot ID si está disponible (para nuevos sistemas)
                riotIdTagline: p.riotIdTagline || '', // Tagline de Riot ID
                championName: p.championName,
                kills: p.kills,
                deaths: p.deaths,
                assists: p.assists,
                win: p.win,
                profileIcon: p.profileIcon, // Icono de perfil del invocador
                // Añade los ítems si los quieres mostrar
                item0: p.item0,
                item1: p.item1,
                item2: p.item2,
                item3: p.item3,
                item4: p.item4,
                item5: p.item5,
                item6: p.item6, // Trinket
                // Puedes añadir más datos relevantes aquí
                totalDamageDealtToChampions: p.totalDamageDealtToChampions,
                goldEarned: p.goldEarned,
                wardsPlaced: p.wardsPlaced,
                visionWardsBoughtInGame: p.visionWardsBoughtInGame,

                profileUrl: `/summoner/LAN/${encodeURIComponent(p.riotIdGameName)}/${encodeURIComponent(p.riotIdTagline)}`
            }));

            return {
                gameId: match.metadata.matchId,
                gameMode: match.info.gameMode,
                gameType: match.info.gameType,
                gameCreation: match.info.gameCreation,
                gameDuration: match.info.gameDuration,
                // Información del participante principal
                championName: mainParticipant.championName,
                kills: mainParticipant.kills,
                deaths: mainParticipant.deaths,
                assists: mainParticipant.assists,
                win: mainParticipant.win,
                // NUEVO: Información de todos los participantes de la partida
                participants: allParticipantsData
            };
        }).filter(m => m !== null); // Elimina cualquier partida nula

        res.json(formattedMatches);


    } catch (err) {
        console.error("Backend API - Error al consultar Match History API:", err);
        res.status(500).send('Error interno del servidor al obtener el historial de partidas.');
    }
});






// 4. RUTAS PARA SERVIR EL SINGLE PAGE APPLICATION (SPA)
// Estas rutas capturarán CUALQUIER solicitud que NO haya sido manejada antes
// y servirán tu Main.html.
// ¡ESTAS DEBEN IR AL FINAL DE TUS RUTAS ESPECÍFICAS DE API Y STATIC!

app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'Pages', 'Main.html'));
});


// Inicia el servidor
app.listen(app.get("port"), () => {
    console.log("servidor corriendo en puerto", app.get("port"));
});