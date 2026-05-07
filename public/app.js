const LANGUAGE_NAMES = {
  fr: 'Français',
  en: 'Anglais',
  nl: 'Néerlandais',
  de: 'Allemand',
  es: 'Espagnol'
};

const SPEECH_LANGS = {
  fr: 'fr-FR',
  en: 'en-US',
  nl: 'nl-NL',
  de: 'de-DE',
  es: 'es-ES'
};

const QUICK_PHRASES = {
  wifi: {
    icon: 'Wi',
    label: 'Wi-Fi',
    fr: 'Le réseau Wi-Fi et le mot de passe sont indiqués dans le livret d’accueil.',
    translations: {
      en: 'The Wi-Fi network and password are shown in the welcome booklet.',
      nl: 'Het wifi-netwerk en het wachtwoord staan in het welkomstboekje.',
      de: 'Das WLAN-Netzwerk und das Passwort stehen in der Gästemappe.',
      es: 'La red Wi-Fi y la contraseña están indicadas en el folleto de bienvenida.'
    }
  },
  breakfast: {
    icon: '☕',
    label: 'Petit-déjeuner',
    fr: 'Le petit-déjeuner est servi à l’horaire convenu ensemble.',
    translations: {
      en: 'Breakfast is served at the time we agreed together.',
      nl: 'Het ontbijt wordt geserveerd op het tijdstip dat we samen hebben afgesproken.',
      de: 'Das Frühstück wird zu der gemeinsam vereinbarten Uhrzeit serviert.',
      es: 'El desayuno se sirve a la hora que acordamos juntos.'
    }
  },
  checkout: {
    icon: '11h',
    label: 'Check-out',
    fr: 'Le check-out se fait avant 11 heures, sauf accord différent.',
    translations: {
      en: 'Check-out is before 11 a.m., unless we agreed otherwise.',
      nl: 'Uitchecken is vóór 11 uur, tenzij we iets anders hebben afgesproken.',
      de: 'Der Check-out ist vor 11 Uhr, sofern nichts anderes vereinbart wurde.',
      es: 'La salida es antes de las 11, salvo que hayamos acordado otra cosa.'
    }
  },
  emergency: {
    icon: 'SOS',
    label: 'Urgence',
    fr: 'En cas d’urgence, appelez le 112 ou venez me chercher immédiatement.',
    translations: {
      en: 'In an emergency, call 112 or come and get me immediately.',
      nl: 'Bel bij noodgeval 112 of kom mij onmiddellijk halen.',
      de: 'Rufen Sie im Notfall 112 an oder holen Sie mich sofort.',
      es: 'En caso de emergencia, llame al 112 o venga a buscarme inmediatamente.'
    }
  }
};

const state = {
  peerConnection: null,
  localStream: null,
  dataChannel: null,
  activeDirection: null,
  currentQuickPhrase: null,
  uiState: 'ready',
  lastDisplayText: '',
  autoStopTimer: null
};

