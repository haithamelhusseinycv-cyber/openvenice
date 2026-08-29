package com.pv.androidfacefusion;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * Complete photo-focused model catalog for Android Face Fusion.
 * Model weights are downloaded on demand from upstream sources instead of
 * being redistributed inside the APK. This keeps the APK practical and
 * preserves upstream model licensing requirements.
 */
public final class ModelCatalog {
    private ModelCatalog() {}

    public static final class ModelFile {
        public final String name;
        public final String url;
        public ModelFile(String name, String url) {
            this.name = name;
            this.url = url;
        }
    }

    public static final class ModelPack {
        public final String id;
        public final String name;
        public final String category;
        public final String license;
        public final String note;
        public final boolean selectableSwapper;
        public final List<ModelFile> files;

        ModelPack(String id, String name, String category, String license,
                  String note, boolean selectableSwapper, ModelFile... files) {
            this.id = id;
            this.name = name;
            this.category = category;
            this.license = license;
            this.note = note;
            this.selectableSwapper = selectableSwapper;
            this.files = Collections.unmodifiableList(Arrays.asList(files));
        }
    }

    private static String hf(String version, String file) {
        return "https://huggingface.co/facefusion/models-" + version + "/resolve/main/" + file;
    }

    private static ModelFile f(String version, String file) {
        return new ModelFile(file, hf(version, file));
    }

