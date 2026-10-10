package com.chili.app;
import android.app.Activity;
import android.app.KeyguardManager;
import android.content.*;
import android.security.keystore.*;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import java.security.KeyStore;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name="AuthVault")
public class AuthVaultPlugin extends Plugin {
 private static final String ALIAS="chilli-vault-v1";
 private javax.crypto.SecretKey key() throws Exception {
  KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);
  if(!ks.containsAlias(ALIAS)){
   KeyGenerator g=KeyGenerator.getInstance("AES","AndroidKeyStore");
   g.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build());g.generateKey();
  }
  return (javax.crypto.SecretKey)ks.getKey(ALIAS,null);
 }
 private android.content.SharedPreferences prefs(){return getContext().getSharedPreferences("chilli-vault",Context.MODE_PRIVATE);}
 private String name(PluginCall c){return c.getString("name","venice-key");}
 private void saveValue(PluginCall c){
  try{
   String v=c.getString("value");if(v==null||v.length()>16384){c.reject("Invalid credential");return;}
   Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());
   String data=Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(cipher.doFinal(v.getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP);
   if(!prefs().edit().putString(name(c),data).commit())throw new Exception();
   JSObject o=new JSObject();o.put("saved",true);c.resolve(o);
  }catch(Exception e){c.reject("Could not save secure credential");}
 }
 private void loadValue(PluginCall c){
  try{
   String data=prefs().getString(name(c),null);JSObject o=new JSObject();o.put("found",data!=null);
   if(data!=null){String[] parts=data.split(":");Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));o.put("value",new String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),StandardCharsets.UTF_8));}
   c.resolve(o);
  }catch(Exception e){c.reject("Could not unlock secure credential");}
 }
 @PluginMethod public void markProvisioned(PluginCall c){
  try{String value=c.getString("value","");String revision=android.util.Base64.encodeToString(java.security.MessageDigest.getInstance("SHA-256").digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)),android.util.Base64.NO_WRAP);
   if(!getContext().getSharedPreferences("venice-provisioning",android.content.Context.MODE_PRIVATE).edit().putString("revision",revision).commit())throw new Exception();c.resolve();
  }catch(Exception e){c.reject("Could not mark credential provisioning");}
 }
 @PluginMethod public void loadProvisioned(PluginCall c){
  try(java.io.InputStream input=getContext().getAssets().open("venice-key.json")){
   java.io.ByteArrayOutputStream buffer=new java.io.ByteArrayOutputStream();byte[] chunk=new byte[1024];int count;
   while((count=input.read(chunk))!=-1){buffer.write(chunk,0,count);if(buffer.size()>2048)throw new Exception();}
   org.json.JSONObject record=new org.json.JSONObject(buffer.toString("UTF-8"));
   String value=record.optString("apiKey","");String revision=android.util.Base64.encodeToString(java.security.MessageDigest.getInstance("SHA-256").digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)),android.util.Base64.NO_WRAP);if(revision.equals(getContext().getSharedPreferences("venice-provisioning",android.content.Context.MODE_PRIVATE).getString("revision","")))value="";JSObject out=new JSObject();out.put("found",!value.isEmpty());if(!value.isEmpty())out.put("value",value);c.resolve(out);
  }catch(java.io.FileNotFoundException e){JSObject out=new JSObject();out.put("found",false);c.resolve(out);}
  catch(Exception e){c.reject("Could not load provisioned credential");}
 }
 @PluginMethod public void save(PluginCall c){saveValue(c);}
 @PluginMethod public void saveNamed(PluginCall c){saveValue(c);}
 @PluginMethod public void load(PluginCall c){loadValue(c);}
 @PluginMethod public void loadNamed(PluginCall c){loadValue(c);}
 @PluginMethod public void clear(PluginCall c){prefs().edit().remove(name(c)).apply();c.resolve();}
 @PluginMethod public void clearNamed(PluginCall c){clear(c);}
 @PluginMethod public void isAvailable(PluginCall c){KeyguardManager k=(KeyguardManager)getContext().getSystemService(Context.KEYGUARD_SERVICE);JSObject o=new JSObject();o.put("available",k.isDeviceSecure());o.put("biometric",false);c.resolve(o);}
 @PluginMethod public void gate(PluginCall c){
  getActivity().runOnUiThread(()->{KeyguardManager k=(KeyguardManager)getContext().getSystemService(Context.KEYGUARD_SERVICE);
   if(!k.isDeviceSecure()){JSObject o=new JSObject();o.put("unlocked",true);o.put("fallback",true);c.resolve(o);return;}
   Intent i=k.createConfirmDeviceCredentialIntent(c.getString("title","Unlock Chilli"),c.getString("subtitle","Confirm your screen lock"));if(i==null){c.reject("Device unlock is unavailable");return;}startActivityForResult(c,i,"gateResult");});
 }
 @ActivityCallback private void gateResult(PluginCall c,ActivityResult r){if(c==null)return;JSObject o=new JSObject();o.put("unlocked",r.getResultCode()==Activity.RESULT_OK);c.resolve(o);}
}
