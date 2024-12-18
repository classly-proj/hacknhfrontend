import { loadDirections } from "./api/mapbox.js";

const bounds = [
    [-70.956425, 43.118725],
    [-70.894926, 43.154229],
];

mapboxgl.accessToken = "pk.eyJ1IjoiZHNjYXJiMjEiLCJhIjoiY2x0cnR3cWlqMGtmZzJucDU2eDR2eWpyMCJ9.nfk8bnbhwkUmEHDhKZv3zA";

document.addEventListener('DOMContentLoaded', function () {
    const buildModeButton = document.getElementById('buildmode');
    if (buildModeButton) {
        buildModeButton.addEventListener('click', function () {
            window.location.href = './openlayer.html';
        });
    }
});

const map = new mapboxgl.Map({
    container: "mapbox",
    style: "mapbox://styles/mapbox/streets-v12",
    zoom: 12,
    center: [-70.92560, 43.13401],
    maxBounds: bounds,
});

let watchId = null;
let currCoords = [-70.92560, 43.13401];
let endCoords = null;

function initLocationLayer(coords) {
    map.addLayer({
        id: 'location',
        type: 'circle',
        source: {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'Point',
                        coordinates: coords
                    }
                }]
            }
        },
        paint: {
            'circle-radius': 10,
            'circle-color': '#3887be'
        }
    });
}

function updateLocation(coords) {
    console.log("UPDATE")
    if (map.getSource('location')) {
        map.getSource('location').setData({
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'Point',
                    coordinates: coords
                }
            }]
        });
    }
}

function startWatchingLocation() {
    if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(position => {
            const { latitude, longitude } = position.coords;
            currCoords = [longitude, latitude];
            if (map.getLayer('location')) {
                updateLocation(currCoords);
                if (endCoords) {
                    loadRoute(currCoords, endCoords)
                }
            } else {
                initLocationLayer(currCoords);
            }
        }, error => {
            console.error("Geolocation error: ", error);
        }, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 5000
        });
    } else {
        console.error("Geolocation is not supported by this browser.");
    }
}

export async function loadRoute(start, end) {
    console.log("Loading route from", start, "to", end);
    const resp = await loadDirections(start[0], start[1], end[0], end[1]);

    if (!resp.ok) {
        console.error("Error loading directions:", resp.status);
        return;
    }

    const json = resp.data;
    const data = json.routes[0];
    const route = data.geometry.coordinates;
    const geojson = {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: route
        }
    };

    if (map.getSource('route')) {
        map.getSource('route').setData(geojson);
    } else {
        endCoords = end;
        map.addLayer({
            id: 'route',
            type: 'line',
            source: {
                type: 'geojson',
                data: geojson
            },
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#3887be',
                'line-width': 5,
                'line-opacity': 0.75
            }
        });
      }
}

export function removeRoute() {
    endCoords = null;
  if (map.getLayer('route')) {
      map.removeLayer('route');
      if (map.getSource('route')) {
          map.removeSource('route');
      }
  } else {
      console.log("Route not found");
  }
}

async function loadBuildings() {
    try {
        const response = await fetch('./data/buildings.json');
        const buildings = await response.json();
        const allFeatures = [];
        for (const floor in buildings.PCBE) {
            if (buildings.PCBE.hasOwnProperty(floor)) {
                buildings.PCBE[floor].forEach((entry) => {
                    allFeatures.push({
                        type: 'Feature',
                        properties: {
                            floor: floor
                        },
                        geometry: {
                            type: 'Point',
                            coordinates: entry.coordinates
                        }
                    });
                });
            }
        }

        const combinedData = {
            type: 'FeatureCollection',
            features: allFeatures
        };

        window.mapboxMap = map;

        if (!map.getSource('combined_buildings')) {
            map.addSource('combined_buildings', {
                type: 'geojson',
                data: combinedData
            });
        }

        if (!map.getLayer("buildings")) {
            map.addLayer({
                id: 'buildings',
                type: 'circle',
                source: 'combined_buildings',
                paint: {
                    'circle-radius': 8,
                    'circle-color': '#ff8c00'
                }
            });
        }

        sessionStorage.setItem("buildings", JSON.stringify(buildings));
        return buildings;
    } catch (error) {
        console.error('Error loading buildings:', error);
    }
}

export function getCurrCoords() {
    return currCoords;
}

export async function findEntrance(building) {
    const buildings = JSON.parse(sessionStorage.getItem("buildings"))
  console.log(building)
    return buildings[building].ground[0].coordinates;
}


map.on('load', async function () {
    startWatchingLocation();
    loadBuildings();
});