    public static List<ModelPack> all() {
        List<ModelPack> p = new ArrayList<>();

        // Core / analysis models
        p.add(new ModelPack("analysis_retinaface", "RetinaFace 10G", "Detection", "InsightFace / non-commercial research",
                "FaceFusion detector model.", false, f("3.0.0", "retinaface_10g.onnx")));
        p.add(new ModelPack("analysis_scrfd", "SCRFD 2.5G", "Detection", "InsightFace / non-commercial research",
                "Lightweight FaceFusion detector model.", false, f("3.0.0", "scrfd_2.5g.onnx")));
        p.add(new ModelPack("analysis_yolo", "YOLO Face 8n", "Detection", "GPL-3.0",
                "Alternative face detector.", false, f("3.0.0", "yoloface_8n.onnx")));
        p.add(new ModelPack("analysis_yunet", "YuNet 2023 Mar", "Detection", "MIT",
                "OpenCV face detector.", false, f("3.4.0", "yunet_2023_mar.onnx")));
        p.add(new ModelPack("analysis_arcface", "ArcFace W600K R50", "Recognition", "InsightFace / non-commercial research",
                "FaceFusion identity embedding model.", false, f("3.0.0", "arcface_w600k_r50.onnx")));
        p.add(new ModelPack("analysis_2dfan4", "2DFAN4", "Landmarks", "See upstream metadata",
                "68-point face landmarker.", false, f("3.0.0", "2dfan4.onnx")));

        // Face swappers. Only INSwapper variants are wired to the present Android runtime.
        p.add(new ModelPack("blendswap_256", "BlendSwap 256", "Face swapper", "Non-Commercial",
                "Catalog/download pack; requires BlendSwap-specific Android processor.", false, f("3.0.0", "blendswap_256.onnx")));
        p.add(new ModelPack("ghost_1_256", "Ghost 1 256", "Face swapper", "Apache-2.0",
                "Catalog/download pack; requires Ghost-specific Android processor.", false,
                f("3.0.0", "ghost_1_256.onnx"), f("3.4.0", "crossface_ghost.onnx")));
        p.add(new ModelPack("ghost_2_256", "Ghost 2 256", "Face swapper", "Apache-2.0",
                "Catalog/download pack; requires Ghost-specific Android processor.", false,
                f("3.0.0", "ghost_2_256.onnx"), f("3.4.0", "crossface_ghost.onnx")));
        p.add(new ModelPack("ghost_3_256", "Ghost 3 256", "Face swapper", "Apache-2.0",
                "Catalog/download pack; requires Ghost-specific Android processor.", false,
                f("3.0.0", "ghost_3_256.onnx"), f("3.4.0", "crossface_ghost.onnx")));
        p.add(new ModelPack("hififace_unofficial_256", "HiFiFace Unofficial 256", "Face swapper", "Unknown",
                "Unknown model license; download only if you have rights to use it.", false,
                f("3.1.0", "hififace_unofficial_256.onnx"), f("3.4.0", "crossface_hififace.onnx")));
        p.add(new ModelPack("hyperswap_1a_256", "HyperSwap 1A 256", "Face swapper", "ResearchRAIL",
                "Catalog/download pack; requires HyperSwap-specific Android processor.", false, f("3.3.0", "hyperswap_1a_256.onnx")));
        p.add(new ModelPack("hyperswap_1b_256", "HyperSwap 1B 256", "Face swapper", "ResearchRAIL",
                "Catalog/download pack; requires HyperSwap-specific Android processor.", false, f("3.3.0", "hyperswap_1b_256.onnx")));
        p.add(new ModelPack("hyperswap_1c_256", "HyperSwap 1C 256", "Face swapper", "ResearchRAIL",
                "Catalog/download pack; requires HyperSwap-specific Android processor.", false, f("3.3.0", "hyperswap_1c_256.onnx")));
        p.add(new ModelPack("inswapper_128", "INSwapper 128", "Face swapper", "InsightFace license",
                "Fully supported by this Android build.", true, f("3.0.0", "inswapper_128.onnx")));
        p.add(new ModelPack("inswapper_128_fp16", "INSwapper 128 FP16", "Face swapper", "InsightFace license",
                "Fully supported alternate; smaller model and recommended for mobile.", true, f("3.0.0", "inswapper_128_fp16.onnx")));
        p.add(new ModelPack("simswap_256", "SimSwap 256", "Face swapper", "See upstream metadata",
                "Catalog/download pack; requires SimSwap-specific Android processor.", false,
                f("3.0.0", "simswap_256.onnx"), f("3.4.0", "crossface_simswap.onnx")));
        p.add(new ModelPack("simswap_unofficial_512", "SimSwap Unofficial 512", "Face swapper", "See upstream metadata",
                "Catalog/download pack; requires SimSwap-specific Android processor.", false,
                f("3.0.0", "simswap_unofficial_512.onnx"), f("3.4.0", "crossface_simswap.onnx")));
        p.add(new ModelPack("uniface_256", "UniFace 256", "Face swapper", "See upstream metadata",
                "Catalog/download pack; requires UniFace-specific Android processor.", false, f("3.0.0", "uniface_256.onnx")));

        // Face restoration / enhancement
        p.add(new ModelPack("codeformer", "CodeFormer", "Face enhancer", "S-Lab-1.0", "Face restoration model.", false, f("3.0.0", "codeformer.onnx")));
        p.add(new ModelPack("gfpgan_1.2", "GFPGAN 1.2", "Face enhancer", "Apache-2.0", "Face restoration model.", false, f("3.0.0", "gfpgan_1.2.onnx")));
        p.add(new ModelPack("gfpgan_1.3", "GFPGAN 1.3", "Face enhancer", "Apache-2.0", "Face restoration model.", false, f("3.0.0", "gfpgan_1.3.onnx")));
        p.add(new ModelPack("gfpgan_1.4", "GFPGAN 1.4", "Face enhancer", "Apache-2.0", "Face restoration model.", false, f("3.0.0", "gfpgan_1.4.onnx")));
        p.add(new ModelPack("gpen_bfr_256", "GPEN BFR 256", "Face enhancer", "Non-Commercial", "Face restoration model.", false, f("3.0.0", "gpen_bfr_256.onnx")));
        p.add(new ModelPack("gpen_bfr_512", "GPEN BFR 512", "Face enhancer", "Non-Commercial", "Face restoration model.", false, f("3.0.0", "gpen_bfr_512.onnx")));
        p.add(new ModelPack("gpen_bfr_1024", "GPEN BFR 1024", "Face enhancer", "Non-Commercial", "Large face restoration model.", false, f("3.0.0", "gpen_bfr_1024.onnx")));
        p.add(new ModelPack("gpen_bfr_2048", "GPEN BFR 2048", "Face enhancer", "Non-Commercial", "Very large face restoration model.", false, f("3.0.0", "gpen_bfr_2048.onnx")));
        p.add(new ModelPack("restoreformer_plus_plus", "RestoreFormer++", "Face enhancer", "Apache-2.0", "Face restoration model.", false, f("3.0.0", "restoreformer_plus_plus.onnx")));

        // Frame / image upscalers
        p.add(new ModelPack("clear_reality_x4", "ClearReality x4", "Frame enhancer", "Non-Commercial", "4x frame enhancer.", false, f("3.0.0", "clear_reality_x4.onnx")));
        p.add(new ModelPack("face_dat_x4", "FaceDAT x4", "Frame enhancer", "CC-BY-4.0", "4x frame enhancer.", false, f("3.5.0", "face_dat_x4.onnx")));
        p.add(new ModelPack("nomos8k_sc_x4", "Nomos8k SC x4", "Frame enhancer", "See upstream metadata", "4x frame enhancer.", false, f("3.0.0", "nomos8k_sc_x4.onnx")));
        p.add(new ModelPack("real_esrgan_x2", "Real-ESRGAN x2", "Frame enhancer", "BSD-3-Clause", "2x frame enhancer.", false, f("3.0.0", "real_esrgan_x2.onnx")));
        p.add(new ModelPack("real_esrgan_x2_fp16", "Real-ESRGAN x2 FP16", "Frame enhancer", "BSD-3-Clause", "Mobile-friendly FP16 2x enhancer.", false, f("3.0.0", "real_esrgan_x2_fp16.onnx")));
        p.add(new ModelPack("real_esrgan_x4", "Real-ESRGAN x4", "Frame enhancer", "BSD-3-Clause", "4x frame enhancer.", false, f("3.0.0", "real_esrgan_x4.onnx")));
        p.add(new ModelPack("real_esrgan_x4_fp16", "Real-ESRGAN x4 FP16", "Frame enhancer", "BSD-3-Clause", "Mobile-friendly FP16 4x enhancer.", false, f("3.0.0", "real_esrgan_x4_fp16.onnx")));
        p.add(new ModelPack("real_esrgan_x8", "Real-ESRGAN x8", "Frame enhancer", "BSD-3-Clause", "8x frame enhancer.", false, f("3.0.0", "real_esrgan_x8.onnx")));
        p.add(new ModelPack("real_esrgan_x8_fp16", "Real-ESRGAN x8 FP16", "Frame enhancer", "BSD-3-Clause", "FP16 8x frame enhancer.", false, f("3.0.0", "real_esrgan_x8_fp16.onnx")));
        p.add(new ModelPack("real_hatgan_x4", "Real-HAT-GAN x4", "Frame enhancer", "Apache-2.0", "4x frame enhancer.", false, f("3.0.0", "real_hatgan_x4.onnx")));
        p.add(new ModelPack("real_web_photo_x4", "Real Web Photo x4", "Frame enhancer", "CC-BY-4.0", "4x photographic enhancer.", false, f("3.1.0", "real_web_photo_x4.onnx")));
        p.add(new ModelPack("realistic_rescaler_x4", "Realistic Rescaler x4", "Frame enhancer", "WTFPL", "4x photographic enhancer.", false, f("3.1.0", "realistic_rescaler_x4.onnx")));
        p.add(new ModelPack("remacri_x4", "Remacri x4", "Frame enhancer", "See upstream metadata", "4x frame enhancer.", false, f("3.0.0", "remacri_x4.onnx")));
        p.add(new ModelPack("siax_x4", "Siax x4", "Frame enhancer", "See upstream metadata", "4x frame enhancer.", false, f("3.0.0", "siax_x4.onnx")));
        p.add(new ModelPack("span_kendata_x4", "SPAN Kendata x4", "Frame enhancer", "See upstream metadata", "4x frame enhancer.", false, f("3.0.0", "span_kendata_x4.onnx")));
        p.add(new ModelPack("swin2_sr_x4", "Swin2SR x4", "Frame enhancer", "See upstream metadata", "4x frame enhancer.", false, f("3.0.0", "swin2_sr_x4.onnx")));
        p.add(new ModelPack("tghq_face_x8", "TGHQ Face x8", "Frame enhancer", "See upstream metadata", "8x face-oriented frame enhancer.", false, f("3.0.0", "tghq_face_x8.onnx")));
        p.add(new ModelPack("ultra_sharp_x4", "UltraSharp x4", "Frame enhancer", "See upstream metadata", "4x sharpness enhancer.", false, f("3.0.0", "ultra_sharp_x4.onnx")));
        p.add(new ModelPack("ultra_sharp_2_x4", "UltraSharp 2 x4", "Frame enhancer", "Non-Commercial", "Newer 4x sharpness enhancer.", false, f("3.3.0", "ultra_sharp_2_x4.onnx")));

        return Collections.unmodifiableList(p);
    }
}