const accessCodeInput = document.querySelector('#accessCode');
const accessMenu = document.querySelector('#accessMenu');
const guestLanguageSelect = document.querySelector('#guestLanguage');
const hostToGuestButton = document.querySelector('#hostToGuestButton');
const guestToHostButton = document.querySelector('#guestToHostButton');
const stopButton = document.querySelector('#stopButton');
const statusBadge = document.querySelector('#statusBadge');
const statusText = document.querySelector('#statusText');
const subtitleText = document.querySelector('#subtitleText');
const subtitleDirection = document.querySelector('#subtitleDirection');
const errorMessage = document.querySelector('#errorMessage');
const quickPhraseButtons = document.querySelector('#quickPhraseButtons');
const quickPhraseResult = document.querySelector('#quickPhraseResult');
const quickTitle = document.querySelector('#quickTitle');
const quickFrench = document.querySelector('#quickFrench');
const quickLanguageLabel = document.querySelector('#quickLanguageLabel');
const quickTranslated = document.querySelector('#quickTranslated');
const speakQuickButton = document.querySelector('#speakQuickButton');
const showLargeButton = document.querySelector('#showLargeButton');
const showLiveLargeButton = document.querySelector('#showLiveLargeButton');
const clearSubtitleButton = document.querySelector('#clearSubtitleButton');
const hostDirectionLabel = document.querySelector('#hostDirectionLabel');
const guestDirectionLabel = document.querySelector('#guestDirectionLabel');
const liveTitle = document.querySelector('#liveTitle');
const listeningBadge = document.querySelector('#listeningBadge');
const closePhraseButton = document.querySelector('#closePhraseButton');
const toast = document.querySelector('#toast');
const guestDisplayDialog = document.querySelector('#guestDisplayDialog');
const guestDisplayLanguage = document.querySelector('#guestDisplayLanguage');
const guestDisplayText = document.querySelector('#guestDisplayText');
const closeGuestDisplayButton = document.querySelector('#closeGuestDisplayButton');
const speakGuestDisplayButton = document.querySelector('#speakGuestDisplayButton');
const remoteAudio = document.querySelector('#remoteAudio');

hostToGuestButton.addEventListener('click', () => startTranslation('host-to-guest'));
guestToHostButton.addEventListener('click', () => startTranslation('guest-to-host'));
stopButton.addEventListener('click', () => stopTranslation('Arrêté'));
guestLanguageSelect.addEventListener('change', handleLanguageChange);
accessCodeInput.addEventListener('change', () => {
  localStorage.setItem('gite.accessCode', accessCodeInput.value.trim());
  accessMenu.open = false;
  showToast('Code mémorisé');
});
accessCodeInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    localStorage.setItem('gite.accessCode', accessCodeInput.value.trim());
    accessMenu.open = false;
    accessCodeInput.blur();
    showToast('Code mémorisé');
  }
});
document.addEventListener('click', (event) => {
  if (accessMenu.open && !accessMenu.contains(event.target)) {
    accessMenu.open = false;
  }
});
quickFrench.addEventListener('input', () => {
  window.clearTimeout(quickFrench.translateTimeout);
  quickFrench.translateTimeout = window.setTimeout(translateEditedQuickPhrase, 650);
});
speakQuickButton.addEventListener('click', speakSelectedQuickPhrase);
showLargeButton.addEventListener('click', () => showGuestDisplay(quickTranslated.textContent, guestLanguageSelect.value));
showLiveLargeButton.addEventListener('click', () => showGuestDisplay(state.lastDisplayText, currentOutputLanguage()));
clearSubtitleButton.addEventListener('click', clearSubtitle);
closePhraseButton.addEventListener('click', closeQuickPhrase);
closeGuestDisplayButton.addEventListener('click', () => guestDisplayDialog.close());
speakGuestDisplayButton.addEventListener('click', speakGuestDisplay);

restorePreferences();
renderQuickPhraseButtons();
updateLanguageLabels();
updateUIState('ready');
registerServiceWorker();

