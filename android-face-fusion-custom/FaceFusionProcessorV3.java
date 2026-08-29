package com.pv.androidfacefusion;

import android.graphics.Bitmap;
import android.util.Log;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * v3 processor that uses the selected swapper's native FaceFusion alignment
 * template and resolution instead of assuming INSwapper 128 for every model.
 */
public class FaceFusionProcessor {
    private static final String TAG = "FaceFusionProcessorV3";

    private final FaceDetector faceDetector;
    private final FaceEmbedder faceEmbedder;
    private final FaceSwapper faceSwapper;

    public FaceFusionProcessor(FaceDetector detector, FaceEmbedder embedder, FaceSwapper swapper) {
        this.faceDetector = detector;
        this.faceEmbedder = embedder;
        this.faceSwapper = swapper;
    }

    private static final class SourceData {
        final float[] embedding;
        final Bitmap sourceFrame;
        SourceData(float[] embedding, Bitmap sourceFrame) {
            this.embedding = embedding;
            this.sourceFrame = sourceFrame;
        }
        void recycle() {
            if (sourceFrame != null && !sourceFrame.isRecycled()) sourceFrame.recycle();
        }
    }

    private SourceData prepareSource(Bitmap sourceImage) throws Exception {
        List<FaceDetector.Face> sourceFaces = faceDetector.detectFaces(sourceImage);
        if (sourceFaces.isEmpty()) {
            throw new Exception("No face detected in source image. Please use a clear source face.");
        }
        FaceDetector.Face sourceFace = sourceFaces.get(0);
        Bitmap recognitionFace = ImageUtils.alignFace(sourceImage, sourceFace.landmarks, 112);
        float[] rawEmbedding;
        try {
            rawEmbedding = faceEmbedder.getRawEmbedding(recognitionFace);
        } finally {
            recognitionFace.recycle();
        }

        Bitmap sourceFrame = null;
        if (faceSwapper.requiresSourceFrame()) {
            sourceFrame = ImageUtils.alignFaceTemplate(
                    sourceImage,
                    sourceFace.landmarks,
                    faceSwapper.getSourceTemplate(),
                    faceSwapper.getSourceSize());
        }
        return new SourceData(rawEmbedding, sourceFrame);
    }

    private Bitmap swapOne(Bitmap base, FaceDetector.Face targetFace,
                           float[] sourceEmbedding, Bitmap sourceFrame) throws Exception {
        int size = faceSwapper.getTargetSize();
        String template = faceSwapper.getTemplate();
        Bitmap alignedTarget = ImageUtils.alignFaceTemplate(base, targetFace.landmarks, template, size);
        Bitmap swapped = null;
        try {
            swapped = faceSwapper.swapFace(alignedTarget, sourceEmbedding, base, sourceFrame);
            return ImageUtils.blendFacesTemplate(base, swapped, targetFace.landmarks, template, size);
        } finally {
            alignedTarget.recycle();
            if (swapped != null && !swapped.isRecycled()) swapped.recycle();
        }
    }

    public Bitmap processFaceFusion(Bitmap sourceImage, Bitmap targetImage) throws Exception {
        return processFaceFusion(sourceImage, targetImage, 0);
    }

    public Bitmap processFaceFusion(Bitmap sourceImage, Bitmap targetImage,
                                    Set<Integer> selectedFaceIndices) throws Exception {
        if (selectedFaceIndices == null || selectedFaceIndices.isEmpty()) {
            return processFaceFusionMultiple(sourceImage, targetImage);
        }

        SourceData source = prepareSource(sourceImage);
        try {
            List<FaceDetector.Face> targetFaces = faceDetector.detectFaces(targetImage);
            if (targetFaces.isEmpty()) throw new Exception("No face detected in target image.");

            Bitmap result = targetImage.copy(Bitmap.Config.ARGB_8888, true);
            for (int i = 0; i < targetFaces.size(); i++) {
                if (!selectedFaceIndices.contains(i)) continue;
                Bitmap next = swapOne(result, targetFaces.get(i), source.embedding, source.sourceFrame);
                if (result != targetImage && !result.isRecycled()) result.recycle();
                result = next;
            }
            return result;
        } finally {
            source.recycle();
        }
    }

    public Bitmap processFaceFusion(Bitmap sourceImage, Bitmap targetImage, int targetFaceIndex) throws Exception {
        if (targetFaceIndex == -1) return processFaceFusionMultiple(sourceImage, targetImage);

        SourceData source = prepareSource(sourceImage);
        try {
            List<FaceDetector.Face> targetFaces = faceDetector.detectFaces(targetImage);
            if (targetFaces.isEmpty()) throw new Exception("No face detected in target image.");
            if (targetFaceIndex < 0 || targetFaceIndex >= targetFaces.size()) targetFaceIndex = 0;
            Log.d(TAG, "Using " + faceSwapper.getSelectedModel() + " on target face " + targetFaceIndex);
            return swapOne(targetImage, targetFaces.get(targetFaceIndex), source.embedding, source.sourceFrame);
        } finally {
            source.recycle();
        }
    }

    public Bitmap processFaceFusionMultiple(Bitmap sourceImage, Bitmap targetImage) throws Exception {
        SourceData source = prepareSource(sourceImage);
        try {
            List<FaceDetector.Face> targetFaces = faceDetector.detectFaces(targetImage);
            if (targetFaces.isEmpty()) throw new Exception("No face detected in target image.");

            Bitmap result = targetImage.copy(Bitmap.Config.ARGB_8888, true);
            for (FaceDetector.Face targetFace : targetFaces) {
                Bitmap next = swapOne(result, targetFace, source.embedding, source.sourceFrame);
                if (result != targetImage && !result.isRecycled()) result.recycle();
                result = next;
            }
            return result;
        } finally {
            source.recycle();
        }
    }

    /**
     * Face Library stores embeddings rather than source images. Embedding-based
     * swappers can use them. UniFace requires a source image, so Standard Swap
     * must be used for UniFace.
     */
    public Bitmap processFaceFusionWithMapping(Bitmap targetImage,
                                                Map<Integer, float[]> targetIndexToEmbeddingMap) throws Exception {
        if (targetIndexToEmbeddingMap == null || targetIndexToEmbeddingMap.isEmpty()) {
            throw new Exception("No target face mappings selected.");
        }
        if (faceSwapper.requiresSourceFrame()) {
            throw new Exception("UniFace requires the original source face image. Switch to Standard Swap for UniFace.");
        }

        List<FaceDetector.Face> targetFaces = faceDetector.detectFaces(targetImage);
        if (targetFaces.isEmpty()) throw new Exception("No face detected in target image.");

        Bitmap result = targetImage.copy(Bitmap.Config.ARGB_8888, true);
        for (int i = 0; i < targetFaces.size(); i++) {
            float[] embedding = targetIndexToEmbeddingMap.get(i);
            if (embedding == null) continue;
            Bitmap next = swapOne(result, targetFaces.get(i), embedding, null);
            if (result != targetImage && !result.isRecycled()) result.recycle();
            result = next;
        }
        return result;
    }

    public List<FaceDetector.Face> detectTargetFaces(Bitmap targetImage) throws Exception {
        return faceDetector.detectFaces(targetImage);
    }
}
