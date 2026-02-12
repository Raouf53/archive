/**
 * CONFIGURATION KULAC S.A.S ARCHIVAGE
 */
const CLIENT_ID = '88617063279-p6af2ckirmtd472u9emqap6kitlhtp3j.apps.googleusercontent.com'; 
const API_KEY = 'AIzaSyCq-MUwxpyht8DfHwySf_3MtgvJNqs17F8'; 

// SCOPE 'drive' permet de voir tous les fichiers, 'drive.file' seulement ceux créés par l'app
const SCOPES = 'https://www.googleapis.com/auth/drive'; 

let tokenClient;
let accessToken = null;

/**
 * 1. INITIALISATION DES BIBLIOTHÈQUES GOOGLE
 */
function gapiLoaded() {
    gapi.load('client', async () => {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
        });
        console.log("GAPI Client initialisé");
    });
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (resp) => {
            if (resp.error) {
                console.error("Erreur Google:", resp.error);
                return;
            }
            
            // ÉTAPE CRUCIALE : On enregistre le jeton
            accessToken = resp.access_token;
            console.log("Jeton reçu avec succès !");

            // On rafraîchit la liste des documents
            await listFiles();

            // Si un fichier était en attente de téléversement, on le lance
            const fileInput = document.getElementById('fileInput');
            if (fileInput && fileInput.files.length > 0) {
                uploadToDrive();
            }
        },
    });
}

// Ajoutez cette petite fonction pour vérifier l'état du jeton
function requestAccess() {
    if (!accessToken) {
        tokenClient.requestAccessToken({ prompt: '' });
    } else {
        listFiles();
    }
}

// Remplace toute la partie window.onload et les fonctions d'init par ce bloc :

window.onload = () => {
    if (typeof gapi !== 'undefined') gapiLoaded();
    if (typeof google !== 'undefined') gisLoaded();
    
    // On ne lance rien automatiquement, on attend que l'utilisateur clique sur le tableau
    const listContainer = document.getElementById('fileList');
    listContainer.innerHTML = '<tr><td colspan="4" class="p-10 text-center"><button onclick="tokenClient.requestAccessToken()" class="bg-blue-600 text-white px-4 py-2 rounded">Charger les documents</button></td></tr>';
};
    
    // Initialisation de la barre de recherche
    initSearch();

/**
 * 2. RÉCUPÉRER TOUTE LA LISTE DES DOCUMENTS (MAX 100)
 */
async function listFiles() {
    if (!accessToken) return;

    try {
        const response = await gapi.client.drive.files.list({
            'pageSize': 100, // Augmenté pour voir beaucoup de documents
            'fields': "files(id, name, mimeType, createdTime, description)",
            'q': "trashed = false", // Tous les fichiers non supprimés
            'orderBy': "createdTime desc" // Les plus récents d'abord
        });

        const files = response.result.files;
        const fileListElement = document.getElementById('fileList');
        if (!fileListElement) return;

        fileListElement.innerHTML = ''; 

        if (files && files.length > 0) {
            files.forEach(file => {
                const date = new Date(file.createdTime).toLocaleDateString('fr-FR');
                
                // Icônes personnalisées
                let icon = 'fa-file-alt';
                let color = 'text-gray-400';
                if(file.mimeType.includes('pdf')) { icon = 'fa-file-pdf'; color = 'text-red-500'; }
                else if(file.mimeType.includes('excel') || file.name.endsWith('.xlsx')) { 
                    icon = 'fa-file-excel'; color = 'text-green-600'; 
                }

                // Dans la boucle files.forEach de listFiles() :
                fileListElement.innerHTML += `
                    <tr class="hover:bg-blue-50 transition border-b border-gray-50">
                        <td class="p-5 flex items-center gap-4">
                            <div class="w-10 h-10 bg-gray-50 ${color} rounded-lg flex items-center justify-center">
                                <i class="fa ${icon} text-xl"></i>
                            </div>
                            <span class="font-medium text-gray-700">${file.name}</span>
                        </td>
                        <td class="p-5"><span class="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold uppercase">${file.description || 'Général'}</span></td>
                        <td class="p-5 text-gray-500 text-sm">${date}</td>
                        <td class="p-5 text-right space-x-2">
                            <button onclick="openPreview('${file.id}', '${file.name.replace(/'/g, "\\'")}')" class="text-green-600 hover:bg-green-100 p-2 rounded-lg transition" title="Aperçu">
                                <i class="fa fa-eye"></i>
                            </button>
                            
                            <button onclick="downloadFile('${file.id}')" class="text-blue-600 hover:bg-blue-100 p-2 rounded-lg transition" title="Télécharger">
                                <i class="fa fa-download"></i>
                            </button>
                            
                            <button onclick="deleteFile('${file.id}')" class="text-red-500 hover:bg-red-100 p-2 rounded-lg transition" title="Supprimer">
                                <i class="fa fa-trash"></i>
                            </button>
                        </td>
                    </tr>`;
            });
        } else {
            fileListElement.innerHTML = '<tr><td colspan="4" class="p-10 text-center text-gray-400 italic">Aucun document dans les archives.</td></tr>';
        }
    } catch (err) {
        console.error("Erreur listage Drive:", err);
        if (err.status === 401) tokenClient.requestAccessToken({ prompt: '' });
    }
    updateStorageQuota();
}

