package ai.openvenice.app;

import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.PluginMethod;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

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
        call.resolve(result);
    }
}
