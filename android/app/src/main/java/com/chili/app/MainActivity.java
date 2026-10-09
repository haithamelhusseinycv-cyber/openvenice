package com.chili.app;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
 @Override public void onCreate(Bundle savedInstanceState) {
  registerPlugin(FaceFusionAgentPlugin.class);registerPlugin(AuthVaultPlugin.class);registerPlugin(MediaActionsPlugin.class);registerPlugin(VoiceChatPlugin.class);
  super.onCreate(savedInstanceState);
 }
}
