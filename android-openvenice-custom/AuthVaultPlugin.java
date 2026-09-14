package ai.openvenice.app;

import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.concurrent.Executor;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "AuthVault")
public class AuthVaultPlugin extends Plugin {
    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "openvenice.auth.vault.v1";
    private static final String PREFS = "openvenice_auth_vault";
    private static final String PREF_CT = "ciphertext";
    private static final String PREF_IV = "iv";

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, 0);
    }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(KEYSTORE);
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) {
            return ((KeyStore.SecretKeyEntry) keyStore.getEntry(KEY_ALIAS, null)).getSecretKey();
        }

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        generator.init(new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build());
        return generator.generateKey();
    }

    @PluginMethod
    public void save(PluginCall call) {
        String value = call.getString("value");
        if (value == null || value.trim().isEmpty()) {
            call.reject("Missing value");
            return;
        }

        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
            byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            prefs().edit()
                .putString(PREF_CT, Base64.encodeToString(encrypted, Base64.NO_WRAP))
                .putString(PREF_IV, Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                .apply();

            JSObject result = new JSObject();
            result.put("saved", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not save credential securely", error);
        }
    }

    @PluginMethod
    public void load(PluginCall call) {
        String ct = prefs().getString(PREF_CT, null);
        String iv = prefs().getString(PREF_IV, null);
        JSObject result = new JSObject();
        if (ct == null || iv == null) {
            result.put("found", false);
            call.resolve(result);
            return;
        }

        try {
            KeyStore keyStore = KeyStore.getInstance(KEYSTORE);
            keyStore.load(null);
            if (!keyStore.containsAlias(KEY_ALIAS)) {
                prefs().edit().clear().apply();
                result.put("found", false);
                call.resolve(result);
                return;
            }

            SecretKey key = ((KeyStore.SecretKeyEntry) keyStore.getEntry(KEY_ALIAS, null)).getSecretKey();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(
                Cipher.DECRYPT_MODE,
                key,
                new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP))
            );
            byte[] plaintext = cipher.doFinal(Base64.decode(ct, Base64.NO_WRAP));
            result.put("found", true);
            result.put("value", new String(plaintext, StandardCharsets.UTF_8));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not unlock saved credential", error);
        }
    }

    @PluginMethod
    public void clear(PluginCall call) {
        try {
            prefs().edit().clear().apply();
            KeyStore keyStore = KeyStore.getInstance(KEYSTORE);
            keyStore.load(null);
            if (keyStore.containsAlias(KEY_ALIAS)) keyStore.deleteEntry(KEY_ALIAS);
            JSObject result = new JSObject();
            result.put("cleared", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not clear saved credential", error);
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", true);
        result.put("storage", "Android Keystore");
        result.put("biometric", biometricStatus() == BiometricManager.BIOMETRIC_SUCCESS);
        call.resolve(result);
    }

    private int biometricStatus() {
        try {
            BiometricManager manager = BiometricManager.from(getContext());
            return manager.canAuthenticate(
                BiometricManager.Authenticators.BIOMETRIC_WEAK
                    | BiometricManager.Authenticators.DEVICE_CREDENTIAL);
        } catch (Throwable error) {
            // Some OEM builds throw from canAuthenticate (missing KeyguardManager
            // bindings etc.). Treat as unavailable rather than crashing the app.
            return BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE;
        }
    }

    /**
     * Premium lock gate: shows the platform BiometricPrompt (fingerprint, face,
     * or device credential fallback). The vault key itself stays independent of
     * biometric enrollment so re-enrolling a fingerprint never orphans saved
     * credentials; this gate is the front-door lock for the app shell.
     *
     * Armor: BiometricPrompt internals have crashed apps on new Android
     * releases (1.1.0 era bugs, OEM quirks). Any Throwable here falls OPEN —
     * the lock must never be able to kill the app.
     */
    @PluginMethod
    public void gate(PluginCall call) {
        try {
            android.app.Activity activity = getBridge() != null ? getBridge().getActivity() : null;
            if (!(activity instanceof FragmentActivity)) {
                // Fall open — the gate is a lock, not a launch requirement.
                JSObject result = new JSObject();
                result.put("unlocked", true);
                result.put("fallback", true);
                result.put("reason", "activity-unavailable");
                call.resolve(result);
                return;
            }

            int status = biometricStatus();
            if (status != BiometricManager.BIOMETRIC_SUCCESS) {
                // No usable authenticator (none enrolled, no lock screen, hardware
                // missing): fall open so the app is never bricked, and surface why.
                JSObject result = new JSObject();
                result.put("unlocked", true);
                result.put("fallback", true);
                result.put("status", status);
                call.resolve(result);
                return;
            }

            FragmentActivity fragmentActivity = (FragmentActivity) activity;
            Executor executor = ContextCompat.getMainExecutor(getContext());
            BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(call.getString("title", "Unlock OpenVenice"))
                .setSubtitle(call.getString("subtitle", ""))
                .setAllowedAuthenticators(
                    BiometricManager.Authenticators.BIOMETRIC_WEAK
                        | BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                .build();

            BiometricPrompt prompt = new BiometricPrompt(fragmentActivity, executor,
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        JSObject response = new JSObject();
                        response.put("unlocked", true);
                        call.resolve(response);
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, CharSequence errString) {
                        call.reject(errString != null ? errString.toString() : "Authentication failed");
                    }
                });
            prompt.authenticate(info);
        } catch (Throwable error) {
            // Never let biometric internals take the app down.
            JSObject result = new JSObject();
            result.put("unlocked", true);
            result.put("fallback", true);
            result.put("reason", error.getClass().getSimpleName());
            call.resolve(result);
        }
    }
}
