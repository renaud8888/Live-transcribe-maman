const LANGUAGE_NAMES = {
  fr: 'Français',
  en: 'Anglais',
  nl: 'Néerlandais',
  de: 'Allemand',
  es: 'Espagnol',
  it: 'Italien',
  pl: 'Polonais',
  pt: 'Portugais',
  ar: 'Arabe',
  tr: 'Turc',
  uk: 'Ukrainien',
  ja: 'Japonais',
  ko: 'Coréen',
  zh: 'Chinois'
};

const SPEECH_LANGS = {
  fr: 'fr-FR',
  en: 'en-US',
  nl: 'nl-NL',
  de: 'de-DE',
  es: 'es-ES',
  it: 'it-IT',
  pl: 'pl-PL',
  pt: 'pt-PT',
  ar: 'ar-SA',
  tr: 'tr-TR',
  uk: 'uk-UA',
  ja: 'ja-JP',
  ko: 'ko-KR',
  zh: 'zh-CN'
};

const DEFAULT_MESSAGES = [
  {
    id: 'wifi',
    title: 'Wi-Fi',
    fr: 'Le réseau Wi-Fi et le mot de passe sont indiqués dans le livret d’accueil.'
  },
  {
    id: 'breakfast',
    title: 'Petit-déjeuner',
    fr: 'Le petit-déjeuner est servi à l’horaire convenu ensemble.'
  },
  {
    id: 'checkout',
    title: 'Départ / check-out',
    fr: 'Le départ se fait avant 11 heures, sauf accord différent.'
  },
  {
    id: 'emergency',
    title: 'Urgence',
    fr: 'En cas d’urgence, appelez le 112 ou venez me chercher immédiatement.'
  }
];

const state = {
  uiState: 'ready',
  peerConnection: null,
  localStream: null,
  dataChannel: null,
  activeDirection: null,
  translatingFrom: null,
  debounceTimers: {},
  messages: [],
  activeDialogLanguage: null
};

const homeView = document.querySelector('#homeView');
const translateView = document.querySelector('#translateView');
const messagesView = document.querySelector('#messagesView');
const guestLanguageSelect = document.querySelector('#guestLanguage');
const accessCode = document.querySelector('#accessCode');
const openTranslateView = document.querySelector('#openTranslateView');
const openMessagesView = document.querySelector('#openMessagesView');
const translateLanguageLabel = document.querySelector('#translateLanguageLabel');
const messagesLanguageLabel = document.querySelector('#messagesLanguageLabel');
const guestPanelLanguage = document.querySelector('#guestPanelLanguage');
const statusBadge = document.querySelector('#statusBadge');
const statusText = document.querySelector('#statusText');
const hostText = document.querySelector('#hostText');
const guestText = document.querySelector('#guestText');
const hostSpeakButton = document.querySelector('#hostSpeakButton');
const guestSpeakButton = document.querySelector('#guestSpeakButton');
const readHostButton = document.querySelector('#readHostButton');
const readGuestButton = document.querySelector('#readGuestButton');
const clearHostButton = document.querySelector('#clearHostButton');
const clearGuestButton = document.querySelector('#clearGuestButton');
const messageCards = document.querySelector('#messageCards');
const saveMessagesButton = document.querySelector('#saveMessagesButton');
const toast = document.querySelector('#toast');
const guestDisplayDialog = document.querySelector('#guestDisplayDialog');
const guestDisplayLanguage = document.querySelector('#guestDisplayLanguage');
const guestDisplayTitle = document.querySelector('#guestDisplayTitle');
const guestDisplayText = document.querySelector('#guestDisplayText');
const guestDisplayFrench = document.querySelector('#guestDisplayFrench');
const closeGuestDisplayButton = document.querySelector('#closeGuestDisplayButton');
const speakGuestDisplayButton = document.querySelector('#speakGuestDisplayButton');
const remoteAudio = document.querySelector('#remoteAudio');

document.querySelectorAll('[data-go-home]').forEach((button) => {
  button.addEventListener('click', () => {
    stopTranslation('Arrêté');
    showView('home');
  });
});