async function startTranslation(direction) {
  clearError();
  updateUIState('connecting', { direction });
  showToast('Connexion au traducteur...');
  subtitleText.textContent = 'Connexion au micro et au service de traduction...';
  state.lastDisplayText = subtitleText.textContent;

  try {
    await stopTranslation(null);

    const guestLanguage = guestLanguageSelect.value;
    const sourceLanguage = direction === 'host-to-guest' ? 'fr' : guestLanguage;
    const targetLanguage = direction === 'host-to-guest' ? guestLanguage : 'fr';
    const localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    const sessionResponse = await fetch('/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accessCode: accessCodeInput.value.trim(),
        direction,
        sourceLanguage,
        targetLanguage
      })
    });

    const sessionPayload = await sessionResponse.json().catch(() => ({}));

    if (!sessionResponse.ok) {
      throw new Error(readableServerError(sessionPayload));
    }

    localStorage.setItem('gite.accessCode', accessCodeInput.value.trim());

    const clientSecret = sessionPayload.client_secret;
    if (!clientSecret) {
      throw new Error('OpenAI n’a pas renvoyé de client secret temporaire.');
    }

    const peerConnection = new RTCPeerConnection();
    const dataChannel = peerConnection.createDataChannel('oai-events');

    peerConnection.ontrack = (event) => {
      remoteAudio.srcObject = event.streams[0];
    };

    peerConnection.onconnectionstatechange = () => {
      if (['failed', 'disconnected'].includes(peerConnection.connectionState)) {
        showError('Problème de connexion. Vous pouvez arrêter puis relancer la traduction.');
        updateUIState('error');
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
    state.lastDisplayText = '';

    subtitleText.innerHTML = direction === 'host-to-guest'
      ? '<span>Je vous écoute. La traduction apparaîtra ici.</span>'
      : '<span>J’écoute l’invité. La traduction apparaîtra ici.</span>';
    updateUIState(direction === 'host-to-guest' ? 'listeningHost' : 'listeningGuest', { direction });
    scheduleAutoStop();
    showToast('Micro en écoute');
  } catch (error) {
    await stopTranslation(null);
    const message = readableClientError(error);
    updateUIState('error');
    showError(message);
    showToast(message);
  }
}

async function stopTranslation(label = 'Arrêté') {
  clearAutoStop();

  if (state.dataChannel) state.dataChannel.close();

  if (state.peerConnection) {
    state.peerConnection.getSenders().forEach((sender) => {
      if (sender.track) sender.track.stop();
    });
    state.peerConnection.close();
  }

  if (state.localStream) {
    state.localStream.getTracks().forEach((track) => track.stop());
  }

  remoteAudio.srcObject = null;
  state.peerConnection = null;
  state.localStream = null;
  state.dataChannel = null;
  state.activeDirection = null;

  if (label) {
    updateUIState('stopped');
    showToast('Session arrêtée');
  }
}

function scheduleAutoStop() {
  clearAutoStop();
  state.autoStopTimer = window.setTimeout(() => {
    stopTranslation('Arrêté');
    showToast('Arrêt automatique après 1 minute');
  }, 60_000);
}

function clearAutoStop() {
  if (!state.autoStopTimer) return;
  window.clearTimeout(state.autoStopTimer);
  state.autoStopTimer = null;
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
    const alreadyHasTranslation = Boolean(state.lastDisplayText.trim());
    subtitleText.textContent = payload.type?.includes('delta')
      ? `${alreadyHasTranslation ? subtitleText.textContent : ''}${text}`.trim()
      : text;
    state.lastDisplayText = subtitleText.textContent;
    liveTitle.textContent = 'Traduction';
  }

  if (payload.type?.includes('error')) {
    showError(payload.error?.message || 'Erreur OpenAI pendant la traduction.');
    updateUIState('error');
  }
}

