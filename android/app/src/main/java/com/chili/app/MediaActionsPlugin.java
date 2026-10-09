package com.chili.app;
import android.Manifest;
import android.content.*;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.io.*;

@CapacitorPlugin(name="MediaActions", permissions={@Permission(alias="gallery", strings={Manifest.permission.WRITE_EXTERNAL_STORAGE})})
public class MediaActionsPlugin extends Plugin {
 private byte[] bytes(PluginCall c)throws Exception{
  String s=c.getString("imageUri","");
  if(!s.startsWith("data:image/")||!s.contains(";base64,")||s.length()>40*1024*1024)throw new IOException();
  return Base64.decode(s.substring(s.indexOf(",")+1),Base64.DEFAULT);
 }
 private String filename(PluginCall c){return c.getString("fileName","chilli-"+System.currentTimeMillis()+".png").replaceAll("[^A-Za-z0-9._-]","_");}
 private Uri cache(PluginCall c)throws Exception{
  File dir=new File(getContext().getCacheDir(),"shared-images");dir.mkdirs();
  File[] files=dir.listFiles();if(files!=null)for(File f:files)if(f.lastModified()<System.currentTimeMillis()-86400000)f.delete();
  File f=new File(dir,filename(c));try(FileOutputStream out=new FileOutputStream(f)){out.write(bytes(c));}
  return FileProvider.getUriForFile(getContext(),getContext().getPackageName()+".fileprovider",f);
 }
 @PermissionCallback private void galleryPermission(PluginCall c){if(getPermissionState("gallery")==PermissionState.GRANTED)saveImage(c);else c.reject("Gallery permission was not granted");}
 @PluginMethod public void saveImage(PluginCall c){
  if(Build.VERSION.SDK_INT<29 && getPermissionState("gallery")!=PermissionState.GRANTED){requestPermissionForAlias("gallery",c,"galleryPermission");return;}
  getBridge().execute(()->{Uri u=null;
   try{
    ContentValues v=new ContentValues();v.put(MediaStore.Images.Media.DISPLAY_NAME,filename(c));v.put(MediaStore.Images.Media.MIME_TYPE,c.getString("mimeType","image/png"));
    if(Build.VERSION.SDK_INT>=29){v.put(MediaStore.Images.Media.RELATIVE_PATH,"Pictures/Chilli");v.put(MediaStore.Images.Media.IS_PENDING,1);}
    u=getContext().getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,v);if(u==null)throw new IOException();
    try(OutputStream out=getContext().getContentResolver().openOutputStream(u)){if(out==null)throw new IOException();out.write(bytes(c));}
    if(Build.VERSION.SDK_INT>=29){v.clear();v.put(MediaStore.Images.Media.IS_PENDING,0);getContext().getContentResolver().update(u,v,null,null);}
    JSObject o=new JSObject();o.put("uri",u.toString());o.put("fileName",filename(c));o.put("destination","gallery");c.resolve(o);
   }catch(Exception e){if(u!=null)getContext().getContentResolver().delete(u,null,null);c.reject("Could not save image to gallery");}
  });
 }
 @PluginMethod public void shareImage(PluginCall c){
  getBridge().execute(()->{try{Uri u=cache(c);getActivity().runOnUiThread(()->{Intent i=new Intent(Intent.ACTION_SEND);i.setType(c.getString("mimeType","image/png"));i.putExtra(Intent.EXTRA_STREAM,u);i.setClipData(ClipData.newRawUri("Chilli image",u));i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);getActivity().startActivity(Intent.createChooser(i,"Share image"));c.resolve();});}catch(Exception e){c.reject("Could not share image");}});
 }
 @PluginMethod public void copyImage(PluginCall c){getBridge().execute(()->{try{Uri u=cache(c);getActivity().runOnUiThread(()->{((ClipboardManager)getContext().getSystemService(Context.CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newUri(getContext().getContentResolver(),"Chilli image",u));c.resolve();});}catch(Exception e){c.reject("Could not copy image");}});}
 @PluginMethod public void copyText(PluginCall c){((ClipboardManager)getContext().getSystemService(Context.CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("Chilli",c.getString("text","")));c.resolve();}
 @PluginMethod public void shareText(PluginCall c){getActivity().runOnUiThread(()->{Intent i=new Intent(Intent.ACTION_SEND);i.setType("text/plain");i.putExtra(Intent.EXTRA_TEXT,c.getString("text",""));getActivity().startActivity(Intent.createChooser(i,"Share"));c.resolve();});}
 @PluginMethod public void getLastCrash(PluginCall c){JSObject o=new JSObject();o.put("found",false);c.resolve(o);}
 @PluginMethod public void clearLastCrash(PluginCall c){c.resolve();}
}