/**
 * 3. TÉLÉVERSER UN DOCUMENT
 */
async function uploadToDrive() {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files[0]) return alert("Sélectionnez un fichier !");
    
    const file = fileInput.files[0];
    const metadata = {
        name: document.getElementById('docName').value || file.name,
        mimeType: file.type,
        description: document.getElementById('docCat').value
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    try {
        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
            body: form
        });
        
        if (res.ok) {
            toggleModal(false);
            listFiles(); // Rafraîchir immédiatement la liste
        }
    } catch (err) { console.error("Erreur upload:", err); }
}

/**
 * 4. ACTIONS : SUPPRIMER ET TÉLÉCHARGER
 */
async function deleteFile(fileId) {
    if(confirm("Confirmez-vous la suppression de ce document de KULAC S.A.S ?")) {
        await gapi.client.drive.files.delete({ 'fileId': fileId });
        listFiles();
    }
}

async function downloadFile(fileId) {
    const response = await gapi.client.drive.files.get({
        fileId: fileId,
        fields: 'webViewLink'
    });
    window.open(response.result.webViewLink, '_blank');
}

/**
 * 5. BARRE DE RECHERCHE ET INTERFACE
 */
function initSearch() {
    const searchInput = document.querySelector('input[placeholder*="Rechercher"]');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const term = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#fileList tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(term) ? "" : "none";
            });
        });
    }
}

function toggleModal(show) {
    const m = document.getElementById('uploadModal');
    if(m) m.classList.toggle('hidden', !show);
}

// Gestion du formulaire d'envoi
const uploadForm = document.getElementById('uploadForm');
if (uploadForm) {
    uploadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        // On demande l'accès, le 'callback' de gisLoaded s'occupera de lancer l'upload
        tokenClient.requestAccessToken(); 
    });
}

/**
 * METTRE À JOUR LE COMPTEUR DE STOCKAGE
 */
async function updateStorageQuota() {
    try {
        // On demande les détails du stockage à Google
        const response = await gapi.client.drive.about.get({
            fields: 'storageQuota'
        });

        const quota = response.result.storageQuota;
        
        // Conversion de Bytes en Go (Gigaoctets)
        const usedGo = (quota.usage / (1024 ** 3)).toFixed(2);
        const limitGo = (quota.limit / (1024 ** 3)).toFixed(0);
        const percent = ((quota.usage / quota.limit) * 100).toFixed(1);

        // Mise à jour de l'affichage dans le badge bleu
        const storageElement = document.querySelector('.bg-blue-50.text-blue-700');
        if (storageElement) {
            storageElement.innerHTML = `<i class="fa fa-database mr-2"></i> Espace utilisé : ${usedGo} Go / ${limitGo} Go (${percent}%)`;
        }
    } catch (err) {
        console.error("Erreur quota storage:", err);
    }
}

/**
 * OUVRIR LA PRÉVISUALISATION
 */
function openPreview(fileId, fileName) {
    const modal = document.getElementById('previewModal');
    const frame = document.getElementById('previewFrame');
    const title = document.getElementById('previewTitle');
    
    // URL du lecteur Google Drive (mode aperçu)
    const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    
    title.innerText = fileName;
    frame.src = previewUrl;
    modal.classList.remove('hidden');
}

/**
 * FERMER LA PRÉVISUALISATION
 */
function closePreview() {
    const modal = document.getElementById('previewModal');
    const frame = document.getElementById('previewFrame');
    modal.classList.add('hidden');
    frame.src = ""; // On vide l'iframe pour stopper le chargement
}