function updateUIState(nextState, options = {}) {
  state.uiState = nextState;
  const direction = options.direction || state.activeDirection;
  const guestLanguage = guestLanguageSelect.value;
  const isHost = direction === 'host-to-guest';
  const isGuest = direction === 'guest-to-host';
  const statusLabels = {
    ready: 'Prêt',
    connecting: 'Connexion',
    listeningHost: 'Écoute',
    listeningGuest: 'Écoute',
    stopped: 'Arrêté',
    error: 'Erreur'
  };

  statusBadge.className = `status status-${nextState}`;
  statusText.textContent = statusLabels[nextState] || 'Prêt';
  stopButton.hidden = !['connecting', 'listeningHost', 'listeningGuest'].includes(nextState);

  hostToGuestButton.classList.toggle('is-active', nextState === 'listeningHost');
  guestToHostButton.classList.toggle('is-active', nextState === 'listeningGuest');
  hostToGuestButton.classList.toggle('is-loading', nextState === 'connecting' && isHost);
  guestToHostButton.classList.toggle('is-loading', nextState === 'connecting' && isGuest);
  hostToGuestButton.classList.toggle('is-muted', ['connecting', 'listeningGuest'].includes(nextState));
  guestToHostButton.classList.toggle('is-muted', ['connecting', 'listeningHost'].includes(nextState));

  if (nextState === 'ready') {
    liveTitle.textContent = 'Choisissez qui parle';
    subtitleDirection.textContent = 'En attente';
    listeningBadge.textContent = 'Micro prêt';
  }

  if (nextState === 'connecting') {
    liveTitle.textContent = 'Connexion au traducteur';
    subtitleDirection.textContent = isHost ? `FR → ${guestLanguage.toUpperCase()}` : `${guestLanguage.toUpperCase()} → FR`;
    listeningBadge.textContent = 'Connexion...';
  }

  if (nextState === 'listeningHost' || nextState === 'listeningGuest') {
    liveTitle.textContent = isHost ? 'Vous parlez' : 'L’invité parle';
    subtitleDirection.textContent = isHost ? `FR → ${guestLanguage.toUpperCase()}` : `${guestLanguage.toUpperCase()} → FR`;
    listeningBadge.textContent = 'Micro en écoute';
  }

  if (nextState === 'stopped') {
    liveTitle.textContent = 'Session arrêtée';
    subtitleDirection.textContent = 'Arrêté';
    listeningBadge.textContent = 'Micro prêt';
  }

  if (nextState === 'error') {
    liveTitle.textContent = 'Une action est nécessaire';
    listeningBadge.textContent = 'À vérifier';
  }

  listeningBadge.classList.toggle('is-live', ['listeningHost', 'listeningGuest'].includes(nextState));
}

function renderQuickPhraseButtons() {
  quickPhraseButtons.innerHTML = '';

  Object.entries(QUICK_PHRASES).forEach(([key, phrase]) => {
    const button = document.createElement('button');
    const preview = phrase.fr.length > 54 ? `${phrase.fr.slice(0, 54)}...` : phrase.fr;
    button.type = 'button';
    button.dataset.key = key;
    button.dataset.icon = phrase.icon;
    button.innerHTML = `<span><strong>${phrase.label}</strong><small>${preview}</small></span>`;
    button.addEventListener('click', () => {
      state.currentQuickPhrase = key;
      renderSelectedQuickPhrase();
    });
    quickPhraseButtons.append(button);
  });
}

function renderSelectedQuickPhrase() {
  if (!state.currentQuickPhrase) return;

  const language = guestLanguageSelect.value;
  const phrase = QUICK_PHRASES[state.currentQuickPhrase];
  quickTitle.value = phrase.label;
  quickFrench.value = phrase.fr;
  quickLanguageLabel.textContent = LANGUAGE_NAMES[language];
  quickTranslated.textContent = phrase.translations[language] || phrase.translations.en;
  quickPhraseResult.hidden = false;

  quickPhraseButtons.querySelectorAll('button').forEach((button) => {
    button.classList.toggle('is-selected', button.dataset.key === state.currentQuickPhrase);
  });

  quickPhraseResult.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function speakSelectedQuickPhrase() {
  speakText(quickTranslated.textContent, guestLanguageSelect.value);
  showToast('Lecture lancée');
}

async function translateEditedQuickPhrase() {
  const text = quickFrench.value.trim();
  const language = guestLanguageSelect.value;

  if (!text) {
    quickTranslated.textContent = '';
    return;
  }

  if (state.currentQuickPhrase) {
    const phrase = QUICK_PHRASES[state.currentQuickPhrase];
    if (text === phrase.fr) {
      quickTranslated.textContent = phrase.translations[language] || phrase.translations.en;
      return;
    }
  }

  quickTranslated.textContent = 'Traduction en cours...';

  try {
    const response = await fetch('/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accessCode: accessCodeInput.value.trim(),
        text,
        targetLanguage: language
      })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(readableServerError(payload));
    }

    quickTranslated.textContent = payload.translation || 'Traduction indisponible.';
  } catch (error) {
    quickTranslated.textContent = 'Impossible de retraduire pour le moment.';
    showToast(readableClientError(error));
  }
}

