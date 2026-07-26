/*
  applock.js
  ----------
  Optional lock screen shown before the app's data is visible — biometric
  (Face ID / fingerprint, via WebAuthn) with a PIN as the required fallback
  (biometric hardware/support varies, so there's always a way in). Re-locks
  on every fresh load, and again if the app was in the background for more
  than a minute — matches "phone was lost/picked up" as the threat this is
  meant to cover.

  Important honesty check: this is a UI gate, not encryption. It stops
  someone picking up your already-unlocked phone from casually opening the
  app and seeing your data. It does not encrypt what's stored in IndexedDB —
  that protection still comes entirely from your phone's own lock screen
  (OS-level disk encryption). Nothing here should be described to the user
  as making the underlying data unreadable to a technical attacker with
  access to the unlocked device.
*/

const APPLOCK_ENABLED_KEY = 'budgeter_applock_enabled';
const APPLOCK_PIN_HASH_KEY = 'budgeter_applock_pin_hash';
const APPLOCK_BIOMETRIC_ID_KEY = 'budgeter_applock_biometric_credential_id';
const APPLOCK_REGRACE_MS = 60000; // re-lock if backgrounded longer than this

let appUnlockedThisSession = false;
let appLockHiddenAt = null;

/* ---------------- Storage helpers ---------------- */

function isAppLockEnabled() {
  return localStorage.getItem(APPLOCK_ENABLED_KEY) === 'true';
}

function hasPinSet() {
  return !!localStorage.getItem(APPLOCK_PIN_HASH_KEY);
}

function hasBiometricSet() {
  return !!localStorage.getItem(APPLOCK_BIOMETRIC_ID_KEY);
}

function disableAppLock() {
  localStorage.removeItem(APPLOCK_ENABLED_KEY);
  localStorage.removeItem(APPLOCK_PIN_HASH_KEY);
  localStorage.removeItem(APPLOCK_BIOMETRIC_ID_KEY);
}

/* ---------------- PIN (SHA-256 hash — a UI gate, not real encryption; see file header) ---------------- */

async function hashPin(pin) {
  const data = new TextEncoder().encode('budgeter-applock-pin::' + pin);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function setPin(pin) {
  localStorage.setItem(APPLOCK_PIN_HASH_KEY, await hashPin(pin));
}

async function verifyPin(pin) {
  const stored = localStorage.getItem(APPLOCK_PIN_HASH_KEY);
  if (!stored) return false;
  return (await hashPin(pin)) === stored;
}

/* ---------------- Biometric (WebAuthn platform authenticator) ----------------
   Needs a real HTTPS origin — won't work over file:// or on a device/browser
   without Face ID, fingerprint, or similar. Always feature-detect before
   offering it; never assume it's available.
*/

function arrayBufferToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToArrayBuffer(base64) {
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer;
}

async function isBiometricAvailable() {
  if (!window.PublicKeyCredential || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (e) {
    return false;
  }
}

async function registerBiometric() {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Budgeter' },
      user: { id: userId, name: 'budgeter-user', displayName: 'Budgeter' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
      timeout: 60000
    }
  });
  localStorage.setItem(APPLOCK_BIOMETRIC_ID_KEY, arrayBufferToBase64(credential.rawId));
}

async function verifyBiometric() {
  const credentialId = localStorage.getItem(APPLOCK_BIOMETRIC_ID_KEY);
  if (!credentialId) return false;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: base64ToArrayBuffer(credentialId), type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000
      }
    });
    return !!assertion;
  } catch (e) {
    return false; // user cancelled, or verification failed
  }
}

/* ---------------- Lock overlay ---------------- */

function showLockOverlay() {
  document.getElementById('applock-overlay').style.display = 'flex';
  document.getElementById('applock-error').style.display = 'none';
  document.getElementById('applock-pin-input').value = '';
  const biometricBtn = document.getElementById('applock-biometric-btn');
  if (hasBiometricSet()) {
    biometricBtn.style.display = '';
    tryBiometricUnlock();
  } else {
    biometricBtn.style.display = 'none';
    document.getElementById('applock-pin-input').focus();
  }
}

function hideLockOverlay() {
  document.getElementById('applock-overlay').style.display = 'none';
}

function unlockApp() {
  appUnlockedThisSession = true;
  hideLockOverlay();
  refreshCurrentView();
}

async function tryBiometricUnlock() {
  const ok = await verifyBiometric();
  if (ok) unlockApp();
}

function showLockError(key) {
  const el = document.getElementById('applock-error');
  el.textContent = t(key);
  el.style.display = '';
}