openTranslateView.addEventListener('click', () => showView('translate'));
openMessagesView.addEventListener('click', () => showView('messages'));
guestLanguageSelect.addEventListener('change', handleLanguageChange);
accessCode.addEventListener('input', saveAccessCode);
hostSpeakButton.addEventListener('click', () => startTranslation('host-to-guest'));
guestSpeakButton.addEventListener('click', () => startTranslation('guest-to-host'));
readHostButton.addEventListener('click', () => speakText(hostText.value, 'fr'));
readGuestButton.addEventListener('click', () => speakText(guestText.value, guestLanguageSelect.value));
clearHostButton.addEventListener('click', () => clearPanel('host'));
clearGuestButton.addEventListener('click', () => clearPanel('guest'));
hostText.addEventListener('input', () => scheduleTextareaTranslation('host'));
guestText.addEventListener('input', () => scheduleTextareaTranslation('guest'));
hostText.addEventListener('blur', () => flushTextareaTranslation('host'));
guestText.addEventListener('blur', () => flushTextareaTranslation('guest'));
saveMessagesButton.addEventListener('click', () => {
  saveMessages();
  showToast('Message enregistré');
});
closeGuestDisplayButton.addEventListener('click', () => guestDisplayDialog.close());
speakGuestDisplayButton.addEventListener('click', () => {
  speakText(guestDisplayText.textContent, state.activeDialogLanguage || guestLanguageSelect.value);
});

restorePreferences();
state.messages = loadMessages();
updateLanguageLabels();
renderMessages();
updateUIState('ready');
registerServiceWorker();

function showView(viewName) {
  homeView.classList.toggle('is-active', viewName === 'home');
  translateView.classList.toggle('is-active', viewName === 'translate');
  messagesView.classList.toggle('is-active', viewName === 'messages');

  if (viewName === 'messages') renderMessages();
  if (viewName === 'translate') updateUIState(state.uiState);
}

async function startTranslation(direction) {
  clearDebounces();
  await stopTranslation(null);
  updateUIState('connecting', { direction });

  const guestLanguage = guestLanguageSelect.value;
  const sourceLanguage = direction === 'host-to-guest' ? 'fr' : guestLanguage;
  const targetLanguage = direction === 'host-to-guest' ? guestLanguage : 'fr';
  const outputArea = direction === 'host-to-guest' ? guestText : hostText;
  outputArea.value = 'Connexion au micro...';

  try {
    const localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    const sessionResponse = await fetch('/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction, sourceLanguage, targetLanguage })
    });
    const sessionPayload = await sessionResponse.json().catch(() => ({}));

    if (!sessionResponse.ok) throw new Error(readableServerError(sessionPayload));

    const clientSecret = sessionPayload.client_secret;
    if (!clientSecret) throw new Error('OpenAI n’a pas renvoyé de client secret temporaire.');

    const peerConnection = new RTCPeerConnection();
    const dataChannel = peerConnection.createDataChannel('oai-events');

    peerConnection.ontrack = (event) => {
      remoteAudio.srcObject = event.streams[0];
      remoteAudio.muted = true;
    };

    peerConnection.onconnectionstatechange = () => {
      if (['failed', 'disconnected'].includes(peerConnection.connectionState)) {
        updateUIState('error');
        showToast('Erreur réseau');
      }
    };

    dataChannel.addEventListener('message', handleRealtimeEvent);
    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    const answerResponse = await fetch('https://api.openai.com/v1/realtime/translations/calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${clientSecret}`,
        'Content-Type': 'application/sdp',
        'OpenAI-Beta': 'realtime=v1'
      },
      body: offer.sdp
    });

    if (!answerResponse.ok) {
      const message = await answerResponse.text();
      throw new Error(message || 'OpenAI a refusé l’appel WebRTC.');
    }

    const answerSdp = await answerResponse.text();
    await peerConnection.setRemoteDescription({ type: 'answer', sdp: answerSdp });

    state.peerConnection = peerConnection;
    state.localStream = localStream;
    state.dataChannel = dataChannel;
    state.activeDirection = direction;
    outputArea.value = direction === 'host-to-guest'
      ? 'Je vous écoute. La traduction apparaîtra ici.'
      : 'J’écoute l’invité. La traduction apparaîtra ici.';
    updateUIState(direction === 'host-to-guest' ? 'listeningHost' : 'listeningGuest', { direction });
    showToast('En écoute');
  } catch (error) {
    await stopTranslation(null);
    const message = readableClientError(error);
    updateUIState('error');
    showToast(message.includes('Micro') ? 'Micro refusé' : message);
    outputArea.value = '';
  }
}

async function stopTranslation(label) {
  if (state.dataChannel) state.dataChannel.close();
  if (state.peerConnection) {
    state.peerConnection.getSenders().forEach((sender) => sender.track?.stop());
    state.peerConnection.close();
  }
  if (state.localStream) state.localStream.getTracks().forEach((track) => track.stop());

  remoteAudio.srcObject = null;
  state.peerConnection = null;
  state.localStream = null;
  state.dataChannel = null;
  state.activeDirection = null;

  if (label) {
    updateUIState('stopped');
    showToast('Arrêté');
  }
}