function closeQuickPhrase() {
  quickPhraseResult.hidden = true;
  state.currentQuickPhrase = null;
  quickPhraseButtons.querySelectorAll('button').forEach((button) => button.classList.remove('is-selected'));
}

function clearSubtitle() {
  subtitleText.innerHTML = '<span>La traduction s’affichera ici.</span>';
  state.lastDisplayText = '';
  showToast('Traduction effacée');
}

function showGuestDisplay(text, language) {
  const cleanText = (text || '').trim();
  if (!cleanText) {
    showToast('Aucune phrase à afficher');
    return;
  }

  const title = quickTitle?.value?.trim();
  guestDisplayLanguage.textContent = title || LANGUAGE_NAMES[language] || 'Traduction';
  guestDisplayText.textContent = cleanText;
  guestDisplayText.dataset.language = language;

  if (typeof guestDisplayDialog.showModal === 'function') {
    guestDisplayDialog.showModal();
  } else {
    showToast(cleanText);
  }
}

function speakGuestDisplay() {
  speakText(guestDisplayText.textContent, guestDisplayText.dataset.language || guestLanguageSelect.value);
  showToast('Lecture lancée');
}

function speakText(text, language) {
  if (!text) return;

  if (!('speechSynthesis' in window)) {
    const message = 'La lecture à voix haute du navigateur n’est pas disponible sur cet appareil.';
    showError(message);
    showToast(message);
    updateUIState('error');
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = SPEECH_LANGS[language] || language;
  utterance.rate = 0.92;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function handleLanguageChange() {
  localStorage.setItem('gite.guestLanguage', guestLanguageSelect.value);
  updateLanguageLabels();
  renderSelectedQuickPhrase();
  updateUIState(state.uiState);
}

function restorePreferences() {
  const storedLanguage = localStorage.getItem('gite.guestLanguage');
  const storedCode = localStorage.getItem('gite.accessCode');

  if (storedLanguage && LANGUAGE_NAMES[storedLanguage]) {
    guestLanguageSelect.value = storedLanguage;
  }

  if (storedCode) {
    accessCodeInput.value = storedCode;
  }
}

function updateLanguageLabels() {
  const language = LANGUAGE_NAMES[guestLanguageSelect.value] || 'Anglais';
  hostDirectionLabel.textContent = `Français → ${language}`;
  guestDirectionLabel.textContent = `${language} → Français`;
}

function currentOutputLanguage() {
  if (state.activeDirection === 'guest-to-host') return 'fr';
  return guestLanguageSelect.value;
}

function clearError() {
  errorMessage.hidden = true;
  errorMessage.textContent = '';
}

function showError(message) {
  errorMessage.textContent = `${message} Vérifiez le code, autorisez le micro, puis réessayez.`;
  errorMessage.hidden = false;
}

function showToast(message) {
  window.clearTimeout(showToast.timeoutId);
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.add('is-visible');
  showToast.timeoutId = window.setTimeout(() => {
    toast.classList.remove('is-visible');
    toast.hidden = true;
  }, 2400);
}

function readableServerError(payload) {
  if (payload?.error === 'ACCESS_CODE_INVALID') {
    return 'Code d’accès incorrect.';
  }

  if (payload?.message) {
    return payload.message;
  }

  return 'Problème de connexion avec le serveur.';
}

function readableClientError(error) {
  const message = error?.message || '';

  if (message.includes('Permission denied') || message.includes('NotAllowedError')) {
    return 'Micro refusé.';
  }

  if (message.includes('Requested device not found') || message.includes('NotFoundError')) {
    return 'Aucun micro trouvé sur cet appareil.';
  }

  if (message.includes('Code d’accès incorrect')) {
    return 'Code d’accès incorrect.';
  }

  if (message.includes('OpenAI')) {
    return `Erreur OpenAI : ${message}`;
  }

  return message || 'Problème de connexion.';
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      console.info('Service worker indisponible, l’application continue sans cache.');
    });
  });
}