/* ---------------- Bootstrap + re-lock on return from background ---------------- */

function initAppLock() {
  if (!isAppLockEnabled() || !hasPinSet()) {
    hideLockOverlay();
    appUnlockedThisSession = true;
    refreshCurrentView();
    return;
  }
  showLockOverlay();

  document.getElementById('applock-biometric-btn').addEventListener('click', tryBiometricUnlock);
  document.getElementById('applock-pin-submit').addEventListener('click', async () => {
    const pin = document.getElementById('applock-pin-input').value;
    if (await verifyPin(pin)) unlockApp();
    else showLockError('applock.wrongPin');
  });
  document.getElementById('applock-pin-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('applock-pin-submit').click();
  });
}

document.addEventListener('visibilitychange', () => {
  if (!isAppLockEnabled() || !hasPinSet()) return;
  if (document.visibilityState === 'hidden') {
    appLockHiddenAt = Date.now();
  } else if (document.visibilityState === 'visible' && appLockHiddenAt) {
    const awayMs = Date.now() - appLockHiddenAt;
    appLockHiddenAt = null;
    if (awayMs > APPLOCK_REGRACE_MS) {
      appUnlockedThisSession = false;
      showLockOverlay();
    }
  }
});

/* ---------------- Settings page section ---------------- */

function startAppLockSetup() {
  openModal(t('modalTitle.setAppLockPin'), `
    <p class="ledger-meta">${t('settings.appLockSetupHint')}</p>
    <div class="form-field">
      <label>${t('settings.appLockNewPinLabel')}</label>
      <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" id="applock-setup-pin" placeholder="••••" />
    </div>
    <div class="form-field">
      <label>${t('settings.appLockConfirmPinLabel')}</label>
      <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" id="applock-setup-pin-confirm" placeholder="••••" />
    </div>
    <div class="form-actions">
      <button class="btn-secondary" id="applock-setup-cancel">Cancel</button>
      <button class="btn-primary" id="applock-setup-save">Save</button>
    </div>
  `);
  document.getElementById('applock-setup-cancel').addEventListener('click', closeModal);
  document.getElementById('applock-setup-save').addEventListener('click', async () => {
    const pin = document.getElementById('applock-setup-pin').value;
    const confirmPin = document.getElementById('applock-setup-pin-confirm').value;
    if (!pin || pin.length < 4) { alert(t('settings.appLockPinTooShort')); return; }
    if (pin !== confirmPin) { alert(t('settings.appLockPinMismatch')); return; }
    await setPin(pin);
    localStorage.setItem(APPLOCK_ENABLED_KEY, 'true');
    closeModal();
    showToast(t('toast.appLockEnabled'));
    renderAppLockSettings();
  });
}

function renderAppLockSettings() {
  const el = document.getElementById('applock-settings');
  const enabled = isAppLockEnabled() && hasPinSet();

  if (!enabled) {
    el.innerHTML = `<button class="btn-primary" id="applock-enable-btn">${t('settings.appLockEnable')}</button>`;
    document.getElementById('applock-enable-btn').addEventListener('click', startAppLockSetup);
    return;
  }

  isBiometricAvailable().then(available => {
    const biometricSet = hasBiometricSet();
    el.innerHTML = `
      <p class="ledger-meta">${t('settings.appLockStatusOn')}${biometricSet ? ' · ' + t('settings.appLockBiometricOn') : ''}</p>
      <div class="header-actions" style="margin-top:10px">
        ${available && !biometricSet ? `<button class="btn-secondary" id="applock-setup-biometric-btn">${t('settings.appLockSetUpBiometric')}</button>` : ''}
        <button class="btn-secondary" id="applock-change-pin-btn">${t('settings.appLockChangePin')}</button>
        <button class="btn-secondary" id="applock-disable-btn">${t('settings.appLockDisable')}</button>
      </div>
    `;
    const setupBtn = document.getElementById('applock-setup-biometric-btn');
    if (setupBtn) {
      setupBtn.addEventListener('click', async () => {
        try {
          await registerBiometric();
          showToast(t('toast.appLockBiometricSet'));
          renderAppLockSettings();
        } catch (e) {
          alert(t('settings.appLockBiometricFailed'));
        }
      });
    }
    document.getElementById('applock-change-pin-btn').addEventListener('click', startAppLockSetup);
    document.getElementById('applock-disable-btn').addEventListener('click', () => {
      if (confirm(t('settings.appLockDisableConfirm'))) {
        disableAppLock();
        showToast(t('toast.appLockDisabled'));
        renderAppLockSettings();
      }
    });
  });
}