function handleRealtimeEvent(event) {
  let payload;
  try {
    payload = JSON.parse(event.data);
  } catch {
    return;
  }

  const text =
    payload.delta ||
    payload.text ||
    payload.transcript ||
    payload.translation ||
    payload?.item?.content?.[0]?.text ||
    payload?.response?.output_text;

  if (typeof text === 'string' && text.trim()) {
    const outputArea = state.activeDirection === 'guest-to-host' ? hostText : guestText;
    const isDelta = payload.type?.includes('delta');
    outputArea.value = isDelta ? `${outputArea.value || ''}${text}` : text;
    updateUIState('translatingText');
    window.setTimeout(() => {
      if (state.activeDirection) {
        updateUIState(state.activeDirection === 'guest-to-host' ? 'listeningGuest' : 'listeningHost');
      }
    }, 600);
  }

  if (payload.type?.includes('error')) {
    updateUIState('error');
    showToast('Erreur réseau');
  }
}

function scheduleTextareaTranslation(source) {
  if (state.translatingFrom) return;
  window.clearTimeout(state.debounceTimers[source]);
  state.debounceTimers[source] = window.setTimeout(() => translateFromTextarea(source), 800);
}

function flushTextareaTranslation(source) {
  window.clearTimeout(state.debounceTimers[source]);
  translateFromTextarea(source);
}

async function translateFromTextarea(source) {
  const isHost = source === 'host';
  const sourceArea = isHost ? hostText : guestText;
  const targetArea = isHost ? guestText : hostText;
  const text = sourceArea.value.trim();

  if (!text || state.translatingFrom === source) return;

  const guestLanguage = guestLanguageSelect.value;
  const sourceLanguage = isHost ? 'fr' : guestLanguage;
  const targetLanguage = isHost ? guestLanguage : 'fr';

  state.translatingFrom = source;
  updateUIState('translatingText');

  try {
    const translation = await translateText(text, sourceLanguage, targetLanguage);
    targetArea.value = translation;
  } catch (error) {
    showToast(readableClientError(error).includes('réseau') ? 'Erreur réseau' : readableClientError(error));
    updateUIState('error');
  } finally {
    state.translatingFrom = null;
    if (state.uiState === 'translatingText') updateUIState('ready');
  }
}

async function translateText(text, sourceLanguage, targetLanguage) {
  const response = await fetch('/api/translate-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, sourceLanguage, targetLanguage })
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) throw new Error(readableServerError(payload));
  return payload.translation || '';
}

function updateUIState(nextState, options = {}) {
  state.uiState = nextState;
  const direction = options.direction || state.activeDirection;
  const labels = {
    ready: 'Prêt',
    connecting: 'Connexion',
    listeningHost: 'En écoute',
    listeningGuest: 'En écoute',
    translatingText: 'Traduction active',
    stopped: 'Arrêté',
    error: 'Erreur'
  };

  statusBadge.className = `status status-${nextState}`;
  statusText.textContent = labels[nextState] || 'Prêt';
  hostSpeakButton.classList.toggle('is-active', nextState === 'listeningHost' || direction === 'host-to-guest');
  guestSpeakButton.classList.toggle('is-active', nextState === 'listeningGuest' || direction === 'guest-to-host');
  hostSpeakButton.disabled = nextState === 'connecting';
  guestSpeakButton.disabled = nextState === 'connecting';
}

function renderMessages() {
  messageCards.innerHTML = '';
  const language = guestLanguageSelect.value;

  state.messages.slice(0, 4).forEach((message) => {
    const card = document.createElement('article');
    card.className = 'message-card';
    card.dataset.id = message.id;
    card.innerHTML = `
      <input class="message-title" value="${escapeAttribute(message.title)}" aria-label="Titre du message">
      <textarea class="message-french" rows="3" aria-label="Texte français">${escapeHtml(message.fr)}</textarea>
      <div class="message-translation" lang="${language}">${escapeHtml(message.translations?.[language] || '')}</div>
      <div class="message-actions">
        <button class="secondary-action translate-message" type="button">Traduire</button>
        <button class="secondary-action read-message" type="button">Lire</button>
        <button class="primary-action guest-action show-message" type="button">Afficher à l’invité</button>
      </div>
    `;

    const titleInput = card.querySelector('.message-title');
    const frenchInput = card.querySelector('.message-french');
    const translated = card.querySelector('.message-translation');

    titleInput.addEventListener('input', () => updateMessage(message.id, { title: titleInput.value }));
    frenchInput.addEventListener('input', () => updateMessage(message.id, { fr: frenchInput.value }));
    card.querySelector('.translate-message').addEventListener('click', () => translateMessage(message.id, card));
    card.querySelector('.read-message').addEventListener('click', () => speakText(translated.textContent, language));
    card.querySelector('.show-message').addEventListener('click', () => {
      showGuestDisplay({
        title: titleInput.value,
        text: translated.textContent,
        french: frenchInput.value,
        language
      });
    });
    messageCards.append(card);
  });
}

