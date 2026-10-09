package com.chili.app;
import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.speech.*;
import android.speech.tts.*;
import android.media.MediaPlayer;
import android.util.Base64;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.util.*;
import java.io.*;

@CapacitorPlugin(name="VoiceChat",permissions={@Permission(alias="microphone",strings={Manifest.permission.RECORD_AUDIO})})
public class VoiceChatPlugin extends Plugin {
 private SpeechRecognizer recognizer;
 private PluginCall listening,speaking;
 private TextToSpeech tts;
 private boolean ttsReady=false;
 private MediaPlayer player;
 @Override public void load(){getActivity().runOnUiThread(()->{tts=new TextToSpeech(getContext(),status->{ttsReady=status==TextToSpeech.SUCCESS;});tts.setOnUtteranceProgressListener(new UtteranceProgressListener(){public void onStart(String id){} public void onDone(String id){finishSpeech(null);} public void onError(String id){finishSpeech("Speech playback failed");}});});}
 private synchronized void finishSpeech(String error){PluginCall c=speaking;speaking=null;if(c!=null){if(error==null)c.resolve();else c.reject(error);}}
 @PluginMethod public void isAvailable(PluginCall c){JSObject o=new JSObject();o.put("available",SpeechRecognizer.isRecognitionAvailable(getContext()));o.put("ttsReady",ttsReady);c.resolve(o);}
 @PluginMethod public void listen(PluginCall c){
  if(getPermissionState("microphone")!=PermissionState.GRANTED){requestPermissionForAlias("microphone",c,"micResult");return;}
  startListen(c);
 }
 @PermissionCallback private void micResult(PluginCall c){if(getPermissionState("microphone")!=PermissionState.GRANTED){c.reject("Microphone permission is required");return;}startListen(c);}
 private void startListen(PluginCall c){getActivity().runOnUiThread(()->{
  if(!SpeechRecognizer.isRecognitionAvailable(getContext())){c.reject("Install or enable a speech recognition service");return;}
  if(listening!=null){c.reject("Already listening");return;}
  listening=c;recognizer=SpeechRecognizer.createSpeechRecognizer(getContext());
  recognizer.setRecognitionListener(new RecognitionListener(){
   public void onReadyForSpeech(Bundle b){}public void onBeginningOfSpeech(){}public void onRmsChanged(float r){}public void onBufferReceived(byte[] b){}public void onEndOfSpeech(){}public void onPartialResults(Bundle b){}public void onEvent(int t,Bundle b){}
   public void onError(int code){PluginCall p=listening;listening=null;if(p!=null)p.reject("Speech recognition failed ("+code+")");cleanupRecognizer();}
   public void onResults(Bundle b){PluginCall p=listening;listening=null;if(p!=null){ArrayList<String> texts=b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);if(texts==null||texts.isEmpty())p.reject("No speech recognized");else{JSObject o=new JSObject();o.put("text",texts.get(0));o.put("locale",c.getString("locale","en-US"));float[] confidence=b.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES);if(confidence!=null&&confidence.length>0)o.put("confidence",confidence[0]);p.resolve(o);}}cleanupRecognizer();}
  });
  Intent i=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);i.putExtra(RecognizerIntent.EXTRA_LANGUAGE,c.getString("locale","en-US"));i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,false);try{recognizer.startListening(i);}catch(Exception e){listening=null;cleanupRecognizer();c.reject("Could not start speech recognition");}
 });}
 private void cleanupRecognizer(){if(recognizer!=null){recognizer.destroy();recognizer=null;}}
 @PluginMethod public void cancelListening(PluginCall c){getActivity().runOnUiThread(()->{PluginCall p=listening;listening=null;if(recognizer!=null)recognizer.cancel();cleanupRecognizer();if(p!=null){JSObject o=new JSObject();o.put("text","");o.put("cancelled",true);p.resolve(o);}c.resolve();});}
 @PluginMethod public void speak(PluginCall c){getActivity().runOnUiThread(()->{
  if(!ttsReady){c.reject("Speech engine is not ready");return;}
  finishSpeech("Speech replaced");tts.stop();int status=tts.setLanguage(Locale.forLanguageTag(c.getString("locale","en-US")));if(status<0){c.reject("Requested voice language is unavailable");return;}
  tts.setSpeechRate(c.getFloat("rate",1.0f));tts.setPitch(c.getFloat("pitch",1.0f));speaking=c;
  if(tts.speak(c.getString("text",""),TextToSpeech.QUEUE_FLUSH,new Bundle(),c.getCallbackId())==TextToSpeech.ERROR)finishSpeech("Speech playback failed");
 });}
 @PluginMethod public void speakBinary(PluginCall c){getActivity().runOnUiThread(()->{try{
  finishSpeech("Speech replaced");if(player!=null){player.release();player=null;}
  File f=File.createTempFile("chilli-voice-",".audio",getContext().getCacheDir());try(FileOutputStream out=new FileOutputStream(f)){out.write(Base64.decode(c.getString("audioBase64",""),Base64.DEFAULT));}
  player=new MediaPlayer();player.setDataSource(f.getAbsolutePath());speaking=c;player.setOnCompletionListener(p->{p.release();player=null;f.delete();finishSpeech(null);});player.setOnErrorListener((p,w,e)->{p.release();player=null;f.delete();finishSpeech("Audio playback failed");return true;});player.prepare();player.start();
 }catch(Exception e){finishSpeech("Could not play audio");c.reject("Could not play audio");}});}
 @PluginMethod public void stopSpeaking(PluginCall c){getActivity().runOnUiThread(()->{if(tts!=null)tts.stop();if(player!=null){player.release();player=null;}finishSpeech(null);c.resolve();});}
 @Override protected void handleOnDestroy(){getActivity().runOnUiThread(()->{cleanupRecognizer();if(tts!=null)tts.shutdown();if(player!=null)player.release();finishSpeech("App closed");});}
}
