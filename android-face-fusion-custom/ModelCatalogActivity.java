package com.pv.androidfacefusion;

import android.app.AlertDialog;
import android.os.Bundle;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Model pack browser/downloader for the photo-focused Face Fusion catalog. */
public class ModelCatalogActivity extends AppCompatActivity {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private LinearLayout list;
    private TextView summary;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setTitle("Complete Models");

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(12), dp(12), dp(12), dp(12));

        TextView title = new TextView(this);
        title.setText("Face Fusion — Complete Model Catalog");
        title.setTextSize(22);
        title.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
        root.addView(title, new LinearLayout.LayoutParams(-1, -2));

        summary = new TextView(this);
        summary.setTextSize(13);
        summary.setPadding(0, dp(8), 0, dp(8));
        root.addView(summary, new LinearLayout.LayoutParams(-1, -2));

        TextView warning = new TextView(this);
        warning.setText("Models are downloaded on demand from upstream repositories. The full catalog is many gigabytes, so download only what you need. INSwapper 128 and INSwapper 128 FP16 are selectable in the current Android swap pipeline; other packs are stored for compatible processors and future adapters. Model licenses remain the responsibility of the user.");
        warning.setTextSize(12);
        warning.setPadding(dp(10), dp(10), dp(10), dp(10));
        root.addView(warning, new LinearLayout.LayoutParams(-1, -2));

        ScrollView scroll = new ScrollView(this);
        list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        scroll.addView(list, new ScrollView.LayoutParams(-1, -2));
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1f));

        setContentView(root);
        rebuildList();
    }

    private void rebuildList() {
        List<ModelCatalog.ModelPack> packs = ModelCatalog.all();
        int downloaded = 0;
        for (ModelCatalog.ModelPack p : packs) if (isDownloaded(p)) downloaded++;
        summary.setText(packs.size() + " packs in catalog • " + downloaded + " downloaded");

        list.removeAllViews();
        for (ModelCatalog.ModelPack pack : packs) list.addView(createPackCard(pack));
    }

    private View createPackCard(ModelCatalog.ModelPack pack) {
        MaterialCardView card = new MaterialCardView(this);
        card.setRadius(dp(10));
        card.setCardElevation(dp(2));
        LinearLayout.LayoutParams cp = new LinearLayout.LayoutParams(-1, -2);
        cp.setMargins(0, dp(6), 0, dp(6));
        card.setLayoutParams(cp);

        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(12), dp(10), dp(12), dp(10));
        card.addView(box);

        TextView name = new TextView(this);
        name.setText(pack.name);
        name.setTextSize(17);
        box.addView(name);

        TextView meta = new TextView(this);
        meta.setText(pack.category + " • " + pack.license + "\n" + pack.note);
        meta.setTextSize(12);
        box.addView(meta);

        TextView files = new TextView(this);
        StringBuilder fs = new StringBuilder("Files: ");
        for (int i = 0; i < pack.files.size(); i++) {
            if (i > 0) fs.append(", ");
            fs.append(pack.files.get(i).name);
        }
        files.setText(fs.toString());
        files.setTextSize(11);
        box.addView(files);

        ProgressBar progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setVisibility(View.GONE);
        box.addView(progress, new LinearLayout.LayoutParams(-1, dp(8)));

        LinearLayout buttons = new LinearLayout(this);
        buttons.setOrientation(LinearLayout.HORIZONTAL);
        box.addView(buttons, new LinearLayout.LayoutParams(-1, -2));

        MaterialButton download = new MaterialButton(this);
        download.setText(isDownloaded(pack) ? "Re-download" : "Download");
        buttons.addView(download, new LinearLayout.LayoutParams(0, -2, 1f));

        MaterialButton remove = new MaterialButton(this);
        remove.setText("Remove");
        remove.setEnabled(isDownloaded(pack));
        buttons.addView(remove, new LinearLayout.LayoutParams(0, -2, 1f));

        if (pack.selectableSwapper) {
            MaterialButton use = new MaterialButton(this);
            String selected = getSharedPreferences("model_settings", MODE_PRIVATE)
                    .getString("swapper_model", "inswapper_128.onnx");
            String fileName = pack.files.get(0).name;
            use.setText(fileName.equals(selected) ? "Selected" : "Use");
            use.setEnabled(isDownloaded(pack) && !fileName.equals(selected));
            buttons.addView(use, new LinearLayout.LayoutParams(0, -2, 1f));
            use.setOnClickListener(v -> {
                getSharedPreferences("model_settings", MODE_PRIVATE).edit()
                        .putString("swapper_model", fileName).apply();
                Toast.makeText(this, "Selected " + pack.name + ". Restart Face Fusion to apply.", Toast.LENGTH_LONG).show();
                rebuildList();
            });
        }

        download.setOnClickListener(v -> confirmAndDownload(pack, progress, download, remove));
        remove.setOnClickListener(v -> {
            for (ModelCatalog.ModelFile f : pack.files) {
                File local = new File(getFilesDir(), f.name);
                if (local.exists()) local.delete();
            }
            String selected = getSharedPreferences("model_settings", MODE_PRIVATE)
                    .getString("swapper_model", "inswapper_128.onnx");
            if (pack.selectableSwapper && pack.files.get(0).name.equals(selected)) {
                getSharedPreferences("model_settings", MODE_PRIVATE).edit()
                        .putString("swapper_model", "inswapper_128.onnx").apply();
            }
            rebuildList();
        });

        return card;
    }

    private void confirmAndDownload(ModelCatalog.ModelPack pack, ProgressBar progress,
                                    MaterialButton download, MaterialButton remove) {
        String msg = "Download " + pack.name + " from its upstream model repository?\n\nLicense: " + pack.license +
                "\n\nUse only where you have the necessary rights and consent.";
        new AlertDialog.Builder(this)
                .setTitle("Model license")
                .setMessage(msg)
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Download", (d, w) -> downloadPack(pack, progress, download, remove))
                .show();
    }

    private void downloadPack(ModelCatalog.ModelPack pack, ProgressBar progress,
                              MaterialButton download, MaterialButton remove) {
        download.setEnabled(false);
        remove.setEnabled(false);
        progress.setVisibility(View.VISIBLE);
        progress.setProgress(0);

        executor.execute(() -> {
            try {
                for (int i = 0; i < pack.files.size(); i++) {
                    ModelCatalog.ModelFile file = pack.files.get(i);
                    final int fileIndex = i;
                    downloadFile(file, pct -> {
                        int overall = (int) (((fileIndex + pct / 100.0) / pack.files.size()) * 100.0);
                        runOnUiThread(() -> progress.setProgress(overall));
                    });
                }
                runOnUiThread(() -> {
                    Toast.makeText(this, pack.name + " downloaded", Toast.LENGTH_SHORT).show();
                    rebuildList();
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    progress.setVisibility(View.GONE);
                    download.setEnabled(true);
                    Toast.makeText(this, "Download failed: " + e.getMessage(), Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    private interface ProgressCallback { void onProgress(int progress); }

    private void downloadFile(ModelCatalog.ModelFile model, ProgressCallback cb) throws Exception {
        File out = new File(getFilesDir(), model.name);
        Exception last = null;
        for (int attempt = 0; attempt < 5; attempt++) {
            try {
                long existing = out.exists() ? out.length() : 0L;
                HttpURLConnection conn = open(model.url, existing);
                int code = conn.getResponseCode();
                if (code == 416) {
                    conn.disconnect();
                    out.delete();
                    existing = 0;
                    conn = open(model.url, 0);
                    code = conn.getResponseCode();
                }
                boolean partial = code == 206;
                if (code != 200 && !partial) throw new Exception("HTTP " + code);
                long total = conn.getContentLengthLong();
                if (partial) total += existing;
                try (InputStream in = new BufferedInputStream(conn.getInputStream());
                     FileOutputStream fos = new FileOutputStream(out, partial)) {
                    byte[] buf = new byte[64 * 1024];
                    long done = partial ? existing : 0;
                    int n;
                    while ((n = in.read(buf)) >= 0) {
                        fos.write(buf, 0, n);
                        done += n;
                        if (total > 0) cb.onProgress((int) Math.min(100, done * 100 / total));
                    }
                    fos.flush();
                } finally {
                    conn.disconnect();
                }
                if (out.length() < 1024 * 1024L) throw new Exception("Downloaded file is unexpectedly small");
                return;
            } catch (Exception e) {
                last = e;
                Thread.sleep(1500L * (attempt + 1));
            }
        }
        throw last != null ? last : new Exception("Download failed");
    }

    private HttpURLConnection open(String initial, long offset) throws Exception {
        String current = initial;
        for (int redirects = 0; redirects < 10; redirects++) {
            HttpURLConnection c = (HttpURLConnection) new URL(current).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(60000);
            c.setReadTimeout(180000);
            c.setRequestProperty("User-Agent", "AndroidFaceFusion/CompleteModels");
            c.setRequestProperty("Accept-Encoding", "identity");
            if (offset > 0) c.setRequestProperty("Range", "bytes=" + offset + "-");
            int code = c.getResponseCode();
            if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                String next = c.getHeaderField("Location");
                c.disconnect();
                if (next == null) throw new Exception("Redirect without Location");
                current = new URL(new URL(current), next).toString();
                continue;
            }
            return c;
        }
        throw new Exception("Too many redirects");
    }

    private boolean isDownloaded(ModelCatalog.ModelPack pack) {
        for (ModelCatalog.ModelFile mf : pack.files) {
            File f = new File(getFilesDir(), mf.name);
            if (!f.exists() || f.length() < 1024 * 1024L) return false;
        }
        return true;
    }

    private int dp(int n) {
        return Math.round(n * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }
}