async function translateMessage(id, card) {
  const message = state.messages.find((item) => item.id === id);
  const language = guestLanguageSelect.value;
  const translated = card.querySelector('.message-translation');
  const button = card.querySelector('.translate-message');

  if (!message?.fr.trim()) return;

  button.disabled = true;
  translated.textContent = 'Traduction en cours...';
  updateUIState('translatingText');

  try {
    const translation = await translateText(message.fr, 'fr', language);
    message.translations = { ...(message.translations || {}), [language]: translation };
    translated.textContent = translation;
    saveMessages();
    showToast('Message enregistré');
  } catch (error) {
    translated.textContent = '';
    showToast('Erreur réseau');
    updateUIState('error');
  } finally {
    button.disabled = false;
    if (state.uiState === 'translatingText') updateUIState('ready');
  }
}

function updateMessage(id, values) {
  const message = state.messages.find((item) => item.id === id);
  if (!message) return;
  Object.assign(message, values);
  saveMessages();
}

function showGuestDisplay({ title, text, french, language }) {
  const cleanText = (text || '').trim();
  if (!cleanText) {
    showToast('Traduisez d’abord le message');
    return;
  }

  state.activeDialogLanguage = language;
  guestDisplayLanguage.textContent = LANGUAGE_NAMES[language] || 'Langue de l’invité';
  guestDisplayTitle.textContent = title || 'Message';
  guestDisplayText.textContent = cleanText;
  guestDisplayFrench.textContent = french || '';

  if (typeof guestDisplayDialog.showModal === 'function') {
    guestDisplayDialog.showModal();
  } else {
    showToast(cleanText);
  }
}

function clearPanel(panel) {
  if (panel === 'host') hostText.value = '';
  if (panel === 'guest') guestText.value = '';
  showToast('Traduction effacée');
}

function speakText(text, language) {
  const cleanText = (text || '').trim();
  if (!cleanText) return;

  if (!('speechSynthesis' in window)) {
    showToast('Lecture audio indisponible');
    updateUIState('error');
    return;
  }

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = SPEECH_LANGS[language] || language;
  utterance.rate = 0.92;
  utterance.onerror = () => showToast('Lecture audio indisponible');
  window.speechSynthesis.cancel();
  window.speechSynthesis.resume();
  window.speechSynthesis.speak(utterance);
  showToast('Lecture lancée');
}

function handleLanguageChange() {
  localStorage.setItem('gite.guestLanguage', guestLanguageSelect.value);
  updateLanguageLabels();
  renderMessages();
}

function saveAccessCode() {
  localStorage.setItem('gite.accessCode', accessCode.value);
}

function restorePreferences() {
  const storedLanguage = localStorage.getItem('gite.guestLanguage');
  const storedCode = localStorage.getItem('gite.accessCode');

  if (storedLanguage && LANGUAGE_NAMES[storedLanguage]) guestLanguageSelect.value = storedLanguage;
  if (storedCode) accessCode.value = storedCode;
}

function updateLanguageLabels() {
  const language = LANGUAGE_NAMES[guestLanguageSelect.value] || 'Anglais';
  translateLanguageLabel.textContent = language;
  messagesLanguageLabel.textContent = language;
  guestPanelLanguage.textContent = language;
}

function loadMessages() {
  const stored = localStorage.getItem('gite.messages');
  if (!stored) return DEFAULT_MESSAGES.map((message) => ({ ...message, translations: {} }));

  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return DEFAULT_MESSAGES.map((fallback, index) => ({
        ...fallback,
        ...(parsed[index] || {}),
        translations: parsed[index]?.translations || {}
      }));
    }
  } catch {
    localStorage.removeItem('gite.messages');
  }

  return DEFAULT_MESSAGES.map((message) => ({ ...message, translations: {} }));
}

function saveMessages() {
  localStorage.setItem('gite.messages', JSON.stringify(state.messages.slice(0, 4)));
}

function clearDebounces() {
  Object.values(state.debounceTimers).forEach((timer) => window.clearTimeout(timer));
  state.debounceTimers = {};
}

function showToast(message) {
  window.clearTimeout(showToast.timeoutId);
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.add('is-visible');
  showToast.timeoutId = window.setTimeout(() => {
    toast.classList.remove('is-visible');
    toast.hidden = true;
  }, 2200);
}

function readableServerError(payload) {
  return payload?.message || 'Erreur réseau';
}

function readableClientError(error) {
  const message = error?.message || '';
  if (message.includes('Permission denied') || message.includes('NotAllowedError')) return 'Micro refusé';
  if (message.includes('NotFoundError')) return 'Aucun micro trouvé';
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) return 'Erreur réseau';
  return message || 'Erreur réseau';
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('"', '&quot;');
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      console.info('Service worker indisponible, l’application continue sans cache.');
    });
  });
}
